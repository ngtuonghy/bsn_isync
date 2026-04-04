// Auto-generated from App.vue — run: node scripts/build-useApp.mjs
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { onClickOutside } from "@vueuse/core";
import { toast } from "vue-sonner";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, watch as fsWatch } from "@tauri-apps/plugin-fs";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { register as registerShortcut, unregister as unregisterShortcut, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { listen } from "@tauri-apps/api/event";
import {
  fetchBacklogProfileWithToken,
  fetchBacklogProjects,
  fetchBacklogIssueTypes,
  fetchBacklogIssues,
  fetchBacklogIssue,
  fetchBacklogUserIcon,
  type BacklogProfile,
  type BacklogProject,
  type BacklogIssueType,
  type BacklogIssue,
  type BacklogOAuthToken,
} from "@/utils/backlogAuth";
import { useStore } from "@/composables/useStore";
import { SyncService } from "@/utils/sync";
import "@/index.css";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

declare const __APP_VERSION__: string;
export const APP_VERSION = __APP_VERSION__;

export const mainTermRef = ref<HTMLElement | null>(null);

export const runTermRef = ref<HTMLElement | null>(null);

export const mainScrollRef = ref<HTMLElement | null>(null);

export const termState = reactive<Record<string, any>>({
  active: 'main',
  terminals: ['main'],
  main: { term: null as Terminal | null, fit: null as FitAddon | null },
  run: { term: null as Terminal | null, fit: null as FitAddon | null }
});

export const TERMINAL_THEMES = {
  dark: {
    background: '#09090b', // zinc-950
    foreground: '#e4e4e7', // zinc-200
    cursor: '#4ade80',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
  },
  light: {
    background: '#ffffff',
    foreground: '#18181b', // zinc-900
    cursor: '#18181b',
    selectionBackground: '#bfdbfe', // blue-200
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5',
  }
};

export const dark = ref(false);

export const activeTab = ref<"runner" | "sync">("runner");

export const sqlConnStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle');

export const sqlErrorMsg = ref('');

export const localHostname = ref("");

export const canBuild = computed(() => {
  return !runner.running && runner.projectRoot && runner.startupProject;
});

export const canTest = computed(() => {
  return runner.running || (runner.projectRoot && runner.startupProject && runner.batFilePath);
});

export const canRun = computed(() => {
  return !runner.running && runner.projectRoot && runner.startupProject && runner.aliasExeName && runner.batFilePath;
});

export const currentBatArgId = computed({
  get: () => {
    if (runner.activeBatConfigIndex === 0) return runner.activeRunArgId;
    const idx = runner.activeBatConfigIndex - 1;
    return runner.batFilesActiveArgIds?.[idx] || "";
  },
  set: (val: string) => {
    if (runner.activeBatConfigIndex === 0) {
      runner.activeRunArgId = val;
    } else {
      const idx = runner.activeBatConfigIndex - 1;
      if (!runner.batFilesActiveArgIds) runner.batFilesActiveArgIds = [];
      runner.batFilesActiveArgIds[idx] = val;
    }
  }
});

export const currentBatArgs = computed({
  get: () => {
    if (runner.activeBatConfigIndex === 0) return runner.runArgs;
    const idx = runner.activeBatConfigIndex - 1;
    return runner.batFilesArgs?.[idx] || "";
  },
  set: (val: string) => {
    if (runner.activeBatConfigIndex === 0) {
      runner.runArgs = val;
    } else {
      const idx = runner.activeBatConfigIndex - 1;
      if (!runner.batFilesArgs) runner.batFilesArgs = [];
      runner.batFilesArgs[idx] = val;
    }
  }
});

export type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type ProjectProfile = {
  id: string;
  name: string;
  owner: string;
  workspaceRoot?: string; // Legacy: No longer used for new profiles
  projectRoot: string; // Now stored as relative path from runner.workspaceRoot
  startupProject: string;
  buildConfig: string;
  urls: string;
  aliasExeName: string;
  batFilePath: string;
  batFiles?: string[];
  batFilesActiveArgIds?: string[];
  batFilesArgs?: string[];
  runArgs?: string;
  exeArgs?: string;
  isExeTestMode?: boolean;
  forceUnicode?: boolean;
  autoWatchBat?: boolean;
  autoWatchTargetTest?: boolean;
  autoWatchTargetRun?: boolean;
  sqlSetupPath: string;
  sqlServer?: string;
  sqlSnippets?: Array<{ id: string; name: string; content: string }>;
  activeSqlSnippetId?: string;
  runArgSnippets?: { id: string; name: string; content: string; batPath?: string; batConfigIndex?: number }[];
  activeRunArgId?: string;
  selectedRunArgIds?: string[];
  exeArgSnippets?: { id: string; name: string; content: string; batPath?: string; batConfigIndex?: number }[];
  activeExeArgId?: string;
  selectedExeArgIds?: string[];
  sync?: any;
  backlogProjectKey?: string;
  backlogIssueTypeId?: number;
  backlogIssueKey?: string;
  backlogIssueSummary?: string;
  deployPath?: string;
  updatedAt: number;
  lastSyncedHash?: string;
  isLocalEdited?: boolean;
  version?: number;
  shortcuts?: Record<string, string>;
};

export type EnvCheck = {
  name: string;
  found: boolean;
  version: string;
  downloadUrl: string;
};

export const envStatus = ref<EnvCheck[]>([]);

export const discoveredProjects = ref<Array<{
  name: string;
  root: string;
  startupProject: string;
  slnCount: number;
  csprojCount: number;
}>>([]);

export const selectedProjectRoot = ref("");

export const setupProfiles = ref<ProjectProfile[]>([]);

export const selectedSetupId = ref("");

export const currentUser = computed(() => backlog.profile?.name || backlog.profile?.userId || "");

export const selectedOwner = ref("");

export const profileSearch = ref("");

export const profileScope = ref<"personal" | "shared" | "team">("team");

export const backlog = reactive({
  host: "",
  apiKey: "",
  status: "idle" as "idle" | "loading" | "success" | "error",
  error: "",
  profile: null as BacklogProfile | null,
  token: null as any, // Will store { access_token, refresh_token, expires_in, expires_at, ... }
  projects: [] as BacklogProject[],
  issueTypes: [] as BacklogIssueType[],
  issues: [] as BacklogIssue[],
  userAvatars: {} as Record<number, string>,
  userAvatarByName: {} as Record<string, string>,
  updatedAt: 0,
});

export const backlogIssueUrl = computed(() => {
  if (!backlog.host || !runner.backlogIssueKey) return undefined;
  const host = backlog.host.replace(/^https?:\/\//, '');
  return `https://${host}/view/${runner.backlogIssueKey}`;
});

export const updateVersion = ref<string | null>(null);

export const isUpdateDownloading = ref(false);

export const isUpdateReady = ref(false);

export async function checkForUpdates(manual = false) {
  try {
    if (manual) {
      toast.info("Searching for new updates...", { id: "updater-check" });
    }
    const version = await invoke("check_update") as string | null;
    if (version) {
      updateVersion.value = version;
      console.log("[updater] update available:", version);
      if (manual) {
        toast.success(`A new update is available (v${version})`, { id: "updater-check" });
      }
    } else {
      if (manual) {
        toast.info("You are running the latest version", { id: "updater-check" });
      }
    }
  } catch (e) {
    console.error("[updater] check failed:", e);
    let errorMsg = String(e);
    if (errorMsg.includes("None of the fallback platforms")) {
      errorMsg = "No compatible update found for your platform (needs .zip).";
    }
    if (manual) {
        toast.error("Update check failed", { description: errorMsg, id: "updater-check" });
    }
  }
}

export const isNotificationEnabled = ref(true);

export const isTerminalHistoryEnabled = ref(false);

export const syncStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');

export const isFetchingProfile = ref(false);

export const lastSyncTime = ref<number | null>(null);

export const profileHashes = new Map<string, string>();

export const showHistoryDialog = ref(false);

export async function restoreVersion(v: any) {
  if (!selectedProfile.value) return;
  const content = typeof v.content === 'string' ? JSON.parse(v.content) : v.content;
  
  // Apply content to current profile
  const idx = setupProfiles.value.findIndex(p => p.id === selectedProfile.value!.id);
  if (idx !== -1) {
    setupProfiles.value[idx] = { 
      ...content, 
      version: selectedProfile.value.version // Keep local version tracking for next sync push
    };
    applySelectedSetupProfile(true);
    await saveSetupsForCurrentRoot();
    toast.success(`Restored to version ${v.version}`);
    showHistoryDialog.value = false;
  }
}

export const isApplyingProfile = ref(false);

export const deletedProfileIds = ref<Map<string, number>>(new Map());

try {
  const stored = localStorage.getItem('bsn_isync:deleted_profiles');
  if (stored) deletedProfileIds.value = new Map(JSON.parse(stored));
} catch(e) {}

export function saveDeletedProfileIds() {
  localStorage.setItem('bsn_isync:deleted_profiles', JSON.stringify(Array.from(deletedProfileIds.value.entries())));
}

export const loadedIssueTypesProjectKey = ref<string | null>(null);

export const CLOUDFLARE_WORKER_URL = "https://bsn-isync-sync-worker.ngtuonghy.workers.dev";

export const { setItem, getItem } = useStore();

export const syncService = computed(() => {
  if (!backlog.host || !backlog.token?.access_token) return null;
  return new SyncService(CLOUDFLARE_WORKER_URL, backlog.host, backlog.token.access_token);
});

export async function downloadUpdate() {
  if (isUpdateDownloading.value) return;
  isUpdateDownloading.value = true;
  try {
    toast.info("Downloading update...", {
      description: `Version v${updateVersion.value} is being downloaded.`
    });
    await invoke("download_and_install_update");
    isUpdateReady.value = true;
    toast.success("Update downloaded", {
      description: "Please restart the application to apply the changes."
    });
  } catch (e: any) {
    toast.error("Download failed", { description: String(e) });
  } finally {
    isUpdateDownloading.value = false;
  }
}

export async function applyUpdate() {
  try {
    await invoke("restart_app");
  } catch (e: any) {
    toast.error("Error while restarting", { description: String(e) });
  }
}

export const UI_STATE_KEY = "ui_state";

export async function loadUIState() {
  console.log("[Store] Loading UI State...");
  try {
    const state = await getItem<any>(UI_STATE_KEY);
    if (!state) {
      console.log("[Store] No UI state found in store.");
      return;
    }
    console.log("[Store] UI State loaded:", state);
    if (state.activeTab) activeTab.value = state.activeTab;
    if (state.dark !== undefined) {
      dark.value = state.dark;
      const el = document.documentElement;
      if (dark.value) el.classList.add("dark");
      else el.classList.remove("dark");
    }
    if (state.selectedSetupId) selectedSetupId.value = state.selectedSetupId;
    if (state.selectedOwner) selectedOwner.value = state.selectedOwner;
    if (state.profileScope) profileScope.value = state.profileScope;
    if (state.workspaceRoot) runner.workspaceRoot = state.workspaceRoot;
    if (state.isNotificationEnabled !== undefined) isNotificationEnabled.value = state.isNotificationEnabled;
    if (state.isTerminalHistoryEnabled !== undefined) isTerminalHistoryEnabled.value = state.isTerminalHistoryEnabled;
    if (state.shortcuts) {
      // Merge with defaults to ensure new shortcut keys (test, run) are present
      Object.assign(runner.shortcuts, {
        test: 'Alt+Shift+T',
        run: 'Alt+Shift+R',
        build: 'Alt+Shift+B',
        rebuild: 'Alt+Shift+U',
        stop: 'Alt+Shift+S',
        ...state.shortcuts
      });
    }
    if (state.backlog) {
      if (state.backlog.host) backlog.host = state.backlog.host;
      if (state.backlog.token) {
        backlog.token = state.backlog.token;
        if (backlog.token.access_token && !backlog.token.expires_at && backlog.token.expires_in) {
          backlog.token.expires_at = Date.now() + (backlog.token.expires_in * 1000);
        }
      }
      if (state.backlog.profile) {
        backlog.profile = state.backlog.profile;
        backlog.status = "success";
        if (!selectedOwner.value || selectedOwner.value === "Guest") {
           selectedOwner.value = currentUser.value;
        }
        loadBacklogIssues();
      } else if (backlog.token?.access_token) {
        // Token exists but no profile, try to reach out
        backlog.status = "loading";
        fetchBacklogProfileWithToken({
          host: backlog.host,
          accessToken: backlog.token.access_token,
        }).then(res => {
          if (res.status === "success") {
            backlog.profile = res.profile;
            backlog.status = "success";
            if (!selectedOwner.value || selectedOwner.value === "Guest") {
              selectedOwner.value = currentUser.value;
            }
            loadBacklogIssues();
            saveUIState(); // update with profile info
          } else {
            backlog.status = "error";
            backlog.error = res.error;
          }
        });
      }
    }
  } catch (e) {
    console.error("[Store] Failed to load UI state", e);
  }
}

export async function saveUIState() {
  try {
    backlog.updatedAt = Date.now();
    const state = {
      activeTab: activeTab.value,
      dark: dark.value,
      selectedSetupId: selectedSetupId.value,
      selectedOwner: selectedOwner.value,
      profileScope: profileScope.value,
      workspaceRoot: runner.workspaceRoot,
      isNotificationEnabled: isNotificationEnabled.value,
      isTerminalHistoryEnabled: isTerminalHistoryEnabled.value,
      shortcuts: runner.shortcuts,
      backlog: {
        host: backlog.host,
        apiKey: backlog.apiKey,
        token: backlog.token,
        profile: backlog.profile,
        updatedAt: backlog.updatedAt,
      }
    };
    await setItem(UI_STATE_KEY, state);
    console.log("[Store] UI state changed (saving via autoSave).");
  } catch (e) {
    console.error("[Store] Failed to trigger save UI state", e);
  }
}

export const OAUTH_STATE_KEY = "bsn_isync:backlog_oauth_state";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = { state: string; createdAt: number };

export let pendingOAuthState: OAuthStatePayload | null = null;

export function buildOAuthState() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function saveOAuthState(state: string) {
  const payload: OAuthStatePayload = { state, createdAt: Date.now() };
  pendingOAuthState = payload;
  const encoded = JSON.stringify(payload);
  let saved = false;

  try {
    window.sessionStorage.setItem(OAUTH_STATE_KEY, encoded);
    saved = true;
  } catch (e) {
    console.log("[backlog-oauth] state save failed (session):", e);
  }

  try {
    window.localStorage.setItem(OAUTH_STATE_KEY, encoded);
    saved = true;
  } catch (e) {
    console.log("[backlog-oauth] state save failed (local):", e);
  }

  if (saved) {
    console.log("[backlog-oauth] state saved:", state);
  }
}

export function readOAuthState() {
  const readFromStorage = (
    storage: Storage,
    label: "session" | "local"
  ): OAuthStatePayload | null => {
    let raw: string | null = null;
    try {
      raw = storage.getItem(OAUTH_STATE_KEY);
    } catch (e) {
      console.log(`[backlog-oauth] state read failed (${label}):`, e);
      return null;
    }
    if (!raw) return null;

    let parsed: OAuthStatePayload | null = null;
    try {
      parsed = JSON.parse(raw) as OAuthStatePayload;
    } catch {
      console.log(`[backlog-oauth] state invalid in ${label} storage`);
      return null;
    }

    if (!parsed?.state || typeof parsed.state !== "string") {
      console.log(`[backlog-oauth] state invalid in ${label} storage`);
      return null;
    }
    if (typeof parsed.createdAt !== "number") {
      console.log(`[backlog-oauth] state missing timestamp (${label})`);
      return null;
    }
    if (Date.now() - parsed.createdAt > OAUTH_STATE_TTL_MS) {
      console.log(`[backlog-oauth] state expired (${label})`);
      clearOAuthState();
      return null;
    }

    console.log(`[backlog-oauth] state loaded (${label}):`, parsed.state);
    return parsed;
  };

  const fromSession = readFromStorage(window.sessionStorage, "session");
  if (fromSession) return fromSession.state;

  const fromLocal = readFromStorage(window.localStorage, "local");
  if (fromLocal) return fromLocal.state;

  if (pendingOAuthState) {
    if (Date.now() - pendingOAuthState.createdAt <= OAUTH_STATE_TTL_MS) {
      console.log("[backlog-oauth] state loaded (memory):", pendingOAuthState.state);
      return pendingOAuthState.state;
    }
    console.log("[backlog-oauth] state expired (memory)");
    pendingOAuthState = null;
  }

  console.log("[backlog-oauth] state missing");
  return null;
}

export function clearOAuthState() {
  pendingOAuthState = null;
  try {
    window.sessionStorage.removeItem(OAUTH_STATE_KEY);
  } catch {}
  try {
    window.localStorage.removeItem(OAUTH_STATE_KEY);
  } catch {}
}

export async function startBacklogOAuthLogin() {
  backlog.error = "";
  backlog.status = "loading";

  const state = buildOAuthState();
  saveOAuthState(state);

  let authUrl: string;
  try {
    authUrl = await invoke("get_backlog_auth_url", { state });
  } catch (e: any) {
    backlog.status = "error";
    const msg = String(e);
    backlog.error = msg;
    toast.error("Backlog login error", { description: msg });
    return;
  }

  backlog.status = "idle";
  try {
    await openUrl(authUrl);
  } catch {
    const opened = window.open(authUrl, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = authUrl;
  }
}

export function isBacklogOAuthCallbackUrl(url: URL) {
  if (url.pathname === "/oauth/callback") return true;
  if (url.protocol === "bsn-isync:" && url.hostname === "oauth" && url.pathname === "/callback") return true;
  return false;
}

export async function handleBacklogOAuthUrl(urlString: string) {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return;
  }
  if (!isBacklogOAuthCallbackUrl(url)) return;

  const shouldResetHistory = url.pathname === "/oauth/callback";
  console.log("[backlog-oauth] callback url:", url.toString());

  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (error) {
    backlog.status = "error";
    const msg = `OAuth2 error: ${errorDescription || error}`;
    backlog.error = msg;
    toast.error("Backlog OAuth2 error", { description: msg });
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }

  const code = url.searchParams.get("code");
  if (code) {
    const key = `bsn_isync_code_${code}`;
    if (window.sessionStorage.getItem(key)) {
      console.log("[backlog-oauth] Code already processed in this session, skipping.");
      return;
    }
    window.sessionStorage.setItem(key, "1");
  }
  
  const state = url.searchParams.get("state");
  const expectedState = readOAuthState();
  console.log("[backlog-oauth] state compare:", { received: state, expected: expectedState });

  if (!code) {
    backlog.status = "error";
    const msg = "Missing authorization code";
    backlog.error = msg;
    toast.error(msg);
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }

  if (!state || !expectedState || state !== expectedState) {
    backlog.status = "error";
    const msg = "Invalid state (mismatch)";
    backlog.error = msg;
    toast.error(msg);
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }

  clearOAuthState();
  backlog.status = "loading";

  let token: BacklogOAuthToken;
  try {
    token = await invoke("backlog_oauth_exchange", { code }) as any;
    if (token) {
      token.expires_at = Date.now() + (token.expires_in * 1000);
      if (token.host) {
        backlog.host = token.host;
      }
    }
  } catch (e: any) {
    backlog.status = "error";
    const msg = `Could not get token: ${String(e)}`;
    backlog.error = msg;
    toast.error("Token exchange error", { description: String(e) });
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }
  
  backlog.token = token;
  saveUIState();

  const profileResult = await fetchBacklogProfileWithToken({
    host: backlog.host,
    accessToken: token.access_token,
  });

  if (profileResult.status === "error") {
    backlog.status = "error";
    backlog.error = profileResult.error;
    toast.error("Error fetching Backlog profile", { description: profileResult.error });
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }

  backlog.profile = profileResult.profile;
  backlog.status = "success";
  selectedOwner.value = currentUser.value;
  saveUIState(); // update with profile
  if (shouldResetHistory) window.history.replaceState({}, "", "/");
  
  // Auto load projects after login
  await loadBacklogProjects();
  loadBacklogIssues();
  toast.success(`Welcome back, ${profileResult.profile.name}!`, { 
    description: "You have successfully logged into Backlog." 
  });
}

export function handleBacklogLogout() {
  backlog.profile = null;
  backlog.token = null;
  backlog.status = "idle";
  backlog.error = "";
  backlog.projects = [];
  backlog.issueTypes = [];
  selectedOwner.value = currentUser.value; // Reset to Guest/Me
  saveUIState();
  toast.success("Logged out of Backlog");
}

export let backlogRefreshInterval: number | undefined;

export let cloudSyncInterval: number | undefined;

export async function ensureValidBacklogToken() {
  if (!backlog.token || !backlog.token.refresh_token) return true;

  const now = Date.now();
  // If token expires in less than 5 minutes, refresh it
  if (backlog.token.expires_at && (backlog.token.expires_at - now < 5 * 60 * 1000)) {
    console.log("[backlog-auth] Token expiring soon, refreshing...");
    try {
      const newToken = await invoke("backlog_oauth_refresh", { refreshToken: backlog.token.refresh_token }) as any;
      if (newToken) {
         newToken.expires_at = Date.now() + (newToken.expires_in * 1000);
         backlog.token = newToken;
         saveUIState();
         console.log("[backlog-auth] Token refreshed successfully.");
         return true;
      }
    } catch (e) {
      console.error("[backlog-auth] Failed to refresh token:", e);
      toast.error("Backlog token auto-refresh error", { description: String(e) });
      return false;
    }
  }
  return true;
}

export async function loadBacklogProjects() {
  if (!backlog.token?.access_token || !backlog.host) return;
  
  const ok = await ensureValidBacklogToken();
  if (!ok) return;

  const res = await fetchBacklogProjects({
    host: backlog.host,
    accessToken: backlog.token.access_token,
  });
  if (res.status === "success") {
    backlog.projects = res.projects;
    return res.projects;
  }
  return [];
}

export async function loadBacklogIssueTypes(projectKey: string) {
  if (!backlog.token?.access_token || !backlog.host || !projectKey) return;

  // OPTIMIZATION: Skip fetch if issueTypes are already loaded for this project
  if (projectKey === loadedIssueTypesProjectKey.value && backlog.issueTypes.length > 0) {
    return;
  }

  const ok = await ensureValidBacklogToken();
  if (!ok) return;

  const res = await fetchBacklogIssueTypes({
    host: backlog.host,
    accessToken: backlog.token.access_token,
    projectIdOrKey: projectKey,
  });
  if (res.status === "success") {
    backlog.issueTypes = res.issueTypes;
    loadedIssueTypesProjectKey.value = projectKey; // Cache project key
  }
}

export async function loadBacklogIssues() {
  const projectKey = runner.backlogProjectKey;
  if (!backlog.token?.access_token || !backlog.host || !projectKey || !backlog.profile?.id) return;
  
  const ok = await ensureValidBacklogToken();
  if (!ok) return;

  const project = backlog.projects.find(p => p.projectKey === projectKey);
  if (!project) return;

  const [resMine, resOthers] = await Promise.all([
    fetchBacklogIssues({
      host: backlog.host,
      accessToken: backlog.token.access_token,
      projectId: project.id,
      assigneeId: backlog.profile.id,
    }),
    fetchBacklogIssues({
      host: backlog.host,
      accessToken: backlog.token.access_token,
      projectId: project.id,
    })
  ]);

  let combined = [];
  const seen = new Set();

  if (resMine.status === "success") {
    for (const issue of resMine.issues) {
      if (!seen.has(issue.id)) {
        combined.push(issue);
        seen.add(issue.id);
      }
    }
  }

  if (resOthers.status === "success") {
    for (const issue of resOthers.issues) {
      if (!seen.has(issue.id)) {
        combined.push(issue);
        seen.add(issue.id);
      }
    }
  }

  backlog.issues = combined;

  for (const issue of combined) {
    if (issue.assignee && backlog.userAvatars[issue.assignee.id] === undefined) {
      const assigneeId = issue.assignee.id;
      const assigneeName = issue.assignee.name;
      backlog.userAvatars[assigneeId] = ""; // placeholder to prevent multiple fetches
      fetchBacklogUserIcon({
        host: backlog.host,
        accessToken: backlog.token.access_token,
        userId: assigneeId,
      }).then(res => {
        if (res.status === "success") {
          backlog.userAvatars[assigneeId] = res.blobUrl;
          backlog.userAvatarByName[assigneeName] = res.blobUrl;
        }
      });
    }
  }
}

export const profileNameInput = ref<HTMLInputElement | null>(null);

export const editableProfileName = ref("");

export const issueSearchQuery = computed({
  get: () => editableProfileName.value,
  set: (val) => { editableProfileName.value = val; }
});

export const showIssueSearch = ref(false);

export const filteredBacklogIssues = computed(() => {
  const q = issueSearchQuery.value.trim().toLowerCase();
  let result = backlog.issues;
  
  if (q) {
    const directMatches = result.filter(i => 
      i.issueKey.toLowerCase().includes(q) || 
      i.summary.toLowerCase().includes(q) ||
      (i.parentIssueId && String(i.parentIssueId).includes(q))
    );
    const matchedIds = new Set(directMatches.map(i => i.id));
    
    result = result.filter(i => 
      matchedIds.has(i.id) || (i.parentIssueId && matchedIds.has(i.parentIssueId))
    );
  }

  // Ensure current user's issues are prioritized at the top
  if (backlog.profile?.id) {
    const myId = backlog.profile.id;
    result = [...result].sort((a, b) => {
      const aIsMine = a.assignee?.id === myId ? 1 : 0;
      const bIsMine = b.assignee?.id === myId ? 1 : 0;
      return bIsMine - aIsMine;
    });
  }
  
  return result;
});

export const issueSearchContainerRef = ref<HTMLElement | null>(null);

export function selectBacklogIssue(issue: BacklogIssue) {
  runner.backlogIssueKey = issue.issueKey;
  runner.backlogIssueSummary = issue.summary;
  runner.backlogIssueColor = issue.issueType?.color || "";
  runner.backlogIssueStatusName = issue.status?.name || "";
  runner.backlogIssueStatusColor = issue.status?.color || "";
  runner.backlogIssueNotFound = false;
}

export const syncConflictDialog = reactive({
  isOpen: false,
  profileName: "",
  cloudChanged: false,
  resolve: null as ((value: 'sync' | 'clone' | 'cancel') => void) | null,
});

export const isNamingArgSnippet = ref(false);

export const namingArgSnippetMode = ref<'create' | 'rename'>('create');

export const namingArgSnippetValue = ref('');

export const namingArgSnippetTarget = ref<'bat' | 'exe'>('bat');

export const currentBatArgSnippets = computed(() => {
  return runner.runArgSnippets.filter(s => s.batConfigIndex === runner.activeBatConfigIndex || (s.batConfigIndex === undefined && runner.activeBatConfigIndex === 0));
});

export const namingArgSnippetTitle = computed(() => namingArgSnippetMode.value === 'create' ? 'Create New Argument' : 'Rename Argument');

export function removeBatConfig(idx: number) {
  if (!runner.batFiles) return;
  runner.batFiles.splice(idx, 1);
  const deletedIndex = idx + 1;
  runner.runArgSnippets = runner.runArgSnippets.filter(s => s.batConfigIndex !== deletedIndex);
  runner.runArgSnippets.forEach(s => {
    if (s.batConfigIndex !== undefined && s.batConfigIndex > deletedIndex) {
      s.batConfigIndex -= 1;
    }
  });
  if (runner.batFilesArgs) {
    runner.batFilesArgs.splice(idx, 1);
  }
  if (runner.batFilesActiveArgIds) {
    runner.batFilesActiveArgIds.splice(idx, 1);
  }
  if (runner.activeBatConfigIndex === deletedIndex) {
    runner.activeBatConfigIndex = 0;
  } else if (runner.activeBatConfigIndex > deletedIndex) {
    runner.activeBatConfigIndex -= 1;
  }
}

export function startNamingArgSnippet(mode: 'create' | 'rename', target: 'bat' | 'exe') {
  namingArgSnippetMode.value = mode;
  namingArgSnippetTarget.value = target;
  if (mode === 'create') {
    namingArgSnippetValue.value = 'New Argument';
  } else {
    const list = target === 'bat' ? runner.runArgSnippets : runner.exeArgSnippets;
    const activeId = target === 'bat' ? currentBatArgId.value : runner.activeExeArgId;
    const snippet = list.find(s => s.id === activeId);
    namingArgSnippetValue.value = snippet?.name || '';
  }
  isNamingArgSnippet.value = true;
}

export function commitArgSnippetName() {
  const name = namingArgSnippetValue.value.trim();
  if (!name) return;
  const target = namingArgSnippetTarget.value;
  const list = target === 'bat' ? runner.runArgSnippets : runner.exeArgSnippets;

  if (namingArgSnippetMode.value === 'create') {
    const id = "arg_" + Date.now();
    list.push({ id, name, content: '', batConfigIndex: target === 'bat' ? runner.activeBatConfigIndex : undefined, batPath: target === 'bat' ? (runner.activeBatConfigIndex === 0 ? runner.batFilePath : (runner.batFiles?.[runner.activeBatConfigIndex - 1] || '')) : undefined });
    if (target === 'bat') {
      currentBatArgId.value = id;
      currentBatArgs.value = "";
    } else {
      runner.activeExeArgId = id;
      runner.exeArgs = "";
    }
  } else {
    const activeId = target === 'bat' ? currentBatArgId.value : runner.activeExeArgId;
    const snippet = list.find(s => s.id === activeId);
    if (snippet) snippet.name = name;
  }
  isNamingArgSnippet.value = false;
}

export function deleteActiveArgSnippet(target: 'bat' | 'exe') {
  const list = target === 'bat' ? runner.runArgSnippets : runner.exeArgSnippets;
  const activeId = target === 'bat' ? currentBatArgId.value : runner.activeExeArgId;
  const idx = list.findIndex(s => s.id === activeId);
  if (idx === -1) return;
  if (!confirm(`Delete argument "${list[idx].name}"?`)) return;
  list.splice(idx, 1);
  
  if (target === 'bat') {
    if (currentBatArgSnippets.value.length > 0) {
      currentBatArgId.value = currentBatArgSnippets.value[0].id;
      currentBatArgs.value = currentBatArgSnippets.value[0].content;
    } else {
      currentBatArgId.value = "";
      currentBatArgs.value = "";
    }
  } else {
    if (list.length > 0) {
      runner.activeExeArgId = list[0].id;
      runner.exeArgs = list[0].content;
    } else {
      runner.activeExeArgId = "";
      runner.exeArgs = "";
    }
  }
}

export function onArgSnippetSelected(target: 'bat' | 'exe', snippetId: string) {
  const list = target === 'bat' ? runner.runArgSnippets : runner.exeArgSnippets;
  const s = list.find(s => s.id === snippetId);
  if (s) {
    if (target === 'bat') {
      currentBatArgId.value = snippetId;
      currentBatArgs.value = s.content;
    } else {
      runner.activeExeArgId = snippetId;
      runner.exeArgs = s.content;
      if (s.batPath) runner.batFilePath = s.batPath;
    }
  }
}

export const isNamingSqlSnippet = ref(false);

export const namingSqlSnippetMode = ref<'create' | 'rename'>('create');

export const namingSqlSnippetValue = ref('');

export const namingSqlSnippetTitle = computed(() => namingSqlSnippetMode.value === 'create' ? 'Create New SQL Script' : 'Rename SQL Script');

export const isSqlSnippetFullscreen = ref(false);

export function startNamingSqlSnippet(mode: 'create' | 'rename') {
  namingSqlSnippetMode.value = mode;
  if (mode === 'create') {
    namingSqlSnippetValue.value = 'New Script';
  } else {
    const snippet = runner.sqlSnippets.find(s => s.id === runner.activeSqlSnippetId);
    namingSqlSnippetValue.value = snippet?.name || '';
  }
  isNamingSqlSnippet.value = true;
}

export function commitSqlSnippetName() {
  const name = namingSqlSnippetValue.value.trim();
  if (!name) return;

  if (namingSqlSnippetMode.value === 'create') {
    const id = "snippet_" + Date.now();
    runner.sqlSnippets.push({ id, name, content: "" });
    runner.activeSqlSnippetId = id;
    runner.sqlSetupPath = "";
  } else {
    const snippet = runner.sqlSnippets.find(s => s.id === runner.activeSqlSnippetId);
    if (snippet) snippet.name = name;
  }
  
  isNamingSqlSnippet.value = false;
}

export function unlinkBacklogIssue() {
  runner.backlogIssueKey = "";
  runner.backlogIssueSummary = "";
  runner.backlogIssueColor = "";
  runner.backlogIssueStatusName = "";
  runner.backlogIssueStatusColor = "";
  runner.backlogIssueNotFound = false;
}

export const ownerSearch = ref("");

export const filteredOwnerOptions = computed(() => {
  const q = ownerSearch.value.trim().toLowerCase();
  if (!q) return ownerOptions.value;
  return ownerOptions.value.filter(o => o.toLowerCase().includes(q));
});

export const projectSearch = ref("");

export const filteredDiscoveredProjects = computed(() => {
  const q = projectSearch.value.trim().toLowerCase();
  if (!q) return discoveredProjects.value;
  return discoveredProjects.value.filter(p => 
    p.name.toLowerCase().includes(q) || p.root.toLowerCase().includes(q)
  );
});

export const ownerOptions = computed(() => {
  const owners = new Set<string>();
  if (currentUser.value) {
    owners.add(currentUser.value);
  }
  setupProfiles.value.forEach((p) => {
    if (p.owner && p.owner !== "Guest") {
      owners.add(p.owner);
    }
  });
  return Array.from(owners);
});

export const visibleProfiles = computed(() => {
  const q = profileSearch.value.trim().toLowerCase();
  return setupProfiles.value.filter((p) => {
    if (p.owner !== selectedOwner.value) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q);
  });
});

export const scopedProfiles = computed(() => {
  if (profileScope.value === "team") return visibleProfiles.value;
  if (profileScope.value === "personal") {
    return visibleProfiles.value.filter((p) => p.owner === currentUser.value);
  }
  return visibleProfiles.value.filter((p) => p.owner !== currentUser.value);
});

export const selectedProfile = computed(() => setupProfiles.value.find((p) => p.id === selectedSetupId.value));

export const canEditSelected = computed(() => {
  if (backlog.status !== 'success') return false;
  if (!selectedProfile.value) return false;
  return !selectedProfile.value.owner || selectedProfile.value.owner === currentUser.value;
});

export const canExecuteSelected = computed(() => {
  return !!selectedProfile.value;
});

export let unlistenRunnerLog: (() => void) | undefined;

export let unlistenBuildStatus: (() => void) | undefined;

export let runnerPollTimer: number | undefined;

export const runner = reactive({
  workspaceRoot: "",
  projectRoot: "",
  startupProject: "",
  urls: "",
  config: "Debug",
  aliasExeName: "",
  batFilePath: "",
  batFiles: [] as string[],
  activeBatConfigIndex: 0,
  batFilesActiveArgIds: [] as string[],
  batFilesArgs: [] as string[],
  runArgs: "",
  exeArgs: "",
  isExeTestMode: false,
  forceUnicode: localStorage.getItem("bsn_isync:global_force_unicode") !== null ? localStorage.getItem("bsn_isync:global_force_unicode") === "true" : true,
  autoWatchBat: localStorage.getItem("bsn_isync:global_watch_bat") !== null ? localStorage.getItem("bsn_isync:global_watch_bat") === "true" : true,
  autoWatchTargetTest: localStorage.getItem("bsn_isync:global_watch_test") === "true",
  autoWatchTargetRun: localStorage.getItem("bsn_isync:global_watch_run") !== null ? localStorage.getItem("bsn_isync:global_watch_run") === "true" : true,
  sqlSetupPath: "",
  sqlServer: localStorage.getItem("bsn_isync:global_sql_server") || "",
  sqlDatabase: localStorage.getItem("bsn_isync:global_sql_db") || "Arkbell_01",
  sqlUser: localStorage.getItem("bsn_isync:global_sql_user") || "sa",
  sqlPassword: localStorage.getItem("bsn_isync:global_sql_pass") || "ArkAdmin@2026",
  useWindowsAuth: localStorage.getItem("bsn_isync:global_sql_winauth") === "false" ? false : true,
  sqlSnippets: [] as { id: string; name: string; content: string }[],
  activeSqlSnippetId: "",
  runArgSnippets: [] as { id: string; name: string; content: string; batPath?: string; batConfigIndex?: number }[],
  activeRunArgId: "",
  selectedRunArgIds: [] as string[],
  exeArgSnippets: [] as { id: string; name: string; content: string; batPath?: string; batConfigIndex?: number }[],
  activeExeArgId: "",
  selectedExeArgIds: [] as string[],
  buildStatus: null as string | null,
  configTemplate: `<?xml version="1.0" encoding="utf-8"?>
<configuration>
	<configSections>
		<section name="entityFramework" type="System.Data.Entity.Internal.ConfigFile.EntityFrameworkSection, EntityFramework, Version=6.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089" requirePermission="false" />
	</configSections>
	<startup>
		<supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.7.1" />
	</startup>
	<entityFramework>
		<providers>
			<provider invariantName="System.Data.SqlClient" type="System.Data.Entity.SqlServer.SqlProviderServices, EntityFramework.SqlServer" />
		</providers>
	</entityFramework>
	<connectionStrings>
		<add name="EntityFramework" connectionString="Data Source=GIGABYTE;Initial Catalog=Arkbell_01;Integrated Security=True;MultipleActiveResultSets=True;Connect Timeout=30;Application Name=ArkbellOnlineSystem" providerName="System.Data.SqlClient" />
	</connectionStrings>
	<appSettings>
		<add key="Job.MsmqName" value="JE5912" />
		<add key="Job.BatFilePath" value="C:\\Users\\ngtuonghy_rikai\\source\\repos\\BSN_Improve_Invoice\\Invoice\\batch\\04_オンラインバッチ\\370300_請求書出力_宴集会\\JE5912.bat" />
		<add key="Execute.EnvId" value="Arkbell_Dev" />
	</appSettings>
</configuration>`,
  runConfigTemplate: `<?xml version="1.0" encoding="utf-8"?>
<configuration>
	<configSections>
		<section name="entityFramework" type="System.Data.Entity.Internal.ConfigFile.EntityFrameworkSection, EntityFramework, Version=6.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089" requirePermission="false" />
	</configSections>
	<startup>
		<supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.7.1" />
	</startup>
	<entityFramework>
		<providers>
			<provider invariantName="System.Data.SqlClient" type="System.Data.Entity.SqlServer.SqlProviderServices, EntityFramework.SqlServer" />
		</providers>
	</entityFramework>
	<connectionStrings>
		<add name="EntityFramework" connectionString="Data Source=GIGABYTE;Initial Catalog=Arkbell_01;Integrated Security=True;MultipleActiveResultSets=True;Connect Timeout=30;Application Name=ArkbellOnlineSystem" providerName="System.Data.SqlClient" />
	</connectionStrings>
	<appSettings>
		<add key="Job.MsmqName" value="JE5912" />
		<add key="Job.BatFilePath" value="C:\\Users\\ngtuonghy_rikai\\source\\repos\\BSN_Improve_Invoice\\Invoice\\batch\\04_オンラインバッチ\\370300_請求書出力_宴集会\\JE5912.bat" />
		<add key="Execute.EnvId" value="Arkbell_Dev" />
	</appSettings>
</configuration>`,
  connectionStringTemplate: "",
  running: false,
  loadingTarget: null as "exe" | "build" | "restore" | "rebuild" | "bat" | null,
  logs: [] as string[],
  childPid: 0 as number | 0,
  backlogProjectKey: "",
  backlogIssueTypeId: undefined as number | undefined,
  backlogIssueKey: "",
  backlogIssueSummary: "",
  backlogIssueColor: "",
  backlogIssueStatusName: "",
  backlogIssueStatusColor: "",
  backlogIssueNotFound: false,
  shortcuts: {
    test: 'Alt+Shift+T',
    run: 'Alt+Shift+R',
    build: 'Alt+Shift+B',
    rebuild: 'Alt+Shift+U',
    stop: 'Alt+Shift+S',
  } as Record<string, string>,
  autoDeployConfig: false,
  deployPath: "",
});

export let sqlCheckTimeout: any = null;

export async function checkSqlConnection(manual = false) {
  if (!runner.sqlServer || !runner.sqlDatabase) {
    sqlConnStatus.value = 'idle';
    return;
  }

  sqlConnStatus.value = 'loading';
  sqlErrorMsg.value = '';

  try {
    const result = await invoke<CommandResult>("run_sql_only", {
      sqlContent: "SELECT @@VERSION",
      server: runner.sqlServer,
      database: runner.sqlDatabase,
      user: runner.sqlUser,
      password: runner.sqlPassword,
      useWindowsAuth: runner.useWindowsAuth
    });

    if (result.code === 0) {
      sqlConnStatus.value = 'success';
      if (manual) toast.success("SQL Connection Successful", { description: result.stdout.split('\n')[0] });
    } else {
      sqlConnStatus.value = 'error';
      sqlErrorMsg.value = result.stderr || result.stdout;
      if (manual) {
        toast.error("SQL Connection Failed", { 
          description: sqlErrorMsg.value,
          action: {
            label: "Copy Error",
            onClick: () => navigator.clipboard.writeText(sqlErrorMsg.value)
          }
        });
      }
    }
  } catch (err: any) {
    sqlConnStatus.value = 'error';
    sqlErrorMsg.value = err.toString();
    if (manual) toast.error("Execution Error", { description: sqlErrorMsg.value });
  }
}

export let unwatchBatFile: any;

export let unwatchTargetDir: any;

export async function setupTargetWatcher() {
  if (unwatchTargetDir) {
    unwatchTargetDir();
    unwatchTargetDir = undefined;
  }
  
  if (!runner.autoWatchTargetTest && !runner.autoWatchTargetRun) return;
  if (!runner.startupProject) return;

  const targetDir = runner.startupProject.replace(/[\\/][^\\/]+$/, '');
  if (!targetDir) return;

  try {
    // @ts-ignore
    unwatchTargetDir = await fsWatch(targetDir, (event: any) => {
      const typeStr = JSON.stringify(event.type);
      if (typeStr.includes('modify') || typeStr.includes('any')) {
        const paths = event.paths || [];
        const isCodeChange = paths.some((p: string) => p.endsWith('.cs') || p.endsWith('.csproj') || p.endsWith('.json') || p.endsWith('.config'));
        
        if (isCodeChange) {
          if (runner.autoWatchTargetTest && !runner.loadingTarget && !runner.buildStatus) {
            toast.info("Target code changed, auto-running test...");
            sendNotification({ title: 'BSN iSync', body: 'Target code changed. Auto-running test...' });
            dotnet('run', 'bat');
          } else if (runner.autoWatchTargetRun && runner.running && !runner.loadingTarget && !runner.buildStatus) {
            toast.info("Target code changed, auto-restarting app...");
            sendNotification({ title: 'BSN iSync', body: 'Target code changed. Auto-restarting app...' });
            stop().then(() => {
              setTimeout(() => {
                dotnet('run', 'exe');
              }, 1000);
            });
          }
        }
      }
    }, { delayMs: 1000 });
  } catch (e) {
    console.error("Failed to watch target dir", e);
  }
}

export async function setupBatWatcher() {
  if (unwatchBatFile) {
    unwatchBatFile();
    unwatchBatFile = undefined;
  }
  
  if (!runner.autoWatchTargetTest && !runner.autoWatchTargetRun) return;
  
  const filesToWatch = [runner.batFilePath, ...(runner.batFiles || [])].filter(b => b && b.trim());
  if (filesToWatch.length === 0) return;

  try {
    // @ts-ignore
    unwatchBatFile = await fsWatch(filesToWatch, (event: any) => {
      const typeStr = JSON.stringify(event.type);
      if (typeStr.includes('modify') || typeStr.includes('any')) {
        if (runner.autoWatchTargetTest && !runner.loadingTarget && !runner.buildStatus) {
          toast.info("BAT file changed, auto-running test...");
          sendNotification({ title: 'BSN iSync', body: 'BAT file changed. Auto-running test...' });
          dotnet('run', 'bat');
        } else if (runner.autoWatchTargetRun && runner.running && !runner.loadingTarget && !runner.buildStatus) {
          toast.info("BAT file changed, auto-restarting app...");
          sendNotification({ title: 'BSN iSync', body: 'BAT file changed. Auto-restarting app...' });
          stop().then(() => {
            setTimeout(() => {
              dotnet('run', 'exe');
            }, 1000);
          });
        }
      }
    }, { delayMs: 500 });
  } catch (e) {
    console.error("Failed to watch bat files", e);
  }
}

export const isRecordingShortcut = ref(false);

export const recordingAction = ref<string | null>(null);

export const showHotkeySettings = ref(false);

export const hotkeyContainerRef = ref<HTMLElement | null>(null);

export function resolveArgs(args: string) {
  if (!args) return "";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const hms = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ms = pad(Math.floor(now.getMilliseconds() / 10)); // 2 digits
  const time8 = `${hms}${ms}`;

  const host6 = localHostname.value.substring(0, 6).toUpperCase();

  return args.replace(/{time}/g, time8).replace(/{hostname}/g, host6);
}

export const argsInputRefBat = ref<any>(null);

export const argsInputRefExe = ref<any>(null);

export function insertTimePlaceholder() {
  const targetRef = runner.isExeTestMode ? argsInputRefExe.value : argsInputRefBat.value;
  let input = targetRef?.$el as HTMLInputElement | undefined;
  if (input && input.tagName !== 'INPUT') input = input.querySelector("input") as HTMLInputElement | undefined;
  if (!input) {
    if (runner.isExeTestMode) runner.exeArgs += " {time}";
    else runner.runArgs += " {time}";
    return;
  }

  const isExe = runner.isExeTestMode;
  const start = input.selectionStart ?? (isExe ? runner.exeArgs.length : runner.runArgs.length);
  const end = input.selectionEnd ?? (isExe ? runner.exeArgs.length : runner.runArgs.length);
  const val = isExe ? runner.exeArgs : runner.runArgs;

  const prefix = val.substring(0, start);
  const suffix = val.substring(end);
  const insertStr = (prefix.length > 0 && !prefix.endsWith(' ')) ? " {time}" : "{time}";
  const newVal = prefix + insertStr + suffix;

  if (isExe) runner.exeArgs = newVal;
  else runner.runArgs = newVal;

  nextTick(() => {
    if (input) {
      input.focus();
      const newPos = start + insertStr.length;
      input.setSelectionRange(newPos, newPos);
    }
  });
}

export function insertHostnamePlaceholder() {
  const placeholder = "{hostname}";
  const targetRef = runner.isExeTestMode ? argsInputRefExe.value : argsInputRefBat.value;
  let input = targetRef?.$el as HTMLInputElement | undefined;
  if (input && input.tagName !== 'INPUT') input = input.querySelector("input") as HTMLInputElement | undefined;
  if (!input) {
    if (runner.isExeTestMode) runner.exeArgs += " " + placeholder;
    else runner.runArgs += " " + placeholder;
    return;
  }

  const isExe = runner.isExeTestMode;
  const start = input.selectionStart ?? (isExe ? runner.exeArgs.length : runner.runArgs.length);
  const end = input.selectionEnd ?? (isExe ? runner.exeArgs.length : runner.runArgs.length);
  const val = isExe ? runner.exeArgs : runner.runArgs;

  const prefix = val.substring(0, start);
  const suffix = val.substring(end);
  const insertStr = (prefix.length > 0 && !prefix.endsWith(' ')) ? " " + placeholder : placeholder;
  const newVal = prefix + insertStr + suffix;

  if (isExe) runner.exeArgs = newVal;
  else runner.runArgs = newVal;

  nextTick(() => {
    if (input) {
      input.focus();
      const newPos = start + insertStr.length;
      input.setSelectionRange(newPos, newPos);
    }
  });
}

export function applyConfigSyncToTemplates() {
  if (runner.loadingTarget) return;

  let msmq = runner.aliasExeName.replace(/\.exe$/i, "");
  const batIndex = runner.activeBatConfigIndex || 0;
  const activeBatPath = batIndex === 0 ? runner.batFilePath : (runner.batFiles?.[batIndex - 1] || runner.batFilePath);
  if (activeBatPath) {
    const m = activeBatPath.match(/([^\\]+)\.bat$/i);
    if (m) msmq = m[1];
  }
  
  const syncTemplate = (tpl: string) => {
    if (!tpl) return tpl;
    let t = tpl;
    
    // 0. ConnectionStrings Override
    if (runner.connectionStringTemplate && runner.connectionStringTemplate.trim()) {
      const connStrSection = runner.connectionStringTemplate.trim();
      const sectionMatch = /<connectionStrings>[\s\S]*?<\/connectionStrings>/i;
      if (sectionMatch.test(t)) {
        t = t.replace(sectionMatch, connStrSection);
      }
    }
    
    // 1. AppSettings Sync
    t = t.replace(/(<add\s+key="Job\.MsmqName"\s+value=")([^"]*)("\s*\/>)/gi, `$1${msmq}$3`);
    t = t.replace(/(<add\s+key="Job\.BatFilePath"\s+value=")([^"]*)("\s*\/>)/gi, `$1${activeBatPath || '.\\' }$3`);
    
    if (runner.sqlServer) {
        t = t.replace(/(<add\s+key="Report\.DBServer"\s+value=")([^"]*)("\s*\/>)/gi, `$1${runner.sqlServer}$3`);
    }

    // 2. ConnectionString Attributes Sync
    t = t.replace(/(connectionString=")([^"]*)(")/gi, (_match, pre, cs, post) => {
      const parts = cs.split(';').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      const kv = {} as Record<string, string>;
      const keyOrder: string[] = [];
      
      parts.forEach((p: string) => {
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1) {
          const rawKey = p.substring(0, eqIdx).trim();
          const val = p.substring(eqIdx + 1).trim();
          const key = rawKey.toLowerCase();
          kv[key] = val;
          (kv as any)['orig_' + key] = rawKey;
          keyOrder.push(key);
        }
      });

      const setKey = (k: string, v: string) => {
        const lk = k.toLowerCase();
        if (!(lk in kv)) { keyOrder.push(lk); (kv as any)['orig_' + lk] = k; }
        kv[lk] = v;
      };

      const removeKey = (k: string) => {
        const lk = k.toLowerCase();
        delete kv[lk];
        const idx = keyOrder.indexOf(lk);
        if (idx !== -1) keyOrder.splice(idx, 1);
      };

      if (runner.sqlServer) {
        if ('server' in kv) {
          setKey('Server', runner.sqlServer);
          removeKey('Data Source');
        } else {
          setKey('Data Source', runner.sqlServer);
        }
      }
      if (runner.sqlDatabase) setKey('Initial Catalog', runner.sqlDatabase);
      
      // Đồng bộ chế độ xác thực
      if (runner.useWindowsAuth) {
        setKey('Integrated Security', 'True');
        // Gỡ bỏ Trusted_Connection vì Integrated Security đã đủ
        removeKey('Trusted_Connection');
        removeKey('TrustedConnection');
        removeKey('User ID'); removeKey('Password'); removeKey('Uid'); removeKey('Pwd');
      } else {
        setKey('Integrated Security', 'False');
        removeKey('Trusted_Connection');
        removeKey('TrustedConnection');
        if (runner.sqlUser) { setKey('User ID', runner.sqlUser); setKey('Password', runner.sqlPassword || ''); }
      }

      const resCs = keyOrder.map(k => `${(kv as any)['orig_' + k] || k}=${kv[k]}`).join(';') + (keyOrder.length > 0 ? ';' : '');
      return `${pre}${resCs}${post}`;
    });

    return t;
  };

  const nConf = syncTemplate(runner.configTemplate);
  if (nConf !== runner.configTemplate) runner.configTemplate = nConf;
  const nRun = syncTemplate(runner.runConfigTemplate);
  if (nRun !== runner.runConfigTemplate) runner.runConfigTemplate = nRun;
}

export function makeProfileId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function initials(name: string) {
  const cleanName = name.split('-').pop()?.trim() || name.trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function setupStorageKey() {
  return `bsn_isync:project_profiles`;
}

export function buildSetupFromRunner(name: string): ProjectProfile {
  // Helper to convert to relative if possible
  const toRel = (p: string) => {
    if (!p || !runner.workspaceRoot) return p;
    const ws = runner.workspaceRoot.replace(/[\\/]$/, "");
    if (p.startsWith(ws)) {
      let rel = p.substring(ws.length);
      if (rel.startsWith("\\") || rel.startsWith("/")) rel = rel.substring(1);
      return rel;
    }
    return p;
  };

  return {
    id: makeProfileId(),
    name,
    owner: currentUser.value,
    projectRoot: toRel(runner.projectRoot),
    startupProject: runner.startupProject,
    buildConfig: runner.config === "Release" ? "Release" : "Debug",
    urls: runner.urls,
    aliasExeName: runner.aliasExeName,
    batFilePath: toRel(runner.batFilePath),
    batFiles: runner.batFiles ? [...runner.batFiles].map(toRel) : [],
    batFilesActiveArgIds: runner.batFilesActiveArgIds ? [...runner.batFilesActiveArgIds] : [],
    batFilesArgs: runner.batFilesArgs ? [...runner.batFilesArgs] : [],
    runArgs: runner.runArgs,
    exeArgs: runner.exeArgs,
    isExeTestMode: runner.isExeTestMode,
    forceUnicode: runner.forceUnicode,
    autoWatchBat: runner.autoWatchBat,
    autoWatchTargetTest: runner.autoWatchTargetTest,
    autoWatchTargetRun: runner.autoWatchTargetRun,
    sqlSetupPath: runner.sqlSetupPath,
    sqlServer: runner.sqlServer,
    sqlSnippets: JSON.parse(JSON.stringify(runner.sqlSnippets)),
    activeSqlSnippetId: runner.activeSqlSnippetId,
      runArgSnippets: JSON.parse(JSON.stringify(runner.runArgSnippets || [])),
      activeRunArgId: runner.activeRunArgId,
      exeArgSnippets: JSON.parse(JSON.stringify(runner.exeArgSnippets || [])),
      activeExeArgId: runner.activeExeArgId,
    backlogProjectKey: runner.backlogProjectKey,
    backlogIssueTypeId: runner.backlogIssueTypeId,
    backlogIssueKey: runner.backlogIssueKey,
    backlogIssueSummary: runner.backlogIssueSummary,
    deployPath: toRel(runner.deployPath),
    // shortcut is now independent and global
    sync: (() => {
      const { logs, ...syncData } = sync;
      return JSON.parse(JSON.stringify(syncData));
    })(),
    updatedAt: Date.now(),
  };
}

export function applySetupToRunner(setup: ProjectProfile) {
  // Helper to convert to absolute
  const toAbs = (p: string) => {
    if (!p) return "";
    if (/^[A-Z]:\\/i.test(p) || p.startsWith("\\\\") || p.startsWith("/")) return p;
    // It's a RELATIVE path, prepend current workspaceRoot
    const ws = runner.workspaceRoot.replace(/[\\/]$/, "");
    return ws ? `${ws}\\${p}` : p;
  };
  // 1. Resolve Paths (handle both absolute migration and relative expansion)
  runner.projectRoot = normalizePath(toAbs(setup.projectRoot || ""));
  selectedProjectRoot.value = runner.projectRoot;
  runner.startupProject = setup.startupProject || "";
  
  runner.config = setup.buildConfig;
  runner.urls = setup.urls || "";
  runner.aliasExeName = setup.aliasExeName || "";
  runner.batFilePath = toAbs(setup.batFilePath || "");
  runner.batFiles = setup.batFiles ? [...setup.batFiles].map(toAbs) : [];
  runner.batFilesActiveArgIds = setup.batFilesActiveArgIds ? [...setup.batFilesActiveArgIds] : [];
  runner.batFilesArgs = setup.batFilesArgs ? [...setup.batFilesArgs] : [];
  runner.runArgs = setup.runArgs || "";
  runner.exeArgs = setup.exeArgs || "";
  runner.isExeTestMode = setup.isExeTestMode || false;
  // forceUnicode, autoWatchTargetTest, autoWatchTargetRun are now global app settings
  runner.deployPath = toAbs(setup.deployPath || "");
  
  runner.sqlSetupPath = setup.sqlSetupPath || "";
  runner.sqlSetupPath = setup.sqlSetupPath || "";
  // SQL server/database/auth settings are now global and shared across app, not loaded from profiles
  
  if (setup.sqlSnippets && Array.isArray(setup.sqlSnippets)) {
    runner.sqlSnippets = JSON.parse(JSON.stringify(setup.sqlSnippets));
  } else if (setup.sqlSetupPath) {
    // Migrate old setup path to snippets array
    runner.sqlSnippets = [{ id: "default_snippet_1", name: "Default Script", content: setup.sqlSetupPath }];
  } else {
    runner.sqlSnippets = [];
  }
  
  runner.activeSqlSnippetId = setup.activeSqlSnippetId || (runner.sqlSnippets.length > 0 ? runner.sqlSnippets[0].id : "");

  if (setup.runArgSnippets && setup.runArgSnippets.length > 0) {
    runner.runArgSnippets = setup.runArgSnippets.map(s => ({ ...s, batPath: s.batPath ? toAbs(s.batPath) : s.batPath }));
  } else if (setup.runArgs) {
    runner.runArgSnippets = [{ id: "default_run_arg_1", name: "Default Argument", content: setup.runArgs }];
  } else {
    runner.runArgSnippets = [];
  }
  runner.activeRunArgId = setup.activeRunArgId || (runner.runArgSnippets.length > 0 ? runner.runArgSnippets[0].id : "");
  runner.selectedRunArgIds = setup.selectedRunArgIds || [];
  const activeRunArg = runner.runArgSnippets.find(s => s.id === runner.activeRunArgId);
  runner.runArgs = activeRunArg ? activeRunArg.content : (setup.runArgs || "");

  if (setup.exeArgSnippets && setup.exeArgSnippets.length > 0) {
    runner.exeArgSnippets = setup.exeArgSnippets.map(s => ({ ...s, batPath: s.batPath ? toAbs(s.batPath) : s.batPath }));
  } else if (setup.exeArgs) {
    runner.exeArgSnippets = [{ id: "default_exe_arg_1", name: "Default Argument", content: setup.exeArgs }];
  } else {
    runner.exeArgSnippets = [];
  }
  runner.activeExeArgId = setup.activeExeArgId || (runner.exeArgSnippets.length > 0 ? runner.exeArgSnippets[0].id : "");
  runner.selectedExeArgIds = setup.selectedExeArgIds || [];
  const activeExeArg = runner.exeArgSnippets.find(s => s.id === runner.activeExeArgId);
  runner.exeArgs = activeExeArg ? activeExeArg.content : (setup.exeArgs || "");
  // keep runner.sqlSetupPath synced for backward compatibility with rust backend or simple execution logic
  const activeSnippet = runner.sqlSnippets.find(s => s.id === runner.activeSqlSnippetId);
  runner.sqlSetupPath = activeSnippet ? activeSnippet.content : (setup.sqlSetupPath || "");

  runner.backlogProjectKey = setup.backlogProjectKey || "";
  runner.backlogIssueTypeId = setup.backlogIssueTypeId;
  runner.backlogIssueKey = setup.backlogIssueKey || "";
  runner.backlogIssueSummary = setup.backlogIssueSummary || "";
  // runner.shortcut is independent and not updated from profiles
  
  if (setup.sync) {
    Object.assign(sync, setup.sync);
  }

  // Implicitly populate configs from Project Source Files
  loadConfigsForCurrentProject();


}

export async function loadSetupsForCurrentRoot() {
  const raw = await getItem<ProjectProfile[]>(setupStorageKey());
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    const defaultSetup = buildSetupFromRunner("Default");
    setupProfiles.value = [defaultSetup];
    selectedOwner.value = defaultSetup.owner;
    selectedSetupId.value = defaultSetup.id;
    await setItem(setupStorageKey(), setupProfiles.value);
    return;
  }
  try {
    const seenIds = new Set<string>();
    const normalized = raw.map((setup) => ({
      ...setup,
      owner: (setup as any).owner || currentUser.value,
    })).filter((p, _, _self) => {
      // Deduplicate by ID
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      
      return true;
    });

    setupProfiles.value = normalized;
    ensureVisibleSelection();
    if (selectedSetupId.value) applySelectedSetupProfile();
  } catch (e) {
    console.error("Failed to load profiles", e);
  }
}

export async function saveSetupsForCurrentRoot() {
  const cleanProfiles = setupProfiles.value.map(p => {
    const { backlogIssueColor, backlogIssueStatusName, backlogIssueStatusColor, backlogIssueNotFound, ...clean } = p as any;
    return clean;
  });
  await setItem(setupStorageKey(), cleanProfiles);
  // Trigger Incremental Cloudflare Sync for the active profile
  // CRITICAL: Skip sync if we are currently APPLYING a profile to avoid feedback loops
  if (!isApplyingProfile.value) {
    // If we're updating a profile, trigger incremental sync
    triggerSync(selectedSetupId.value);
  }
}

export let syncTimer: number | undefined;

export let lastSyncContext = { targetId: undefined as string | undefined, skipPush: false, manual: false };

export function triggerSync(id?: string, skipPush = false, manual = false) {
  if (syncTimer) clearTimeout(syncTimer);
  
  const effectiveId = (id && id.trim()) ? id : undefined;
  
  // If we have a pending sync, and the new request is for a DIFFERENT id, 
  // or one is FULL (undefined) and other is TARGETED, we upgrade to FULL to be safe.
  let currentTargetId: string | undefined = effectiveId;
  if (syncTimer && lastSyncContext.targetId !== effectiveId) {
    currentTargetId = undefined; // Upgrade to Full Sync
  }
  
  lastSyncContext = { targetId: currentTargetId, skipPush, manual };
  
  syncTimer = window.setTimeout(async () => {
    const context = { ...lastSyncContext };
    // Reset context before execution so next triggers start fresh
    lastSyncContext = { targetId: undefined, skipPush: false, manual: false };
    
    const ok = await ensureValidBacklogToken();
    if (!ok) {
      syncTimer = undefined;
      return;
    }
    
    if (context.skipPush) syncStatus.value = 'idle';
    await syncProfilesWithCloudflare(context.targetId, context.skipPush, context.manual);
    syncTimer = undefined;
  }, 1000); 
}

export function getProfileHashContent(p: any) {
  const { 
    updatedAt, version, sync, lastSyncedHash, isLocalEdited, 
    isExeTestMode, forceUnicode, autoWatchBat, autoWatchTargetTest, autoWatchTargetRun, 
    sqlServer, sqlDatabase, sqlUser, sqlPassword, useWindowsAuth, 
    configTemplate, runConfigTemplate, connectionStringTemplate, 
    backlogIssueColor, backlogIssueStatusName, backlogIssueStatusColor, backlogIssueNotFound, 
    ...rest 
  } = p || {};
  // clean up nulls/undefined/empty for consistent hashing
  const clean: any = {};
  for (const k of Object.keys(rest).sort()) {
    if (rest[k] !== undefined && rest[k] !== null && rest[k] !== "") clean[k] = rest[k];
  }
  return JSON.stringify(clean);
}

export async function syncProfilesWithCloudflare(targetId?: string, skipPush = false, manual = false) {
  if (!syncService.value) {
    syncStatus.value = 'idle';
    return;
  }

  // Determine sync type
  const isLazyPull = !!targetId && skipPush;
  const isTargetedSync = !!targetId && !skipPush;
  const isFullSync = !targetId;

  if (isLazyPull) isFetchingProfile.value = true;

  let pullCount = 0;
  let pushCount = 0;
  
  try {
    const localMap = new Map(setupProfiles.value.map(p => [p.id, p]));
    let profilesChanged = false;
    let backlogChanged = false;
    let currentProfilePulled = false;

    // Helper to process pulling a single profile content
    const processPulledProfile = async (cpId: string, cpVersion: number, content: any, local: ProjectProfile | undefined) => {
      const cloudHashable = getProfileHashContent(content);

      // Check for local edits if it's not ours
      if (local && local.owner !== currentUser.value) {
        const lastHash = local.lastSyncedHash || profileHashes.get(local.id);
        // If the cloud hasn't actually changed from what we previously pulled,
        // do not overwrite the local profile (preserves local edits).
        const cloudChanged = !lastHash || lastHash !== cloudHashable;

        if (!manual && !cloudChanged) {
          // Update version so we don't keep pulling unchanged content
          const idx = setupProfiles.value.findIndex(p => p.id === cpId);
          if (idx !== -1) {
            setupProfiles.value[idx].version = cpVersion;
            setupProfiles.value[idx].lastSyncedHash = cloudHashable;
            profileHashes.set(cpId, cloudHashable);
            profilesChanged = true;
          }
          return;
        }

        // If local has un-pushed edits (since it's not ours, they wouldn't be pushed anyway)
        if (local.isLocalEdited) {
          const action = await new Promise<'sync' | 'clone' | 'cancel'>((resolve) => {
            syncConflictDialog.profileName = local.name;
            syncConflictDialog.cloudChanged = cloudChanged;
            syncConflictDialog.resolve = resolve;
            syncConflictDialog.isOpen = true;
          });
          
          syncConflictDialog.isOpen = false;
          await new Promise(r => setTimeout(r, 300)); // wait for dialog animation
          
          if (action === 'cancel') {
            return; // Skip updating this profile, keeping local edits
          }
          
          if (action === 'clone') {
            const clone = JSON.parse(JSON.stringify(local));
            clone.id = makeProfileId();
            clone.name = `${clone.name} (Local Edits)`;
            clone.owner = currentUser.value;
            delete clone.version;
            delete clone.isLocalEdited;
            setupProfiles.value.push(clone);
          }
        }
      }

      const idx = setupProfiles.value.findIndex(p => p.id === cpId);
      if (idx !== -1) {
        const current = setupProfiles.value[idx];
        setupProfiles.value[idx] = { ...content, version: cpVersion, isLocalEdited: false, isExeTestMode: current.isExeTestMode, forceUnicode: current.forceUnicode ?? true, autoWatchBat: current.autoWatchBat, autoWatchTargetTest: current.autoWatchTargetTest, autoWatchTargetRun: current.autoWatchTargetRun, batFilePath: current.batFilePath, batFiles: current.batFiles };
      } else {
        setupProfiles.value.push({ ...content, version: cpVersion, isLocalEdited: false, forceUnicode: true, autoWatchBat: true, autoWatchTargetTest: false, autoWatchTargetRun: false });
      }
      
      const contentHash = getProfileHashContent(content);
      profileHashes.set(cpId, contentHash);
      
      const pIdx = setupProfiles.value.findIndex(p => p.id === cpId);
      if (pIdx !== -1) {
        setupProfiles.value[pIdx].lastSyncedHash = contentHash;
      }
      
      profilesChanged = true;
      if (cpId === selectedSetupId.value) currentProfilePulled = true;
      pullCount++;
    };

    // --- 1. PULL PHASE ---
    if (isLazyPull) {
      const cloudProfile = await syncService.value.getProfile(targetId!);
      if (cloudProfile && cloudProfile.content) {
        const content = typeof cloudProfile.content === 'string' ? JSON.parse(cloudProfile.content) : cloudProfile.content;
        const local = localMap.get(targetId!);
        const serverVersion = Number(cloudProfile.version) || 0;
        const localVersion = Number(local?.version) || 0;

        if (!local || serverVersion > localVersion || manual) {
          await processPulledProfile(targetId!, serverVersion, content, local);
        }
      }
    } else {
      const cloudMetas = await syncService.value.getProfiles();
      const profilesToPull: string[] = [];

      cloudMetas.forEach(meta => {
        if (isTargetedSync && meta.id !== targetId) return;

        const deletedAt = deletedProfileIds.value.get(meta.id);
        if (deletedAt) return; // Permanent local tombstone blocks pull if cloud delete failed

        const local = localMap.get(meta.id);
        const serverVersion = Number(meta.version) || 0;
        const localVersion = Number(local?.version) || 0;
        if (!local || serverVersion > localVersion || manual) {
          profilesToPull.push(meta.id);
        }
      });

      if (profilesToPull.length > 0) {
        if (!isLazyPull) syncStatus.value = 'saving';
        const pullResults = await Promise.all(profilesToPull.map(id => syncService.value!.getProfile(id)));
        for (const cp of pullResults) {
          if (!cp || !cp.content) continue;
          const content = typeof cp.content === 'string' ? JSON.parse(cp.content) : cp.content;
          const local = localMap.get(cp.id);
          const meta = cloudMetas.find(m => m.id === cp.id);
          const serverVer = Number(cp.version) || Number(meta?.version) || 0;
          await processPulledProfile(cp.id, serverVer, content, local);
        }
      }

      if (isFullSync) {
        const cloudIds = new Set(cloudMetas.map(m => m.id));
        
        // 1. Clear tombstones for IDs no longer on cloud
        let tombstoneChanged = false;
        deletedProfileIds.value.forEach((_, id) => {
           if (!cloudIds.has(id)) {
             deletedProfileIds.value.delete(id);
             tombstoneChanged = true;
           }
        });
        if (tombstoneChanged) saveDeletedProfileIds();

        // 2. REMOTE DELETE: If a synced profile is missing from cloud, delete it locally
        // (But only if it's NOT in our recently deleted list and NOT a guest profile)
        const toRemoveLocally = setupProfiles.value.filter(p => 
          p.owner !== "Guest" && 
          p.version !== undefined && // It was previously synced
          !cloudIds.has(p.id) && 
          !deletedProfileIds.value.has(p.id)
        );

        if (toRemoveLocally.length > 0) {
          syncStatus.value = 'saving';
          console.log(`[Sync] Removing ${toRemoveLocally.length} profiles deleted on other machines.`);
          setupProfiles.value = setupProfiles.value.filter(p => !toRemoveLocally.includes(p));
          profilesChanged = true;
        }
      }
      
      // Cleanup auto-generated empty Default profile if we pulled real profiles
      const emptyDefaultIdx = setupProfiles.value.findIndex(p => p.name === "Default" && !p.projectRoot && !p.startupProject);
      if (emptyDefaultIdx !== -1 && setupProfiles.value.length > 1) {
        const removedId = setupProfiles.value[emptyDefaultIdx].id;
        setupProfiles.value.splice(emptyDefaultIdx, 1);
        profilesChanged = true;
        if (selectedSetupId.value === removedId) {
          selectedSetupId.value = setupProfiles.value[0].id;
        }
      }
    }

    // --- 2. PUSH PHASE ---
    if (!skipPush) {
      const pushProfile = async (p: ProjectProfile) => {
        if (p.owner !== currentUser.value) return;

        // Prevent pushing auto-generated empty Default profiles to cloud
        if (p.name === "Default" && !p.projectRoot && !p.startupProject) return;

        const currentContentStr = getProfileHashContent(p);
        const lastHash = p.lastSyncedHash || profileHashes.get(p.id);
        if (lastHash === currentContentStr) return;

        const meta = await syncService.value!.getProfile(p.id);
        const serverVer = Number(meta?.version) || 0;
        const localVer = Number(p.version) || 0;

        if (localVer >= serverVer || !meta) {
           syncStatus.value = 'saving';
           const { sync: _sync, lastSyncedHash: _lsh, isLocalEdited: _ile, isExeTestMode: _ietm, forceUnicode: _f, autoWatchBat: _awb, autoWatchTargetTest: _awtt, autoWatchTargetRun: _awtr, sqlServer: _ss, sqlDatabase: _sdb, sqlUser: _su, sqlPassword: _sp, useWindowsAuth: _uwa, configTemplate: _ct, runConfigTemplate: _rct, connectionStringTemplate: _cst, backlogIssueColor: _bic, backlogIssueStatusName: _bisn, backlogIssueStatusColor: _bisc, backlogIssueNotFound: _binf, ...payloadToSync } = p as any;
           const result = await syncService.value!.upsertProfile({
             id: p.id,
             name: p.name,
             content: payloadToSync,
             version: localVer
           });
           if (result.success && result.version) {
             p.version = result.version;
             p.lastSyncedHash = currentContentStr;
             profileHashes.set(p.id, currentContentStr);
             profilesChanged = true;
             pushCount++;
           }
        }
      };

      if (isTargetedSync) {
        const profile = setupProfiles.value.find(p => p.id === targetId);
        if (profile) await pushProfile(profile);
      } else if (isFullSync) {
        for (const p of setupProfiles.value) {
          await pushProfile(p);
        }
      }
    }

    if (profilesChanged) {
      await setItem(setupStorageKey(), setupProfiles.value);
      if (selectedSetupId.value && currentProfilePulled) applySelectedSetupProfile(true);
    }
    if (backlogChanged) await saveUIState();

    lastSyncTime.value = Date.now();
    if (pullCount > 0 || pushCount > 0 || manual) {
      syncStatus.value = 'saved';
      if (manual || isFullSync) {
         toast.success(`Sync complete: ${pullCount} pulled, ${pushCount} pushed.`);
      }
      setTimeout(() => { if (syncStatus.value === 'saved') syncStatus.value = 'idle'; }, 3000);
    } else {
      if (syncStatus.value !== 'idle') syncStatus.value = 'idle';
    }
  } catch (e) {
    console.error("Sync failed", e);
    syncStatus.value = 'error';
    if (manual) toast.error("Sync failed", { description: String(e) });
  } finally {
    isFetchingProfile.value = false;
  }
}

export function ensureVisibleSelection() {
  const owners = ownerOptions.value;
  if (owners.length > 0 && !owners.includes(selectedOwner.value)) {
    selectedOwner.value = owners[0];
  }
  const visible = scopedProfiles.value;
  if (!visible.some((p) => p.id === selectedSetupId.value)) {
    selectedSetupId.value = visible[0]?.id ?? "";
  }
}

export async function applySelectedSetupProfile(silent = false) {
  const setup = setupProfiles.value.find((x) => x.id === selectedSetupId.value);
  if (!setup) {
    if (!silent) toast.error("Setup profile not selected");
    return;
  }
  
  // LOCK: Block auto-save watchers while we populate the form
  isApplyingProfile.value = true;
  
  // Initialize editable name for the restored input field
  editableProfileName.value = setup.name;
  
  applySetupToRunner(setup);
  
  // Wait for Vue's reactive updates to settle before lifting the lock
  setTimeout(() => {
    isApplyingProfile.value = false;
  }, 500);
}

export function saveCurrentToSelectedSetupProfile() {
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) return;
  
  const cleanObj = (obj: any) => {
    const res = { ...obj };
    for (const key in res) {
      if (res[key] === null || res[key] === undefined || (Array.isArray(res[key]) && res[key].length === 0) || res[key] === "") {
        delete res[key];
      }
    }
    return res;
  };
  const oldSetupStr = JSON.stringify(cleanObj(setupProfiles.value[idx]), Object.keys(cleanObj(setupProfiles.value[idx])).sort());
  const setup = { ...setupProfiles.value[idx] };
  
  // Helper to convert to relative if possible
  const toRel = (p: string) => {
    if (!p || !runner.workspaceRoot) return p;
    const ws = runner.workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");
    const normP = p.replace(/\\/g, "/");
    if (normP.toLowerCase().startsWith(ws.toLowerCase())) {
      const rel = normP.substring(ws.length).replace(/^\//, "");
      // Convert back to backslashes for consistency with how it was saved
      return rel.replace(/\//g, "\\");
    }
    return p;
  };

  setup.projectRoot = toRel(runner.projectRoot);
  setup.startupProject = runner.startupProject;
  setup.buildConfig = runner.config === "Release" ? "Release" : "Debug";
  setup.urls = runner.urls;
  setup.aliasExeName = runner.aliasExeName;
  setup.batFilePath = toRel(runner.batFilePath);
  setup.batFiles = runner.batFiles ? [...runner.batFiles].map(toRel) : [];
  setup.batFilesActiveArgIds = runner.batFilesActiveArgIds ? [...runner.batFilesActiveArgIds] : [];
  setup.batFilesArgs = runner.batFilesArgs ? [...runner.batFilesArgs] : [];
  setup.runArgs = runner.runArgs;
  setup.exeArgs = runner.exeArgs;
  setup.isExeTestMode = runner.isExeTestMode;
  // forceUnicode, autoWatchTargetTest, autoWatchTargetRun are now global app settings
  setup.sqlSetupPath = runner.sqlSetupPath;
  
  setup.sqlSnippets = JSON.parse(JSON.stringify(runner.sqlSnippets));
  setup.activeSqlSnippetId = runner.activeSqlSnippetId;
    setup.runArgSnippets = runner.runArgSnippets ? JSON.parse(JSON.stringify(runner.runArgSnippets)).map((s: any) => ({ ...s, batPath: s.batPath ? toRel(s.batPath) : s.batPath })) : [];
    setup.activeRunArgId = runner.activeRunArgId;
    setup.selectedRunArgIds = JSON.parse(JSON.stringify(runner.selectedRunArgIds || []));
    setup.exeArgSnippets = runner.exeArgSnippets ? JSON.parse(JSON.stringify(runner.exeArgSnippets)).map((s: any) => ({ ...s, batPath: s.batPath ? toRel(s.batPath) : s.batPath })) : [];
    setup.activeExeArgId = runner.activeExeArgId;
    setup.selectedExeArgIds = JSON.parse(JSON.stringify(runner.selectedExeArgIds || []));
  setup.sync = (() => {
    const { logs, ...syncData } = sync;
    return JSON.parse(JSON.stringify(syncData));
  })();
  
  setup.backlogProjectKey = runner.backlogProjectKey;
  setup.backlogIssueTypeId = runner.backlogIssueTypeId;
  setup.backlogIssueKey = runner.backlogIssueKey;
  setup.backlogIssueSummary = runner.backlogIssueSummary;
  setup.deployPath = toRel(runner.deployPath);
  
  const setupForCompare = { ...setup, updatedAt: setupProfiles.value[idx].updatedAt };
  const newSetupStr = JSON.stringify(cleanObj(setupForCompare), Object.keys(cleanObj(setupForCompare)).sort());
  if (oldSetupStr !== newSetupStr) {
    setup.updatedAt = Date.now();
    if (setup.owner !== currentUser.value) {
      setup.isLocalEdited = true;
    }
    setupProfiles.value[idx] = setup;
    saveSetupsForCurrentRoot();
  }
}

export const preventAutoSearch = ref(false);

export function focusProfileName() {
  if (!selectedProfile.value) return;
  nextTick(() => {
    profileNameInput.value?.focus();
  });
}

export function commitProfileName() {
  const namePart = editableProfileName.value.trim();
  if (!namePart) {
    return;
  }
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) {
    return;
  }
  const setup = { ...setupProfiles.value[idx] };
  
  setup.name = namePart;
  
  setupProfiles.value[idx] = setup;
  saveSetupsForCurrentRoot();
}

export function createNewSetupProfile() {
  if (runner.running) {
    return;
  }

  if (backlog.status !== 'success') {
    toast.error("Backlog Login Required", {
      description: "You need to log in to Backlog to use this feature.",
      duration: 5000,
    });
    return;
  }
  
  // Clear runner fields for a fresh start
  runner.projectRoot = "";
  runner.startupProject = "";
  runner.aliasExeName = "";
  runner.batFilePath = "";
  runner.batFiles = [];
  runner.batFilesActiveArgIds = [];
  runner.batFilesArgs = [];
  runner.runArgs = "";
  runner.exeArgs = "";
  runner.isExeTestMode = false;
  selectedProjectRoot.value = "";
  
  // Clear Backlog issue links for a fresh start
  runner.backlogIssueKey = "";
  runner.backlogIssueSummary = "";
  runner.backlogIssueTypeId = undefined;
  runner.backlogIssueColor = "";
  runner.backlogIssueStatusName = "";
  runner.backlogIssueStatusColor = "";
  runner.backlogIssueNotFound = false;
  issueSearchQuery.value = "";
  showIssueSearch.value = false;
  
  const nextNum = (() => {
    const nums = setupProfiles.value
      .filter(p => p.owner === currentUser.value)
      .map(p => {
        const match = p.name.match(/^Setup\s+(\d+)/i);
        return match ? parseInt(match[1]) : 0;
      });
    return Math.max(0, ...nums) + 1;
  })();
  const baseName = `Setup ${nextNum}`;
  const setup = buildSetupFromRunner(baseName);
  setupProfiles.value.push(setup);
  selectedOwner.value = currentUser.value;
  selectedSetupId.value = setup.id;
  saveSetupsForCurrentRoot();
  triggerSync(setup.id);
  preventAutoSearch.value = true;
  focusProfileName();
  setTimeout(() => { preventAutoSearch.value = false; }, 300);
}

export function cloneSelectedSetupProfile() {
  if (runner.running) return;
  if (backlog.status !== 'success') {
    toast.error("Backlog Login Required", {
      description: "You need to log in to Backlog to use this feature.",
      duration: 5000,
    });
    return;
  }

  const profileToClone = setupProfiles.value.find((x) => x.id === selectedSetupId.value);
  if (!profileToClone) return;

  const setup = JSON.parse(JSON.stringify(profileToClone));
  setup.id = makeProfileId();
  setup.name = `${setup.name} (Clone)`;
  setup.owner = currentUser.value;
  delete setup.version;
  delete setup.isLocalEdited;

  setupProfiles.value.push(setup);
  selectedOwner.value = currentUser.value;
  selectedSetupId.value = setup.id;
  
  applySetupToRunner(setup);
  saveSetupsForCurrentRoot();
  triggerSync(setup.id);
  
  toast.success("Profile Cloned", { description: "You can now edit your local copy." });
}

export async function deleteSelectedSetupProfile() {
  if (runner.running) {
    return;
  }
  if (setupProfiles.value.length <= 1) {
    toast.error("Must keep at least 1 setup");
    return;
  }
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) return;
  
  const profileToDelete = setupProfiles.value[idx];
  
  // Track this ID so we don't pull it back during the next sync
  deletedProfileIds.value.set(profileToDelete.id, Date.now());
  saveDeletedProfileIds();
  
  setupProfiles.value.splice(idx, 1);
  selectedSetupId.value = setupProfiles.value[0]?.id ?? "";
  applySelectedSetupProfile();
  await saveSetupsForCurrentRoot();
  
  // Also delete from Cloudflare if synced
  if (syncService.value && profileToDelete.owner === currentUser.value) {
    try {
      await syncService.value.deleteProfile(profileToDelete.id);
      // Wait for cloud delete to potentially process, or just trust the tombstone
    } catch (e) {
      console.error("Failed to delete profile from server", e);
    }
  }
}

export async function exportProfileToDoc() {
  if (!selectedProfile.value) return;
  const p = selectedProfile.value;
  
  const content = `# Profile: ${p.name}
> Exported from BSN iSync on ${new Date().toLocaleString()}

## 1. General Configuration
- **Owner**: ${p.owner}
- **Workspace**: ${runner.workspaceRoot || 'Not Set'}
- **Project Root**: ${p.projectRoot}
- **Startup Project**: ${p.startupProject}
- **Target Executable**: ${p.aliasExeName || 'Direct .exe'}

## 2. Execution Logic
- **Build Configuration**: ${p.buildConfig}
- **Runner Arguments**: \`${p.runArgs || '(empty)'}\`
- **Exe Arguments**: \`${p.exeArgs || '(empty)'}\`
- **Test (BAT) File**: \`${p.batFilePath || '(empty)'}\`
- **Deploy Path (Override)**: \`${p.deployPath || '(default)'}\`

## 3. Database Connection
- **Server**: \`${p.sqlServer || '(default)'}\`
## 4. SQL Scripts (${p.sqlSnippets?.length || 0})
${(p.sqlSnippets || []).map((s, i) => `
### Step ${i + 1}: ${s.name}
\`\`\`sql
${s.content}
\`\`\`
`).join('\n')}

