import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'vue-sonner';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

declare const __APP_VERSION__: string;
export const APP_VERSION = __APP_VERSION__;
export const CLOUDFLARE_WORKER_URL = 'https://bsn-isync-sync-worker.ngtuonghy.workers.dev';
export const OAUTH_STATE_KEY = 'bsn_isync:backlog_oauth_state';
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const UI_STATE_KEY = 'ui_state';

export type OAuthStatePayload = { state: string; createdAt: number };

export const useUiStore = defineStore('ui', () => {
  const isDarkMode = ref(false);
  const activeTab = ref<'runner' | 'sync'>('runner');
  const isNotificationEnabled = ref(true);
  const isTerminalHistoryEnabled = ref(false);
  const isHistoryDialogOpen = ref(false);
  const isHotkeySettingsOpen = ref(false);
  const isIssueSearchVisible = ref(false);
  const isNamingSqlSnippet = ref(false);
  const namingSqlSnippetMode = ref<'create' | 'rename'>('create');
  const namingSqlSnippetValue = ref('');
  const isSqlEditorFullscreen = ref(false);
  const showSqlResult = ref(false);
  const sqlResultData = ref<{ columns: string[]; rows: Record<string, unknown>[] }>({ columns: [], rows: [] });
  const isSqlRunning = ref(false);
  const isNamingArgSnippet = ref(false);
  const namingArgSnippetMode = ref<'create' | 'rename'>('create');
  const namingArgSnippetValue = ref('');
  const namingArgSnippetTarget = ref<'bat' | 'exe'>('bat');
  const isRecordingShortcut = ref(false);
  const recordingAction = ref<string | null>(null);
  const hotkeyContainerRef = ref<HTMLElement | null>(null);
  const issueSearchContainerRef = ref<HTMLElement | null>(null);
  const profileNameInput = ref<HTMLInputElement | null>(null);
  const argsInputRefBat = ref<any>(null);
  const argsInputRefExe = ref<any>(null);
  const localHostname = ref('');
  const updateVersion = ref<string | null>(null);
  const isUpdateDownloading = ref(false);
  const isUpdateReady = ref(false);
  const envStatus = ref<Array<{ name: string; found: boolean; version: string; downloadUrl: string }>>([]);
  const syncStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isFetchingProfile = ref(false);
  const lastSyncTime = ref<number | null>(null);
  const isApplyingProfile = ref(false);
  const deletedProfileIds = ref<Map<string, number>>(new Map());
  const profileHashes = new Map<string, string>();
  const loadedIssueTypesProjectKey = ref<string | null>(null);
  const isNamingArgSnippetDialog = ref(false);
  const isRunnerSettingsOpen = ref(false);

  const namingSqlSnippetTitle = computed(() => namingSqlSnippetMode.value === 'create' ? 'Create New SQL Script' : 'Rename SQL Script');
  const namingArgSnippetTitle = computed(() => namingArgSnippetMode.value === 'create' ? 'Create New Argument' : 'Rename Argument');

  try {
    const stored = localStorage.getItem('bsn_isync:deleted_profiles');
    if (stored) deletedProfileIds.value = new Map(JSON.parse(stored));
  } catch (e) {}

  function saveDeletedProfileIds() {
    localStorage.setItem('bsn_isync:deleted_profiles', JSON.stringify(Array.from(deletedProfileIds.value.entries())));
  }

  async function checkForUpdates(manual = false) {
    try {
      if (manual) {
        toast.info('Searching for new updates...', { id: 'updater-check' });
      }
      const version = await invoke('check_update') as string | null;
      if (version) {
        updateVersion.value = version;
        console.log('[updater] update available:', version);
        if (manual) {
          toast.success(`A new update is available (v${version})`, { id: 'updater-check' });
        }
      } else {
        if (manual) {
          toast.info('You are running the latest version', { id: 'updater-check' });
        }
      }
    } catch (e) {
      console.error('[updater] check failed:', e);
      let errorMsg = String(e);
      if (errorMsg.includes('None of the fallback platforms')) {
        errorMsg = 'No compatible update found for your platform (needs .zip).';
      }
      if (manual) {
        toast.error('Update check failed', { description: errorMsg, id: 'updater-check' });
      }
    }
  }

  async function downloadUpdate() {
    if (isUpdateDownloading.value) return;
    isUpdateDownloading.value = true;
    try {
      toast.info('Downloading update...', {
        description: `Version v${updateVersion.value} is being downloaded.`
      });
      await invoke('download_and_install_update');
      isUpdateReady.value = true;
      toast.success('Update downloaded', {
        description: 'Please restart the application to apply the changes.'
      });
    } catch (e: any) {
      toast.error('Download failed', { description: String(e) });
    } finally {
      isUpdateDownloading.value = false;
    }
  }

  async function applyUpdate() {
    try {
      await invoke('restart_app');
    } catch (e: any) {
      toast.error('Error while restarting', { description: String(e) });
    }
  }

  async function checkEnv(customMsbuildPath?: string) {
    try {
      envStatus.value = await invoke<Array<{ name: string; found: boolean; version: string; downloadUrl: string }>>('check_environment', {
        customMsbuildPath: customMsbuildPath || null
      });
      const missing = envStatus.value.filter(x => !x.found);
      if (missing.length > 0) {
        // If .NET missing but MSBuild is configured, the backend will suppress the found:false if possible,
        // but extra check here if we want to silence the toast.
        const reallyMissing = missing.filter(m => m.name !== '.NET SDK' || !customMsbuildPath);
        if (reallyMissing.length > 0) {
          toast.warning('Some required tools are missing', {
            description: `Missing: ${reallyMissing.map(x => x.name).join(', ')}. Please install them to use all features.`,
            duration: 10000,
          });
        }
      }
    } catch (e) {
      console.error('Failed to check environment:', e);
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
      console.error('Failed to send notification:', e);
    }
  }

  return {
    isDarkMode,
    activeTab,
    isNotificationEnabled,
    isTerminalHistoryEnabled,
    isHistoryDialogOpen,
    isHotkeySettingsOpen,
    isIssueSearchVisible,
    isNamingSqlSnippet,
    namingSqlSnippetMode,
    namingSqlSnippetValue,
    isSqlEditorFullscreen,
    showSqlResult,
    sqlResultData,
    isSqlRunning,
    isNamingArgSnippet,
    namingArgSnippetMode,
    namingArgSnippetValue,
    namingArgSnippetTarget,
    isRecordingShortcut,
    recordingAction,
    hotkeyContainerRef,
    issueSearchContainerRef,
    profileNameInput,
    argsInputRefBat,
    argsInputRefExe,
    localHostname,
    updateVersion,
    isUpdateDownloading,
    isUpdateReady,
    envStatus,
    syncStatus,
    isFetchingProfile,
    lastSyncTime,
    isApplyingProfile,
    deletedProfileIds,
    profileHashes,
    loadedIssueTypesProjectKey,
    isNamingArgSnippetDialog,
    isRunnerSettingsOpen,
    namingSqlSnippetTitle,
    namingArgSnippetTitle,
    saveDeletedProfileIds,
    checkForUpdates,
    downloadUpdate,
    applyUpdate,
    checkEnv,
    notify,
  };
});
