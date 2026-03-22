export type BacklogProfile = {
  id: number;
  name: string;
  userId?: string;
  mailAddress?: string;
  roleType?: number;
  lang?: string;
  nickName?: string;
};

export type BacklogAuthResult =
  | { status: "success"; profile: BacklogProfile; baseUrl: string }
  | { status: "error"; error: string; baseUrl: string };

export type BacklogAuthParams = {
  host: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};

export function buildBacklogBaseUrl(host: string): string {
  const trimmed = host.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export async function fetchBacklogProfile(
  params: BacklogAuthParams
): Promise<BacklogAuthResult> {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) {
    return {
      status: "error",
      error: "Vui lòng nhập Backlog host (ví dụ: example.backlog.com)",
      baseUrl,
    };
  }
  if (!params.apiKey.trim()) {
    return {
      status: "error",
      error: "Vui lòng nhập API key Backlog",
      baseUrl,
    };
  }

  const fetchImpl = params.fetchFn ?? fetch;
  const url = `${baseUrl}/api/v2/users/myself?apiKey=${encodeURIComponent(
    params.apiKey.trim()
  )}`;

  try {
    const res = await fetchImpl(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      return {
        status: "error",
        error:
          `Không lấy được profile (${res.status}). ` +
          (text || "Vui lòng kiểm tra API key/host."),
        baseUrl,
      };
    }

    const data = (await res.json()) as BacklogProfile;
    return { status: "success", profile: data, baseUrl };
  } catch (e: any) {
    return {
      status: "error",
      error: `Lỗi kết nối: ${String(e)}`,
      baseUrl,
    };
  }
}

export type BacklogOAuthToken = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  expires_at?: number; // Optional timestamp in milliseconds
  host?: string; // Optional host for sync
};

export type BacklogOAuthTokenResult =
  | { status: "success"; token: BacklogOAuthToken; baseUrl: string }
  | { status: "error"; error: string; baseUrl: string };

export type BacklogOAuthAuthorizeParams = {
  host: string;
  clientId: string;
  redirectUri: string;
  state: string;
};

export type BacklogOAuthTokenParams = {
  host: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  fetchFn?: typeof fetch;
};

export type BacklogOAuthRefreshParams = {
  host: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchFn?: typeof fetch;
};

export function buildBacklogOAuthAuthorizeUrl(
  params: BacklogOAuthAuthorizeParams
): string {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) return "";
  const search = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
  });
  return `${baseUrl}/OAuth2AccessRequest.action?${search.toString()}`;
}

export async function exchangeBacklogOAuthToken(
  params: BacklogOAuthTokenParams
): Promise<BacklogOAuthTokenResult> {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) {
    return {
      status: "error",
      error: "Vui lòng nhập Backlog host (ví dụ: example.backlog.com)",
      baseUrl,
    };
  }
  if (!params.clientId.trim() || !params.clientSecret.trim()) {
    return {
      status: "error",
      error: "Vui lòng nhập client_id và client_secret",
      baseUrl,
    };
  }
  if (!params.redirectUri.trim()) {
    return {
      status: "error",
      error: "Vui lòng nhập redirect_uri",
      baseUrl,
    };
  }
  const fetchImpl = params.fetchFn ?? fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });
  try {
    const res = await fetchImpl(`${baseUrl}/api/v2/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        status: "error",
        error:
          `Không lấy được token (${res.status}). ` +
          (text || "Vui lòng kiểm tra client_id/secret/redirect_uri."),
        baseUrl,
      };
    }
    const token = (await res.json()) as BacklogOAuthToken;
    return { status: "success", token, baseUrl };
  } catch (e: any) {
    return {
      status: "error",
      error: `Lỗi kết nối: ${String(e)}`,
      baseUrl,
    };
  }
}

export async function refreshBacklogOAuthToken(
  params: BacklogOAuthRefreshParams
): Promise<BacklogOAuthTokenResult> {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) {
    return {
      status: "error",
      error: "Vui lòng nhập Backlog host (ví dụ: example.backlog.com)",
      baseUrl,
    };
  }
  if (!params.clientId.trim() || !params.clientSecret.trim()) {
    return {
      status: "error",
      error: "Vui lòng nhập client_id và client_secret",
      baseUrl,
    };
  }
  if (!params.refreshToken.trim()) {
    return {
      status: "error",
      error: "Vui lòng nhập refresh_token",
      baseUrl,
    };
  }
  const fetchImpl = params.fetchFn ?? fetch;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });
  try {
    const res = await fetchImpl(`${baseUrl}/api/v2/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        status: "error",
        error:
          `Không refresh được token (${res.status}). ` +
          (text || "Vui lòng kiểm tra refresh_token."),
        baseUrl,
      };
    }
    const token = (await res.json()) as BacklogOAuthToken;
    return { status: "success", token, baseUrl };
  } catch (e: any) {
    return {
      status: "error",
      error: `Lỗi kết nối: ${String(e)}`,
      baseUrl,
    };
  }
}