---
*Document generated by BSN iSync - Modernizing Workflow.*
`;

  try {
    const path = await save({
      filters: [{ name: 'Markdown Documentation', extensions: ['md'] }],
      defaultPath: `${p.name.replace(/[^a-z0-9]/gi, '_')}_Guide.md`
    });

    if (path) {
      await writeTextFile(path, content);
      toast.success("Documentation exported successfully!", {
        description: `Saved to: ${path.split('\\').pop()}`,
        action: {
          label: 'Open File',
          onClick: () => invoke('open_file', { path })
        }
      });
    }
  } catch (err) {
    console.error(err);
    toast.error("Export failed", {
      description: String(err)
    });
  }
}

export const sync = reactive({
  confirmOverwrite: true,
  preserveStructure: true,
  dryRun: false,
  checksum: "sha256",
  sql: {
    source: "",
    dest: "database\\sql",
    include: "**/*.sql",
    exclude: "**/*.bak",
  },
  bat: {
    source: "",
    dest: "tools\\scripts",
    include: "*.bat",
  },
  exe: {
    source: "",
    dest: "tools\\bin",
    requireSignature: true,
  },
  logs: [] as string[],
});

export function toggleTheme() {
  dark.value = !dark.value;
  const el = document.documentElement;
  if (dark.value) el.classList.add("dark");
  else el.classList.remove("dark");
  
  const theme = dark.value ? TERMINAL_THEMES.dark : TERMINAL_THEMES.light;
  termState.terminals.forEach((tId: string) => {
    if (termState[tId]?.term) termState[tId].term.options.theme = theme;
  });
}

export function clearLogs() {
  runner.logs = [];
  termState.terminals.forEach((tId: string) => {
    if (termState[tId]?.term) termState[tId].term.clear();
  });
}

export async function cdToRoot() {
  if (!runner.projectRoot) return;
  const cmd = `cd '${runner.projectRoot}'\r`;
  await invoke("pty_write", { id: "main", data: cmd });
  // If we were in 'run', maybe the user wants to see it? but usually they use this in 'main'
  if (termState.active !== 'main') {
    termState.active = 'main';
    nextTick(() => termState.main.fit?.fit());
  }
}

export function validatePaths() {
  return runner.projectRoot.trim().length > 0 && runner.startupProject.trim().length > 0;
}

export function normalizePath(path: string) {
  let s = path.replace(/\//g, "\\");
  if (s.startsWith("\\\\?\\")) {
    s = s.substring(4);
  }
  return s;
}

export async function pickProjectFolder() {
  const picked = await invoke<string | null>("pick_project_folder");
  if (!picked) return;
  runner.workspaceRoot = normalizePath(picked);
  await discoverProjects(true); // Manually picking folder should auto-select
}

export async function discoverProjects(autoSelect = false) {
  if (!runner.workspaceRoot.trim()) {
    return;
  }
  try {
    const mapped = await invoke<Array<{
      name: string;
      root: string;
      startup_project: string;
      sln_count: number;
      csproj_count: number;
    }>>("discover_projects", { root: normalizePath(runner.workspaceRoot.trim()) });
    discoveredProjects.value = mapped.map((x) => ({
      name: x.name,
      root: x.root,
      startupProject: x.startup_project,
      slnCount: x.sln_count,
      csprojCount: x.csproj_count,
    }));
    
    // Only auto-select if requested AND nothing is currently selected
    if (autoSelect && discoveredProjects.value.length > 0) {
      if (!runner.projectRoot) {
        selectedProjectRoot.value = discoveredProjects.value[0].root;
        applySelectedProject();
      }
    }
  } catch (e: any) {
    // Silent error
  }
}

export function applySelectedProject() {
  const selected = discoveredProjects.value.find((x) => x.root === selectedProjectRoot.value);
  if (!selected) {
    return;
  }
  
  // selected.root is ABSOLUTE from discover_projects
  runner.projectRoot = normalizePath(selected.root);
  if (selected.startupProject) {
    runner.startupProject = selected.startupProject;
  }

  // Auto-Discovery for BAT file if current is empty
  if (!runner.batFilePath && (selected as any).foundBat) {
    const ws = runner.workspaceRoot.replace(/[\\/]$/, "");
    runner.batFilePath = normalizePath(`${ws}\\${(selected as any).foundBat}`);
    toast.info("Auto-discovered matching BAT file", { description: (selected as any).foundBat });
  }
  
  // Sync PTY terminal location
  invoke("pty_write", { id: "main", data: `cd '${runner.projectRoot}'\r` }).catch(() => {});
  
  loadConfigsForCurrentProject();
}

export async function runDotnetAndCollect(mode: "restore" | "build") {
  const config = runner.config || "Debug";
  
  // Extract project directory and filename
  const projectPath = runner.startupProject.replace(/\\/g, '/');
  const lastSlash = projectPath.lastIndexOf('/');
  const projectDir = lastSlash !== -1 
    ? runner.projectRoot + '\\' + runner.startupProject.substring(0, lastSlash).replace(/\//g, '\\')
    : runner.projectRoot;
  const projectFile = lastSlash !== -1
    ? runner.startupProject.substring(lastSlash + 1)
    : runner.startupProject;

  // We use pty_write for building to show progress in main terminal
  // Auto cd to project root for build/rebuild
  await invoke("pty_write", { id: "main", data: `cd '${projectDir}'\r` });
  const cmd = `dotnet ${mode} "${projectFile}" -c ${config}\r`;
  await invoke("pty_write", { id: "main", data: cmd });
}

export async function dotnet(cmd: "restore" | "build" | "run", target: "exe" | "bat" = "exe", overrideArgs?: string) {
  const loadingKey = cmd === "run" ? target : cmd;
  runner.loadingTarget = loadingKey;
  
  saveCurrentToSelectedSetupProfile();
  if (!validatePaths()) {
    toast.error("Please enter projectRoot and startupProject");
    runner.loadingTarget = null;
    return;
  }
  // Smart EXE suffix check
  if (runner.aliasExeName && !runner.aliasExeName.toLowerCase().endsWith(".exe")) {
    runner.aliasExeName += ".exe";
  }
  if (cmd === "restore") {
    await runDotnetAndCollect("restore");
    runner.loadingTarget = null;
    return;
  } else if (cmd === "build") {
    await runDotnetAndCollect("build");
    runner.loadingTarget = null;
    return;
  }
    const isTestButton = cmd === "run" && target === "bat";
    const isExeTest = isTestButton && runner.isExeTestMode;
    const actualTarget = isExeTest ? "test_exe" : target;
    const fallbackArgs = isExeTest ? runner.exeArgs : runner.runArgs;
    const actualArgs = overrideArgs ?? (target === 'bat' && !isExeTest ? currentBatArgs.value : fallbackArgs);

    let runId = "";
    let runName = "";
    try {
      const useSharedTerminal = actualTarget === 'bat' || actualTarget === 'test_exe';
      if (actualTarget === 'exe' || actualTarget === 'test_exe' || actualTarget === 'bat') {
        runName = actualTarget === 'bat' ? 'BAT' : 'EXE';
        if (actualTarget === 'bat' && runner.activeRunArgId) {
          const snip = runner.runArgSnippets?.find(s => s.id === runner.activeRunArgId);
          if (snip) runName = snip.name;
        } else if (actualTarget !== 'bat' && runner.activeExeArgId) {
          const snip = runner.exeArgSnippets?.find(s => s.id === runner.activeExeArgId);
          if (snip) runName = snip.name;
        }

        if (useSharedTerminal) {
          runId = 'main';
          termState.active = 'main';
          nextTick(() => termState.main.fit?.fit());
        } else {
          runId = `run-1`;
          if (!termState.terminals.includes(runId)) {
            termState.terminals.push(runId);
            termState[runId] = { term: null as any, fit: null as any, name: runName };
          } else {
            termState[runId].name = runName;
          }
          termState.active = 'main';
          await nextTick();
          const el = document.getElementById('term-' + runId);
          if (el && !termState[runId].term) {
            await initPty(runId as any, el);
          }
          termState[runId].fit?.fit();
        }
      }

      const allBats = isExeTest 
        ? [runner.batFilePath].filter(b => b && b.trim()) 
        : [runner.batFilePath, ...(runner.batFiles || [])].filter(b => b && b.trim());
      
      const tasks: { target: string, batPath: string | null, ptyId: string, name: string, args: string }[] = [];
      
      if (allBats.length === 0) {
        tasks.push({ target: actualTarget, batPath: null, ptyId: runId, name: runName, args: actualTarget === 'exe' ? "" : actualArgs });
      } else {
        for (let i = 0; i < allBats.length; i++) {
          let tName = i === 0 ? runName : `${actualTarget === 'bat' ? 'BAT' : 'EXE'} ${i+1}`;
          if (!useSharedTerminal && allBats[i]) {
            const m = allBats[i].match(/([^\\]+)\.bat$/i);
            if (m) tName = m[1];
          }
          tasks.push({
            target: actualTarget,
            batPath: allBats[i],
            ptyId: useSharedTerminal ? 'main' : (i === 0 ? runId : `run-${i + 1}`),
            name: tName,
            args: actualTarget === 'exe' ? "" : (i === 0 ? actualArgs : (runner.batFilesArgs?.[i - 1] || ""))
          });
        }
      }

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        if (task.ptyId !== 'main' && termState[task.ptyId]) {
          termState[task.ptyId].name = task.name;
        }

        if (task.ptyId !== runId) {
          if (!termState.terminals.includes(task.ptyId)) {
            termState.terminals.push(task.ptyId);
            termState[task.ptyId] = { term: null as any, fit: null as any, name: task.name };
          }
          termState.active = 'main';

          await nextTick();
          const el = document.getElementById('term-' + task.ptyId);
          if (el && !termState[task.ptyId].term) {
            await initPty(task.ptyId as any, el);
          }
          termState[task.ptyId].fit?.fit();
          await new Promise(r => setTimeout(r, 1000)); // Stagger delay
        }

        const isAppRun = actualTarget === 'exe' || actualTarget === 'test_exe';
        
        let taskAliasExeName = runner.aliasExeName;
        let taskConfigTemplate = runner.configTemplate;
        let taskRunConfigTemplate = runner.runConfigTemplate;
        
        if (task.batPath) {
          const m = task.batPath.match(/([^\\]+)\.bat$/i);
          if (m) {
            const msmq = m[1];
            if (isAppRun && actualTarget !== 'test_exe') {
              taskAliasExeName = `${msmq}.exe`;
            }
            if (taskConfigTemplate) {
              taskConfigTemplate = taskConfigTemplate.replace(/(<add\s+key="Job\.MsmqName"\s+value=")([^"]*)("\s*\/>)/gi, `$1${msmq}$3`);
              taskConfigTemplate = taskConfigTemplate.replace(/(<add\s+key="Job\.BatFilePath"\s+value=")([^"]*)("\s*\/>)/gi, `$1${task.batPath}$3`);
            }
            if (taskRunConfigTemplate) {
              taskRunConfigTemplate = taskRunConfigTemplate.replace(/(<add\s+key="Job\.MsmqName"\s+value=")([^"]*)("\s*\/>)/gi, `$1${msmq}$3`);
              taskRunConfigTemplate = taskRunConfigTemplate.replace(/(<add\s+key="Job\.BatFilePath"\s+value=")([^"]*)("\s*\/>)/gi, `$1${task.batPath}$3`);
            }
          }
        }

        await invoke("dotnet_run_start", {
          request: {
            projectRoot: runner.projectRoot,
            startupProject: runner.startupProject,
            urls: runner.urls || null,
            buildConfig: runner.config,
            aliasExeName: taskAliasExeName,
            batFilePath: task.batPath,
            target: task.target,
            configTemplate: taskConfigTemplate,
            sqlSetupPath: runner.sqlSetupPath || null,
            sqlServer: runner.sqlServer || null,
            sqlDatabase: runner.sqlDatabase || null,
            sqlUser: runner.sqlUser || null,
            sqlPassword: runner.sqlPassword || null,
            sqlUseWindowsAuth: runner.useWindowsAuth,
            runArgs: resolveArgs(task.args),
            deployPath: runner.deployPath || null,
            runConfigTemplate: taskRunConfigTemplate,
            forceUnicode: runner.forceUnicode,
            ptyId: task.ptyId,
          },
        });
      }

      // Only set runner.running for 'exe' to trigger the Stop toggle and Output session
      if (actualTarget === 'exe') {
        runner.running = true;
      }
  } catch (e: any) {
    toast.error(String(e));
    termState.active = 'main';
  } finally {
    runner.loadingTarget = null;
  }
}

export async function rebuild() {
  runner.loadingTarget = "rebuild";
  saveCurrentToSelectedSetupProfile();
  if (!validatePaths()) {
    toast.error("Please enter projectRoot and startupProject");
    runner.loadingTarget = null;
    return;
  }
  try {
    const config = runner.config || "Debug";
    const cmd = `dotnet build "${runner.startupProject}" -c ${config}\r`;
    await invoke("pty_write", { id: "main", data: cmd });
  } catch (e: any) {
    toast.error(String(e));
  } finally {
    runner.loadingTarget = null;
  }
}

export function switchTerminal(tId: string) {
  termState.active = tId;
  nextTick(() => {
    if (termState[tId]?.fit) {
      termState[tId].fit.fit();
    }
  });
}

export async function stop() {
  try {
    await invoke("dotnet_run_stop");
    runner.running = false;
    termState.terminals = termState.terminals.filter((t: string) => t === 'main');
    termState.active = 'main';
    nextTick(() => termState.main.fit?.fit());
  } catch (e: any) {
    // Silent error
  }
}

export async function browseBatFile(index?: number) {
  const workspace = runner.workspaceRoot;
  const defaultDir = `${workspace}\\batch`;
  const picked = await invoke("pick_file", { defaultPath: defaultDir }) as string | null;
  if (picked) {
    if (typeof index === 'number') {
      if (!runner.batFiles) runner.batFiles = [];
      runner.batFiles[index] = picked;
    } else {
      runner.batFilePath = picked;
    }
    
    // Auto-fill EXE Name if it is currently empty based on chosen bat file
    if (!runner.aliasExeName.trim()) {
      const filenameMatch = picked.match(/[^\\/]+$/);
      if (filenameMatch) {
        runner.aliasExeName = filenameMatch[0].replace(/\.[^/.]+$/, "") + ".exe";
      }
    }
    const currentId = typeof index === 'number' ? (runner.batFilesActiveArgIds?.[index] || "") : runner.activeRunArgId;
    const s = runner.runArgSnippets.find(x => x.id === currentId);
    if(s) s.batPath = picked;
    const s2 = runner.exeArgSnippets.find(x => x.id === runner.activeExeArgId);
    if(s2) s2.batPath = picked;
  }
}

export async function loadConfigsForCurrentProject() {
  if (!runner.projectRoot || !runner.startupProject) return;
  
  try {
    const targetContent = await invoke("fetch_project_config", {
      projectRoot: runner.projectRoot,
      startupProject: runner.startupProject,
    }).catch(e => { console.warn("Failed to fetch target config", e); return null; });
    
    if (targetContent) {
        runner.configTemplate = targetContent as string;
    }
    
    const runContent = await invoke("fetch_project_config", {
      projectRoot: "D:\\workspace\\invoice\\Arkbell.Console\\Arkbell.Console.ReceiveBatchAction",
      startupProject: "Arkbell.Console.ReceiveBatchAction.csproj",
    }).catch(e => { console.warn("Failed to fetch run config", e); return null; });

    if (runContent) {
      runner.runConfigTemplate = runContent as string;
    }
    
    // Run the sync template substitution on the newly loaded fresh contents
    applyConfigSyncToTemplates();
    
  } catch (e: any) {
    console.error("Auto-sync configs failed:", e);
  }
}

export async function runSqlOnly() {
  if (!runner.sqlServer?.trim()) {
    toast.error("Please enter SQL Server");
    return;
  }
  if (!runner.sqlDatabase?.trim()) {
    toast.error("Please enter Database name");
    return;
  }
  if (!runner.useWindowsAuth && (!runner.sqlUser?.trim() || !runner.sqlPassword?.trim())) {
    toast.error("Please enter SQL Username/Password");
    return;
  }
  if (!runner.sqlSetupPath || !runner.sqlSetupPath.trim()) {
    toast.error("Missing SQL content", {
      description: "Please enter SQL code directly in the box below."
    });
    return;
  }

  try {
    const input = runner.sqlSetupPath.trim();
    if (!input) return;

    let sqlPath = "";
    let deleteCmd = "";
    
    // Always treat as raw SQL script
    sqlPath = await invoke("prepare_sql_temp_file", { content: input }) as string;
    deleteCmd = `; del -Force "${sqlPath}"`;

    let authParams = runner.useWindowsAuth ? "-E" : `-U "${runner.sqlUser}" -P "${runner.sqlPassword}"`;
    let cmd_str = `chcp 65001 > $null; sqlcmd -f 65001 -S "${runner.sqlServer}" -d "${runner.sqlDatabase}" ${authParams}`;
    cmd_str += ` -i "${sqlPath}"${deleteCmd}\r\n`;

    // Write to main terminal so user can see output
    termState.active = 'main';
    await invoke("pty_write", { id: "main", data: cmd_str });
  } catch (e: any) {
    toast.error(String(e));
  }
}

export async function runAllSqlSnippets() {
  if (!runner.sqlServer?.trim()) {
    toast.error("Please enter SQL Server");
    return;
  }
  if (!runner.sqlDatabase?.trim()) {
    toast.error("Please enter Database name");
    return;
  }
  if (!runner.useWindowsAuth && (!runner.sqlUser?.trim() || !runner.sqlPassword?.trim())) {
    toast.error("Please enter SQL Username/Password");
    return;
  }
  if (runner.sqlSnippets.length === 0) {
    toast.error("No SQL Scripts found to run.");
    return;
  }

  let combinedSql = "";
  for (const snippet of runner.sqlSnippets) {
    if (snippet.content.trim()) {
      combinedSql += `\r\nPRINT '----------------------------------------'\r\n`;
      combinedSql += `PRINT '--- Executing: ${snippet.name.replace(/'/g, "''")} ---'\r\n`;
      combinedSql += `PRINT '----------------------------------------'\r\nGO\r\n`;
      combinedSql += snippet.content.trim() + `\r\nGO\r\n`;
    }
  }

  if (!combinedSql.trim()) {
    toast.info("All scripts are empty.");
    return;
  }

  try {
    let sqlPath = await invoke("prepare_sql_temp_file", { content: combinedSql }) as string;
    let deleteCmd = `; del -Force "${sqlPath}"`;

    let authParams = runner.useWindowsAuth ? "-E" : `-U "${runner.sqlUser}" -P "${runner.sqlPassword}"`;
    let cmd_str = `chcp 65001 > $null; sqlcmd -f 65001 -S "${runner.sqlServer}" -d "${runner.sqlDatabase}" ${authParams}`;
    cmd_str += ` -i "${sqlPath}"${deleteCmd}\r\n`;

    termState.active = 'main';
    await invoke("pty_write", { id: "main", data: cmd_str });
    
    toast.success("Executing All Scripts", { description: "Check terminal for output." });
  } catch (e: any) {
    toast.error("Execution failed", { description: String(e) });
  }
}

