<script setup lang="ts">
declare const __APP_VERSION__: string;
const APP_VERSION = __APP_VERSION__;

import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { onClickOutside } from "@vueuse/core";
import { FolderOpen, ScanSearch, Plus, Pencil, Save, Trash2, Hammer, Play, Square, RotateCcw, Beaker, Home, ChevronDown, ChevronRight, Sun, Moon, Search, Clock, RefreshCw, ArrowUpCircle, ExternalLink, X, ShieldCheck, ShieldAlert, Bell, BellOff, Cloud, Share2 } from "lucide-vue-next";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "vue-sonner";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
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
import { Textarea } from "@/components/ui/textarea";
import BacklogAuthPanel from "@/components/backlog/BacklogAuthPanel.vue";
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
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
const isConfigCollapsed = ref(true);
const configSectionRef = ref<HTMLElement | null>(null);
const mainScrollRef = ref<HTMLElement | null>(null);

const canBuild = computed(() => {
  return !runner.running && runner.projectRoot && runner.startupProject;
});

const canTest = computed(() => {
  return runner.running || (runner.projectRoot && runner.startupProject && runner.batFilePath);
});

const canRun = computed(() => {
  return !runner.running && runner.projectRoot && runner.startupProject && runner.aliasExeName && runner.batFilePath;
});


