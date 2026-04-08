import { onMounted, onUnmounted } from 'vue';
import { getCurrent } from '@tauri-apps/plugin-deep-link';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useUiStore } from '@/stores/useUiStore';
import { useRunnerStore } from '@/stores/useRunnerStore';
import { useTerminalStore } from '@/stores/useTerminalStore';
import { useBacklogStore } from '@/stores/useBacklogStore';

export function setupApp() {
  const uiStore = useUiStore();
  const runnerStore = useRunnerStore();
  const terminalStore = useTerminalStore();
  const backlogStore = useBacklogStore();

  let unlistenDeepLink: UnlistenFn | null = null;

  async function handleDeepLinkUrl(url: string) {
    console.log('[DeepLink] Handling URL:', url);
    if (backlogStore.isBacklogOAuthCallbackUrl(url)) {
      const params = new URL(url).searchParams;
      const code = params.get('code');
      if (code) {
        console.log('[DeepLink] Found OAuth code, processing callback...');
        await backlogStore.handleBacklogOAuthCallback(code);
      }
    }
  }

  async function handleDeepLink(urls: string[] | null) {
    if (!urls) return;
    for (const url of urls) {
      await handleDeepLinkUrl(url);
    }
  }

  onMounted(async () => {
    await uiStore.checkForUpdates();
    uiStore.checkEnv();
    
    // Get hostname from backend
    try {
      const hostname = await invoke<string>('get_hostname');
      uiStore.localHostname = hostname;
    } catch (e) {
      console.error('Failed to get hostname:', e);
    }
    
    await runnerStore.loadWorkspaceRoot();
    await backlogStore.initBacklog();
    await runnerStore.loadUIState();
    await runnerStore.loadSetupsForCurrentRoot();
    await runnerStore.saveUIState();

    // Check SQL connection after a short delay
    setTimeout(() => {
      void runnerStore.checkSqlConnectionOnStartup();
    }, 3000);

    // Check for URLs that launched the app
    const urls = await getCurrent();
    await handleDeepLink(urls);

    // Listen for deep-link events when app is reopened
    unlistenDeepLink = await listen<string[]>('deep-link', (event) => {
      console.log('[DeepLink] Event received:', event.payload);
      handleDeepLink(event.payload);
    });
  });

  onUnmounted(() => {
    if (unlistenDeepLink) {
      unlistenDeepLink();
    }
  });

  return {
    uiStore,
    runnerStore,
    terminalStore,
    backlogStore,
  };
}