export function onSnippetSelected(id: string | null) {
  if (!id) return;
  const snippet = runner.sqlSnippets.find(s => s.id === id);
  if (snippet) {
    runner.sqlSetupPath = snippet.content;
  }
}

export function createNewSqlSnippet() {
  startNamingSqlSnippet('create');
}

export function renameActiveSqlSnippet() {
  startNamingSqlSnippet('rename');
}

export function deleteActiveSqlSnippet() {
  const idx = runner.sqlSnippets.findIndex(s => s.id === runner.activeSqlSnippetId);
  if (idx === -1) return;
  if (!confirm(`Delete SQL script "${runner.sqlSnippets[idx].name}"?`)) return;
  runner.sqlSnippets.splice(idx, 1);
  if (runner.sqlSnippets.length > 0) {
    runner.activeSqlSnippetId = runner.sqlSnippets[0].id;
    runner.sqlSetupPath = runner.sqlSnippets[0].content;
  } else {
    runner.activeSqlSnippetId = "";
    runner.sqlSetupPath = "";
  }
}

export async function checkEnv() {
  try {
    envStatus.value = await invoke<EnvCheck[]>("check_environment");
    const missing = envStatus.value.filter(x => !x.found);
    if (missing.length > 0) {
      toast.warning("Some required tools are missing", {
        description: `Missing: ${missing.map(x => x.name).join(", ")}. Please install them to use all features.`,
        duration: 10000,
      });
    }
  } catch (e) {
    console.error("Failed to check environment:", e);
  }
}

