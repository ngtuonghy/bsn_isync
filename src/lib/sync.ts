// No special import needed for standard fetch in Tauri v2 if not using proxying characteristics.

export type SyncProfileMetadata = {
  id: string;
  owner_id: string;
  name: string;
  version: number;
  updated_at: string;
};

export type SyncProfile = {
  id: string;
  name: string;
  content: any;
  version?: number;
};

export type SyncResult = {
  success: boolean;
  error?: string;
  server_version?: number;
  client_version?: number;
  version?: number;
};

export class SyncService {
  private baseUrl: string;
  private host: string;
  private token: string;

  constructor(baseUrl: string, host: string, token: string) {
    this.baseUrl = baseUrl;
    // Sanitize host: remove protocol if exists, and trailing slashes
    this.host = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.token = token;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'X-Backlog-Host': this.host,
      'Content-Type': 'application/json'
    };
  }

  private async handleError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data.error && data.details) {
        return `${data.error}: ${data.details}`;
      }
      return data.error || data.message || `Error ${res.status}`;
    } catch {
      return res.statusText || `Error ${res.status}`;
    }
  }

  async getProfiles(): Promise<SyncProfileMetadata[]> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles?t=${Date.now()}`, {
      method: 'GET',
      headers: this.headers,
      cache: 'no-cache'
    });
    if (!res.ok) {
      throw new Error(await this.handleError(res));
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data.results || data.data || []);
  }
  
  async getProfile(id: string): Promise<any> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles/${id}?t=${Date.now()}`, {
      method: 'GET',
      headers: this.headers,
      cache: 'no-cache'
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(await this.handleError(res));
    }
    const data = await res.json();
    // Return either the raw object or the nested data/result if wrapped
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.id && data.content) return data; // It's the raw profile
      return data.data || data.result || data;
    }
    return data;
  }

  async getHistory(id: string): Promise<any[]> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles/${id}/history`, {
      method: 'GET',
      headers: this.headers
    });
    if (!res.ok) {
      throw new Error(await this.handleError(res));
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data.results || data.data || []);
  }

  async deleteProfile(id: string): Promise<boolean> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles/${id}`, {
      method: 'DELETE',
      headers: this.headers
    });
    if (!res.ok) {
      throw new Error(await this.handleError(res));
    }
    return true;
  }

  async upsertProfile(profile: SyncProfile): Promise<SyncResult> {
    const res = await window.fetch(`${this.baseUrl}/api/v1/profiles`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(profile)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { 
      success: false, 
      error: data.error || await this.handleError(res),
      server_version: data.server_version,
      client_version: data.client_version
    };
    return { success: true, version: data.version };
  }
}