export type BacklogProject = {
  id: number;
  projectKey: string;
  name: string;
};

export type BacklogIssueType = {
  id: number;
  projectId: number;
  name: string;
  color: string;
  displayOrder: number;
};

export async function fetchBacklogProfileWithToken(
  params: { host: string; accessToken: string; fetchFn?: typeof fetch }
): Promise<BacklogAuthResult> {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) {
    return {
      status: "error",
      error: "Vui lòng nhập Backlog host (ví dụ: example.backlog.com)",
      baseUrl,
    };
  }
  if (!params.accessToken.trim()) {
    return {
      status: "error",
      error: "Vui lòng nhập access_token",
      baseUrl,
    };
  }
  const fetchImpl = params.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(`${baseUrl}/api/v2/users/myself`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        status: "error",
        error:
          `Không lấy được profile (${res.status}). ` +
          (text || "Vui lòng kiểm tra access_token."),
        baseUrl,
      };
    }
    const data = (await res.json()) as BacklogProfile;
    return { status: "success", profile: data, baseUrl };
  } catch (e: any) {
    return {
      status: "error",
      error: `Lỗi kết nối: ${String(e)}`,
      baseUrl,
    };
  }
}

export async function fetchBacklogProjects(
  params: { host: string; accessToken: string; fetchFn?: typeof fetch }
): Promise<{ status: "success"; projects: BacklogProject[] } | { status: "error"; error: string }> {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) return { status: "error", error: "Backlog host không hợp lệ" };
  
  const fetchImpl = params.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(`${baseUrl}/api/v2/projects`, {
      method: "GET",
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!res.ok) return { status: "error", error: `Lỗi fetch projects (${res.status})` };
    const data = await res.json();
    return { status: "success", projects: data };
  } catch (e: any) {
    return { status: "error", error: String(e) };
  }
}

export type BacklogIssue = {
  id: number;
  issueKey: string;
  summary: string;
  issueType: BacklogIssueType;
};

export async function fetchBacklogIssue(
  params: { host: string; accessToken: string; issueKeyOrId: string; fetchFn?: typeof fetch }
): Promise<{ status: "success"; issue: BacklogIssue } | { status: "error"; error: string }> {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) return { status: "error", error: "Backlog host không hợp lệ" };
  
  const fetchImpl = params.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(`${baseUrl}/api/v2/issues/${params.issueKeyOrId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!res.ok) return { status: "error", error: `Lỗi fetch issue (${res.status})` };
    const data = await res.json();
    console.log(data);
    return { status: "success", issue: data };
  } catch (e: any) {
    return { status: "error", error: String(e) };
  }
}

export async function fetchBacklogIssueTypes(
  params: { host: string; accessToken: string; projectIdOrKey: string; fetchFn?: typeof fetch }
): Promise<{ status: "success"; issueTypes: BacklogIssueType[] } | { status: "error"; error: string }> {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) return { status: "error", error: "Backlog host không hợp lệ" };
  
  const fetchImpl = params.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(`${baseUrl}/api/v2/projects/${params.projectIdOrKey}/issueTypes`, {
      method: "GET",
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!res.ok) return { status: "error", error: `Lỗi fetch issue types (${res.status})` };
    const data = await res.json();
    return { status: "success", issueTypes: data };
  } catch (e: any) {
    return { status: "error", error: String(e) };
  }
}

export async function fetchBacklogIssues(
  params: { host: string; accessToken: string; projectId?: number; assigneeId?: number; fetchFn?: typeof fetch }
): Promise<{ status: "success"; issues: BacklogIssue[] } | { status: "error"; error: string }> {
  const baseUrl = buildBacklogBaseUrl(params.host);
  if (!baseUrl) return { status: "error", error: "Backlog host không hợp lệ" };
  
  const fetchImpl = params.fetchFn ?? fetch;
  const searchParams = new URLSearchParams();
  if (params.projectId) {
    searchParams.append("projectId[]", String(params.projectId));
  }
  if (params.assigneeId) {
    searchParams.append("assigneeId[]", String(params.assigneeId));
  }
  searchParams.append("count", "100");

  try {
    const res = await fetchImpl(`${baseUrl}/api/v2/issues?${searchParams.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!res.ok) return { status: "error", error: `Lỗi fetch issues (${res.status})` };
    const data = await res.json();
    return { status: "success", issues: data };
  } catch (e: any) {
    return { status: "error", error: String(e) };
  }
}