export function formatTauriShortcut(e: KeyboardEvent): string {
  const modifiers = [];
  if (e.ctrlKey || e.metaKey) modifiers.push('CommandOrControl');
  if (e.altKey) modifiers.push('Alt');
  if (e.shiftKey) modifiers.push('Shift');

  let key = e.key.toUpperCase();
  if (key === ' ') key = 'Space';
  else if (key === 'ESCAPE') key = 'Esc';
  else if (key === 'ARROWUP') key = 'Up';
  else if (key === 'ARROWDOWN') key = 'Down';
  else if (key === 'ARROWLEFT') key = 'Left';
  else if (key === 'ARROWRIGHT') key = 'Right';
  
  if (e.code.startsWith('Key')) {
    key = e.code.replace('Key', '');
  } else if (e.code.startsWith('Digit')) {
    key = e.code.replace('Digit', '');
  } else if (e.code.startsWith('F') && e.code.length > 1) {
    key = e.code;
  }

  if (modifiers.length === 0) return key;
  return [...modifiers, key].join('+');
}

export async function startRecordingShortcut(action: string) {
  if (isRecordingShortcut.value) return;
  isRecordingShortcut.value = true;
  recordingAction.value = action;
  window.addEventListener("keydown", handleShortcutKeydown, true);
  toast.info(`Recording shortcut... Press any combination for ${action.toUpperCase()}`, { duration: 4000 });
}

