<script setup lang="ts">
declare const __APP_VERSION__: string;
const APP_VERSION = __APP_VERSION__;

import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { FolderOpen, ScanSearch, Plus, Pencil, Save, Trash2, Hammer, Play, Square, RotateCcw, Beaker, Home, ChevronDown, ChevronRight, Sun, Moon, Search, Clock, RefreshCw, ArrowUpCircle } from "lucide-vue-next";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "vue-sonner";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
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
  buildBacklogOAuthAuthorizeUrl,
  type BacklogProfile,
} from "@/lib/backlogAuth";
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
  return !runner.running && runner.projectRoot && runner.startupProject && runner.aliasExeName;
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
  runArgs: string;
  sqlSetupPath: string;
  sqlServer?: string;
  sqlDatabase?: string;
  sqlUser?: string;
  sqlPassword?: string;
  useWindowsAuth?: boolean;
  configTemplate: string;
  sync?: any;
};

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

const currentUser = ref("ngtuonghy");
const selectedOwner = ref("ngtuonghy");
const profileSearch = ref("");
const profileScope = ref<"personal" | "shared" | "team">("personal");



const backlog = reactive({
  host: "",
  apiKey: "",
  status: "idle" as "idle" | "loading" | "success" | "error",
  error: "",
  profile: null as BacklogProfile | null,
});


const envHost = import.meta.env.VITE_BACKLOG_HOST as string | undefined;
if (envHost && !backlog.host) backlog.host = envHost;

const envApiKey = import.meta.env.VITE_BACKLOG_API_KEY as string | undefined;
if (envApiKey && !backlog.apiKey) backlog.apiKey = envApiKey;

const envClientId = import.meta.env.VITE_BACKLOG_CLIENT_ID as string | undefined;
const envRedirectUri = import.meta.env.VITE_BACKLOG_REDIRECT_URI as string | undefined;

const oauthToken = reactive({
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
});

// Update state
const updateVersion = ref<string | null>(null);
const isUpdateDownloading = ref(false);
const isUpdateReady = ref(false);

async function checkForUpdates(manual = false) {
  try {
    if (manual) {
      toast.info("Đang kiểm tra bản cập nhật...", { id: "updater-check" });
    }
    const version = await invoke("check_update") as string | null;
    if (version) {
      updateVersion.value = version;
      console.log("[updater] update available:", version);
      if (manual) {
        toast.success(`Tìm thấy bản cập nhật mới v${version}`, { id: "updater-check" });
      }
    } else {
      if (manual) {
        toast.info("Ứng dụng đã ở phiên bản mới nhất", { id: "updater-check" });
      }
    }
  } catch (e) {
    console.error("[updater] check failed:", e);
    if (manual) {
        toast.error("Lỗi khi kiểm tra cập nhật", { description: String(e), id: "updater-check" });
    }
  }
}

async function downloadUpdate() {
  if (isUpdateDownloading.value) return;
  isUpdateDownloading.value = true;
  try {
    toast.info("Đang tải bản cập nhật...", {
      description: `Bản cập nhật v${updateVersion.value} đang được tải xuống.`
    });
    await invoke("download_and_install_update");
    isUpdateReady.value = true;
    toast.success("Đã tải xong bản cập nhật", {
      description: "Vui lòng khởi động lại ứng dụng để áp dụng thay đổi."
    });
  } catch (e: any) {
    toast.error("Lỗi khi tải cập nhật", { description: String(e) });
  } finally {
    isUpdateDownloading.value = false;
  }
}

async function applyUpdate() {
  try {
    await invoke("restart_app");
  } catch (e: any) {
    toast.error("Lỗi khi khởi động lại", { description: String(e) });
  }
}

const UI_STATE_KEY = "bsn_isync:ui_state";
function saveUIState() {
  const state = {
    activeTab: activeTab.value,
    dark: dark.value,
    selectedSetupId: selectedSetupId.value,
    selectedOwner: selectedOwner.value,
    profileScope: profileScope.value,
    workspaceRoot: runner.workspaceRoot,
  };
  window.localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
}

