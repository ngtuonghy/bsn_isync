<script setup lang="ts">
declare const __APP_VERSION__: string;
const APP_VERSION = __APP_VERSION__;

import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { onClickOutside } from "@vueuse/core";
import { FolderOpen, ScanSearch, Maximize2, User, Lock, Plus, Pencil, Save, Trash2, Hammer, Play, Square, RotateCcw, Beaker, Home, Sun, Moon, Search, Clock, RefreshCw, ArrowUpCircle, ExternalLink, X, ShieldCheck, ShieldAlert, Bell, BellOff, Cloud, History, Settings2, Database, Code2, ListTree, Layers, FilePlus2, AppWindow, TerminalSquare, Keyboard, FileDown, Monitor } from "lucide-vue-next";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "vue-sonner";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { register as registerShortcut, unregister as unregisterShortcut, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import BacklogAuthPanel from "@/components/BacklogAuthPanel.vue";
import ProfileHistory from "@/components/ProfileHistory.vue";
import {
  fetchBacklogProfileWithToken,
  fetchBacklogProjects,
  fetchBacklogIssueTypes,
  fetchBacklogIssues,
  type BacklogProfile,
  type BacklogProject,
  type BacklogIssueType,
  type BacklogIssue,
  type BacklogOAuthToken,
} from "@/lib/backlogAuth";
import { useStore } from "@/composables/useStore";
import { SyncService } from "@/lib/sync";
import HotkeyManager from "@/components/HotkeyManager.vue";
import SqlEditor from "./components/SqlEditor.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import "./index.css";
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

const mainTermRef = ref<HTMLElement | null>(null);
const runTermRef = ref<HTMLElement | null>(null);

const termState = reactive({
  active: 'main' as 'main' | 'run',
  main: { term: null as Terminal | null, fit: null as FitAddon | null },
  run: { term: null as Terminal | null, fit: null as FitAddon | null }
});

const TERMINAL_THEMES = {
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

const dark = ref(false);
const activeTab = ref<"runner" | "sync">("runner");

// SQL Connection Status State
const sqlConnStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle');
const sqlErrorMsg = ref('');
const localHostname = ref("");

const canBuild = computed(() => {
  return !runner.running && runner.projectRoot && runner.startupProject;
});

const canTest = computed(() => {
  return runner.running || (runner.projectRoot && runner.startupProject && runner.batFilePath);
});

const canRun = computed(() => {
  return !runner.running && runner.projectRoot && runner.startupProject && runner.aliasExeName && runner.batFilePath;
});


type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type ProjectProfile = {
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
  runArgs?: string;
  exeArgs?: string;
  isExeTestMode?: boolean;
  forceUnicode?: boolean;
  sqlSetupPath: string;
  sqlServer?: string;
  sqlDatabase?: string;
  sqlUser?: string;
  sqlPassword?: string;
  useWindowsAuth?: boolean;
  configTemplate: string;
  runConfigTemplate?: string;
  connectionStringTemplate?: string;
  sqlSnippets?: { id: string; name: string; content: string }[];
  activeSqlSnippetId?: string;
  sync?: any;
  backlogProjectKey?: string;
  backlogIssueTypeId?: number;
  backlogIssueKey?: string;
  backlogIssueSummary?: string;
  deployPath?: string;
  updatedAt: number;
  version?: number;
  shortcuts?: Record<string, string>;
};

type EnvCheck = {
  name: string;
  found: boolean;
  version: string;
  downloadUrl: string;
};

const envStatus = ref<EnvCheck[]>([]);

const discoveredProjects = ref<Array<{
  name: string;
  root: string;
  startupProject: string;
  slnCount: number;
  csprojCount: number;
}>>([]);
const selectedProjectRoot = ref("");
const setupProfiles = ref<ProjectProfile[]>([]);
const selectedSetupId = ref("");

const currentUser = computed(() => backlog.profile?.name || backlog.profile?.userId || "");
const selectedOwner = ref("");
const profileSearch = ref("");
const profileScope = ref<"personal" | "shared" | "team">("team");



const backlog = reactive({
  host: "",
  apiKey: "",
  status: "idle" as "idle" | "loading" | "success" | "error",
  error: "",
  profile: null as BacklogProfile | null,
  token: null as any, // Will store { access_token, refresh_token, expires_in, expires_at, ... }
  projects: [] as BacklogProject[],
  issueTypes: [] as BacklogIssueType[],
  issues: [] as BacklogIssue[],
  updatedAt: 0,
});

const backlogIssueUrl = computed(() => {
  if (!backlog.host || !runner.backlogIssueKey) return undefined;
  return `https://${backlog.host}/view/${runner.backlogIssueKey}`;
});




// env variables for Backlog removed (moved to backend)

// Update state
const updateVersion = ref<string | null>(null);
const isUpdateDownloading = ref(false);
const isUpdateReady = ref(false);

async function checkForUpdates(manual = false) {
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

const isNotificationEnabled = ref(true);
const syncStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const isFetchingProfile = ref(false);
const lastSyncTime = ref<number | null>(null);
const profileHashes = new Map<string, string>(); // Dirty checking: Store content hashes to avoid redundant pushes
const showHistoryDialog = ref(false);

async function restoreVersion(v: any) {
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
const isApplyingProfile = ref(false);
const deletedProfileIds = ref<Map<string, number>>(new Map()); // id -> timestamp
try {
  const stored = localStorage.getItem('bsn_isync:deleted_profiles');
  if (stored) deletedProfileIds.value = new Map(JSON.parse(stored));
} catch(e) {}
function saveDeletedProfileIds() {
  localStorage.setItem('bsn_isync:deleted_profiles', JSON.stringify(Array.from(deletedProfileIds.value.entries())));
}

const loadedIssueTypesProjectKey = ref<string | null>(null);
const CLOUDFLARE_WORKER_URL = "https://bsn-isync-sync-worker.ngtuonghy.workers.dev";

const { setItem, getItem } = useStore();


const syncService = computed(() => {
  if (!backlog.host || !backlog.token?.access_token) return null;
  return new SyncService(CLOUDFLARE_WORKER_URL, backlog.host, backlog.token.access_token);
});

async function downloadUpdate() {
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

async function applyUpdate() {
  try {
    await invoke("restart_app");
  } catch (e: any) {
    toast.error("Error while restarting", { description: String(e) });
  }
}

const UI_STATE_KEY = "ui_state";
async function loadUIState() {
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

/**
 * Saves UI-specific settings (Theme, Tabs, Notification preferences, and Backlog tokens) 
 * to the LOCAL store ONLY. This data is NEVER synced to the Cloudflare Worker.
 */
async function saveUIState() {
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

const OAUTH_STATE_KEY = "bsn_isync:backlog_oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type OAuthStatePayload = { state: string; createdAt: number };
let pendingOAuthState: OAuthStatePayload | null = null;

function buildOAuthState() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveOAuthState(state: string) {
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

function readOAuthState() {
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

function clearOAuthState() {
  pendingOAuthState = null;
  try {
    window.sessionStorage.removeItem(OAUTH_STATE_KEY);
  } catch {}
  try {
    window.localStorage.removeItem(OAUTH_STATE_KEY);
  } catch {}
}

async function startBacklogOAuthLogin() {
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

function isBacklogOAuthCallbackUrl(url: URL) {
  if (url.pathname === "/oauth/callback") return true;
  if (url.protocol === "bsn-isync:" && url.hostname === "oauth" && url.pathname === "/callback") return true;
  return false;
}

async function handleBacklogOAuthUrl(urlString: string) {
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

function handleBacklogLogout() {
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

// background refresh timer
let backlogRefreshInterval: number | undefined;
let cloudSyncInterval: number | undefined;

async function ensureValidBacklogToken() {
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

async function loadBacklogProjects() {
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

async function loadBacklogIssueTypes(projectKey: string) {
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

async function loadBacklogIssues() {
  const projectKey = runner.backlogProjectKey;
  if (!backlog.token?.access_token || !backlog.host || !projectKey || !backlog.profile?.id) return;
  
  const ok = await ensureValidBacklogToken();
  if (!ok) return;

  const project = backlog.projects.find(p => p.projectKey === projectKey);
  if (!project) return;

  const res = await fetchBacklogIssues({
    host: backlog.host,
    accessToken: backlog.token.access_token,
    projectId: project.id,
    assigneeId: backlog.profile.id,
  });
  if (res.status === "success") {
    backlog.issues = res.issues;
  }
}

const issueSearchQuery = ref("");
const showIssueSearch = ref(false);
const filteredBacklogIssues = computed(() => {
  const q = issueSearchQuery.value.trim().toLowerCase();
  if (!q) return backlog.issues;
  return backlog.issues.filter(i => 
    i.issueKey.toLowerCase().includes(q) || 
    i.summary.toLowerCase().includes(q)
  );
});

const issueSearchContainerRef = ref<HTMLElement | null>(null);
onClickOutside(issueSearchContainerRef, () => {
  showIssueSearch.value = false;
});

function selectBacklogIssue(issue: BacklogIssue) {
  runner.backlogIssueKey = issue.issueKey;
  runner.backlogIssueSummary = issue.summary;
}

const isNamingSqlSnippet = ref(false);
const namingSqlSnippetMode = ref<'create' | 'rename'>('create');
const namingSqlSnippetValue = ref('');
const namingSqlSnippetTitle = computed(() => namingSqlSnippetMode.value === 'create' ? 'Create New SQL Script' : 'Rename SQL Script');
const isSqlSnippetFullscreen = ref(false);

function startNamingSqlSnippet(mode: 'create' | 'rename') {
  namingSqlSnippetMode.value = mode;
  if (mode === 'create') {
    namingSqlSnippetValue.value = 'New Script';
  } else {
    const snippet = runner.sqlSnippets.find(s => s.id === runner.activeSqlSnippetId);
    namingSqlSnippetValue.value = snippet?.name || '';
  }
  isNamingSqlSnippet.value = true;
}

function commitSqlSnippetName() {
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

function unlinkBacklogIssue() {
  runner.backlogIssueKey = "";
  runner.backlogIssueSummary = "";
}



const ownerSearch = ref("");
const filteredOwnerOptions = computed(() => {
  const q = ownerSearch.value.trim().toLowerCase();
  if (!q) return ownerOptions.value;
  return ownerOptions.value.filter(o => o.toLowerCase().includes(q));
});

const projectSearch = ref("");
const filteredDiscoveredProjects = computed(() => {
  const q = projectSearch.value.trim().toLowerCase();
  if (!q) return discoveredProjects.value;
  return discoveredProjects.value.filter(p => 
    p.name.toLowerCase().includes(q) || p.root.toLowerCase().includes(q)
  );
});


// handleBacklogLogin removed (redundant)

const ownerOptions = computed(() => {
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

const visibleProfiles = computed(() => {
  const q = profileSearch.value.trim().toLowerCase();
  return setupProfiles.value.filter((p) => {
    if (p.owner !== selectedOwner.value) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q);
  });
});

const scopedProfiles = computed(() => {
  if (profileScope.value === "team") return visibleProfiles.value;
  if (profileScope.value === "personal") {
    return visibleProfiles.value.filter((p) => p.owner === currentUser.value);
  }
  return visibleProfiles.value.filter((p) => p.owner !== currentUser.value);
});

// isOwnerView / hasVisibleProfiles removed
const selectedProfile = computed(() => setupProfiles.value.find((p) => p.id === selectedSetupId.value));
const canEditSelected = computed(() => {
  if (backlog.status !== 'success') return false;
  if (!selectedProfile.value) return false;
  return !selectedProfile.value.owner || selectedProfile.value.owner === currentUser.value;
});

const canExecuteSelected = computed(() => {
  return !!selectedProfile.value;
});
// selectedProject removed
// selectedProjectLabel removed
const profileNameInput = ref<HTMLInputElement | null>(null);
const editableProfileName = ref("");

let unlistenRunnerLog: (() => void) | undefined;
let unlistenBuildStatus: (() => void) | undefined;
let runnerPollTimer: number | undefined;

const runner = reactive({
  workspaceRoot: "",
  projectRoot: "",
  startupProject: "",
  urls: "",
  config: "Debug",
  aliasExeName: "",
  batFilePath: "",
  runArgs: "",
  exeArgs: "",
  isExeTestMode: false,
  forceUnicode: true,
  sqlSetupPath: "",
  sqlServer: localStorage.getItem("bsn_isync:global_sql_server") || "",
  sqlDatabase: localStorage.getItem("bsn_isync:global_sql_db") || "Arkbell_01",
  sqlUser: localStorage.getItem("bsn_isync:global_sql_user") || "sa",
  sqlPassword: localStorage.getItem("bsn_isync:global_sql_pass") || "ArkAdmin@2026",
  useWindowsAuth: localStorage.getItem("bsn_isync:global_sql_winauth") === "false" ? false : true,
  sqlSnippets: [] as { id: string; name: string; content: string }[],
  activeSqlSnippetId: "",
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

// SQL Connection Diagnostics Logic
let sqlCheckTimeout: any = null;

async function checkSqlConnection(manual = false) {
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

// Watch for SQL context changes to auto-test
watch(
  () => [runner.sqlServer, runner.sqlDatabase, runner.sqlUser, runner.sqlPassword, runner.useWindowsAuth],
  () => {
    if (sqlCheckTimeout) clearTimeout(sqlCheckTimeout);
    sqlCheckTimeout = setTimeout(() => checkSqlConnection(false), 1000);
  },
  { deep: true }
);

const isRecordingShortcut = ref(false);
const recordingAction = ref<string | null>(null);
const showHotkeySettings = ref(false);
const hotkeyContainerRef = ref<HTMLElement | null>(null);

onClickOutside(hotkeyContainerRef, () => {
  showHotkeySettings.value = false;
  if (isRecordingShortcut.value) stopRecordingShortcut();
});

// RunArgs are now per-profile, no global sync needed


// --- Autosave logic ---
watch(() => {
  const { 
    running, loadingTarget, logs, childPid, buildStatus, isExeTestMode, forceUnicode,
    // Exclude SQL settings from profile persistence
    sqlServer, sqlDatabase, sqlUser, sqlPassword, useWindowsAuth,
    ...rest 
  } = runner;
  return rest;
}, (newVal, oldVal) => {
  // CRITICAL: Block auto-save if we are currently loading/applying a profile to avoid race syncs
  if (!isApplyingProfile.value && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    if (selectedSetupId.value) {
      saveCurrentToSelectedSetupProfile();
    }
  }
}, { deep: true });

// UNIFIED BACKLOG PROJECT WATCHER: 
// Consolidates persistence, issue types, and issue loading.
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


function resolveArgs(args: string) {
  if (!args) return "";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const hms = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ms = pad(Math.floor(now.getMilliseconds() / 10)); // 2 digits
  const time8 = `${hms}${ms}`;

  const host6 = localHostname.value.substring(0, 6).toUpperCase();

  return args.replace(/{time}/g, time8).replace(/{hostname}/g, host6);
}

const argsInputRefBat = ref<any>(null);
const argsInputRefExe = ref<any>(null);

function insertTimePlaceholder() {
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

function insertHostnamePlaceholder() {
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

function applyConfigSyncToTemplates() {
  if (runner.loadingTarget) return;

  const msmq = runner.aliasExeName.replace(/\.exe$/i, "");
  
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
    t = t.replace(/(<add\s+key="Job\.BatFilePath"\s+value=")([^"]*)("\s*\/>)/gi, `$1${runner.batFilePath || '.\\' }$3`);
    
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

watch(
  () => [
    runner.aliasExeName, runner.batFilePath, runner.sqlServer, runner.sqlDatabase, 
    runner.connectionStringTemplate, runner.useWindowsAuth, runner.sqlUser, runner.sqlPassword
  ], 
  applyConfigSyncToTemplates
);

// Auto-derive EXE Name from BAT Path silently
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

// Persist SQL Settings globally (App-wide, not in profiles)
watch(() => runner.sqlServer, (val) => localStorage.setItem('bsn_isync:global_sql_server', val || ''));
watch(() => runner.sqlDatabase, (val) => localStorage.setItem('bsn_isync:global_sql_db', val || ''));
watch(() => runner.sqlUser, (val) => localStorage.setItem('bsn_isync:global_sql_user', val || ''));
watch(() => runner.sqlPassword, (val) => localStorage.setItem('bsn_isync:global_sql_pass', val || ''));
watch(() => runner.useWindowsAuth, (val) => localStorage.setItem('bsn_isync:global_sql_winauth', String(val)));


function makeProfileId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function setupStorageKey() {
  return `bsn_isync:project_profiles`;
}


function buildSetupFromRunner(name: string): ProjectProfile {
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
    runArgs: runner.runArgs,
    exeArgs: runner.exeArgs,
    isExeTestMode: runner.isExeTestMode,
    forceUnicode: runner.forceUnicode,
    sqlSetupPath: runner.sqlSetupPath,
    sqlServer: runner.sqlServer,
    sqlDatabase: runner.sqlDatabase,
    sqlUser: runner.sqlUser,
    sqlPassword: runner.sqlPassword,
    useWindowsAuth: runner.useWindowsAuth,
    configTemplate: runner.configTemplate,
    runConfigTemplate: runner.runConfigTemplate,
    connectionStringTemplate: runner.connectionStringTemplate,
    sqlSnippets: JSON.parse(JSON.stringify(runner.sqlSnippets)),
    activeSqlSnippetId: runner.activeSqlSnippetId,
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

function applySetupToRunner(setup: ProjectProfile) {
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
  runner.runArgs = setup.runArgs || "";
  runner.exeArgs = setup.exeArgs || "";
  runner.isExeTestMode = setup.isExeTestMode || false;
  runner.forceUnicode = setup.forceUnicode ?? true;
  runner.deployPath = toAbs(setup.deployPath || "");
  
  runner.sqlSetupPath = setup.sqlSetupPath || "";
  runner.sqlSetupPath = setup.sqlSetupPath || "";
  // SQL server/database/auth settings are now global and shared across app, not loaded from profiles
  
  runner.configTemplate = setup.configTemplate || "";
  runner.runConfigTemplate = setup.runConfigTemplate || "";
  runner.connectionStringTemplate = setup.connectionStringTemplate || "";
  
  if (setup.sqlSnippets && Array.isArray(setup.sqlSnippets)) {
    runner.sqlSnippets = JSON.parse(JSON.stringify(setup.sqlSnippets));
  } else if (setup.sqlSetupPath) {
    // Migrate old setup path to snippets array
    runner.sqlSnippets = [{ id: "default_snippet_1", name: "Default Script", content: setup.sqlSetupPath }];
  } else {
    runner.sqlSnippets = [];
  }
  
  runner.activeSqlSnippetId = setup.activeSqlSnippetId || (runner.sqlSnippets.length > 0 ? runner.sqlSnippets[0].id : "");
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

async function loadSetupsForCurrentRoot() {
  const raw = await getItem<ProjectProfile[]>(setupStorageKey());
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    const defaultSetup = buildSetupFromRunner("Default");
    setupProfiles.value = [defaultSetup];
    selectedOwner.value = defaultSetup.owner;
    selectedSetupId.value = defaultSetup.id;
    await saveSetupsForCurrentRoot();
    return;
  }
  try {
    const seenIds = new Set<string>();
    const normalized = raw.map((setup) => ({
      ...setup,
      owner: (setup as any).owner || currentUser.value,
    })).filter((p, _, self) => {
      // PRUNE GHOST PROFILES:
      // Remove any that have no project root AND use a default name AND aren't the only one
      const isPlaceholder = !p.projectRoot && /^Setup\s+\d+$/i.test(p.name);
      if (isPlaceholder && self.length > 1) return false;
      
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

async function saveSetupsForCurrentRoot() {
  await setItem(setupStorageKey(), setupProfiles.value);
  // Trigger Incremental Cloudflare Sync for the active profile
  // CRITICAL: Skip sync if we are currently APPLYING a profile to avoid feedback loops
  if (!isApplyingProfile.value) {
    // If we're updating a profile, trigger incremental sync
    triggerSync(selectedSetupId.value);
  }
}

let syncTimer: number | undefined;
let lastSyncContext = { targetId: undefined as string | undefined, skipPush: false };

function triggerSync(id?: string, skipPush = false) {
  if (syncTimer) clearTimeout(syncTimer);
  
  const effectiveId = (id && id.trim()) ? id : undefined;
  
  // If we have a pending sync, and the new request is for a DIFFERENT id, 
  // or one is FULL (undefined) and other is TARGETED, we upgrade to FULL to be safe.
  let currentTargetId: string | undefined = effectiveId;
  if (syncTimer && lastSyncContext.targetId !== effectiveId) {
    currentTargetId = undefined; // Upgrade to Full Sync
  }
  
  lastSyncContext = { targetId: currentTargetId, skipPush };
  
  syncTimer = window.setTimeout(async () => {
    const context = { ...lastSyncContext };
    // Reset context before execution so next triggers start fresh
    lastSyncContext = { targetId: undefined, skipPush: false };
    
    const ok = await ensureValidBacklogToken();
    if (!ok) {
      syncTimer = undefined;
      return;
    }
    
    syncStatus.value = context.skipPush ? 'idle' : 'saving';
    await syncProfilesWithCloudflare(context.targetId, context.skipPush);
    syncTimer = undefined;
  }, 1000); 
}

async function syncProfilesWithCloudflare(targetId?: string, skipPush = false, manual = false) {
  if (!syncService.value) {
    syncStatus.value = 'idle';
    return;
  }

  // Determine sync type
  const isLazyPull = !!targetId && skipPush;
  const isTargetedSync = !!targetId && !skipPush;
  const isFullSync = !targetId;

  if (isLazyPull) isFetchingProfile.value = true;
  else syncStatus.value = 'saving';

  let pullCount = 0;
  let pushCount = 0;
  
  try {
    const localMap = new Map(setupProfiles.value.map(p => [p.id, p]));
    let profilesChanged = false;
    let backlogChanged = false;
    let currentProfilePulled = false;

    // --- 1. PULL PHASE ---
    if (isLazyPull) {
      const cloudProfile = await syncService.value.getProfile(targetId!);
      if (cloudProfile && cloudProfile.content) {
        const content = typeof cloudProfile.content === 'string' ? JSON.parse(cloudProfile.content) : cloudProfile.content;
        const local = localMap.get(targetId!);
        const serverVersion = Number(cloudProfile.version) || 0;
        const localVersion = Number(local?.version) || 0;

        if (!local || serverVersion > localVersion) {
          const idx = setupProfiles.value.findIndex(p => p.id === targetId);
          if (idx !== -1) {
            const current = setupProfiles.value[idx];
            setupProfiles.value[idx] = { ...content, version: serverVersion, isExeTestMode: current.isExeTestMode, forceUnicode: current.forceUnicode ?? true };
          } else {
            setupProfiles.value.push({ ...content, version: serverVersion, forceUnicode: true });
          }
          // Update hash to avoid immediate re-push
          const { updatedAt, version, isExeTestMode, forceUnicode, ...hashable } = content;
          profileHashes.set(targetId!, JSON.stringify(hashable));
          profilesChanged = true;
          if (targetId === selectedSetupId.value) currentProfilePulled = true;
          pullCount++;
        }
      }
    } else {
      const cloudMetas = await syncService.value.getProfiles();
      const profilesToPull: string[] = [];

      cloudMetas.forEach(meta => {
        if (meta.id === "__global_backlog_settings__") {
           profilesToPull.push(meta.id);
           return;
        }
        if (isTargetedSync && meta.id !== targetId) return;

        const deletedAt = deletedProfileIds.value.get(meta.id);
        if (deletedAt) return; // Permanent local tombstone blocks pull if cloud delete failed

        const local = localMap.get(meta.id);
        const serverVersion = Number(meta.version) || 0;
        const localVersion = Number(local?.version) || 0;
        if (!local || serverVersion > localVersion) {
          profilesToPull.push(meta.id);
        }
      });

      if (profilesToPull.length > 0) {
        const pullResults = await Promise.all(profilesToPull.map(id => syncService.value!.getProfile(id)));
        pullResults.forEach(cp => {
          if (!cp || !cp.content) return;
          const content = typeof cp.content === 'string' ? JSON.parse(cp.content) : cp.content;
          
          if (cp.id === "__global_backlog_settings__") {
            const cloudUpdateAt = content.updatedAt || 0;
            const localUpdateAt = backlog.updatedAt || 0;
            if (cloudUpdateAt > localUpdateAt) {
              if (backlog.status === 'loading') return;
              Object.assign(backlog, content);
              backlogChanged = true;
            }
            const { updatedAt, ...hashable } = content;
            profileHashes.set("__global_backlog_settings__", JSON.stringify(hashable));
            return;
          }

          const idx = setupProfiles.value.findIndex(p => p.id === cp.id);
          if (idx === -1) {
            const isPlaceholder = !content.projectRoot && /^Setup\s+\d+$/i.test(content.name);
            if (isPlaceholder) return;
            setupProfiles.value.push({ ...content, version: cp.version, forceUnicode: true });
          } else {
            const current = setupProfiles.value[idx];
            setupProfiles.value[idx] = { ...content, version: cp.version, isExeTestMode: current.isExeTestMode, forceUnicode: current.forceUnicode ?? true };
          }
          const { updatedAt, version, isExeTestMode, forceUnicode, ...hashable } = content;
          profileHashes.set(cp.id, JSON.stringify(hashable));
          profilesChanged = true;
          if (cp.id === selectedSetupId.value) currentProfilePulled = true;
          pullCount++;
        });
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
          console.log(`[Sync] Removing ${toRemoveLocally.length} profiles deleted on other machines.`);
          setupProfiles.value = setupProfiles.value.filter(p => !toRemoveLocally.includes(p));
          profilesChanged = true;
        }
      }
    }

    // --- 2. PUSH PHASE ---
    if (!skipPush) {
      // 5. Push backlog settings if changed
      const backlogContent = {
        host: backlog.host,
        apiKey: backlog.apiKey,
        token: backlog.token,
        profile: backlog.profile,
        updatedAt: backlog.updatedAt || Date.now()
      };
      
      const { updatedAt: _backlogUpd, ...backlogHashable } = backlogContent;
      const backlogContentStr = JSON.stringify(backlogHashable);
      const lastBacklogHash = profileHashes.get("__global_backlog_settings__");
      
      if (lastBacklogHash !== backlogContentStr) {
        await syncService.value.upsertProfile({
          id: "__global_backlog_settings__",
          name: "Global Backlog Settings",
          content: backlogContent
        });
        profileHashes.set("__global_backlog_settings__", backlogContentStr);
      }

      const pushProfile = async (p: ProjectProfile) => {
        if (p.owner !== currentUser.value) return;

        const { updatedAt, version, isExeTestMode, forceUnicode, ...hashable } = p;
        const currentContentStr = JSON.stringify(hashable);
        const lastHash = profileHashes.get(p.id);
        if (lastHash === currentContentStr) return;

        const meta = await syncService.value!.getProfile(p.id);
        const serverVer = Number(meta?.version) || 0;
        const localVer = Number(p.version) || 0;

        if (localVer >= serverVer || !meta) {
           const { forceUnicode: _f, ...payloadToSync } = p;
           const result = await syncService.value!.upsertProfile({
             id: p.id,
             name: p.name,
             content: payloadToSync,
             version: localVer
           });
           if (result.success && result.version) {
             p.version = result.version;
             profileHashes.set(p.id, currentContentStr);
             profilesChanged = true;
             pushCount++;
           }
        }
      };

      if (isTargetedSync && targetId !== "__global_backlog_settings__") {
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
    syncStatus.value = 'saved';
    
    if (manual || (isFullSync && (pullCount > 0 || pushCount > 0))) {
       toast.success(`Sync complete: ${pullCount} pulled, ${pushCount} pushed.`);
    }
    setTimeout(() => { if (syncStatus.value === 'saved') syncStatus.value = 'idle'; }, 3000);
  } catch (e) {
    console.error("Sync failed", e);
    syncStatus.value = 'error';
    if (manual) toast.error("Sync failed", { description: String(e) });
  } finally {
    isFetchingProfile.value = false;
  }
}

function ensureVisibleSelection() {
  const owners = ownerOptions.value;
  if (owners.length > 0 && !owners.includes(selectedOwner.value)) {
    selectedOwner.value = owners[0];
  }
  const visible = scopedProfiles.value;
  if (!visible.some((p) => p.id === selectedSetupId.value)) {
    selectedSetupId.value = visible[0]?.id ?? "";
  }
}

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


watch(selectedSetupId, (next, prev) => {
  if (next && next !== prev) {
    applySelectedSetupProfile(true);
    // On-click sync: Perform a PULL-only sync IMMEDIATELY (no debounce) for better feedback
    void syncProfilesWithCloudflare(next, true);
  }
});

async function applySelectedSetupProfile(silent = false) {
  const setup = setupProfiles.value.find((x) => x.id === selectedSetupId.value);
  if (!setup) {
    if (!silent) toast.error("Setup profile not selected");
    return;
  }
  
  // LOCK: Block auto-save watchers while we populate the form
  isApplyingProfile.value = true;
  
  // Initialize editable name for the restored input field
  let name = setup.name;
  if (setup.backlogIssueKey) {
    const keyMatch = new RegExp(`\\s*-\\s*${setup.backlogIssueKey}$`, "i");
    name = name.replace(keyMatch, "");
  }
  editableProfileName.value = name;
  
  applySetupToRunner(setup);
  
  // UNLOCK: Release after a short delay to allow all debounced/buffered watchers to settle
  setTimeout(() => {
    isApplyingProfile.value = false;
  }, 100);
}

function saveCurrentToSelectedSetupProfile() {
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) return;
  
  const setup = setupProfiles.value[idx];
  
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
  
  setup.projectRoot = toRel(runner.projectRoot);
  setup.startupProject = runner.startupProject;
  setup.buildConfig = runner.config === "Release" ? "Release" : "Debug";
  setup.urls = runner.urls;
  setup.aliasExeName = runner.aliasExeName;
  setup.batFilePath = toRel(runner.batFilePath);
  setup.runArgs = runner.runArgs;
  setup.exeArgs = runner.exeArgs;
  setup.isExeTestMode = runner.isExeTestMode;
  setup.forceUnicode = runner.forceUnicode;
  setup.sqlSetupPath = runner.sqlSetupPath;
  // Deliberately omitted sqlServer to prevent syncing local workstation host configs to cloud
  setup.sqlDatabase = runner.sqlDatabase;
  setup.sqlUser = runner.sqlUser;
  setup.sqlPassword = runner.sqlPassword;
  setup.useWindowsAuth = runner.useWindowsAuth;
  setup.configTemplate = runner.configTemplate;
  setup.runConfigTemplate = runner.runConfigTemplate;
  setup.connectionStringTemplate = runner.connectionStringTemplate;
  setup.sqlSnippets = JSON.parse(JSON.stringify(runner.sqlSnippets));
  setup.activeSqlSnippetId = runner.activeSqlSnippetId;
  setup.sync = (() => {
    const { logs, ...syncData } = sync;
    return JSON.parse(JSON.stringify(syncData));
  })();
  
  setup.backlogProjectKey = runner.backlogProjectKey;
  setup.backlogIssueTypeId = runner.backlogIssueTypeId;
  setup.backlogIssueKey = runner.backlogIssueKey;
  setup.backlogIssueSummary = runner.backlogIssueSummary;
  setup.deployPath = toRel(runner.deployPath);
  setup.updatedAt = Date.now();
  
  saveSetupsForCurrentRoot();
}

const preventAutoSearch = ref(false);

function focusProfileName() {
  if (!selectedProfile.value) return;
  nextTick(() => {
    profileNameInput.value?.focus();
  });
}

function commitProfileName() {
  const namePart = editableProfileName.value.trim();
  if (!namePart) {
    return;
  }
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) {
    return;
  }
  const setup = { ...setupProfiles.value[idx] };
  
  // Reconstruct full name: [Custom Part] - [Issue Key]
  if (runner.backlogIssueKey) {
    setup.name = `${namePart} - ${runner.backlogIssueKey}`;
  } else {
    setup.name = namePart;
  }
  
  setupProfiles.value[idx] = setup;
  saveSetupsForCurrentRoot();
}

function createNewSetupProfile() {
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
  runner.runArgs = "";
  runner.exeArgs = "";
  runner.isExeTestMode = false;
  runner.forceUnicode = true;
  selectedProjectRoot.value = "";
  
  // Clear Backlog issue links for a fresh start
  runner.backlogIssueKey = "";
  runner.backlogIssueSummary = "";
  runner.backlogIssueTypeId = undefined;
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
  selectedSetupId.value = setup.id;
  saveSetupsForCurrentRoot();
  preventAutoSearch.value = true;
  focusProfileName();
  setTimeout(() => { preventAutoSearch.value = false; }, 300);
}

async function deleteSelectedSetupProfile() {
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

async function exportProfileToDoc() {
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
- **Database**: \`${p.sqlDatabase || '(default)'}\`
- **Authentication**: ${p.useWindowsAuth ? 'Windows Authentication' : `SQL User: ${p.sqlUser || '???'}`}

## 4. Configuration Templates
### Default Config Template
\`\`\`xml
${p.configTemplate || '(default)'}
\`\`\`

${p.runConfigTemplate ? `### Run Config Template
\`\`\`xml
${p.runConfigTemplate}
\`\`\`
` : ''}

## 5. SQL Scripts (${p.sqlSnippets?.length || 0})
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

const sync = reactive({
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

function toggleTheme() {
  dark.value = !dark.value;
  const el = document.documentElement;
  if (dark.value) el.classList.add("dark");
  else el.classList.remove("dark");
  
  const theme = dark.value ? TERMINAL_THEMES.dark : TERMINAL_THEMES.light;
  if (termState.main.term) termState.main.term.options.theme = theme;
  if (termState.run.term) termState.run.term.options.theme = theme;
}

function clearLogs() {
  runner.logs = [];
  if (termState.main.term) termState.main.term.clear();
  if (termState.run.term) termState.run.term.clear();
}

async function cdToRoot() {
  if (!runner.projectRoot) return;
  const cmd = `cd '${runner.projectRoot}'\r`;
  await invoke("pty_write", { id: "main", data: cmd });
  // If we were in 'run', maybe the user wants to see it? but usually they use this in 'main'
  if (termState.active !== 'main') {
    termState.active = 'main';
    nextTick(() => termState.main.fit?.fit());
  }
}

function validatePaths() {
  return runner.projectRoot.trim().length > 0 && runner.startupProject.trim().length > 0;
}

function normalizePath(path: string) {
  let s = path.replace(/\//g, "\\");
  if (s.startsWith("\\\\?\\")) {
    s = s.substring(4);
  }
  return s;
}

async function pickProjectFolder() {
  const picked = await invoke<string | null>("pick_project_folder");
  if (!picked) return;
  runner.workspaceRoot = normalizePath(picked);
  await discoverProjects(true); // Manually picking folder should auto-select
}

async function discoverProjects(autoSelect = false) {
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
      if (!selectedProjectRoot.value || !discoveredProjects.value.some(p => p.root === selectedProjectRoot.value)) {
        selectedProjectRoot.value = discoveredProjects.value[0].root;
        applySelectedProject();
      }
    }
  } catch (e: any) {
    // Silent error
  }
}

function applySelectedProject() {
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

async function runDotnetAndCollect(mode: "restore" | "build") {
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

async function dotnet(cmd: "restore" | "build" | "run", target: "exe" | "bat" = "exe") {
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
    const actualTarget = (isTestButton && runner.isExeTestMode) ? "test_exe" : target;
    const actualArgs = (isTestButton && runner.isExeTestMode) ? runner.exeArgs : runner.runArgs;

    // If target is 'bat', ensure we are in the 'main' (Shell) terminal
    if (actualTarget === 'bat') {
      termState.active = 'main';
      nextTick(() => termState.main.fit?.fit());
    }
    
    try {
      // Only Flip to Run terminal if target is 'exe'
      if (actualTarget === 'exe' || actualTarget === 'test_exe') {
        termState.active = 'run';
        if (!termState.run.term && runTermRef.value) {
          await initPty('run', runTermRef.value);
        }
        nextTick(() => termState.run.fit?.fit());
      }

      await invoke("dotnet_run_start", {
        request: {
          projectRoot: runner.projectRoot,
          startupProject: runner.startupProject,
          urls: runner.urls || null,
          buildConfig: runner.config,
          aliasExeName: runner.aliasExeName,
          batFilePath: runner.batFilePath || null,
          target: actualTarget,
          configTemplate: runner.configTemplate,
          sqlSetupPath: runner.sqlSetupPath || null,
          sqlServer: runner.sqlServer || null,
          sqlDatabase: runner.sqlDatabase || null,
          sqlUser: runner.sqlUser || null,
          sqlPassword: runner.sqlPassword || null,
          sqlUseWindowsAuth: runner.useWindowsAuth,
          runArgs: resolveArgs(actualArgs || ""),
          deployPath: runner.deployPath || null,
          runConfigTemplate: runner.runConfigTemplate || null,
          forceUnicode: runner.forceUnicode,
        },
      });
      
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

async function rebuild() {
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

async function stop() {
  try {
    await invoke("dotnet_run_stop");
    runner.running = false;
    termState.active = 'main';
    nextTick(() => termState.main.fit?.fit());
  } catch (e: any) {
    // Silent error
  }
}

async function browseBatFile() {
  const workspace = runner.workspaceRoot;
  const defaultDir = `${workspace}\\batch`;
  const picked = await invoke("pick_file", { defaultPath: defaultDir }) as string | null;
  if (picked) {
    runner.batFilePath = picked;
    
    // Auto-fill EXE Name if it is currently empty based on chosen bat file
    if (!runner.aliasExeName.trim()) {
      const filenameMatch = picked.match(/[^\\/]+$/);
      if (filenameMatch) {
        runner.aliasExeName = filenameMatch[0].replace(/\.[^/.]+$/, "") + ".exe";
      }
    }
  }
}



async function loadConfigsForCurrentProject() {
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

async function runSqlOnly() {
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

async function runAllSqlSnippets() {
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

function onSnippetSelected(id: string | null) {
  if (!id) return;
  const snippet = runner.sqlSnippets.find(s => s.id === id);
  if (snippet) {
    runner.sqlSetupPath = snippet.content;
  }
}


function createNewSqlSnippet() {
  startNamingSqlSnippet('create');
}

function renameActiveSqlSnippet() {
  startNamingSqlSnippet('rename');
}

function deleteActiveSqlSnippet() {
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

async function checkEnv() {
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

function formatTauriShortcut(e: KeyboardEvent): string {
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

async function startRecordingShortcut(action: string) {
  if (isRecordingShortcut.value) return;
  isRecordingShortcut.value = true;
  recordingAction.value = action;
  window.addEventListener("keydown", handleShortcutKeydown, true);
  toast.info(`Recording shortcut... Press any combination for ${action.toUpperCase()}`, { duration: 4000 });
}

function stopRecordingShortcut() {
  isRecordingShortcut.value = false;
  recordingAction.value = null;
  window.removeEventListener("keydown", handleShortcutKeydown, true);
}

async function handleShortcutKeydown(e: KeyboardEvent) {
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

async function updateGlobalShortcut(action: string, newShortcut: string, oldShortcut?: string) {
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

async function notify(title: string, body: string) {
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

async function registerAllShortcuts() {
  for (const [action, shortcut] of Object.entries(runner.shortcuts)) {
    if (shortcut) {
      await updateGlobalShortcut(action, shortcut);
    }
  }
}

async function unregisterAllShortcuts() {
  for (const shortcut of Object.values(runner.shortcuts)) {
    if (shortcut && await isRegistered(shortcut)) {
      await unregisterShortcut(shortcut);
    }
  }
}

async function resetAllShortcuts() {
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

async function initPty(id: 'main' | 'run', container: HTMLElement) {
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
}

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
    const t = termState.active === 'main' ? termState.main.term : termState.run.term;
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
    const payload = event.payload;
    const { id, data } = payload;
    if (id === 'main' && termState.main.term) {
      termState.main.term.write(data);
    } else if (id === 'run' && termState.run.term) {
      termState.run.term.write(data);
    }
  });


  if (mainTermRef.value) {
    await initPty('main', mainTermRef.value);
  }

  const ro = new ResizeObserver(() => {
    try { 
      if (termState.active === 'main') {
        termState.main.fit?.fit();
        invoke("resize_pty", { id: 'main', rows: termState.main.term?.rows, cols: termState.main.term?.cols }).catch(() => {});
      } else {
        termState.run.fit?.fit();
        invoke("resize_pty", { id: 'run', rows: termState.run.term?.rows, cols: termState.run.term?.cols }).catch(() => {});
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
  if (backlogRefreshInterval) window.clearInterval(backlogRefreshInterval);
  if (cloudSyncInterval) window.clearInterval(cloudSyncInterval);
  if (unlistenRunnerLog) unlistenRunnerLog();
  if (unlistenBuildStatus) unlistenBuildStatus();
  if (runnerPollTimer) window.clearInterval(runnerPollTimer);
});

</script>

<template>
  <div class="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/5 via-background to-background text-foreground overflow-x-hidden selection:bg-primary/20">
    <header class="border-b border-black/5 dark:border-white/5 bg-card sticky top-0 z-50 shadow-sm transition-all duration-300">
      <div class="px-6 py-1.5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">IS</div>
          <div class="flex flex-col select-none">
            <div class="flex items-baseline gap-2">
              <div class="text-sm font-semibold tracking-tight">BSN iSync</div>
              <span class="text-[11px] text-muted-foreground font-medium uppercase tracking-tighter">v{{ APP_VERSION }}</span>
            </div>
            <span class="text-[8px] font-bold bg-linear-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(59,130,246,0.2)] uppercase tracking-widest leading-none mt-0.5">by ngtuonghy</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <BacklogAuthPanel 
            class="mr-2"
            v-model:host="backlog.host"
            :apiKey="backlog.apiKey"
            :status="backlog.status"
            :profile="backlog.profile"
            :projects="backlog.projects"
            v-model:selectedProjectKey="runner.backlogProjectKey"
            :error="backlog.error"
            @login-oauth="startBacklogOAuthLogin"
            @logout="handleBacklogLogout"
          />
          <div class="h-4 w-px bg-border mx-1"></div>
          
          <!-- Update status indicator -->
          <template v-if="updateVersion">
            <template v-if="isUpdateReady">
              <Button @click="applyUpdate" variant="default" size="sm" class="h-8 gap-1.5 px-3 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 animate-in fade-in zoom-in duration-300">
                <RefreshCw class="size-3.5 animate-spin-slow" />
                <span class="text-[11px] font-bold">Restart Now</span>
              </Button>
            </template>
            <template v-else>
              <Button @click="downloadUpdate" :disabled="isUpdateDownloading" variant="secondary" size="sm" class="h-8 gap-1.5 px-3 transition-all">
                <ArrowUpCircle class="size-3.5" :class="isUpdateDownloading ? 'animate-bounce' : ''" />
                <span class="text-[11px] font-bold">{{ isUpdateDownloading ? 'Downloading...' : `Update Now (v${updateVersion})` }}</span>
              </Button>
            </template>
            <div class="h-4 w-px bg-border mx-1"></div>
          </template>

          <!-- Environment Status -->
          <div class="relative group/env mr-1">
            <Button variant="ghost" size="icon" class="h-7 w-7 transition-all hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg"
                    :class="envStatus.some(x => !x.found) ? 'text-amber-500' : 'text-green-500'">
              <ShieldCheck v-if="envStatus.every(x => x.found)" class="size-4" />
              <ShieldAlert v-else class="size-4" />
            </Button>
            
            <div class="absolute right-0 top-full mt-2 w-72 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] opacity-0 invisible group-hover/env:opacity-100 group-hover/env:visible transition-all z-50 p-4 scale-95 group-hover/env:scale-100 origin-top-right ring-1 ring-white/10">
              <div class="flex items-center justify-between mb-4">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Environment</span>
                  <span class="text-[8px] text-muted-foreground/50 font-bold uppercase tracking-widest">System Requirements</span>
                </div>
                <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all" @click="checkEnv" title="Re-check environment">
                  <RefreshCw class="size-3" />
                </Button>
              </div>
              
              <div class="space-y-2">
                <div v-for="tool in envStatus" :key="tool.name" 
                     class="flex items-center justify-between p-2.5 rounded-xl border border-white/5 transition-all"
                     :class="tool.found ? 'bg-green-500/5 border-green-500/10' : 'bg-amber-500/5 border-amber-500/10'">
                  <div class="flex items-center gap-3">
                    <div class="size-2 rounded-full" :class="tool.found ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'"></div>
                    <div class="flex flex-col">
                      <span class="text-[11px] font-black text-foreground/90 uppercase tracking-tight">{{ tool.name }}</span>
                      <span class="text-[9px] text-muted-foreground font-bold tracking-tight opacity-70">{{ tool.found ? tool.version : 'Not found in PATH' }}</span>
                    </div>
                  </div>
                  <Button v-if="!tool.found" 
                          variant="secondary" 
                          size="sm" 
                          class="h-7 px-3 text-[9px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-lg shrink-0" 
                          @click="openUrl(tool.downloadUrl)">
                    Install
                  </Button>
                  <div v-else class="px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 text-[8px] font-black uppercase tracking-tighter">OK</div>
                </div>
              </div>
              
              <div v-if="envStatus.some(x => !x.found)" class="mt-4 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p class="text-[9px] text-amber-500/80 font-bold leading-relaxed text-center italic opacity-80">Some features might be unavailable until tools are installed.</p>
              </div>
            </div>
          </div>


          <template v-if="!updateVersion">
            <Button @click="() => checkForUpdates(true)" variant="ghost" size="icon" class="h-7 w-7 transition-all hover:bg-accent group" title="Check for updates">
              <RefreshCw class="size-3.5 group-hover:rotate-180 transition-transform duration-500" />
            </Button>
          </template>


          <Button @click="toggleTheme" variant="ghost" size="icon" class="h-7 w-7 transition-all hover:bg-accent ring-primary/20">
            <Moon v-if="!dark" class="size-4" />
            <Sun v-else class="size-4 text-yellow-500" />
          </Button>
          
          <Button @click="isNotificationEnabled = !isNotificationEnabled" 
                  variant="ghost" 
                  size="icon" 
                  class="h-7 w-7 transition-all hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg group/bell relative" 
                  :title="isNotificationEnabled ? 'Notifications Enabled' : 'Notifications Disabled'">
            <Bell v-if="isNotificationEnabled" class="size-4 text-primary animate-in zoom-in-50 duration-300" />
            <BellOff v-else class="size-4 text-muted-foreground opacity-50 animate-in zoom-in-50 duration-300" />
            <div v-if="isNotificationEnabled" class="absolute top-1 right-1 size-1.5 bg-primary rounded-full ring-2 ring-background animate-pulse"></div>
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            class="h-8 w-8 transition-all hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg group/hk-gl relative" 
            title="Manage Global Hotkeys"
            @click="showHotkeySettings = true"
          >
            <Keyboard class="size-4 text-muted-foreground group-hover/hk-gl:text-primary transition-colors" />
          </Button>

          <div class="h-4 w-px bg-border mx-1"></div>
        </div>
      </div>
    </header>

    <main class="h-[calc(100vh-61px)] flex flex-col px-0 pb-4 pt-2">
      <Tabs v-model="activeTab" class="flex-1 flex flex-col min-h-0">
        <div class="mx-6 mb-2 bg-muted/20 backdrop-blur-3xl p-1.5 px-3 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all duration-500">
          <div class="flex items-center gap-5">
            <!-- Workspace Group (Pro Balance) -->
            <div class="flex items-center gap-3 min-w-0 flex-[0.7] pr-5 border-r border-white/5">
              <div class="flex items-center gap-2.5 p-1 px-2 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 flex-1 min-w-0 group/ws">
                <FolderOpen class="size-3.5 text-primary opacity-60 group-hover/ws:opacity-100 transition-opacity shrink-0" />
                <input v-model="runner.workspaceRoot" 
                       class="bg-transparent border-0 h-7 text-[11px] flex-1 min-w-0 focus:outline-none placeholder:text-muted-foreground/30 font-bold" 
                       placeholder="Workspace..." />
                <div class="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" class="h-6 text-[9.5px] px-2.5 hover:bg-white/10 transition-all font-black uppercase tracking-tight rounded-md" @click="pickProjectFolder">Browse</Button>
                  <Button variant="secondary" class="h-7 text-[9.5px] px-3.5 font-black uppercase tracking-widest shadow-xl rounded-lg" @click="discoverProjects">
                    <ScanSearch class="size-3.5 mr-1.5" /> SCAN
                  </Button>
                </div>
              </div>
            </div>

            <!-- Global SQL Context Group (Pro Balance) -->
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="flex items-center gap-2 shrink-0 pr-4 border-r border-white/5">
                <Database class="size-3.5 text-primary opacity-50" />
                <span class="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">SQL CONTEXT</span>
              </div>

              <!-- Integrated SQL Context Group (Server & DB) -->
              <div class="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner ring-1 ring-white/5">
                <div class="flex items-center gap-2 px-3 py-0.5 bg-background/40 rounded-lg border border-white/5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all min-w-[120px]">
                  <Server class="size-3 text-primary/40" />
                  <input v-model="runner.sqlServer" 
                         class="bg-transparent border-0 h-6 w-full text-[10px] font-mono font-black focus:outline-none placeholder:text-muted-foreground/20" 
                         placeholder="Server..." />
                </div>
                <div class="w-px h-4 bg-white/10 mx-1"></div>
                <div class="flex items-center gap-2 px-3 py-0.5 bg-background/40 rounded-lg border border-white/5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all min-w-[120px]">
                  <Database class="size-3 text-primary/40" />
                  <input v-model="runner.sqlDatabase" 
                         class="bg-transparent border-0 h-6 w-full text-[10px] font-mono font-black focus:outline-none placeholder:text-muted-foreground/20" 
                         placeholder="Database..." />
                </div>

                <!-- SQL Connection Diagnosis Indicator -->
                <div class="flex items-center gap-1.5 px-1.5 shrink-0 border-l border-white/10 ml-0.5">
                  <div class="relative group/sql-status">
                    <div v-if="sqlConnStatus === 'loading'" class="size-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    <div v-else-if="sqlConnStatus === 'success'" class="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    <div v-else-if="sqlConnStatus === 'error'" class="size-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                    <div v-else class="size-2 rounded-full bg-muted shadow-inner opacity-40"></div>
                    
                    <!-- Error Tooltip (Simplified) -->
                    <div v-if="sqlConnStatus === 'error' && sqlErrorMsg" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-destructive text-white text-[9px] font-bold rounded-lg shadow-xl opacity-0 group-hover/sql-status:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {{ sqlErrorMsg.length > 50 ? sqlErrorMsg.substring(0, 50) + '...' : sqlErrorMsg }}
                      <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-destructive"></div>
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" class="size-6 rounded-md hover:bg-white/10 transition-all" @click="() => checkSqlConnection(true)" :disabled="sqlConnStatus === 'loading' || !runner.sqlServer || !runner.sqlDatabase" title="Test SQL Connection">
                    <RefreshCw class="size-3 text-primary/60 hover:text-primary transition-colors" :class="sqlConnStatus === 'loading' ? 'animate-spin' : ''" />
                  </Button>
                </div>
              </div>

              <!-- Pro Auth Mode Toggle -->
              <div class="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5 shadow-inner">
                <button
                  class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                  :class="runner.useWindowsAuth ? 'bg-primary text-primary-foreground shadow-lg scale-105' : 'text-muted-foreground hover:text-white opacity-40 hover:opacity-100'"
                  @click="runner.useWindowsAuth = true"
                >WIN</button>
                <button
                  class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                  :class="!runner.useWindowsAuth ? 'bg-primary text-primary-foreground shadow-lg scale-105' : 'text-muted-foreground hover:text-white opacity-40 hover:opacity-100'"
                  @click="runner.useWindowsAuth = false"
                >SQL</button>
              </div>

              <!-- Integrated Credentials (SQL Auth) -->
              <transition 
                enter-active-class="transition duration-300 ease-out" 
                enter-from-class="transform translate-x-4 opacity-0 scale-95" 
                enter-to-class="transform translate-x-0 opacity-100 scale-100"
                leave-active-class="transition duration-200 ease-in"
                leave-from-class="transform translate-x-0 opacity-100 scale-100"
                leave-to-class="transform translate-x-4 opacity-0 scale-95"
              >
                <div v-if="!runner.useWindowsAuth" class="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner ring-1 ring-white/5 mr-1">
                  <div class="flex items-center gap-2 px-2 py-0.5 bg-background/40 rounded-lg border border-white/5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <User class="size-3 text-primary/40" />
                    <input v-model="runner.sqlUser" 
                           class="bg-transparent border-0 h-6 w-16 text-[10px] font-mono font-black focus:outline-none placeholder:text-muted-foreground/20" 
                           placeholder="User" />
                  </div>
                  <div class="flex items-center gap-2 px-2 py-0.5 bg-background/40 rounded-lg border border-white/5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <Lock class="size-3 text-primary/40" />
                    <input v-model="runner.sqlPassword" 
                           class="bg-transparent border-0 h-6 w-24 text-[10px] font-mono font-black focus:outline-none placeholder:text-muted-foreground/20" 
                           placeholder="Password" />
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <TabsContent value="runner" class="flex-1 min-h-0 m-0 border-0 p-0 outline-none">
          <section class="flex h-full gap-4 items-stretch overflow-hidden">
            <div ref="mainScrollRef" class="w-[58%] min-h-0 flex flex-col gap-6 pt-2 pl-6 pr-4 pb-0 overflow-hidden">
              <section class="rounded-3xl bg-card/98 flex-1 flex flex-col min-h-0 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden shadow-sm transition-all duration-300">
                <div class="px-4 py-3 border-b border-primary/5 flex items-center justify-between bg-muted/20">
                  <div class="flex items-center gap-3">
                    <div class="text-[13px] font-black tracking-tight uppercase flex items-center gap-2">
                       <Layers class="size-4 text-primary" /> PROFILES
                    </div>
                    <div v-if="selectedProfile && selectedProfile.owner" class="text-[9px] px-2 py-0.5 rounded-full bg-muted font-medium uppercase tracking-tighter">{{ selectedProfile.owner }}</div>
                    <div v-if="selectedProfile && !canEditSelected" class="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                      <Lock class="size-2.5" /> Local Edit
                    </div>
                    
                    <!-- Professional Profile Sync Status -->
                    <div v-if="selectedProfile && selectedProfile.owner === currentUser" class="flex items-center gap-1">
                      <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter transition-all"
                           :class="syncStatus === 'saving' ? 'bg-amber-500/10 text-amber-500' : syncStatus === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'">
                        <RefreshCw v-if="syncStatus === 'saving'" class="size-2.5 animate-spin" />
                        <Cloud v-else class="size-2.5" />
                        <span v-if="syncStatus === 'saving'">Cloud Syncing...</span>
                        <span v-else-if="syncStatus === 'error'">Sync Error</span>
                        <span v-else>Cloud Protected <span v-if="lastSyncTime" class="opacity-40 ml-1 font-medium">({{ new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }})</span></span>
                      </div>
                      <Button v-if="syncStatus !== 'saving'" 
                              variant="ghost" 
                              size="icon" 
                              class="h-5 w-5 rounded-full hover:bg-muted text-muted-foreground/30 hover:text-primary transition-all p-0" 
                              title="Refresh from Cloud" 
                              @click="() => syncProfilesWithCloudflare(undefined, false, true)">
                        <RefreshCw class="size-2.5" />
                      </Button>

                      <div class="h-3 w-px bg-border mx-1 opacity-20"></div>

                      <Button 
                        v-if="syncService"
                        variant="ghost" 
                        size="icon" 
                        class="h-5 w-5 rounded-full hover:bg-muted text-muted-foreground/30 hover:text-primary transition-all p-0" 
                        title="View Version History" 
                        @click="showHistoryDialog = true"
                      >
                        <History class="size-2.5" />
                      </Button>
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    size="sm" 
                    class="h-8 px-3.5 font-black uppercase text-[10px] tracking-widest relative group/create shrink-0 shadow-sm transition-all bg-primary/90 hover:bg-primary" 
                    :disabled="runner.running || backlog.status !== 'success'" 
                    @click="createNewSetupProfile"
                  >
                    <FilePlus2 class="size-3.5 mr-1.5 opacity-80" /> NEW PROFILE
                  </Button>
                </div>

                
                <div class="p-4 flex-1 overflow-hidden">
                  <div class="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 h-full">
                    <!-- Left Column: Search & List -->
                    <div class="flex flex-col gap-3 h-full min-h-0">
                        <div class="space-y-2.5 pb-2 border-b border-white/5 shrink-0">
                          <!-- Row 1: Owner Selection & Home -->
                          <div class="flex items-center gap-1.5">
                            <Select v-model="selectedOwner" :disabled="runner.running">
                              <SelectTrigger class="h-9 text-[10.5px] bg-muted/20 border-input pl-1.5 flex-1 overflow-hidden">
                                <div class="flex items-center gap-2 overflow-hidden text-left">
                                  <Avatar size="sm" class="h-5 w-5 ring-1 ring-primary/20">
                                    <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[8px] font-bold">{{ initials(selectedOwner || "") }}</AvatarFallback>
                                  </Avatar>
                                  <div class="truncate flex-1">
                                    <SelectValue placeholder="Owner" />
                                  </div>
                                </div>
                              </SelectTrigger>
                              <SelectContent class="p-1">
                                <div class="py-2 px-1">
                                  <div class="relative">
                                    <Search class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground opacity-40" />
                                    <input v-model="ownerSearch" 
                                           class="w-full bg-background border border-input h-9 text-[11px] pl-9 pr-2 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all font-medium" 
                                           placeholder="Filter owners..."
                                           @mousedown.stop
                                           @keydown.stop />
                                  </div>
                                </div>
                                <div class="max-h-[200px] overflow-y-auto custom-scrollbar">
                                  <SelectItem v-for="owner in filteredOwnerOptions" :key="owner" :value="owner" :text-value="owner">
                                    <template #leading>
                                      <Avatar size="sm" class="h-5 w-5 ring-1 ring-primary/20" aria-hidden="true">
                                        <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[8px] font-bold">{{ initials(owner) }}</AvatarFallback>
                                      </Avatar>
                                    </template>
                                    <span class="text-[10.5px] font-medium">{{ owner }}</span>
                                  </SelectItem>
                                  <div v-if="filteredOwnerOptions.length === 0" class="px-2 py-4 text-center text-[10px] text-muted-foreground italic opacity-50">
                                    No owners found
                                  </div>
                                </div>
                              </SelectContent>
                            </Select>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              class="h-9 w-9 shrink-0 rounded-xl hover:bg-primary/10 transition-all duration-300"
                              :class="selectedOwner === currentUser && profileScope === 'personal' ? 'text-primary bg-primary/5 shadow-inner' : 'text-muted-foreground/60'"
                              @click="() => { selectedOwner = currentUser; profileScope = 'personal'; }"
                              title="My Profiles"
                            >
                              <Home class="size-4" :class="selectedOwner === currentUser && profileScope === 'personal' ? 'scale-110' : ''" />
                            </Button>
                          </div>

                          <!-- Row 4: Search -->
                          <div class="relative w-full">
                            <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground opacity-50" />
                            <Input v-model="profileSearch" placeholder="Search profiles..." :disabled="runner.running" class="pl-9 h-9 text-[11px]" />
                          </div>

                        </div>

                      <div class="flex-1 overflow-y-auto px-1 pb-2 space-y-1.5 custom-scrollbar">
                        <button v-for="setup in scopedProfiles" :key="setup.id"
                                :disabled="runner.running"
                                class="w-full flex flex-col text-left rounded-xl p-3 transition-all duration-300 group/item relative border bg-linear-to-br"
                                :class="[
                                  setup.id === selectedSetupId 
                                    ? 'from-primary/10 to-primary/5 border-primary/20 shadow-sm ring-1 ring-primary/10' 
                                    : 'border-transparent hover:bg-muted/30 from-transparent to-transparent',
                                  runner.running ? 'opacity-50 cursor-not-allowed' : ''
                                ]"
                                @click="selectedSetupId = setup.id">
                            <div class="flex items-center justify-between w-full mb-1">
                              <div class="text-[13px] font-bold leading-tight text-foreground/90 group-hover/item:text-primary transition-colors wrap-break-word flex items-center gap-2">
                                {{ setup.name }}
                                <RefreshCw v-if="setup.id === selectedSetupId && isFetchingProfile" class="size-3 animate-spin text-primary" />
                              </div>
                              <div class="flex items-center gap-1.5 opacity-40 group-hover/item:opacity-100 transition-opacity">
                                <!-- Cloud Icon for owned profiles -->
                                <Cloud v-if="setup.owner === currentUser" 
                                       class="size-3 transition-colors"
                                       :class="[
                                         setup.id === selectedSetupId && syncStatus === 'saving' ? 'text-amber-500 animate-pulse' : 
                                         setup.id === selectedSetupId && syncStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'
                                       ]" />
                                <component :is="setup.owner === currentUser ? Pencil : Save" class="size-3" />
                              </div>
                            </div>
                            <div class="flex items-center gap-1.5 overflow-hidden">
                              <div class="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover/item:bg-primary transition-colors shrink-0"></div>
                              <div class="text-[10px] text-muted-foreground truncate font-medium tracking-tight opacity-70 group-hover/item:opacity-100 transition-opacity">
                                {{ (() => {
                                  const ws = (runner.workspaceRoot || "").replace(/[\\/]$/, "");
                                  const fullRoot = setup.projectRoot ? `${ws}\\${setup.projectRoot}` : "";
                                  const normFull = fullRoot.replace(/\//g, "\\").toLowerCase();
                                  const found = discoveredProjects.find(p => (p.root || "").replace(/\//g, "\\").toLowerCase() === normFull);
                                  return found?.name || setup.projectRoot?.split('\\').pop() || "No project selected";
                                })() }}
                              </div>
                            </div>
                        </button>
                      </div>
                    </div>

                    <!-- Right Column: Detail Form -->
                    <div class="flex flex-col gap-4 border-l border-white/5 pl-4 overflow-y-auto custom-scrollbar">
                      <div class="flex items-start justify-between gap-4 pb-3 border-b border-primary/5">
                        <div class="min-w-0 flex-1 relative">
                          <template v-if="selectedProfile">
                            <div ref="issueSearchContainerRef" class="relative group/identity flex flex-col pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div class="flex items-center gap-2">
                                <div class="relative flex-1 flex items-center bg-transparent border-b-2 border-transparent pb-0.5 rounded-none px-0 transition-all"
                                     :class="[!isNamingSqlSnippet ? 'focus-within:border-primary/50' : '']">
                                  <Input 
                                    ref="profileNameInput" 
                                    v-model="editableProfileName" 
                                    class="font-black h-10 border-0 bg-transparent focus-visible:ring-0 px-2 -ml-2 transition-all rounded-md text-xl flex-1 min-w-0 cursor-text shadow-none" 
                                    placeholder="Profile name or search issue..."
                                    @focus="() => { if (!preventAutoSearch) showIssueSearch = true; }"
                                    @input="showIssueSearch = true"
                                    @blur="commitProfileName"
                                    @keydown.enter="commitProfileName" 
                                  />
                                  <div v-if="runner.backlogIssueKey" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[9px] font-black shrink-0 shadow-sm mx-1 group/badge transition-all hover:bg-primary/20 max-w-[200px]">
                                    <span class="truncate block w-full text-left" :title="runner.backlogIssueKey">{{ runner.backlogIssueKey }}</span>
                                    <button @click.stop="unlinkBacklogIssue" 
                                            class="hover:bg-primary/80 hover:text-primary-foreground rounded-full p-0.5 transition-colors opacity-60 group-hover/badge:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed" 
                                            title="Unlink issue">
                                      <X class="size-2.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <span class="text-[9px] font-bold text-muted-foreground opacity-30 font-mono tracking-tighter mt-0.5 ml-0.5">ID: {{ selectedProfile.id }}</span>

                              <!-- Unified Search Dropdown under Title -->
                              <div v-if="showIssueSearch && backlog.profile" 
                                   class="absolute top-12 left-0 w-full z-50 bg-card/95 backdrop-blur-xl border border-primary/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 origin-top">
                                <div class="p-2 border-b border-white/5 bg-primary/5 flex items-center justify-between">
                                  <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Suggestions from Backlog</span>
                                  <Button variant="ghost" size="icon" class="h-5 w-5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive" @click="showIssueSearch = false">
                                    <Plus class="size-3 rotate-45" />
                                  </Button> 
                                </div>
                                <div class="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                  <div v-if="filteredBacklogIssues.length === 0" class="py-12 text-center">
                                    <Search class="size-8 mx-auto opacity-10 mb-2" />
                                    <p class="text-[10px] uppercase font-bold text-muted-foreground opacity-40">No issues found</p>
                                  </div>
                                  <button v-for="issue in filteredBacklogIssues.slice(0, 15)" :key="issue.id"
                                          class="w-full flex flex-col items-start p-2.5 rounded-xl transition-all hover:bg-primary/10 group/item text-left"
                                          @click="selectBacklogIssue(issue); showIssueSearch = false">
                                    <div class="flex flex-col gap-1 items-start w-full min-w-0">
                                      <div class="inline-flex max-w-[95%] h-5 px-1.5 rounded-[4px] border border-b-2 text-[10px] font-mono font-bold items-center justify-center uppercase tracking-normal bg-background shadow-xs transition-all active:translate-y-px active:border-b truncate" :title="issue.issueKey">
                                        <span class="truncate block w-full">{{ issue.issueKey }}</span>  
                                      </div>
                                      <span class="text-[11px] font-bold text-foreground opacity-80 pl-0.5 block w-full truncate" :title="issue.summary">{{ issue.summary }}</span>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </template>
                          <template v-else>
                            <h2 class="text-xl font-black tracking-tight text-muted-foreground/40 mt-1">Select a Profile</h2>
                          </template>
                        </div>
                        <div class="flex items-center gap-2 pt-1.5 shrink-0">
                          <Button 
                            v-if="syncService"
                            variant="ghost" 
                            size="icon" 
                            class="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary transition-all opacity-60 hover:opacity-100"
                            title="View History"
                            @click="showHistoryDialog = true"
                          >
                            <History class="size-4" />
                          </Button>

                          <Button 
                            v-if="backlogIssueUrl"
                            variant="ghost" 
                            size="icon" 
                            class="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary transition-all opacity-60 hover:opacity-100"
                            title="View on Backlog"
                            @click="() => { if (backlogIssueUrl) openUrl(backlogIssueUrl); }"
                          >
                            <ExternalLink class="size-4" />
                          </Button>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            class="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary transition-all opacity-60 hover:opacity-100"
                            title="Export Documentation"
                            @click="exportProfileToDoc"
                          >
                            <FileDown class="size-4" />
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            class="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-destructive hover:text-destructive-foreground hover:bg-destructive/20 transition-all border border-destructive/20 font-black tracking-widest text-[9px] shadow-sm uppercase shrink-0"
                            title="Delete this Profile"
                            :disabled="runner.running"
                            @click="deleteSelectedSetupProfile"
                          >
                            <Trash2 class="size-3.5 opacity-80" /> DELETE
                          </Button>
                        </div>
                      </div>

                      <div class="space-y-6 pt-2">
                        <div class="flex items-center justify-between mb-1.5 px-0.5">
                          <Label class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5"><AppWindow class="size-3.5 text-primary opacity-80" /> Target Project</Label>
                          
                          <Dialog>
                            <DialogTrigger as-child>
                              <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group/settings" title="Configuration & SQL Setup">
                                <Settings2 class="size-4 group-hover/settings:rotate-90 transition-transform duration-500" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent class="max-w-6xl w-[90vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-primary/20 shadow-2xl rounded-2xl">
                              <DialogHeader class="px-6 py-4 border-b bg-muted/30">
                                <div class="flex items-center gap-3">
                                  <div class="p-2 rounded-xl bg-primary/10 text-primary">
                                    <Settings2 class="size-5" />
                                  </div>
                                  <div>
                                    <DialogTitle class="text-xl font-black uppercase tracking-tight">Project Configuration</DialogTitle>
                                    <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">SQL Setup & App.config Template</p>
                                  </div>
                                </div>
                              </DialogHeader>
                              
                              <div class="flex-1 overflow-hidden p-6">
                                  <Tabs defaultValue="target" class="h-full flex flex-col gap-6">
                                    <TabsList class="grid w-full grid-cols-3 h-10 p-1 bg-muted/50 rounded-xl">
                                      <TabsTrigger value="target" class="rounded-lg font-bold uppercase tracking-widest text-[11px]">Target Config (Test)</TabsTrigger>
                                      <TabsTrigger value="run" class="rounded-lg font-bold uppercase tracking-widest text-[11px]">Run Config (Exe)</TabsTrigger>
                                      <TabsTrigger value="conn" class="rounded-lg font-bold uppercase tracking-widest text-[11px]">Connection Strings</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="target" class="flex flex-col flex-1 min-h-0 mt-0 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                       <!-- 1. App.config Setup (Target/Test) -->
                                       <div class="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-2xl overflow-hidden bg-background/50 shadow-inner">
                                          <div class="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-primary/10 shrink-0">
                                            <div class="flex items-center gap-2">
                                              <div class="size-2 rounded-full bg-blue-500"></div>
                                              <Label class="text-[10px] uppercase font-black text-muted-foreground tracking-widest">App.config (Target Template)</Label>
                                            </div>
                                          </div>
                                          <Textarea v-model="runner.configTemplate" 
                                                    class="flex-1 font-mono text-[11px] p-4 leading-relaxed bg-transparent border-0 focus-visible:ring-0 resize-none custom-scrollbar rounded-none" 
                                                    placeholder="<!-- XML Template content (for Test) -->" />
                                       </div>

                                    </TabsContent>

                                    <TabsContent value="run" class="flex flex-col flex-1 min-h-0 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                       <div class="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-2xl overflow-hidden bg-background/50 shadow-inner">
                                          <div class="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-primary/10 shrink-0">
                                            <div class="flex items-center gap-2">
                                              <div class="size-2 rounded-full bg-green-500"></div>
                                              <Label class="text-[10px] uppercase font-black text-muted-foreground tracking-widest">App.config (Run Template)</Label>
                                            </div>
                                          </div>
                                          <Textarea v-model="runner.runConfigTemplate" 
                                                    class="flex-1 font-mono text-[11px] p-4 leading-relaxed bg-transparent border-0 focus-visible:ring-0 resize-none custom-scrollbar rounded-none" 
                                                    placeholder="<!-- Run XML content -->" />
                                       </div>
                                    </TabsContent>
                                    <TabsContent value="conn" class="flex flex-col flex-1 min-h-0 mt-0 animate-in fade-in slide-in-from-top-4 duration-300">
                                       <div class="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-2xl overflow-hidden bg-background/50 shadow-inner">
                                          <div class="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-primary/10 shrink-0">
                                            <div class="flex items-center gap-2">
                                              <div class="size-2 rounded-full bg-orange-500"></div>
                                              <Label class="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Connection Strings Override</Label>
                                            </div>
                                          </div>
                                          <Textarea v-model="runner.connectionStringTemplate" 
                                                    class="flex-1 font-mono text-[11px] p-4 leading-relaxed bg-transparent border-0 focus-visible:ring-0 resize-none custom-scrollbar rounded-none" 
                                                    placeholder="<connectionStrings>&#10;  <add name=&quot;EntityFramework&quot; connectionString=&quot;Data Source=...;Initial Catalog=...;Integrated Security=True&quot; />&#10;</connectionStrings>" />
                                          <div class="px-4 py-2 bg-primary/5 text-[9px] font-bold text-primary/60 uppercase tracking-widest border-t border-primary/5">
                                            SQL Server and Database will still be automatically mapped.
                                          </div>
                                       </div>
                                    </TabsContent>
                                  </Tabs>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                            <Select v-model="selectedProjectRoot" @update:model-value="applySelectedProject">
                              <SelectTrigger class="w-full h-9 bg-muted/20 border-input">
                                <div class="truncate max-w-full font-medium text-xs">
                                  <SelectValue placeholder="Scan projects to select...">
                                    {{ discoveredProjects.find(p => p.root === selectedProjectRoot)?.name }}
                                  </SelectValue>
                                </div>
                              </SelectTrigger>
                              <SelectContent class="p-1">
                                <div class="py-2 px-1">
                                  <div class="relative">
                                    <Search class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground opacity-40" />
                                    <input v-model="projectSearch" 
                                           class="w-full bg-background border border-input h-9 text-[11px] pl-9 pr-2 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all font-medium" 
                                           placeholder="Filter projects..."
                                           @mousedown.stop
                                           @keydown.stop />
                                  </div>
                                </div>
                                <div class="max-h-[250px] overflow-y-auto custom-scrollbar">
                                  <SelectItem v-for="item in filteredDiscoveredProjects" :key="item.root" :value="item.root">
                                    <div class="flex flex-col items-start gap-0.5">
                                      <span class="text-xs font-bold">{{ item.name }}</span>
                                      <span class="text-[9px] text-muted-foreground opacity-60 truncate max-w-[300px]">{{ item.root }}</span>
                                    </div>
                                  </SelectItem>
                                </div>
                              </SelectContent>
                            </Select>
                          </div>


                        <div class="space-y-3 pt-2 mt-2 border-t border-border/40">
                          <div class="flex items-center justify-between px-0.5">
                            <Label class="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                              <TerminalSquare class="size-3.5 text-primary opacity-80" /> 
                              <span class="opacity-80">Test Configuration</span>
                            </Label>
                            <div class="flex items-center bg-muted/50 p-0.5 rounded-md border shadow-inner">
                              <button @click="runner.isExeTestMode = false" 
                                      :class="!runner.isExeTestMode ? 'bg-background shadow-sm text-foreground ring-1 ring-black/5 dark:ring-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
                                      class="px-2.5 py-0.5 rounded-sm text-[9px] font-bold transition-all uppercase tracking-wider">
                                BAT Mode
                              </button>
                              <button @click="runner.isExeTestMode = true" 
                                      :class="runner.isExeTestMode ? 'bg-background shadow-sm text-foreground ring-1 ring-black/5 dark:ring-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
                                      class="px-2.5 py-0.5 rounded-sm text-[9px] font-bold transition-all uppercase tracking-wider">
                                EXE Mode
                              </button>
                            </div>
                          </div>

                          <div v-if="!runner.isExeTestMode" class="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div class="flex gap-1.5 h-9">
                              <div class="flex-1 relative flex items-center">
                                <Input v-model="runner.batFilePath" placeholder="Path to .bat file" class="font-mono pr-8 h-full text-[11px]" />
                                <Beaker class="absolute right-2.5 size-3 opacity-30" />
                              </div>
                              <Button variant="outline" size="icon" class="h-full w-9 border-input shrink-0" @click="browseBatFile"><FolderOpen class="size-4" /></Button>
                            </div>
                            <div class="flex items-center justify-end pr-1 mt-1.5">
                              <label class="flex items-center gap-1.5 cursor-pointer group select-none">
                                <div class="relative flex items-center justify-center">
                                  <input type="checkbox" v-model="runner.forceUnicode" class="peer sr-only" />
                                  <div class="w-6 h-3.5 bg-muted-foreground/30 rounded-full peer-checked:bg-primary/80 transition-colors shadow-inner border border-border/50"></div>
                                  <div class="absolute left-[2px] size-2.5 bg-background rounded-full shadow-sm transform transition-transform peer-checked:translate-x-[10px] border border-border/50"></div>
                                </div>
                                <span class="text-[9px] font-bold tracking-wide uppercase transition-colors" :class="runner.forceUnicode ? 'text-primary/90' : 'text-muted-foreground/60 group-hover:text-muted-foreground'">
                                  Shift-JIS (932)
                                </span>
                              </label>
                            </div>
                          </div>
                          
                          <div class="space-y-1.5 pb-2">
                            <div class="flex flex-col mb-2 px-1">
                              <Label class="text-[9px] font-bold text-muted-foreground uppercase mb-1.5 pl-0.5 flex items-center gap-1.5">
                                <span class="opacity-70">{{ runner.isExeTestMode ? 'EXE ARGUMENTS' : 'BAT ARGUMENTS' }}</span> 
                                <span class="text-[8px] opacity-40 normal-case font-normal leading-none">{{ runner.isExeTestMode ? '(passed to .exe during TEST)' : '(passed to .bat during TEST)' }}</span>
                              </Label>
                              
                              <div v-if="!runner.isExeTestMode" class="relative flex items-center group/args animate-in fade-in slide-in-from-right-2 duration-300">
                                <Input ref="argsInputRefBat" v-model="runner.runArgs" placeholder="-debug ..." class="pr-20 selection:bg-primary/30 selection:text-primary" />
                                <div class="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover/args:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {time}" @click="insertTimePlaceholder">
                                    <Clock class="size-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {hostname}" @click="insertHostnamePlaceholder">
                                    <Monitor class="size-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div v-else class="relative flex items-center group/args animate-in fade-in slide-in-from-right-2 duration-300">
                                <Input ref="argsInputRefExe" v-model="runner.exeArgs" placeholder="1 2 3 4 5 ..." class="pr-20 selection:bg-primary/30 selection:text-primary" />
                                <div class="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover/args:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {time}" @click="insertTimePlaceholder">
                                    <Clock class="size-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {hostname}" @click="insertHostnamePlaceholder">
                                    <Monitor class="size-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div class="space-y-4 pb-2 border-t border-white/5 pt-3">
                            <!-- SQL Snippets & Execution -->
                            <div class="space-y-1.5 min-h-0">
                              <div class="flex items-center justify-between px-0.5 mb-1.5">
                                <Label class="text-[9px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1.5">
                                  <Code2 class="size-3.5 text-primary opacity-80" /> SQL Scripts
                                </Label>

                                <div class="flex items-center gap-2">
                                  <span class="text-[8px] font-black py-0.5 px-2 rounded bg-primary/10 text-primary uppercase tracking-tighter">Profile-specific scripts</span>
                                  <div class="w-px h-3 bg-white/10"></div>
                                  <Button variant="ghost" size="sm" class="h-7 px-3.5 text-[9px] font-black tracking-widest text-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-500 transition-all flex items-center gap-2 rounded-lg group/full border border-cyan-500/20 bg-cyan-500/5 shadow-sm" title="Open Fullscreen Editor (Serious Mode)" @click="isSqlSnippetFullscreen = true">
                                    <Maximize2 class="size-3 group-hover/full:scale-110 transition-transform" />
                                    FULLSCREEN
                                  </Button>
                                </div>
                              </div>
                              <div class="flex gap-1.5">
                                <Button variant="ghost" size="sm" class="h-5 px-2.5 py-0 text-[8.5px] font-black tracking-widest text-[#FF7500] hover:bg-[#FF7500]/10 hover:text-[#FF7500] rounded-md shadow-sm border border-[#FF7500]/20 bg-[#FF7500]/5" title="Run All Scripts" @click="runAllSqlSnippets" :disabled="!canExecuteSelected || runner.sqlSnippets.length === 0">
                                  <ListTree class="size-2.5 mr-1" /> RUN ALL
                                </Button>
                                <Button variant="ghost" size="sm" class="h-5 px-2.5 py-0 text-[8.5px] font-black tracking-widest text-primary hover:bg-primary/10 hover:text-primary rounded-md shadow-sm border border-primary/20 bg-primary/5" title="Run Current Script" @click="runSqlOnly" :disabled="!canExecuteSelected || runner.sqlSnippets.length === 0">
                                  <Play class="size-2.5 mr-1" /> RUN
                                </Button>
                              </div>
                            </div>
                              
                              <div class="flex items-center gap-1.5 p-1.5 rounded-xl bg-muted/40 shadow-inner border border-primary/5">
                                <Select v-model="runner.activeSqlSnippetId" @update:model-value="(v: any) => onSnippetSelected(v)" :disabled="runner.sqlSnippets.length === 0">
                                  <SelectTrigger class="h-8 flex-1 text-[10px] font-bold bg-background shadow-sm border-primary/10 rounded-lg hover:border-primary/30 transition-colors">
                                    <SelectValue placeholder="No scripts found..." />
                                  </SelectTrigger>
                                  <SelectContent class="max-w-[250px] shadow-xl">
                                    <SelectItem v-for="snippet in runner.sqlSnippets" :key="snippet.id" :value="snippet.id" class="text-[10px] font-medium py-2">
                                      <div class="flex items-center gap-2">
                                        <Code2 class="size-3.5 text-primary/70" />
                                        <span>{{ snippet.name }}</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                <div class="w-px h-5 bg-border/80 mx-0.5"></div>

                                <Button variant="outline" size="sm" class="h-8 px-3 rounded-lg border-primary/20 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground shadow-sm transition-all focus:ring-2 focus:ring-primary/20 font-black tracking-widest text-[9px]" @click="createNewSqlSnippet" title="Create a new query script">
                                  <Plus class="size-3.5 mr-1.5" /> CREATE
                                </Button>
                                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-lg hover:bg-background shadow-xs text-muted-foreground transition-all" @click="renameActiveSqlSnippet" :disabled="runner.sqlSnippets.length === 0" title="Rename Script">
                                  <Pencil class="size-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-lg hover:bg-destructive shadow-xs hover:text-destructive-foreground text-destructive/80 transition-all" @click="deleteActiveSqlSnippet" :disabled="runner.sqlSnippets.length === 0" title="Delete Script">
                                  <Trash2 class="size-3.5" />
                                </Button>
                              </div>

                              <SqlEditor
                                v-model="runner.sqlSetupPath"
                                placeholder="-- Write SQL queries here..."
                                height="260px"
                                font-size="11px"
                                :disabled="runner.sqlSnippets.length === 0"
                                @change="(v: string) => { 
                                   const s = runner.sqlSnippets.find(s => s.id === runner.activeSqlSnippetId);
                                   if(s) s.content = v;
                                }"
                              />
                            </div>
                          </div>

                        </div>
                    </div>
                  </div>
                </section>

            </div>

            <div class="flex-1 h-full flex flex-col gap-4 min-w-0 pt-2 pr-6 pl-2 pb-0 overflow-hidden">
              <section class="rounded-3xl bg-card/25 flex-1 flex flex-col min-h-0 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-2xl">
                <!-- Header with Session Switcher -->
                <div class="px-3 py-1.5 flex items-center justify-between border-b bg-muted/50">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mr-2">Terminal</span>
                    
                    <div class="flex items-center gap-1 bg-background/50 p-0.5 rounded-md border shadow-inner" v-if="runner.running || termState.active === 'run'">
                      <button @click="termState.active = 'main'" 
                              :class="termState.active === 'main' ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
                              class="px-2.5 py-0.5 rounded-sm text-[10px] font-bold transition-all uppercase tracking-tighter">
                        1 Shell
                      </button>
                      <button @click="termState.active = 'run'" 
                              :class="termState.active === 'run' ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
                              class="px-2.5 py-0.5 rounded-sm text-[10px] font-bold transition-all uppercase tracking-tighter">
                        2 Output
                      </button>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1 border-l ml-1 pl-1">
                      <Button variant="ghost" size="sm" class="h-6 w-6 p-0 text-muted-foreground hover:text-primary transition-colors" title="Jump to Project Root" @click="cdToRoot">
                        <Home class="size-3" />
                      </Button>
                      <Button variant="ghost" size="sm" class="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors" @click="clearLogs">Clear</Button>
                    </div>
                  </div>
                </div>

                <div class="flex-1 flex flex-row min-h-0 bg-card relative">
                  <!-- Main Shell Viewport -->
                  <div v-show="termState.active === 'main'" ref="mainTermRef" class="flex-1 terminal-custom-scroll"></div>
                  
                  <!-- Run Output Viewport -->
                  <div v-show="termState.active === 'run'" ref="runTermRef" class="flex-1 terminal-custom-scroll"></div>
                    <!-- Premium Vertical Execution Sidebar -->
                  <div class="w-14 border-l bg-muted/40 flex flex-col shrink-0 overflow-y-auto scrollbar-none">
                    <TooltipProvider>
                      <div class="flex-1"></div>

                      <div class="flex flex-col items-center py-8 gap-6 relative">
                        <!-- Status Indicator with Glow -->
                        <div class="flex flex-col items-center gap-2 mb-4 group/status cursor-default">
                          <div class="size-2 rounded-full transition-all duration-500" 
                               :class="runner.running ? 'bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]' : 'bg-zinc-700 shadow-[0_0_4px_rgba(0,0,0,0.5)]'">
                          </div>
                          <span class="text-[7.5px] uppercase tracking-[0.15em] font-bold transition-colors duration-300" 
                                :class="runner.running ? 'text-green-400' : 'text-zinc-600'">
                            {{ runner.running ? 'Run' : 'Idle' }}
                          </span>
                        </div>

                        <div class="w-8 h-px bg-white/10 opacity-50"></div>

                        <!-- Build Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90 relative"
                                    :class="((runner.buildStatus || runner.loadingTarget === 'build') ? '' : (!canBuild || runner.loadingTarget || runner.buildStatus) ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50')"
                                    :disabled="!canBuild || !!runner.loadingTarget || !!runner.buildStatus"
                                    @click="dotnet('build')">
                              <div :class="runner.buildStatus ? 'animate-hammer-grow' : ''">
                                <component :is="runner.loadingTarget === 'build' ? RotateCcw : Hammer" 
                                           :class="[
                                             'size-4 transition-all duration-300',
                                             runner.loadingTarget === 'build' ? 'animate-spin' : '',
                                             runner.buildStatus ? 'animate-hammer-hit text-[#FC6400]' : 'group-hover/btn:rotate-12 text-zinc-500'
                                           ]" />
                              </div>
                              <div v-if="runner.buildStatus" class="absolute size-4 bg-[#FAC000]/40 rounded-full animate-spark-pop blur-sm z-0"></div>
                              <span class="text-[7.5px] uppercase tracking-tighter font-bold transition-all duration-300" 
                                    :class="runner.buildStatus ? 'text-[#FF7500] animate-pulse scale-110' : 'text-zinc-600'">
                                {{ runner.loadingTarget === 'build' ? '...' : (runner.buildStatus ? 'Building' : 'Build') }}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-zinc-400 font-semibold tracking-wide">Build Project</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runner.shortcuts.build" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        
                        <!-- Rebuild Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90 relative"
                                    :class="(runner.loadingTarget === 'rebuild') ? 'text-zinc-200' : (!canBuild || runner.loadingTarget || runner.buildStatus) ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50'"
                                    :disabled="!canBuild || !!runner.loadingTarget || !!runner.buildStatus"
                                    @click="rebuild">
                              <RotateCcw :class="[
                                           'size-4 transition-transform duration-300',
                                           runner.loadingTarget === 'rebuild' ? 'animate-spin' : 'group-hover/btn:-rotate-45'
                                         ]" />
                              <span class="text-[8px] uppercase tracking-wide font-semibold">{{ runner.loadingTarget === 'rebuild' ? '...' : 'Rebuild' }}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-zinc-400 font-semibold tracking-wide">Rebuild All</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runner.shortcuts.rebuild" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>

                        <div class="w-8 h-px bg-white/10 opacity-50 my-1"></div>

                        <!-- Test Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-blue-500 relative" 
                                    :class="((canTest && runner.loadingTarget === 'bat') ? 'text-blue-500' : (canTest && !runner.loadingTarget && !runner.buildStatus) 
                                      ? 'text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                      : 'text-zinc-700 cursor-not-allowed opacity-40')"
                                    :disabled="!canTest || !!runner.loadingTarget || !!runner.buildStatus"
                                    @click="dotnet('run', 'bat')">
                              <component :is="runner.loadingTarget === 'bat' ? RotateCcw : (runner.isExeTestMode ? TerminalSquare : Beaker)"
                                         :class="[
                                           'size-5 transition-transform duration-300',
                                           runner.loadingTarget === 'bat' ? 'animate-spin' : 'group-hover/btn:-rotate-12'
                                         ]" />
                              <span class="text-[8px] uppercase tracking-wide font-bold">{{ runner.loadingTarget === 'bat' ? '...' : 'Test' }}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-blue-400 font-semibold tracking-wide">Run Test (BAT)</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runner.shortcuts.test" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>

                        <!-- Run Button with Tooltip -->
                        <template v-if="!runner.running">
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button variant="ghost" 
                                      class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-green-500 relative" 
                                      :class="(runner.loadingTarget === 'exe') ? 'opacity-100' : (!canRun || runner.loadingTarget || runner.buildStatus) ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:text-green-400 hover:bg-green-500/10'"
                                      :disabled="!canRun || !!runner.loadingTarget || !!runner.buildStatus"
                                      @click="dotnet('run', 'exe')">
                                <component :is="runner.loadingTarget === 'exe' ? RotateCcw : Play"
                                           :class="[
                                             'size-5 transition-transform duration-300',
                                             runner.loadingTarget === 'exe' ? 'animate-spin' : 'fill-current group-hover/btn:scale-110'
                                           ]" />
                                <span class="text-[8px] uppercase tracking-wide font-bold">{{ runner.loadingTarget === 'exe' ? '...' : 'Run' }}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" :side-offset="12">
                              <div class="flex items-center gap-3">
                                <span class="text-green-400 font-semibold tracking-wide">Run Application</span>
                                <div class="h-4 w-px bg-white/10"></div>
                                <HotkeyLabel :shortcut="runner.shortcuts.run" size="lg" variant="solid" />
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </template>

                        <!-- Stop Button with Tooltip -->
                        <template v-else>
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button variant="ghost" 
                                      class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-red-500 hover:text-red-400 hover:bg-red-500/10 relative" 
                                      @click="stop">
                                <Square class="size-5 fill-current group-hover/btn:drop-shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all" />
                                <span class="text-[8px] uppercase tracking-wide font-bold">Stop</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" :side-offset="12">
                              <div class="flex items-center gap-3">
                                <span class="text-red-400 font-semibold tracking-wide">Stop Execution</span>
                                <div class="h-4 w-px bg-white/10"></div>
                                <HotkeyLabel :shortcut="runner.shortcuts.stop" size="lg" variant="solid" />
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </template>
                      </div>
                    </TooltipProvider>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </main>
    <Toaster richColors position="bottom-right" closeButton expand />

    <ProfileHistory 
      v-model:open="showHistoryDialog"
      :profile="selectedProfile"
      :syncService="syncService"
      :canEdit="canEditSelected"
      @restore="restoreVersion"
    />

    <!-- Premium Global Hotkey Dialog -->
    <Dialog :open="showHotkeySettings" @update:open="val => { showHotkeySettings = val; if(!val) stopRecordingShortcut(); }">
      <DialogContent class="max-w-2xl p-0 border-0 bg-transparent shadow-none overflow-visible">
        <HotkeyManager 
          :shortcuts="runner.shortcuts"
          :isRecording="isRecordingShortcut"
          :recordingAction="recordingAction"
          @start-recording="startRecordingShortcut"
          @stop-recording="stopRecordingShortcut"
          @update:shortcut="(action, val) => { runner.shortcuts[action] = val; saveUIState(); updateGlobalShortcut(action, val); }"
          @reset-all="resetAllShortcuts"
          @close="showHotkeySettings = false"
        />
      </DialogContent>
    </Dialog>

    <Dialog :open="isNamingSqlSnippet" @update:open="val => isNamingSqlSnippet = val">
      <DialogContent class="sm:max-w-[425px] rounded-3xl border border-primary/10 shadow-2xl bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle class="text-[14px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Code2 class="size-4" /> {{ namingSqlSnippetTitle }}
          </DialogTitle>
        </DialogHeader>
        <div class="py-6 space-y-4">
          <div class="space-y-2">
            <Label class="text-[10px] font-black uppercase text-muted-foreground opacity-60 ml-1 font-mono">Script Name</Label>
            <Input 
              v-model="namingSqlSnippetValue" 
              class="h-11 rounded-xl bg-muted/30 border-primary/5 focus:border-primary/20 focus:ring-2 focus:ring-primary/10 transition-all font-bold px-4" 
              placeholder="e.g., Update Database Schema"
              autofocus
              @keydown.enter="commitSqlSnippetName"
            />
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 mt-2">
          <Button variant="ghost" class="h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest opacity-60 hover:opacity-100" @click="isNamingSqlSnippet = false">
            Cancel
          </Button>
          <Button class="h-11 px-8 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90" @click="commitSqlSnippetName">
            Save Script
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Professional Fullscreen SQL Editor Dialog -->
    <Dialog :open="isSqlSnippetFullscreen" @update:open="val => isSqlSnippetFullscreen = val">
      <DialogContent class="max-w-none! sm:max-w-none! w-[90vw]! h-[88vh] p-0 border-0 bg-transparent shadow-none overflow-hidden flex flex-col pointer-events-auto transition-all duration-500 [&>button]:hidden">
        <div class="flex-1 bg-background/95 backdrop-blur-3xl border border-border shadow-[0_0_100px_rgba(0,0,0,0.2)] rounded-[24px] overflow-hidden flex flex-col ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-500">
          <!-- Pro Toolbar Header (Theme Synced) -->
          <div class="h-14 px-6 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
            <!-- Left: Brand -->
            <div class="flex items-center gap-3">
              <div class="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
                <Code2 class="size-5" />
              </div>
              <div class="flex flex-col">
                <span class="text-[12px] font-black uppercase tracking-[0.2em] text-foreground">SQL PRO ENGINE</span>
                <span class="text-[8px] font-black text-muted-foreground/60 uppercase tracking-tighter">Synchronized Environment</span>
              </div>
            </div>

            <!-- Center: Snippet Sync & Context -->
            <div class="flex items-center gap-4 flex-1 max-w-[550px] mx-6">
              <div class="flex-1 flex items-center gap-2 bg-background border border-border p-1 rounded-xl shadow-sm group/sync focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Select v-model="runner.activeSqlSnippetId" @update:model-value="(v: any) => onSnippetSelected(v)">
                  <SelectTrigger class="h-8 flex-1 text-[10.5px] font-bold bg-muted/30 border-0 rounded-lg hover:bg-muted/50 transition-all">
                    <SelectValue placeholder="Select script..." />
                  </SelectTrigger>
                  <SelectContent class="max-w-[300px] shadow-2xl">
                    <SelectItem v-for="snippet in runner.sqlSnippets" :key="snippet.id" :value="snippet.id" class="text-[10.5px] font-bold py-2">
                      <div class="flex items-center gap-2">
                        <Code2 class="size-3.5 text-primary/70" />
                        <span>{{ snippet.name }}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                <div class="w-px h-5 bg-border mx-1"></div>
                
                <div class="flex items-center gap-3 px-2 shrink-0">
                  <div class="flex items-center gap-1.5 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                    <Server class="size-3 text-primary" />
                    <span class="text-[10px] font-mono font-bold truncate max-w-[80px]">{{ runner.sqlServer || '?' }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                    <Database class="size-3 text-primary" />
                    <span class="text-[10px] font-mono font-bold truncate max-w-[80px]">{{ runner.sqlDatabase || '?' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: Action Controls -->
            <div class="flex items-center gap-2">
              <Button variant="ghost" class="h-9 px-4 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all rounded-lg border border-primary/20 bg-primary/5 group/run-all min-w-[110px]" @click="runAllSqlSnippets" :disabled="runner.sqlSnippets.length === 0">
                <ListTree class="size-3.5 opacity-70 group-hover/run-all:scale-110 transition-transform mr-1.5" />
                Run All
              </Button>
              <Button class="h-9 px-5 text-[9px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 rounded-lg group/run shadow-lg shadow-primary/10 min-w-[120px]" @click="runSqlOnly" :disabled="runner.sqlSnippets.length === 0">
                <Play class="size-3.5 fill-current group-hover/run:scale-110 transition-transform" />
                Run Script
              </Button>
              
              <div class="w-px h-6 bg-border mx-2"></div>
              
              <Button variant="ghost" size="icon" class="size-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all border border-transparent hover:border-destructive/20" @click="isSqlSnippetFullscreen = false">
                <X class="size-5" />
              </Button>
            </div>
          </div>

          <!-- Code Editor Area -->
          <div class="flex-1 min-h-0 relative">
            <SqlEditor
              v-model="runner.sqlSetupPath"
              :is-dark="dark"
              height="100%"
              font-size="14px"
              placeholder="-- Write your SQL pro queries here..."
              @change="(v: string) => { 
                 const s = runner.sqlSnippets.find(s => s.id === runner.activeSqlSnippetId);
                 if(s) s.content = v;
              }"
            />
            
            <!-- Floating Indicator -->
            <div class="absolute bottom-6 left-6 flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border shadow-sm opacity-60 hover:opacity-100 transition-opacity pointer-events-none">
              <div class="size-2 rounded-full" :class="dark ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]'"></div>
              <span class="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">PRO Mode Active</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(50px) scale(0.9);
}
</style>

<style>
.terminal-custom-scroll .xterm-viewport::-webkit-scrollbar {
  width: 8px;
}
.terminal-custom-scroll .xterm-viewport::-webkit-scrollbar-track {
  background: transparent;
}
.terminal-custom-scroll .xterm-viewport::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.terminal-custom-scroll .xterm-viewport::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
.xterm-screen {
  padding: 8px;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--muted-foreground);
  opacity: 0.5;
}
</style>