export function stopRecordingShortcut() {
  isRecordingShortcut.value = false;
  recordingAction.value = null;
  window.removeEventListener("keydown", handleShortcutKeydown, true);
}

export async function handleShortcutKeydown(e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();

  // Esc to cancel recording
  if (e.key === 'Escape') {
    stopRecordingShortcut();
    toast.info("Recording cancelled");
    return;
  }

  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

  const shortcut = formatTauriShortcut(e);
  if (shortcut && recordingAction.value) {
    const action = recordingAction.value;
    const oldShortcut = runner.shortcuts[action];
    runner.shortcuts[action] = shortcut;
    stopRecordingShortcut();
    
    await updateGlobalShortcut(action, shortcut, oldShortcut);
    toast.success(`${action.toUpperCase()} set to: ${shortcut}`);
    saveUIState();
  }
}

export async function updateGlobalShortcut(action: string, newShortcut: string, oldShortcut?: string) {
  try {
    if (oldShortcut && await isRegistered(oldShortcut)) {
      await unregisterShortcut(oldShortcut);
    }
    if (newShortcut) {
      await registerShortcut(newShortcut, (event: any) => {
        if (event.state === 'Pressed') {
          console.log(`Shortcut ${newShortcut} triggered for action: ${action}`);
          switch(action) {
            case 'test': dotnet('run', 'bat'); break;
            case 'run': dotnet('run', 'exe'); break;
            case 'build': dotnet('build'); break;
            case 'rebuild': rebuild(); break;
            case 'stop': stop(); break;
          }
          notify('BSN iSync', `${action.toUpperCase()} triggered via shortcut`);
        }
      });
    }
  } catch (e) {
    console.error("Failed to update global shortcut:", e);
    // Silent error or toast if needed
  }
}