function toggleConfig() {
  isConfigCollapsed.value = !isConfigCollapsed.value;
  if (!isConfigCollapsed.value) {
    // Wait for the transition to provide accurate height/layout
    setTimeout(() => {
      if (configSectionRef.value && mainScrollRef.value) {
        const top = configSectionRef.value.offsetTop;
        mainScrollRef.value.scrollTo({
          top: top - 16, // px offset for better visual alignment
          behavior: 'smooth'
        });
      }
    }, 100);
  }
}
type ProjectProfile = {
  id: string;
  name: string;
  owner: string;
  workspaceRoot?: string;
  projectRoot: string;
  startupProject: string;
  buildConfig: string;
  urls: string;
  aliasExeName: string;
  batFilePath: string;
  runArgs?: string;
  sqlSetupPath: string;
  sqlServer?: string;
  sqlDatabase?: string;
  sqlUser?: string;
  sqlPassword?: string;
  useWindowsAuth?: boolean;
  configTemplate: string;
  sync?: any;
  backlogProjectKey?: string;
  backlogIssueTypeId?: number;
  backlogIssueKey?: string;
  backlogIssueSummary?: string;
  shortcut?: string;
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
const profileScope = ref<"personal" | "shared" | "team">("personal");



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

const isNotificationEnabled = ref(true); // Default to true, will be loaded from store

const syncStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const CLOUDFLARE_WORKER_URL = "https://bsn-isync-sync-worker.ngtuonghy.workers.dev"; // Changed to a real-ish placeholder

const { setItem, getItem } = useStore();
const isShareDialogOpen = ref(false);
const shareTargetUserId = ref('');
const shareRole = ref<'editor' | 'viewer'>('editor');

async function handleShare() {
  if (!selectedSetupId.value || !shareTargetUserId.value || !syncService.value) return;
  try {
    const res = await syncService.value.shareProfile(selectedSetupId.value, shareTargetUserId.value, shareRole.value);
    if (res.success) {
      toast.success("Profile shared successfully");
      isShareDialogOpen.value = false;
      shareTargetUserId.value = '';
    } else {
      toast.error("Sharing failed", { description: res.error });
    }
  } catch (e) {
    toast.error("Sharing failed", { description: String(e) });
  }
}

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
    const state = {
      activeTab: activeTab.value,
      dark: dark.value,
      selectedSetupId: selectedSetupId.value,
      selectedOwner: selectedOwner.value,
      profileScope: profileScope.value,
      workspaceRoot: runner.workspaceRoot,
      isNotificationEnabled: isNotificationEnabled.value,
      backlog: {
        host: backlog.host,
        token: backlog.token,
        profile: backlog.profile,
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

  const ok = await ensureValidBacklogToken();
  if (!ok) return;

  const res = await fetchBacklogIssueTypes({
    host: backlog.host,
    accessToken: backlog.token.access_token,
    projectIdOrKey: projectKey,
  });
  if (res.status === "success") {
    backlog.issueTypes = res.issueTypes;
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

function selectBacklogIssue(issue: BacklogIssue) {
  runner.backlogIssueKey = issue.issueKey;
  runner.backlogIssueSummary = issue.summary;
  
  // Example: tính năng 1 - BSN_IMPRROT
  // When selecting an issue, we update the custom part to either be the summary (if default) 
  // or keep current custom part.
  let currentName = editableProfileName.value.trim();
  // Strip existing key if any from the display name to get clean custom part
  currentName = currentName.replace(/\s*-\s*[A-Z0-9_]+-[0-9]+$/i, "");

  if (currentName.startsWith("Setup ") || !currentName) {
    editableProfileName.value = issue.summary;
  } else {
    editableProfileName.value = currentName;
  }
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
// selectedProject removed
// selectedProjectLabel removed
const profileNameInput = ref<HTMLInputElement | null>(null);
const isEditingProfileName = ref(false);
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
  sqlSetupPath: "",
  sqlServer: "",
  sqlDatabase: "Arkbell_01",
  sqlUser: "",
  sqlPassword: "",
  useWindowsAuth: true,
  buildStatus: null as string | null,
  configTemplate: `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <configSections>
    <section name="entityFramework" type="System.Data.Entity.Internal.ConfigFile.EntityFrameworkSection, EntityFramework, Version=6.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089" requirePermission="false" />
  </configSections>
  <startup>
    <supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.7.1" />
  </startup>
  <appSettings>
    <add key="Job.MsmqName" value="JE5912" />
    <add key="Job.BatFilePath" value=".\" />
    <add key="Job.SyncMode" value="sync" />
    <add key="Execute.EnvId" value="Arkbell_Dev" />
    <add key="ClientSettingsProvider.ServiceUri" value="" />
  </appSettings>
  <connectionStrings>
    <add name="EntityFramework" connectionString="" providerName="System.Data.SqlClient" />
  </connectionStrings>
  <entityFramework>
    <providers>
      <provider invariantName="System.Data.SqlClient" type="System.Data.Entity.SqlServer.SqlProviderServices, EntityFramework.SqlServer" />
    </providers>
  </entityFramework>
</configuration>`,
  running: false,
  loadingTarget: null as "exe" | "build" | "restore" | "rebuild" | "bat" | null,
  logs: [] as string[],
  childPid: 0 as number | 0,
  backlogProjectKey: "",
  backlogIssueTypeId: undefined as number | undefined,
  backlogIssueKey: "",
  backlogIssueSummary: "",
  shortcut: "Alt+Shift+M",
});

// RunArgs are now per-profile, no global sync needed

// Sync shortcut globally as it's independent of profiles
watch(() => runner.shortcut, (val) => {
  window.localStorage.setItem("bsn_isync:global:shortcut", val);
});

// --- Autosave logic ---
watch(() => {
  const { running, loadingTarget, logs, childPid, buildStatus, ...rest } = runner;
  return rest;
}, (newVal, oldVal) => {
  // Only autosave if essential fields changed (exclude running state)
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    if (selectedSetupId.value && canEditSelected.value) {
      saveCurrentToSelectedSetupProfile();
    }
  }
}, { deep: true });

watch(() => runner.backlogProjectKey, (newKey) => {
  if (newKey) {
    window.localStorage.setItem("backlog_last_project", newKey);
    // When project changes in header, also fetch new issues
    void loadBacklogIssues();
  }
});


function resolveArgs(args: string) {
  if (!args) return "";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const hms = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ms = pad(Math.floor(now.getMilliseconds() / 10)); // 2 digits
  const time8 = `${hms}${ms}`;

  return args.replace(/{time}/g, time8);
}

const argsInputRef = ref<any>(null);

function insertTimePlaceholder() {
  const input = argsInputRef.value?.$el as HTMLInputElement;
  if (!input) {
    runner.runArgs += " {time}";
    return;
  }

  const start = input.selectionStart ?? runner.runArgs.length;
  const end = input.selectionEnd ?? runner.runArgs.length;
  const val = runner.runArgs;

  runner.runArgs = val.substring(0, start) + "{time}" + val.substring(end);

  nextTick(() => {
    input.focus();
    const newPos = start + "{time}".length;
    input.setSelectionRange(newPos, newPos);
  });
}

watch(() => runner.backlogProjectKey, (newKey) => {
  if (newKey) {
    loadBacklogIssueTypes(newKey);
    loadBacklogIssues();
  }
});

// Auto-sync configTemplate with UI inputs
watch(() => [runner.aliasExeName, runner.batFilePath], () => {
  const msmq = runner.aliasExeName.replace(/\.exe$/i, "");
  let tpl = runner.configTemplate;
  
  // Replace Job.MsmqName value
  tpl = tpl.replace(/(<add key="Job\.MsmqName" value=")([^"]*)(" \/>)/, `$1${msmq}$3`);
  // Replace Job.BatFilePath value
  tpl = tpl.replace(/(<add key="Job\.BatFilePath" value=")([^"]*)(" \/>)/, `$1${runner.batFilePath || '.\\' }$3`);
  
  runner.configTemplate = tpl;
});


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
  return {
    id: makeProfileId(),
    name,
    owner: currentUser.value,
    workspaceRoot: runner.workspaceRoot,
    projectRoot: runner.projectRoot,
    startupProject: runner.startupProject,
    buildConfig: runner.config === "Release" ? "Release" : "Debug",
    urls: runner.urls,
    aliasExeName: runner.aliasExeName,
    batFilePath: runner.batFilePath,
    runArgs: runner.runArgs,
    sqlSetupPath: runner.sqlSetupPath,
    sqlServer: runner.sqlServer,
    sqlDatabase: runner.sqlDatabase,
    sqlUser: runner.sqlUser,
    sqlPassword: runner.sqlPassword,
    useWindowsAuth: runner.useWindowsAuth,
    configTemplate: runner.configTemplate,
    backlogProjectKey: runner.backlogProjectKey,
    backlogIssueTypeId: runner.backlogIssueTypeId,
    backlogIssueKey: runner.backlogIssueKey,
    backlogIssueSummary: runner.backlogIssueSummary,
    // shortcut is now independent and global
    sync: (() => {
      const { logs, ...syncData } = sync;
      return JSON.parse(JSON.stringify(syncData));
    })(),
  };
}

function applySetupToRunner(setup: ProjectProfile) {
  if (setup.workspaceRoot) runner.workspaceRoot = setup.workspaceRoot;
  
  // Always update project fields even if empty
  runner.projectRoot = setup.projectRoot || "";
  selectedProjectRoot.value = setup.projectRoot || "";
  runner.startupProject = setup.startupProject || "";
  
  runner.config = setup.buildConfig;
  runner.urls = setup.urls || "";
  runner.aliasExeName = setup.aliasExeName || "";
  runner.batFilePath = setup.batFilePath || "";
  runner.runArgs = setup.runArgs || "";
  
  runner.sqlSetupPath = setup.sqlSetupPath || "";
  runner.sqlServer = setup.sqlServer || "";
  runner.sqlDatabase = setup.sqlDatabase || "";
  runner.sqlUser = setup.sqlUser || "";
  runner.sqlPassword = setup.sqlPassword || "";
  runner.useWindowsAuth = !!setup.useWindowsAuth;
  runner.configTemplate = setup.configTemplate || "";
  runner.backlogProjectKey = setup.backlogProjectKey || "";
  runner.backlogIssueTypeId = setup.backlogIssueTypeId;
  runner.backlogIssueKey = setup.backlogIssueKey || "";
  runner.backlogIssueSummary = setup.backlogIssueSummary || "";
  // runner.shortcut is independent and not updated from profiles
  
  if (setup.sync) {
    Object.assign(sync, setup.sync);
  }
  
  // Backlog linkage
  if (setup.backlogProjectKey) {
    void loadBacklogIssueTypes(setup.backlogProjectKey);
  }
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
    const normalized = raw.map((setup) => ({
      ...setup,
      owner: (setup as any).owner || currentUser.value,
    }));
    setupProfiles.value = normalized;
    ensureVisibleSelection();
    if (selectedSetupId.value) applySelectedSetupProfile();
  } catch (e) {
    console.error("Failed to load profiles", e);
  }
}

async function saveSetupsForCurrentRoot() {
  await setItem(setupStorageKey(), setupProfiles.value);
  // Trigger Cloudflare Sync
  triggerSync();
}

let syncTimer: number | undefined;
function triggerSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncStatus.value = 'saving';
  syncTimer = window.setTimeout(async () => {
    await syncProfilesWithCloudflare();
  }, 2000); // 2 second debounce for auto-save
}

/**
 * Synchronizes Project Profiles to Cloudflare D1.
 * Only the project configurations (roots, paths, runner args) are synced.
 * UI preferences and Backlog tokens are excluded from this process.
 */
async function syncProfilesWithCloudflare() {
  if (!syncService.value) {
    syncStatus.value = 'idle';
    return;
  }

  try {
    // Only sync profiles owned/edited by current user that changed
    // For simplicity in this version, we sync all setupProfiles
    for (const profile of setupProfiles.value) {
      if (profile.owner === currentUser.value) {
        await syncService.value.upsertProfile({
          id: profile.id,
          name: profile.name,
          content: profile
        });
      }
    }
    syncStatus.value = 'saved';
    setTimeout(() => { if (syncStatus.value === 'saved') syncStatus.value = 'idle'; }, 3000);
  } catch (e) {
    console.error("Sync failed", e);
    syncStatus.value = 'error';
    toast.error("Sync failed", { description: String(e) });
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

watch([activeTab, dark, selectedSetupId, selectedOwner, profileScope, () => runner.workspaceRoot, () => backlog.host, () => backlog.token, () => backlog.profile], () => {
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

watch(() => runner.backlogProjectKey, (newVal) => {
  if (newVal) {
    void loadBacklogIssueTypes(newVal);
  } else {
    backlog.issueTypes = [];
  }
});

watch(selectedSetupId, (next, prev) => {
  if (next && next !== prev) {
    isEditingProfileName.value = false;
    applySelectedSetupProfile(true);
  }
});

function applySelectedSetupProfile(silent = false) {
  const setup = setupProfiles.value.find((x) => x.id === selectedSetupId.value);
  if (!setup) {
    if (!silent) toast.error("Setup profile not selected");
    return;
  }
  applySetupToRunner(setup);
}

function saveCurrentToSelectedSetupProfile() {
  if (!canEditSelected.value) {
    return;
  }
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) return;
  
  const setup = { ...setupProfiles.value[idx] };
  setup.workspaceRoot = runner.workspaceRoot;
  setup.projectRoot = runner.projectRoot;
  setup.startupProject = runner.startupProject;
  setup.buildConfig = runner.config === "Release" ? "Release" : "Debug";
  setup.urls = runner.urls;
  setup.aliasExeName = runner.aliasExeName;
  setup.batFilePath = runner.batFilePath;
  setup.runArgs = runner.runArgs;
  setup.sqlSetupPath = runner.sqlSetupPath;
  setup.sqlServer = runner.sqlServer;
  setup.sqlDatabase = runner.sqlDatabase;
  setup.sqlUser = runner.sqlUser;
  setup.sqlPassword = runner.sqlPassword;
  setup.useWindowsAuth = runner.useWindowsAuth;
  setup.configTemplate = runner.configTemplate;
  setup.sync = (() => {
    const { logs, ...syncData } = sync;
    return JSON.parse(JSON.stringify(syncData));
  })();
  
  setup.backlogProjectKey = runner.backlogProjectKey;
  setup.backlogIssueTypeId = runner.backlogIssueTypeId;
  setup.backlogIssueKey = runner.backlogIssueKey;
  setup.backlogIssueSummary = runner.backlogIssueSummary;
  
  setupProfiles.value[idx] = setup;
  saveSetupsForCurrentRoot();
}

function startEditingProfileName() {
  if (!selectedProfile.value || !canEditSelected.value) return;
  // Extract custom part from full name (strip " - KEY")
  let name = selectedProfile.value.name;
  if (selectedProfile.value.backlogIssueKey) {
    const keyMatch = new RegExp(`\\s*-\\s*${selectedProfile.value.backlogIssueKey}$`, "i");
    name = name.replace(keyMatch, "");
  }
  editableProfileName.value = name;
  isEditingProfileName.value = true;
  nextTick(() => profileNameInput.value?.focus());
}


function cancelEditingProfileName() {
  isEditingProfileName.value = false;
  editableProfileName.value = "";
}

function commitProfileName() {
  if (!isEditingProfileName.value) return;
  if (!canEditSelected.value) {
    cancelEditingProfileName();
    return;
  }
  const namePart = editableProfileName.value.trim();
  if (!namePart) {
    cancelEditingProfileName();
    return;
  }
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) {
    cancelEditingProfileName();
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
  cancelEditingProfileName();
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
  selectedProjectRoot.value = "";
  
  const baseName = `Setup ${setupProfiles.value.length + 1}`;
  const setup = buildSetupFromRunner(baseName);
  setupProfiles.value.push(setup);
  selectedSetupId.value = setup.id;
  saveSetupsForCurrentRoot();
  startEditingProfileName();
}

async function deleteSelectedSetupProfile() {
  if (runner.running) {
    return;
  }
  if (!canEditSelected.value) {
    toast.error("Only the creator can delete this profile");
    return;
  }
  if (setupProfiles.value.length <= 1) {
    toast.error("Must keep at least 1 setup");
    return;
  }
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) return;
  
  const profileToDelete = setupProfiles.value[idx];
  setupProfiles.value.splice(idx, 1);
  selectedSetupId.value = setupProfiles.value[0]?.id ?? "";
  applySelectedSetupProfile();
  await saveSetupsForCurrentRoot();
  
  // Also delete from Cloudflare if synced
  if (syncService.value && profileToDelete.owner === currentUser.value) {
    try {
      await syncService.value.deleteProfile(profileToDelete.id);
    } catch (e) {
      console.error("Failed to delete profile from server", e);
    }
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
  runner.projectRoot = selected.root;
  if (selected.startupProject) {
    runner.startupProject = selected.startupProject;
  }
  // Sync PTY terminal location
  invoke("pty_write", { id: "main", data: `cd '${selected.root}'\r` }).catch(() => {});
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
    // If target is 'bat', ensure we are in the 'main' (Shell) terminal
    if (target === 'bat') {
      termState.active = 'main';
      nextTick(() => termState.main.fit?.fit());
    }
    
    try {
      // Only Flip to Run terminal if target is 'exe'
      if (target === 'exe') {
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
        target: target,
        configTemplate: runner.configTemplate,
        sqlSetupPath: runner.sqlSetupPath || null,
        sqlServer: runner.sqlServer || null,
        sqlDatabase: runner.sqlDatabase || null,
        sqlUser: runner.sqlUser || null,
        sqlPassword: runner.sqlPassword || null,
        sqlUseWindowsAuth: runner.useWindowsAuth,
        runArgs: resolveArgs(runner.runArgs),
      },
    });
    
    // Only set runner.running for 'exe' to trigger the Stop toggle and Output session
    if (target === 'exe') {
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
      description: "Please enter .sql file path or SQL code directly in the box below."
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

    // Use chcp 65001 to ensure terminal handles UTF-8 correctly
    let cmd_str = `chcp 65001 > $null; sqlcmd -f 65001 -S "${runner.sqlServer}" -d "${runner.sqlDatabase}" -E`;
    cmd_str += ` -i "${sqlPath}"${deleteCmd}\r\n`;

    // Write to main terminal so user can see output
    termState.active = 'main';
    await invoke("pty_write", { id: "main", data: cmd_str });
  } catch (e: any) {
    toast.error(String(e));
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

const isRecordingShortcut = ref(false);
const shortcutContainerRef = ref<HTMLElement | null>(null);

onClickOutside(shortcutContainerRef, () => {
  if (isRecordingShortcut.value) {
    stopRecordingShortcut();
  }
});

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

async function startRecordingShortcut() {
  if (isRecordingShortcut.value) return;
  isRecordingShortcut.value = true;
  window.addEventListener("keydown", handleShortcutKeydown, true);
  toast.info("Recording shortcut... Press keys to record.", { duration: 3000 });
}

function stopRecordingShortcut() {
  isRecordingShortcut.value = false;
  window.removeEventListener("keydown", handleShortcutKeydown, true);
}

async function handleShortcutKeydown(e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();

  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

  const shortcut = formatTauriShortcut(e);
  if (shortcut) {
    const oldShortcut = runner.shortcut;
    runner.shortcut = shortcut;
    stopRecordingShortcut();
    
    await updateGlobalShortcut(shortcut, oldShortcut);
    toast.success(`Shortcut set to: ${shortcut}`);
  }
}

async function updateGlobalShortcut(newShortcut: string, oldShortcut?: string) {
  try {
    if (oldShortcut && await isRegistered(oldShortcut)) {
      await unregisterShortcut(oldShortcut);
    }
    if (newShortcut) {
      await registerShortcut(newShortcut, (event: any) => {
        if (event.state === 'Pressed') {
          console.log(`Shortcut ${newShortcut} triggered`);
          notify('BSN iSync', `Test started via shortcut (${newShortcut})`);
          dotnet('run', 'bat');
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

function clearShortcut() {
  const old = runner.shortcut;
  runner.shortcut = "";
  if (old) {
    unregisterShortcut(old).catch(() => {});
  }
  toast.success("Shortcut cleared");
}

function resetShortcutToDefault() {
  const defaultShortcut = "Alt+Shift+M";
  if (runner.shortcut === defaultShortcut) return;
  const old = runner.shortcut;
  runner.shortcut = defaultShortcut;
  void updateGlobalShortcut(defaultShortcut, old);
  toast.success(`Shortcut reset to: ${defaultShortcut}`);
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

  // 2. Load UI state and Backlog login status from store
  await loadUIState();

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

  backlogRefreshInterval = window.setInterval(() => {
    if (backlog.token) {
      ensureValidBacklogToken();
    }
  }, 2 * 60 * 1000); // Check every 2 minutes
});

onUnmounted(() => {
  if (backlogRefreshInterval) window.clearInterval(backlogRefreshInterval);
  if (unlistenRunnerLog) unlistenRunnerLog();
  if (unlistenBuildStatus) unlistenBuildStatus();
  if (runnerPollTimer) window.clearInterval(runnerPollTimer);
});
</script>

<template>
  <div class="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/5 via-background to-background text-foreground overflow-x-hidden selection:bg-primary/20">
    <header class="border-b border-black/5 dark:border-white/5 bg-card/60 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
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

          <div class="h-4 w-px bg-border mx-1"></div>
        </div>
      </div>
    </header>

    <main class="h-[calc(100vh-61px)] flex flex-col px-0 pb-4 pt-2">
      <Tabs v-model="activeTab" class="flex-1 flex flex-col min-h-0">
        <div class="mx-6 mb-2 flex items-center justify-start gap-4 bg-card/40 p-2.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/5 backdrop-blur-xl">
          
          <div class="flex items-center gap-2 w-full max-w-xl bg-muted/30 rounded-xl p-1.5 transition-all focus-within:bg-muted/50 ring-1 ring-transparent focus-within:ring-primary/20">
            <div class="flex items-center gap-2 flex-1 min-w-0 px-2">
              <FolderOpen class="size-3.5 text-muted-foreground shrink-0" />
              <input v-model="runner.workspaceRoot" 
                     class="bg-transparent border-0 h-6 text-xs flex-1 min-w-0 focus:outline-none placeholder:text-muted-foreground/50" 
                     placeholder="Workspace Path (D:\workspace...)" />
            </div>
            <div class="flex items-center gap-1 border-l pl-1 ml-auto">
              <Button variant="ghost" class="h-7 text-[11px] px-2.5 hover:bg-accent transition-all" @click="pickProjectFolder">Browse</Button>
              <Button variant="secondary" class="h-7 text-[11px] px-3 font-semibold shadow-sm" @click="discoverProjects">
                <ScanSearch class="size-3.5 mr-1" />
                Scan
              </Button>
            </div>
          </div>

            <!-- Enhanced Premium Global Shortcut UI -->
            <div ref="shortcutContainerRef" class="flex items-center gap-3 bg-white dark:bg-zinc-900/80 rounded-2xl p-1.5 border border-zinc-200 dark:border-white/10 shadow-lg dark:shadow-2xl backdrop-blur-md group/shortcut-container ml-2 ring-1 ring-black/5 dark:ring-white/5">
              <div class="flex items-center gap-1.5 px-2.5 py-1 bg-primary text-primary-foreground rounded-lg shadow-sm shrink-0 shadow-primary/20">
                  <Beaker class="size-3" :class="isRecordingShortcut ? 'animate-pulse' : ''" />
                  <span class="text-[9px] font-black uppercase tracking-widest">{{ isRecordingShortcut ? 'Recording' : 'Hotkey' }}</span>
              </div>

              <div class="flex items-center gap-1 min-w-[140px] justify-center">
                <template v-if="runner.shortcut && !isRecordingShortcut">
                   <div v-for="(part, i) in runner.shortcut.split('+')" :key="i" class="flex items-center gap-0.5">
                      <span v-if="i > 0" class="text-[8px] font-black text-muted-foreground/30 px-0.5">+</span>
                      <kbd class="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-white/10 text-[10px] font-mono font-black text-zinc-800 dark:text-zinc-200 shadow-[0_2px_0_var(--color-zinc-300)] dark:shadow-[0_2px_0_var(--color-zinc-950)] leading-none uppercase select-none transition-transform group-hover/hotkey:-translate-y-0.5">{{ part }}</kbd>
                   </div>
                </template>
                <span v-else-if="isRecordingShortcut" class="text-[10px] font-black text-primary animate-pulse tracking-widest">PRESS KEYS...</span>
                <span v-else class="text-[10px] font-bold text-muted-foreground/40 italic">None Set</span>
              </div>

              <div class="flex items-center gap-0.5 border-l border-white/10 pl-1">
                <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all scale-90 hover:scale-100" title="Record New Shortcut" @click="startRecordingShortcut" :disabled="backlog.status !== 'success'">
                  <Pencil class="size-3" />
                </Button>
                <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-all scale-90 hover:scale-100" title="Reset to Default (Alt+Shift+T)" @click="resetShortcutToDefault" :disabled="backlog.status !== 'success'">
                  <RotateCcw class="size-3" />
                </Button>
                <Button v-if="runner.shortcut" variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all scale-90 hover:scale-100" title="Clear Shortcut" @click="clearShortcut" :disabled="backlog.status !== 'success'">
                  <Trash2 class="size-3" />
                </Button>
              </div>
            </div>
          </div>

        <TabsContent value="runner" class="flex-1 min-h-0 m-0 border-0 p-0 outline-none">
          <section class="flex h-full gap-4 items-stretch overflow-hidden">
            <div ref="mainScrollRef" class="w-[55%] min-h-0 flex flex-col gap-6 pt-2 pl-6 pr-4 pb-0 overflow-hidden">
              <section class="rounded-3xl bg-card/25 flex-1 flex flex-col min-h-0 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden backdrop-blur-2xl">
                <div class="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="text-[13px] font-bold tracking-tight">Project Profile</div>
                    <div v-if="selectedProfile && selectedProfile.owner" class="text-[9px] px-2 py-0.5 rounded-full bg-muted font-medium uppercase tracking-tighter">{{ selectedProfile.owner }}</div>
                    
                    <!-- Professional Profile Sync Status -->
                    <div v-if="selectedProfile && selectedProfile.owner === currentUser" 
                         class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter transition-all"
                         :class="syncStatus === 'saving' ? 'bg-amber-500/10 text-amber-500' : syncStatus === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'">
                      <RefreshCw v-if="syncStatus === 'saving'" class="size-2.5 animate-spin" />
                      <Cloud v-else class="size-2.5" />
                      <span>{{ syncStatus === 'saving' ? 'Cloud Syncing...' : syncStatus === 'error' ? 'Sync Error' : 'Cloud Protected' }}</span>
                    </div>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    class="h-8 px-3 font-bold relative group/create shrink-0" 
                    :disabled="runner.running" 
                    @click="createNewSetupProfile"
                  >
                    <Plus class="size-3.5 mr-1" /> Create
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
                              <div class="text-[13px] font-bold leading-tight text-foreground/90 group-hover/item:text-primary transition-colors break-words">{{ setup.name }}</div>
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
                                {{ discoveredProjects.find(p => p.root === setup.projectRoot)?.name || setup.projectRoot?.split('\\').pop() || "No project selected" }}
                              </div>
                            </div>
                        </button>
                      </div>
                    </div>

                    <!-- Right Column: Detail Form -->
                    <div class="flex flex-col gap-4 border-l border-white/5 pl-4 overflow-y-auto custom-scrollbar">
                      <div class="flex items-center justify-between pb-2 border-b border-white/5">
                        <div class="min-w-0 flex-1 relative">
                          <template v-if="isEditingProfileName">
                            <div class="relative group/identity flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div class="flex items-center gap-2">
                                <div class="relative flex-1 flex items-center bg-card border border-primary/20 rounded-2xl px-1.5 focus-within:ring-2 focus-within:ring-primary/20 shadow-sm transition-all group-focus-within/identity:border-primary/40">
                                  <Input 
                                    ref="profileNameInput" 
                                    v-model="editableProfileName" 
                                    class="font-black h-10 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px] px-2.5 flex-1 min-w-0" 
                                    placeholder="Profile name or search issue..."
                                    @focus="showIssueSearch = true"
                                    @keydown.enter="commitProfileName" 
                                  />
                                  <div v-if="runner.backlogIssueKey" class="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-primary text-primary-foreground text-[9px] font-black shrink-0 mr-1 shadow-sm group/badge">
                                    {{ runner.backlogIssueKey }}
                                    <button @click.stop="unlinkBacklogIssue" class="hover:bg-white/20 rounded-full p-0.5 transition-colors opacity-60 group-hover/badge:opacity-100" title="Unlink issue">
                                      <X class="size-2.5" />
                                    </button>
                                  </div>
                                  <div class="flex items-center gap-1 shrink-0 p-1">
                                    <a v-if="backlogIssueUrl" 
                                       :href="backlogIssueUrl" 
                                       target="_blank" 
                                       class="p-1.5 rounded-lg hover:bg-primary/10 text-primary opacity-40 hover:opacity-100 transition-all"
                                       title="Xem trên Backlog"
                                       @click.stop>
                                      <ExternalLink class="size-3.5" />
                                    </a>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" class="h-10 w-10 rounded-2xl hover:bg-primary/5 border border-transparent hover:border-primary/10" @click="commitProfileName">
                                  <Save class="size-5 text-primary opacity-60" />
                                </Button>
                              </div>

                              <!-- Unified Search Dropdown -->
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
                                    <div class="flex items-center gap-2 mb-0.5">
                                      <div class="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[8px] font-black shrink-0 shadow-sm">{{ issue.issueKey }}</div>
                                      <span class="text-[11px] font-bold text-foreground group-hover/item:text-primary truncate">{{ issue.summary }}</span>
                                    </div>
                                    <span class="text-[9px] text-muted-foreground opacity-60 pl-0.5">{{ issue.summary }}</span>
                                  </button>
                                </div>
                                <div class="p-2 bg-muted/30 border-t border-white/5 flex items-center justify-center">
                                  <span class="text-[8px] text-muted-foreground opacity-40 italic">Results from project: {{ runner.backlogProjectKey }}</span>
                                </div>
                              </div>
                            </div>
                          </template>
                          <div v-else class="flex-1 flex flex-col gap-1 min-w-0">
                            <button class="w-full text-left group/header flex flex-col gap-0.5" @click="startEditingProfileName">
                              <div class="flex items-center gap-2">
                                <span class="text-[16px] font-black tracking-tight leading-tight group-hover/header:text-primary transition-colors break-words">{{ selectedProfile?.name || 'No Profile Selected' }}</span>
                                <Pencil v-if="canEditSelected" class="size-3.5 opacity-0 group-hover/header:opacity-40 transition-opacity shrink-0 translate-y-0.5" />
                                <RefreshCw v-if="syncStatus === 'saving'" class="size-3.5 text-primary animate-spin ml-2" />
                              </div>
                              <div v-if="runner.backlogIssueKey" class="flex items-center gap-2 pl-4.5 mt-0.5">
                                <div class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground/80 tracking-tighter">{{ runner.backlogIssueKey }}</div>
                                <span class="text-[10px] text-muted-foreground font-medium opacity-60 break-words leading-tight">{{ runner.backlogIssueSummary }}</span>
                                <a :href="backlogIssueUrl" target="_blank" @click.stop class="ml-auto p-1 rounded-md hover:bg-primary/5 text-primary opacity-0 group-hover/header:opacity-40 hover:opacity-100 transition-all">
                                  <ExternalLink class="size-3" />
                                </a>
                              </div>
                            </button>
                          </div>
                        </div>
                        <div class="flex items-center gap-1 ml-auto">
                          <Dialog v-model:open="isShareDialogOpen">
                            <DialogTrigger as-child>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                class="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                title="Share Profile"
                                :disabled="runner.running || !canEditSelected || !syncService"
                                @click="isShareDialogOpen = true"
                              >
                                <Share2 class="size-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent class="sm:max-w-[425px] bg-background/95 backdrop-blur-2xl border-primary/10 rounded-3xl shadow-2xl">
                              <DialogHeader>
                                <DialogTitle class="text-[17px] font-black tracking-tight">Chia sẻ Profile</DialogTitle>
                                <DialogDescription class="text-[12px] opacity-60">
                                  Cấp quyền cho người dùng khác truy cập hoặc chỉnh sửa cấu hình này.
                                </DialogDescription>
                              </DialogHeader>
                              <div class="grid gap-6 py-4">
                                <div class="space-y-2">
                                  <Label class="text-[10px] font-black uppercase tracking-widest opacity-60">ID Người dùng (Backlog ID)</Label>
                                  <Input v-model="shareTargetUserId" placeholder="Nhập User ID người nhận..." class="h-10 rounded-xl bg-muted/20 border-primary/10 focus:ring-primary/20" />
                                </div>
                                <div class="space-y-2">
                                  <Label class="text-[10px] font-black uppercase tracking-widest opacity-60">Quyền truy cập</Label>
                                  <Select v-model="shareRole">
                                    <SelectTrigger class="h-10 rounded-xl bg-muted/20 border-primary/10">
                                      <SelectValue placeholder="Chọn quyền" />
                                    </SelectTrigger>
                                    <SelectContent class="rounded-xl border-primary/10">
                                      <SelectItem value="editor" class="text-xs font-bold py-2.5">Chỉnh sửa (Editor)</SelectItem>
                                      <SelectItem value="viewer" class="text-xs font-bold py-2.5">Chỉ xem (Viewer)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <DialogFooter class="sm:justify-end gap-2">
                                <Button variant="ghost" class="h-10 rounded-xl px-6 font-bold uppercase tracking-widest text-[10px]" @click="isShareDialogOpen = false">Hủy</Button>
                                <Button class="h-10 rounded-xl px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20" :disabled="!shareTargetUserId" @click="handleShare">Chia sẻ ngay</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            class="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            title="Delete Profile"
                            :disabled="runner.running || !canEditSelected"
                            @click="deleteSelectedSetupProfile"
                          >
                            <Trash2 class="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div class="space-y-6">
                        <div class="space-y-1.5">
                        <Label class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Target Project</Label>
                        <Select v-model="selectedProjectRoot" @update:model-value="applySelectedProject" :disabled="!canEditSelected">
                          <SelectTrigger class="w-full h-9 bg-muted/20 border-input" :disabled="!canEditSelected">
                            <div class="truncate max-w-full font-medium">
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


                        <div class="space-y-1.5">
                          <Label class="text-[9px] text-muted-foreground uppercase font-bold pl-0.5">EXE Name</Label>
                          <Input v-model="runner.aliasExeName" placeholder="App.exe" @blur="() => { if (runner.aliasExeName && !runner.aliasExeName.toLowerCase().endsWith('.exe')) { runner.aliasExeName += '.exe' } }" :disabled="!canEditSelected" />
                        </div>

                        <div class="space-y-3">
                          <div class="space-y-1.5">
                            <Label class="text-[9px] text-muted-foreground uppercase font-bold pl-0.5">Test (BAT) File</Label>
                            <div class="flex gap-1.5 h-9">
                              <div class="flex-1 relative flex items-center">
                                <Input v-model="runner.batFilePath" class="font-mono pr-8 h-full" :disabled="!canEditSelected" />
                                <Beaker class="absolute right-2.5 size-3 opacity-30" />
                              </div>
                              <Button variant="outline" size="icon" class="h-full w-9 border-input shrink-0" @click="browseBatFile" :disabled="!canEditSelected"><FolderOpen class="size-4" /></Button>
                            </div>
                          </div>
                          <div class="space-y-1.5">
                            <Label class="text-[9px] text-muted-foreground uppercase font-bold pl-0.5">Arguments</Label>
                            <div class="relative flex items-center group/args">
                              <Input ref="argsInputRef" v-model="runner.runArgs" placeholder="-debug ..." class="pr-14 selection:bg-primary/30 selection:text-primary" :disabled="backlog.status !== 'success'" />
                              <div class="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover/args:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {time}" @click="insertTimePlaceholder" :disabled="backlog.status !== 'success'">
                                  <Clock class="size-3" />
                                </Button>
                              </div>
                            </div>
                
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section ref="configSectionRef" class="rounded-3xl bg-card/25 shadow-[0_15px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.25)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden transition-all duration-500 backdrop-blur-2xl shrink-0">
                <button type="button" 
                        @click="toggleConfig"
                        class="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group/collapsible text-left">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold">Configuration & Database</span>
                    <span v-if="isConfigCollapsed" class="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded opacity-60">Alias EXE + SQL Setup</span>
                  </div>
                  <component :is="isConfigCollapsed ? ChevronRight : ChevronDown" class="size-4 text-muted-foreground group-hover/collapsible:text-primary transition-colors" />
                </button>
                
                <div v-show="!isConfigCollapsed" class="px-4 pb-4 border-t border-white/5 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Tabs defaultValue="sql" class="w-full">
                    <TabsList class="grid w-full grid-cols-2 h-8 p-1 bg-muted/50 font-bold uppercase tracking-wider">
                      <TabsTrigger value="sql" class="text-[10px] px-3">SQL Setup</TabsTrigger>
                      <TabsTrigger value="config" class="text-[10px] px-3">Config Template</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sql" class="mt-0 space-y-3">
                      <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                           <Label class="text-[10px] uppercase font-bold text-muted-foreground">Server</Label>
                          <Input v-model="runner.sqlServer" placeholder="localhost\SQLEXPRESS" class="h-8 text-xs" :disabled="!canEditSelected" />
                        </div>
                        <div class="space-y-1">
                          <Label class="text-[10px] uppercase font-bold text-muted-foreground">Database</Label>
                          <Input v-model="runner.sqlDatabase" placeholder="MyDatabase" class="h-8 text-xs" :disabled="!canEditSelected" />
                        </div>
                      </div>

                      <div class="flex items-center justify-end py-1">
                        <Button variant="secondary" size="sm" class="h-8 text-[11px] font-bold px-4 transition-all hover:bg-primary hover:text-primary-foreground group" @click="runSqlOnly" :disabled="!canEditSelected">
                          <Play class="size-3.5 mr-2 group-hover:animate-pulse" />
                          Run SQL
                        </Button>
                      </div>

                      <div class="space-y-1.5 pt-1">
                        <div class="flex items-center justify-between">
                          <Label class="text-[10px] uppercase font-bold text-muted-foreground">SQL Script / Query</Label>
                        </div>
                        <Textarea v-model="runner.sqlSetupPath" class="min-h-[200px] max-h-[400px] overflow-y-auto font-mono text-[11px] p-2 leading-relaxed" placeholder="Paste SQL code here (Supports Japanese/Vietnamese)..." :disabled="!canEditSelected" />
                      </div>
                    </TabsContent>
                    <TabsContent value="config" class="mt-0 space-y-3">
                      <div class="space-y-1.5 pt-1">
                        <div class="flex items-center justify-between">
                          <Label class="text-[10px] uppercase font-bold text-muted-foreground">App.config Template</Label>
                          <span class="text-[9px] text-muted-foreground opacity-50 italic">Auto-syncs with EXE & BAT</span>
                        </div>
                        <Textarea v-model="runner.configTemplate" class="min-h-[200px] max-h-[500px] overflow-y-auto font-mono text-[11px] p-2 leading-relaxed" placeholder="XML Config Template..." :disabled="!canEditSelected" />
                      </div>
                    </TabsContent>
                  </Tabs>

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

                      <!-- Control Buttons -->
                      <Button variant="ghost" 
                              class="w-12 h-11 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90"
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
                        <!-- Spark Particle -->
                        <div v-if="runner.buildStatus" class="absolute size-4 bg-[#FAC000]/40 rounded-full animate-spark-pop blur-sm z-0"></div>
                        <span class="text-[7.5px] uppercase tracking-tighter font-bold transition-all duration-300" 
                              :class="runner.buildStatus ? 'text-[#FF7500] animate-pulse scale-110' : 'text-zinc-600'">
                          {{ runner.loadingTarget === 'build' ? '...' : (runner.buildStatus ? 'Building' : 'Build') }}
                        </span>
                      </Button>
                      
                      <Button variant="ghost" 
                              class="w-12 h-11 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90"
                              :class="(runner.loadingTarget === 'rebuild') ? 'text-zinc-200' : (!canBuild || runner.loadingTarget || runner.buildStatus) ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50'"
                              :disabled="!canBuild || !!runner.loadingTarget || !!runner.buildStatus"
                              @click="rebuild">
                        <RotateCcw :class="[
                                     'size-4 transition-transform duration-300',
                                     runner.loadingTarget === 'rebuild' ? 'animate-spin' : 'group-hover/btn:-rotate-45'
                                   ]" />
                        <span class="text-[8px] uppercase tracking-wide font-semibold">{{ runner.loadingTarget === 'rebuild' ? '...' : 'Rebuild' }}</span>
                      </Button>

                      <div class="w-8 h-px bg-white/10 opacity-50 my-1"></div>

                      <Button variant="ghost" 
                              class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95" 
                              :class="((canTest && runner.loadingTarget === 'bat') ? 'text-blue-500' : (canTest && !runner.loadingTarget && !runner.buildStatus) 
                                ? 'text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                : 'text-zinc-700 cursor-not-allowed opacity-40')"
                              :disabled="!canTest || !!runner.loadingTarget || !!runner.buildStatus"
                              @click="dotnet('run', 'bat')">
                        <component :is="runner.loadingTarget === 'bat' ? RotateCcw : Beaker"
                                   :class="[
                                     'size-5 transition-transform duration-300',
                                     runner.loadingTarget === 'bat' ? 'animate-spin' : 'group-hover/btn:-rotate-12'
                                   ]" />
                        <span class="text-[8px] uppercase tracking-wide font-bold">{{ runner.loadingTarget === 'bat' ? '...' : 'Test' }}</span>
                      </Button>

                      <Button v-if="!runner.running"
                              variant="ghost" 
                              class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-green-500" 
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

                      <Button v-else
                              variant="ghost" 
                              class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-red-500 hover:text-red-400 hover:bg-red-500/10" 
                              @click="stop">
                        <Square class="size-5 fill-current group-hover/btn:drop-shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all" />
                        <span class="text-[8px] uppercase tracking-wide font-bold">Stop</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Old Button Section Removed -->
            </div>
          </section>
        </TabsContent>


      </Tabs>
    </main>
    <Toaster richColors position="bottom-right" closeButton expand />
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