function loadUIState() {
  const raw = window.localStorage.getItem(UI_STATE_KEY);
  if (!raw) return;
  try {
    const state = JSON.parse(raw);
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
  } catch (e) {
    console.error("Failed to load UI state", e);
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

  if (!backlog.host.trim()) {
    backlog.status = "error";
    backlog.error = "Vui lòng nhập Backlog host";
    return;
  }

  const clientId = (envClientId ?? "").trim();
  const defaultRedirectUri = "bsn-isync://oauth/callback";
  const redirectUri = (envRedirectUri ?? defaultRedirectUri).trim();

  if (!clientId) {
    backlog.status = "error";
    backlog.error = "Thiếu client_id";
    return;
  }

  if (!redirectUri) {
    backlog.status = "error";
    backlog.error = "Thiếu redirect_uri";
    return;
  }

  const state = buildOAuthState();
  saveOAuthState(state);

  const authUrl = buildBacklogOAuthAuthorizeUrl({
    host: backlog.host,
    clientId,
    redirectUri,
    state,
  });

  if (!authUrl) {
    backlog.status = "error";
    backlog.error = "Không tạo được URL OAuth2";
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
    backlog.error = `OAuth2 error: ${errorDescription || error}`;
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readOAuthState();
  console.log("[backlog-oauth] state compare:", { received: state, expected: expectedState });

  if (!code) {
    backlog.status = "error";
    backlog.error = "Thiếu authorization code";
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }

  if (!state || !expectedState || state !== expectedState) {
    backlog.status = "error";
    backlog.error = "State không hợp lệ";
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }

  clearOAuthState();
  backlog.status = "loading";

  let token: { access_token: string; token_type: string; expires_in: number; refresh_token: string };
  try {
    token = await invoke("backlog_oauth_exchange", { code });
  } catch (e: any) {
    backlog.status = "error";
    backlog.error = `Không lấy được token: ${String(e)}`;
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }
  oauthToken.accessToken = token.access_token;
  oauthToken.refreshToken = token.refresh_token;
  oauthToken.expiresAt = Date.now() + token.expires_in * 1000;

  const profileResult = await fetchBacklogProfileWithToken({
    host: backlog.host,
    accessToken: token.access_token,
  });

  if (profileResult.status === "error") {
    backlog.status = "error";
    backlog.error = profileResult.error;
    if (shouldResetHistory) window.history.replaceState({}, "", "/");
    return;
  }

  backlog.profile = profileResult.profile;
  backlog.status = "success";
  currentUser.value = profileResult.profile.name || profileResult.profile.userId || "Bạn";
  selectedOwner.value = currentUser.value;
  if (shouldResetHistory) window.history.replaceState({}, "", "/");
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

async function handleBacklogOAuthCallback() {
  await handleBacklogOAuthUrl(window.location.href);
}

// handleBacklogLogin removed (redundant)

const ownerOptions = computed(() => {
  const owners = new Set<string>([currentUser.value]);
  setupProfiles.value.forEach((p) => owners.add(p.owner));
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
const canEditSelected = computed(() => selectedProfile.value?.owner === currentUser.value);
// selectedProject removed
// selectedProjectLabel removed
const profileNameInput = ref<HTMLInputElement | null>(null);
const isEditingProfileName = ref(false);
const editableProfileName = ref("");

let unlistenRunnerLog: (() => void) | undefined;
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
    <add key="Job.BatFilePath" value="" />
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
});

// --- Autosave logic ---
watch(() => {
  const { running, loadingTarget, logs, childPid, ...rest } = runner;
  return rest;
}, (newVal, oldVal) => {
  // Only autosave if essential fields changed (exclude running state)
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    if (selectedSetupId.value && canEditSelected.value) {
      saveCurrentToSelectedSetupProfile();
    }
  }
}, { deep: true });


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

// Auto-sync configTemplate with UI inputs
watch(() => [runner.aliasExeName, runner.batFilePath], () => {
  const msmq = runner.aliasExeName.replace(/\.exe$/i, "");
  let tpl = runner.configTemplate;
  
  // Replace Job.MsmqName value
  tpl = tpl.replace(/(<add key="Job\.MsmqName" value=")([^"]*)(" \/>)/, `$1${msmq}$3`);
  // Replace Job.BatFilePath value
  tpl = tpl.replace(/(<add key="Job\.BatFilePath" value=")([^"]*)(" \/>)/, `$1${runner.batFilePath}$3`);
  
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
  if (setup.sync) {
    Object.assign(sync, setup.sync);
  }
}

function loadSetupsForCurrentRoot() {
  const raw = window.localStorage.getItem(setupStorageKey());
  if (!raw) {
    const defaultSetup = buildSetupFromRunner("Default");
    setupProfiles.value = [defaultSetup];
    selectedOwner.value = defaultSetup.owner;
    selectedSetupId.value = defaultSetup.id;
    saveSetupsForCurrentRoot();
    return;
  }
  try {
    const parsed = JSON.parse(raw) as ProjectProfile[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaultSetup = buildSetupFromRunner("Default");
      setupProfiles.value = [defaultSetup];
      selectedOwner.value = defaultSetup.owner;
      selectedSetupId.value = defaultSetup.id;
      saveSetupsForCurrentRoot();
      return;
    }
    const normalized = parsed.map((setup) => ({
      ...setup,
      owner: (setup as any).owner || currentUser.value,
    }));
    setupProfiles.value = normalized;
    ensureVisibleSelection();
    if (selectedSetupId.value) applySelectedSetupProfile();
  } catch {
    const defaultSetup = buildSetupFromRunner("Default");
    setupProfiles.value = [defaultSetup];
    selectedOwner.value = defaultSetup.owner;
    selectedSetupId.value = defaultSetup.id;
    saveSetupsForCurrentRoot();
  }
}

function saveSetupsForCurrentRoot() {
  window.localStorage.setItem(setupStorageKey(), JSON.stringify(setupProfiles.value));
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

watch([activeTab, dark, selectedSetupId, selectedOwner, profileScope, () => runner.workspaceRoot], () => {
  saveUIState();
}, { deep: true });

watch(selectedSetupId, (next, prev) => {
  if (next && next !== prev) {
    isEditingProfileName.value = false;
    applySelectedSetupProfile(true);
  }
});

function applySelectedSetupProfile(silent = false) {
  const setup = setupProfiles.value.find((x) => x.id === selectedSetupId.value);
  if (!setup) {
    if (!silent) toast.error("Setup profile chưa được chọn");
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
  
  setupProfiles.value[idx] = setup;
  saveSetupsForCurrentRoot();
}

function startEditingProfileName() {
  if (!selectedProfile.value || !canEditSelected.value) return;
  editableProfileName.value = selectedProfile.value.name;
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
  const name = editableProfileName.value.trim();
  if (!name) {
    cancelEditingProfileName();
    return;
  }
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) {
    cancelEditingProfileName();
    return;
  }
  const setup = { ...setupProfiles.value[idx] };
  setup.name = name;
  setupProfiles.value[idx] = setup;
  saveSetupsForCurrentRoot();
  cancelEditingProfileName();
}

function createNewSetupProfile() {
  if (runner.running) {
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

function deleteSelectedSetupProfile() {
  if (runner.running) {
    return;
  }
  if (!canEditSelected.value) {
    toast.error("Chỉ người tạo mới được xóa profile này");
    return;
  }
  if (setupProfiles.value.length <= 1) {
    toast.error("Cần giữ ít nhất 1 setup");
    return;
  }
  const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
  if (idx < 0) return;
  setupProfiles.value.splice(idx, 1);
  selectedSetupId.value = setupProfiles.value[0]?.id ?? "";
  applySelectedSetupProfile();
  saveSetupsForCurrentRoot();
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
  // We use pty_write for building to show progress in main terminal
  const cmd = `dotnet ${mode} "${runner.startupProject}" -c ${config}\r`;
  await invoke("pty_write", { id: "main", data: cmd });
}

async function dotnet(cmd: "restore" | "build" | "run", target: "exe" | "bat" = "exe") {
  const loadingKey = cmd === "run" ? target : cmd;
  runner.loadingTarget = loadingKey;
  
  saveCurrentToSelectedSetupProfile();
  if (!validatePaths()) {
    toast.error("Vui lòng nhập projectRoot và startupProject");
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
    toast.error("Vui lòng nhập projectRoot và startupProject");
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
    toast.error("Vui lòng nhập Server SQL");
    return;
  }
  if (!runner.sqlDatabase?.trim()) {
    toast.error("Vui lòng nhập Database name");
    return;
  }
  if (!runner.useWindowsAuth && (!runner.sqlUser?.trim() || !runner.sqlPassword?.trim())) {
    toast.error("Vui lòng nhập Username/Password cho SQL");
    return;
  }
  if (!runner.sqlSetupPath || !runner.sqlSetupPath.trim()) {
    toast.error("Thiếu nội dung SQL", {
      description: "Vui lòng nhập đường dẫn file .sql hoặc mã SQL trực tiếp vào ô bên dưới."
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
  loadUIState();
  loadSetupsForCurrentRoot();
  await handleBacklogOAuthCallback();
  void checkForUpdates();

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

  try {
    await discoverProjects(false);
  } catch (e: any) {
    // Silent error
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
});

onUnmounted(() => {
  if (unlistenRunnerLog) unlistenRunnerLog();
  if (runnerPollTimer) window.clearInterval(runnerPollTimer);
});
</script>

<template>
  <div class="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/5 via-background to-background text-foreground overflow-x-hidden selection:bg-primary/20">
    <header class="border-b border-black/5 dark:border-white/5 bg-card/60 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
      <div class="px-6 py-2.5 flex items-center justify-between">
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
            :host="backlog.host"
            :apiKey="backlog.apiKey"
            :status="backlog.status"
            :profile="backlog.profile"
            :error="backlog.error"
            @login-oauth="startBacklogOAuthLogin"
          />
          <div class="h-4 w-px bg-border mx-1"></div>
          
          <!-- Update status indicator -->
          <template v-if="updateVersion">
            <template v-if="isUpdateReady">
              <Button @click="applyUpdate" variant="default" size="sm" class="h-8 gap-1.5 px-3 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 animate-in fade-in zoom-in duration-300">
                <RefreshCw class="size-3.5 animate-spin-slow" />
                <span class="text-[11px] font-bold">Restart to Update</span>
              </Button>
            </template>
            <template v-else>
              <Button @click="downloadUpdate" :disabled="isUpdateDownloading" variant="secondary" size="sm" class="h-8 gap-1.5 px-3 transition-all">
                <ArrowUpCircle class="size-3.5" :class="isUpdateDownloading ? 'animate-bounce' : ''" />
                <span class="text-[11px] font-bold">{{ isUpdateDownloading ? 'Downloading...' : `Update v${updateVersion}` }}</span>
              </Button>
            </template>
            <div class="h-4 w-px bg-border mx-1"></div>
          </template>

          <template v-if="!updateVersion">
            <Button @click="() => checkForUpdates(true)" variant="ghost" size="icon" class="h-7 w-7 transition-all hover:bg-accent group" title="Check for updates">
              <RefreshCw class="size-3.5 group-hover:rotate-180 transition-transform duration-500" />
            </Button>
          </template>

          <Button @click="toggleTheme" variant="ghost" size="icon" class="h-7 w-7 transition-all hover:bg-accent">
            <Moon v-if="!dark" class="size-4" />
            <Sun v-else class="size-4 text-yellow-500" />
          </Button>
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
                Quét
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="runner" class="flex-1 min-h-0 m-0 border-0 p-0 outline-none">
          <section class="flex h-full gap-4 items-stretch overflow-hidden">
            <div ref="mainScrollRef" class="w-[55%] min-h-0 flex flex-col gap-6 pt-4 pl-6 pr-4 pb-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
              <section class="rounded-3xl bg-card/25 flex-1 flex flex-col min-h-0 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden backdrop-blur-2xl">
                <div class="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div class="text-[13px] font-bold tracking-tight">Project Profile</div>
                  <div class="flex items-center gap-2" v-if="selectedProfile">
                    <span class="text-[9px] px-2 py-0.5 rounded-full bg-muted font-medium uppercase tracking-tighter">{{ selectedProfile.owner }}</span>
                  </div>
                </div>
                
                <div class="p-4 flex-1 overflow-hidden">
                  <div class="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 h-full">
                    <!-- Left Column: Search & List -->
                    <div class="flex flex-col gap-3 h-full min-h-0">
                      <div class="space-y-2 pb-2 border-b border-white/5 shrink-0">
                        <div class="flex items-center justify-between gap-2">
                          <Select v-model="selectedOwner" :disabled="runner.running">
                            <SelectTrigger class="h-10 text-[10.5px] bg-muted/20 border-input pl-1.5">
                              <div class="flex items-center gap-2 overflow-hidden">
                                <Avatar size="sm" shape="square" class="rounded-md">
                                  <AvatarFallback>{{ initials(selectedOwner || "") }}</AvatarFallback>
                                </Avatar>
                                <div class="truncate">
                                  <SelectValue placeholder="Owner" />
                                </div>
                              </div>
                            </SelectTrigger>
                            <SelectContent class="p-1">
                              <div class="py-2">
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
                                    <Avatar size="sm" shape="square" class="rounded-sm h-5 w-5" aria-hidden="true">
                                      <AvatarFallback class="text-[8px]">{{ initials(owner) }}</AvatarFallback>
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
                          <Button variant="secondary" size="sm" class="font-bold" :disabled="runner.running" @click="createNewSetupProfile">
                            <Plus class="size-3 mr-1" /> Create
                          </Button>
                        </div>
                        <div class="relative">
                          <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground opacity-50" />
                          <Input v-model="profileSearch" placeholder="Search profiles..." :disabled="runner.running" class="pl-9 h-9" />
                        </div>
                      </div>

                      <div class="flex-1 overflow-y-auto px-1 pb-2 space-y-1 custom-scrollbar">
                        <button v-for="setup in scopedProfiles" :key="setup.id"
                                :disabled="runner.running"
                                class="w-full flex text-left rounded-lg p-2.5 transition-all group/item relative border"
                                :class="[
                                  setup.id === selectedSetupId ? 'bg-primary/10 border-primary/20 shadow-sm' : 'border-transparent hover:bg-muted/20',
                                  runner.running ? 'opacity-50 cursor-not-allowed' : ''
                                ]"
                                @click="selectedSetupId = setup.id">
                            <div class="min-w-0 flex-1">
                              <div class="text-sm font-bold truncate leading-none mb-1.5">{{ setup.name }}</div>
                               <div class="text-xs text-muted-foreground truncate opacity-70">{{ discoveredProjects.find(p => p.root === setup.projectRoot)?.name || setup.projectRoot?.split('\\').pop() || "Chưa chọn dự án" }}</div>
                            </div>
                            <component :is="setup.owner === currentUser ? Pencil : Save" class="size-3 opacity-0 group-hover/item:opacity-40 transition-opacity" />
                        </button>
                      </div>
                    </div>

                    <!-- Right Column: Detail Form -->
                    <div class="flex flex-col gap-4 border-l border-white/5 pl-4 overflow-y-auto custom-scrollbar">
                      <div class="flex items-center justify-between pb-2 border-b border-white/5">
                        <div class="min-w-0 flex-1">
                          <Input v-if="isEditingProfileName" v-model="editableProfileName" class="font-bold" @keydown.enter="commitProfileName" @blur="commitProfileName" />
                          <button v-else class="w-full text-left text-[13px] font-bold hover:text-primary transition-colors flex items-center gap-1.5 min-w-0" @click="startEditingProfileName">
                            <span class="truncate">{{ selectedProfile?.name || "No Profile Selected" }}</span>
                            <Pencil v-if="canEditSelected" class="size-3 opacity-30 shrink-0" />
                          </button>
                        </div>
                        <div class="flex items-center gap-1 ml-2">
                          <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="!canEditSelected" @click="saveCurrentToSelectedSetupProfile"><Save class="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" class="h-7 w-7 text-red-500/60 hover:text-red-500 hover:bg-red-500/10" :disabled="!canEditSelected" @click="deleteSelectedSetupProfile"><Trash2 class="size-3.5" /></Button>
                        </div>
                      </div>

                      <div class="space-y-4">
                        <div class="space-y-1.5">
                          <Label class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Target Project</Label>
                          <Select v-model="selectedProjectRoot" @update:model-value="applySelectedProject">
                            <SelectTrigger class="w-full h-9 bg-muted/20 border-input">
                              <div class="truncate max-w-full">
                                <SelectValue placeholder="Quét dự án để chọn...">
                                  {{ discoveredProjects.find(p => p.root === selectedProjectRoot)?.name }}
                                </SelectValue>
                              </div>
                            </SelectTrigger>
                            <SelectContent class="p-1">
                              <div class="py-2">
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
                                <div v-if="filteredDiscoveredProjects.length === 0" class="px-2 py-4 text-center text-[10px] text-muted-foreground italic opacity-50">
                                  No projects match search
                                </div>
                              </div>
                            </SelectContent>
                          </Select>
                        </div>

                        <div class="space-y-1.5">
                          <Label class="text-[9px] text-muted-foreground uppercase font-bold pl-0.5">EXE Name</Label>
                          <Input v-model="runner.aliasExeName" placeholder="App.exe" @blur="() => { if (runner.aliasExeName && !runner.aliasExeName.toLowerCase().endsWith('.exe')) { runner.aliasExeName += '.exe' } }" />
                        </div>

                        <div class="space-y-3">
                          <div class="space-y-1.5">
                            <Label class="text-[9px] text-muted-foreground uppercase font-bold pl-0.5">Test (BAT) File</Label>
                            <div class="flex gap-1.5 h-9">
                              <div class="flex-1 relative flex items-center">
                                <Input v-model="runner.batFilePath" class="font-mono pr-8 h-full" />
                                <Beaker class="absolute right-2.5 size-3 opacity-30" />
                              </div>
                              <Button variant="outline" size="icon" class="h-full w-9 border-input shrink-0" @click="browseBatFile"><FolderOpen class="size-4" /></Button>
                            </div>
                          </div>
                          <div class="space-y-1.5">
                            <Label class="text-[9px] text-muted-foreground uppercase font-bold pl-0.5">Arguments</Label>
                            <div class="relative flex items-center group/args">
                              <Input ref="argsInputRef" v-model="runner.runArgs" placeholder="-debug ..." class="pr-14" />
                              <div class="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover/args:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {time}" @click="insertTimePlaceholder">
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
                          <Input v-model="runner.sqlServer" placeholder="localhost\SQLEXPRESS" class="h-8 text-xs" />
                        </div>
                        <div class="space-y-1">
                          <Label class="text-[10px] uppercase font-bold text-muted-foreground">Database</Label>
                          <Input v-model="runner.sqlDatabase" placeholder="MyDatabase" class="h-8 text-xs" />
                        </div>
                      </div>

                      <div class="flex items-center justify-end py-1">
                        <Button variant="secondary" size="sm" class="h-8 text-[11px] font-bold px-4 transition-all hover:bg-primary hover:text-primary-foreground group" @click="runSqlOnly">
                          <Play class="size-3.5 mr-2 group-hover:animate-pulse" />
                          Run SQL
                        </Button>
                      </div>

                      <div class="space-y-1.5 pt-1">
                        <div class="flex items-center justify-between">
                          <Label class="text-[10px] uppercase font-bold text-muted-foreground">SQL Script / Query</Label>
                        </div>
                        <Textarea v-model="runner.sqlSetupPath" class="min-h-[120px] max-h-[400px] overflow-y-auto font-mono text-[11px] p-2 leading-relaxed" placeholder="Dán mã SQL tại đây (Hỗ trợ tiếng Nhật/Việt)..." />
                      </div>
                    </TabsContent>
                    <TabsContent value="config" class="mt-0">
                      <Textarea v-model="runner.configTemplate" class="min-h-[160px] max-h-[500px] overflow-y-auto font-mono text-[11px] p-2" placeholder="Nội dung XML cấu hình..." />
                    </TabsContent>
                  </Tabs>
                </div>
              </section>



            </div>

            <div class="flex-1 h-full flex flex-col gap-4 min-w-0 pt-4 pr-6 pl-2 pb-8 overflow-y-auto custom-scrollbar">


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
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20" v-if="runner.running">
          <span class="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
          <span class="text-[9px] font-bold text-green-500 uppercase">Live</span>
        </div>
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
                              :class="!canBuild ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50'"
                              :disabled="!canBuild || runner.loadingTarget === 'build'"
                              @click="dotnet('build')">
                        <component :is="runner.loadingTarget === 'build' ? RotateCcw : Hammer" 
                                   :class="[
                                     'size-4 transition-transform duration-300',
                                     runner.loadingTarget === 'build' ? 'animate-spin' : 'group-hover/btn:rotate-12'
                                   ]" />
                        <span class="text-[8px] uppercase tracking-wide font-semibold">{{ runner.loadingTarget === 'build' ? '...' : 'Build' }}</span>
                      </Button>
                      
                      <Button variant="ghost" 
                              class="w-12 h-11 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90"
                              :class="!canBuild ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50'"
                              :disabled="!canBuild || runner.loadingTarget === 'rebuild'"
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
                              :class="canTest 
                                ? 'text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                : 'text-zinc-700 cursor-not-allowed opacity-40'"
                              :disabled="!canTest || runner.loadingTarget === 'bat'"
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
                              :class="!canRun || runner.loadingTarget === 'exe' ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:text-green-400 hover:bg-green-500/10'"
                              :disabled="!canRun || runner.loadingTarget === 'exe'"
                              @click="dotnet('run', 'exe')">
                        <component :is="runner.loadingTarget === 'exe' ? RotateCcw : Play"
                                   :class="[
                                     'size-5 fill-current transition-transform duration-300',
                                     runner.loadingTarget === 'exe' ? 'animate-spin' : 'group-hover/btn:scale-110'
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