export async function notify(title: string, body: string) {
  if (!isNotificationEnabled.value) return;
  try {
    let permission = await isPermissionGranted();
    if (!permission) {
      const permissionResponse = await requestPermission();
      permission = permissionResponse === 'granted';
    }
    if (permission) {
      sendNotification({ title, body });
    }
  } catch (e) {
    console.error("Failed to send notification:", e);
  }
}

export async function registerAllShortcuts() {
  for (const [action, shortcut] of Object.entries(runner.shortcuts)) {
    if (shortcut) {
      await updateGlobalShortcut(action, shortcut);
    }
  }
}

export async function unregisterAllShortcuts() {
  for (const shortcut of Object.values(runner.shortcuts)) {
    if (shortcut && await isRegistered(shortcut)) {
      await unregisterShortcut(shortcut);
    }
  }
}

export async function resetAllShortcuts() {
  const defaults = { 
    test: 'Alt+Shift+T', 
    run: 'Alt+Shift+R', 
    build: 'Alt+Shift+B', 
    rebuild: 'Alt+Shift+U', 
    stop: 'Alt+Shift+S' 
  };
  await unregisterAllShortcuts();
  Object.assign(runner.shortcuts, defaults);
  await registerAllShortcuts();
  saveUIState();
  toast.success('All shortcuts reset to defaults');
}

export async function initPty(id: 'main' | 'run', container: HTMLElement) {
  if (termState[id].term) return;

  const t = new Terminal({
    theme: dark.value ? TERMINAL_THEMES.dark : TERMINAL_THEMES.light,
    cursorBlink: true,
    cursorStyle: 'bar',
    fontSize: 13,
    fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
    convertEol: true,
    allowProposedApi: true,
  });

  const fit = new FitAddon();
  t.loadAddon(fit);
  t.open(container);
  
  // Enable Ctrl+C Copy Support
  t.attachCustomKeyEventHandler((e) => {
    if (e.ctrlKey && e.code === 'KeyC') {
      if (t.hasSelection()) {
        const text = t.getSelection();
        navigator.clipboard.writeText(text);
        return false; // Prevent sending to PTY
      }
    }
    return true;
  });

  fit.fit();

  termState[id].term = t;
  termState[id].fit = fit;

  await invoke("init_pty", {
    id,
    root: runner.projectRoot || runner.workspaceRoot,
    rows: t.rows,
    cols: t.cols,
  }).catch(() => {});

  t.onData((data) => {
    invoke("pty_write", { id, data }).catch(() => {});
  });

  termState[id as 'main' | 'run'].term = t;
  
  // Apply history setting on init
  if (!isTerminalHistoryEnabled.value) {
    invoke("pty_write", { id, data: `Set-PSReadLineOption -HistorySaveStyle SaveNothing\r` }).catch(() => {});
  }
}

export async function checkCurrentBacklogIssue() {
  if (!runner.backlogIssueKey || !backlog.host || !backlog.token?.access_token) {
    runner.backlogIssueColor = "";
    runner.backlogIssueNotFound = false;
    return;
  }
  
  const existing = backlog.issues.find(i => i.issueKey === runner.backlogIssueKey);
  if (existing) {
    runner.backlogIssueColor = existing.issueType?.color || "";
    runner.backlogIssueStatusName = existing.status?.name || "";
    runner.backlogIssueStatusColor = existing.status?.color || "";
    runner.backlogIssueNotFound = false;
    return;
  }

  const res = await fetchBacklogIssue({
    host: backlog.host,
    accessToken: backlog.token.access_token,
    issueKeyOrId: runner.backlogIssueKey,
  });

  if (res.status === "success") {
    runner.backlogIssueColor = res.issue.issueType?.color || "";
    runner.backlogIssueStatusName = res.issue.status?.name || "";
    runner.backlogIssueStatusColor = res.issue.status?.color || "";
    runner.backlogIssueNotFound = false;
    runner.backlogIssueSummary = res.issue.summary;
  } else {
    runner.backlogIssueColor = "#ef4444"; // red/error
    runner.backlogIssueStatusName = "";
    runner.backlogIssueStatusColor = "";
    runner.backlogIssueNotFound = true;
  }
}

export function setupApp() {
  watch(() => backlog.profile, (profile) => {
    if (profile && profile.id && backlog.host && backlog.token?.access_token && backlog.userAvatars[profile.id] === undefined) {
      backlog.userAvatars[profile.id] = "";
      fetchBacklogUserIcon({
        host: backlog.host,
        accessToken: backlog.token.access_token,
        userId: profile.id,
      }).then(res => {
        if (res.status === "success") {
          backlog.userAvatars[profile.id] = res.blobUrl;
          if (profile.name) {
            backlog.userAvatarByName[profile.name] = res.blobUrl;
          }
        }
      });
    }
  });

  onClickOutside(issueSearchContainerRef, () => {
    showIssueSearch.value = false;
  });

  watch(() => runner.forceUnicode, (val) => {
    localStorage.setItem("bsn_isync:global_force_unicode", String(val));
  });

  watch(() => runner.autoWatchBat, (val) => {
    localStorage.setItem("bsn_isync:global_watch_bat", String(val));
  });

  watch(() => runner.autoWatchTargetTest, (val) => {
    localStorage.setItem("bsn_isync:global_watch_test", String(val));
  });

  watch(() => runner.autoWatchTargetRun, (val) => {
    localStorage.setItem("bsn_isync:global_watch_run", String(val));
  });

  watch(() => [runner.autoWatchTargetTest, runner.autoWatchTargetRun, runner.batFilePath, runner.batFiles], () => {
    setupBatWatcher();
  }, { deep: true });

  watch(() => [runner.autoWatchTargetTest, runner.autoWatchTargetRun, runner.startupProject], () => {
    setupTargetWatcher();
  }, { deep: true });

  watch(
    () => [runner.sqlServer, runner.sqlDatabase, runner.sqlUser, runner.sqlPassword, runner.useWindowsAuth],
    () => {
      if (sqlCheckTimeout) clearTimeout(sqlCheckTimeout);
      sqlCheckTimeout = setTimeout(() => checkSqlConnection(false), 1000);
    },
    { deep: true }
  );

  onClickOutside(hotkeyContainerRef, () => {
    showHotkeySettings.value = false;
    if (isRecordingShortcut.value) stopRecordingShortcut();
  });

  watch(() => {
    const { 
      running, loadingTarget, logs, childPid, buildStatus, isExeTestMode,
      // Exclude SQL settings from profile persistence
      sqlServer, sqlDatabase, sqlUser, sqlPassword, useWindowsAuth, configTemplate, runConfigTemplate, connectionStringTemplate,
      // Exclude dynamic backlog display fields and global toggles
      backlogIssueColor, backlogIssueStatusName, backlogIssueStatusColor, backlogIssueNotFound,
      forceUnicode, autoWatchBat, autoWatchTargetTest, autoWatchTargetRun,
      ...rest 
    } = runner;
    return JSON.stringify(rest, Object.keys(rest).sort());
  }, (newVal, oldVal) => {
    // CRITICAL: Block auto-save if we are currently loading/applying a profile to avoid race syncs
    if (!isApplyingProfile.value && newVal !== oldVal) {
      if (selectedSetupId.value) {
        saveCurrentToSelectedSetupProfile();
      }
    }
  });

  watch(() => runner.backlogProjectKey, (newKey) => {
    if (newKey) {
      window.localStorage.setItem("backlog_last_project", newKey);
      void loadBacklogIssueTypes(newKey);
      void loadBacklogIssues();
    } else {
      backlog.issueTypes = [];
      loadedIssueTypesProjectKey.value = null;
    }
  });

  watch(
    () => [
      runner.aliasExeName, runner.batFilePath, runner.batFiles, runner.activeBatConfigIndex, runner.sqlServer, runner.sqlDatabase, 
      runner.connectionStringTemplate, runner.useWindowsAuth, runner.sqlUser, runner.sqlPassword
    ], 
    applyConfigSyncToTemplates,
    { deep: true }
  );

  watch(() => runner.batFilePath, (newPath) => {
    if (newPath) {
      const filenameMatch = newPath.match(/[^\\/]+$/);
      if (filenameMatch) {
        runner.aliasExeName = filenameMatch[0].replace(/\.[^/.]+$/, "") + ".exe";
      }
    } else {
      runner.aliasExeName = "";
    }
  });

  watch(() => runner.sqlServer, (val) => localStorage.setItem('bsn_isync:global_sql_server', val || ''));

  watch(() => runner.sqlDatabase, (val) => localStorage.setItem('bsn_isync:global_sql_db', val || ''));

  watch(() => runner.sqlUser, (val) => localStorage.setItem('bsn_isync:global_sql_user', val || ''));

  watch(() => runner.sqlPassword, (val) => localStorage.setItem('bsn_isync:global_sql_pass', val || ''));

  watch(() => runner.useWindowsAuth, (val) => localStorage.setItem('bsn_isync:global_sql_winauth', String(val)));

  watch([selectedOwner, profileSearch, profileScope, setupProfiles], () => {
    ensureVisibleSelection();
  }, { deep: true });

  watch([activeTab, dark, selectedSetupId, selectedOwner, profileScope, () => runner.workspaceRoot, () => backlog.host, () => backlog.apiKey, () => backlog.token, () => backlog.profile], () => {
    saveUIState();
  }, { deep: true });

  watch(currentUser, (newVal) => {
    if (newVal && newVal !== "Guest") {
      // Dynamically migrate in-memory profiles that don't have a valid owner
      const migrated = setupProfiles.value.map(p => {
        if (!p.owner || p.owner === "Guest" || p.owner === "ngtuonghy") {
          return { ...p, owner: newVal };
        }
        return p;
      });
      
      // Only update if something actually changed to avoid infinite watch loops
      if (JSON.stringify(migrated) !== JSON.stringify(setupProfiles.value)) {
        setupProfiles.value = migrated;
        saveSetupsForCurrentRoot();
      }
      
      // Force selectedOwner to current if it's lagging Behind
      if (!selectedOwner.value || selectedOwner.value === "Guest" || selectedOwner.value === "ngtuonghy") {
        selectedOwner.value = newVal;
      }
    }
  }, { immediate: true });

  watch(() => backlog.status, (newStatus, oldStatus) => {
    if (newStatus === 'success' && oldStatus !== 'success') {
      // Automatically pull profiles when user logs in successfully
      void syncProfilesWithCloudflare(undefined, true, false);
    }
  });

  watch(selectedSetupId, (next, prev) => {
    if (next && next !== prev) {
      applySelectedSetupProfile(true);
      // On-click sync: Perform a PULL-only sync IMMEDIATELY (no debounce) for better feedback
      void syncProfilesWithCloudflare(next, true, false);
    }
  });

  watch(isTerminalHistoryEnabled, (enabled) => {
    const cmd = enabled 
      ? `Set-PSReadLineOption -HistorySaveStyle SaveIncrementally\r` 
      : `Set-PSReadLineOption -HistorySaveStyle SaveNothing\r`;
    
    termState.terminals.forEach((tId: string) => {
      if (termState[tId]?.term) {
        invoke("pty_write", { id: tId, data: cmd }).catch(() => {});
      }
    });
    saveUIState();
  });

  watch(isNotificationEnabled, () => {
    saveUIState();
  });

  watch(() => runner.backlogIssueKey, checkCurrentBacklogIssue);

  onMounted(async () => {
    // 1. Initialize environment status
    await checkEnv();
  
    // Auto-check SQL connection on start if server is defined
    if (runner.sqlServer && runner.sqlDatabase) {
      checkSqlConnection(false);
    }
  
    // Fetch local hostname for shortcuts
    try {
      localHostname.value = await invoke("get_hostname");
    } catch (e) {
      console.error("Failed to fetch hostname:", e);
    }
  
    // 2. Load UI state and Backlog login status from store
    await loadUIState();
    
    // Initialize Global Shortcuts
    await registerAllShortcuts();
  
    // 3. Load Project Profiles
    await loadSetupsForCurrentRoot();
    
    // 4. Check for updates
    void checkForUpdates(false);
  
    // 5. Handle potential OAuth Redirect
    try {
      const startUrls = await getCurrent();
      if (startUrls?.length) {
        for (const url of startUrls) {
          await handleBacklogOAuthUrl(url);
        }
      }
      await onOpenUrl((urls) => {
        urls.forEach((url) => {
          void handleBacklogOAuthUrl(url);
        });
      });
    } catch {}
  
    // 6. Existing setup...
    try {
      await discoverProjects(false);
    } catch (e: any) {}
  
    await loadBacklogProjects();
    
    // 7. Initial sync with cloud to pull shared profiles
    if (backlog.token?.access_token) {
      triggerSync();
    }
    
    if (backlog.status === 'idle' && backlog.token?.access_token) {
       void fetchBacklogProfileWithToken({
         host: backlog.host,
         accessToken: backlog.token.access_token,
       }).then(res => {
         if (res.status === "success") {
           backlog.profile = res.profile;
           backlog.status = "success";
           saveUIState();
         }
       });
    }
  
    // Load last selected project from global storage if not set by profile
    const lastProject = window.localStorage.getItem("backlog_last_project");
    if (lastProject && !runner.backlogProjectKey) {
      runner.backlogProjectKey = lastProject;
    }
  
    // If a project is already selected (from storage or profile), fetch issues
    if (runner.backlogProjectKey) {
      void loadBacklogIssues();
    }
  
  
  
    unlistenRunnerLog = await listen<string>("runner-log", (event) => {
      // Build/Setup logs should always go to the main terminal first
      const t = termState['main']?.term || termState[termState.active]?.term;
      if (t) {
        // Process multi-line payloads and trim trailing carriage returns to prevent overlap
        const lines = event.payload.split(/\r?\n/);
        lines.forEach(line => {
          const cleanLine = line.replace(/\r/g, '');
          if (cleanLine.length > 0) {
            t.writeln(`\x1b[36m${cleanLine}\x1b[0m`);
          }
        });
      }
    });
  
    unlistenBuildStatus = await listen<string>("build-status", (event) => {
      runner.buildStatus = event.payload;
      if (event.payload === "done") {
        notify('BSN iSync', '✅ Success: Build/Test completed');
        setTimeout(() => {
          if (runner.buildStatus === "done") runner.buildStatus = null;
        }, 1500);
      } else if (event.payload === "error") {
        notify('BSN iSync', 'Build/Test failed');
        setTimeout(() => {
          if (runner.buildStatus === "error") runner.buildStatus = null;
        }, 500);
      }
    });
  
    listen("pty-out", (event: any) => {
      const { id, data } = event.payload;
      if (termState[id]?.term) {
        termState[id].term.write(data);
      }
    });
  
  
    if (mainTermRef.value) {
      await initPty('main', mainTermRef.value);
    }
  
    const ro = new ResizeObserver(() => {
      try { 
        const tId = termState.active;
        if (termState[tId]?.fit && termState[tId]?.term) {
          termState[tId].fit.fit();
          invoke("resize_pty", { id: tId, rows: termState[tId].term.rows, cols: termState[tId].term.cols }).catch(() => {});
        }
      } catch {}
    });
    if (mainTermRef.value) ro.observe(mainTermRef.value);
    if (runTermRef.value) ro.observe(runTermRef.value);
  
    // 8. Register all shortcuts
    await registerAllShortcuts();
  
    backlogRefreshInterval = window.setInterval(async () => {
      if (backlog.token) {
        await ensureValidBacklogToken();
      }
    }, 2 * 60 * 1000); // Check token every 2 minutes
  
    // Background Cloud Sync Polling:
    // Automatically pull updates from other machines every 3 minutes
    cloudSyncInterval = window.setInterval(async () => {
      if (syncService.value && syncStatus.value === 'idle') {
        const ok = await ensureValidBacklogToken();
        if (!ok) return;
        console.log("[Sync] Periodic background pull...");
        // Trigger a PULL-only sync (skipPush = true)
        void syncProfilesWithCloudflare(undefined, true);
      }
    }, 3 * 60 * 1000); 
  
    // Initial Startup Sync - Only call triggerSync if authenticated. 
    // It handles the full pull internally.
    if (backlog.token?.access_token) {
      console.log("[Setup] Starting initial cloud sync...");
      triggerSync();
    }
  });

  onUnmounted(() => {
    unregisterAllShortcuts();
    unregisterAllShortcuts();
    if (backlogRefreshInterval) window.clearInterval(backlogRefreshInterval);
    if (cloudSyncInterval) window.clearInterval(cloudSyncInterval);
    if (unlistenRunnerLog) unlistenRunnerLog();
    if (unlistenBuildStatus) unlistenBuildStatus();
    if (runnerPollTimer) window.clearInterval(runnerPollTimer);
    if (unwatchBatFile) unwatchBatFile();
  });
}
