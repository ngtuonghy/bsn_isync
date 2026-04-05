import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { toast } from 'vue-sonner';
import { useStore } from '@/composables/useStore';
import { SyncService } from '@/utils/sync';
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
} from '@/utils/backlogAuth';

export const CLOUDFLARE_WORKER_URL = 'https://bsn-isync-sync-worker.ngtuonghy.workers.dev';

export const useBacklogStore = defineStore('backlog', () => {
  const backlog = reactive({
    host: '',
    apiKey: '',
    status: 'idle' as 'idle' | 'loading' | 'success' | 'error',
    error: '',
    profile: null as BacklogProfile | null,
    token: null as BacklogOAuthToken | null,
    projects: [] as BacklogProject[],
    issueTypes: [] as BacklogIssueType[],
    issues: [] as BacklogIssue[],
    userAvatars: {} as Record<number, string>,
    userAvatarByName: {} as Record<string, string>,
    updatedAt: 0,
  });

  const loadedIssueTypesProjectKey = ref<string | null>(null);
  const sqlConnStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle');
  const sqlErrorMsg = ref('');

  const { setItem, getItem } = useStore();

  const syncService = computed(() => {
    if (!backlog.host || !backlog.token?.access_token) return null;
    return new SyncService(CLOUDFLARE_WORKER_URL, backlog.host, backlog.token.access_token);
  });

  function getBacklogIssueUrl(backlogIssueKey: string) {
    if (!backlog.host || !backlogIssueKey) return undefined;
    const host = backlog.host.replace(/^https?:\/\//, '');
    return `https://${host}/view/${backlogIssueKey}`;
  }

  async function withTokenRefresh<T>(apiCall: (token: string) => Promise<T>): Promise<T | null> {
    if (!backlog.token?.access_token) return null;
    
    try {
      return await apiCall(backlog.token.access_token);
    } catch (error: any) {
      if (error?.status === 401 || error?.message?.includes('401')) {
        console.log('[Backlog] Token expired, refreshing...');
        if (backlog.token.refresh_token) {
          const refreshed = await refreshBacklogToken(backlog.token.refresh_token);
          if (refreshed && backlog.token?.access_token) {
            return await apiCall(backlog.token.access_token);
          }
        }
        await handleBacklogLogout();
        return null;
      }
      throw error;
    }
  }

  async function refreshBacklogToken(refreshToken: string): Promise<boolean> {
    try {
      console.log('[Backlog] Refreshing token...');
      const result = await invoke<BacklogOAuthToken>('backlog_oauth_refresh', { refreshToken });
      
      if (result && result.access_token) {
        const newToken: BacklogOAuthToken = {
          ...result,
          expires_at: Date.now() + (result.expires_in * 1000),
          host: backlog.host
        };
        
        backlog.token = newToken;
        await setItem('backlog_oauth_token', newToken);
        console.log('[Backlog] Token refreshed successfully');
        return true;
      }
      return false;
    } catch (e) {
      console.error('[Backlog] Token refresh failed:', e);
      toast.error('Session expired', { description: 'Please login again' });
      await handleBacklogLogout();
      return false;
    }
  }

  function buildOAuthState() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async function saveOAuthState(state: string) {
    await setItem('backlog_oauth_state', state);
  }

  async function readOAuthState(): Promise<string | null> {
    return await getItem('backlog_oauth_state');
  }

  async function clearOAuthState() {
    await setItem('backlog_oauth_state', null);
  }

  async function startBacklogOAuthLogin() {
    try {
      backlog.status = 'loading';
      const state = buildOAuthState();
      await saveOAuthState(state);

      const authUrl = await invoke<string>('get_backlog_auth_url', { state });
      if (authUrl) {
        await openUrl(authUrl);
      }
    } catch (e: any) {
      backlog.status = 'error';
      backlog.error = String(e);
      toast.error('Failed to start OAuth login', { description: String(e) });
    }
  }

  function isBacklogOAuthCallbackUrl(url: string): boolean {
    const params = new URL(url).searchParams;
    return params.has('code') && params.has('state');
  }

  async function handleBacklogOAuthCallback(code: string) {
    try {
      backlog.status = 'loading';
      console.log('[Backlog] Starting OAuth callback with code:', code.substring(0, 10) + '...');
      
      const result = await invoke<BacklogOAuthToken>('backlog_oauth_exchange', { code });
      console.log('[Backlog] Token received:', result);

      if (result.host) {
        backlog.host = result.host;
        await setItem('backlog_host', result.host);
        console.log('[Backlog] Host saved:', result.host);
      }

      const tokenWithExpiry: BacklogOAuthToken = {
        ...result,
        expires_at: Date.now() + (result.expires_in * 1000),
        host: backlog.host
      };

      backlog.token = tokenWithExpiry;
      await setItem('backlog_oauth_token', tokenWithExpiry);
      console.log('[Backlog] Token saved with expires_at:', tokenWithExpiry.expires_at);

      await clearOAuthState();

      const profileResult = await fetchBacklogProfileWithToken({
        host: backlog.host,
        accessToken: result.access_token
      });
      
      if (profileResult.status === 'success') {
        backlog.profile = profileResult.profile;
        await setItem('backlog_profile', profileResult.profile);
        console.log('[Backlog] Profile saved:', profileResult.profile.name);
      }

      backlog.status = 'success';
      toast.success('Logged in via OAuth');
      console.log('[Backlog] OAuth login complete');

      await loadBacklogProjects();
    } catch (e: any) {
      backlog.status = 'error';
      backlog.error = String(e);
      console.error('[Backlog] OAuth error:', e);
      toast.error('OAuth login failed', { description: String(e) });
    }
  }

  async function handleBacklogLogout() {
    backlog.host = '';
    backlog.apiKey = '';
    backlog.status = 'idle';
    backlog.error = '';
    backlog.profile = null;
    backlog.token = null;
    backlog.projects = [];
    backlog.issues = [];
    backlog.issueTypes = [];
    backlog.userAvatars = {};
    backlog.userAvatarByName = {};
    backlog.updatedAt = 0;

    await setItem('backlog_host', null);
    await setItem('backlog_token', null);
    await setItem('backlog_profile', null);
  }

  async function loadBacklogProjects() {
    if (!backlog.token?.access_token || !backlog.host) return;

    backlog.status = 'loading';
    const result = await withTokenRefresh(async (token) => {
      return await fetchBacklogProjects({
        host: backlog.host,
        accessToken: token
      });
    });

    if (result?.status === 'success') {
      backlog.projects = result.projects;
      backlog.status = 'success';
    } else if (result?.status === 'error') {
      backlog.status = 'error';
      backlog.error = result.error;
    }
  }

  async function loadBacklogIssueTypes(projectKey: string) {
    if (!backlog.token?.access_token || !backlog.host) return;

    const result = await withTokenRefresh(async (token) => {
      return await fetchBacklogIssueTypes({
        host: backlog.host,
        accessToken: token,
        projectIdOrKey: projectKey
      });
    });

    if (result?.status === 'success') {
      backlog.issueTypes = result.issueTypes;
      loadedIssueTypesProjectKey.value = projectKey;
    }
  }

  async function loadBacklogIssues(projectId?: number, assigneeId?: number, keyword?: string) {
    if (!backlog.token?.access_token || !backlog.host) return;

    console.log('[Backlog] loadBacklogIssues called with projectId:', projectId);
    const result = await withTokenRefresh(async (token) => {
      return await fetchBacklogIssues({
        host: backlog.host,
        accessToken: token,
        projectId,
        assigneeId,
        keyword
      });
    });

    if (result?.status === 'success') {
      console.log('[Backlog] Issues loaded:', result.issues.length);
      backlog.issues = result.issues;
      
      const uniqueAssignees = [...new Map(
        result.issues
          .filter(i => i.assignee?.id && !backlog.userAvatars[i.assignee.id])
          .map(i => [i.assignee!.id, i.assignee!])
      ).entries()];
      
      for (const [userId, assignee] of uniqueAssignees) {
        if (!backlog.userAvatars[userId]) {
          const iconResult = await fetchBacklogUserIcon({
            host: backlog.host,
            accessToken: backlog.token!.access_token,
            userId
          });
          if (iconResult.status === 'success') {
            backlog.userAvatars[userId] = iconResult.blobUrl;
            if (assignee.name) {
              backlog.userAvatarByName[assignee.name] = iconResult.blobUrl;
            }
          }
        }
      }
    } else {
      console.log('[Backlog] Failed to load issues:', result?.error);
    }
  }

  async function checkCurrentBacklogIssue(issueKey: string) {
    if (!backlog.token?.access_token || !backlog.host || !issueKey) return null;

    const result = await withTokenRefresh(async (token) => {
      return await fetchBacklogIssue({
        host: backlog.host,
        accessToken: token,
        issueKeyOrId: issueKey
      });
    });

    if (result?.status === 'success') {
      if (result.issue.assignee && backlog.profile) {
        if (!backlog.userAvatars[result.issue.assignee.id]) {
          const iconResult = await fetchBacklogUserIcon({
            host: backlog.host,
            accessToken: backlog.token!.access_token,
            userId: result.issue.assignee.id
          });
          if (iconResult.status === 'success') {
            backlog.userAvatars[result.issue.assignee.id] = iconResult.blobUrl;
          }
        }
      }
      return result.issue;
    }
    return null;
  }

  async function checkSqlConnection(sqlServer: string, sqlDatabase: string, _sqlSetupPath: string) {
    if (!sqlServer || !sqlDatabase) {
      sqlConnStatus.value = 'idle';
      sqlErrorMsg.value = '';
      return;
    }

    sqlConnStatus.value = 'loading';
    sqlErrorMsg.value = '';

    try {
      const connStr = `Server=${sqlServer};Database=${sqlDatabase};Trusted_Connection=True;TrustServerCertificate=True;`;
      
      console.log('[Backlog] Checking SQL connection:', connStr);
      
      const result = await invoke<{ success: boolean; error?: string }>('check_sql_connection', {
        connectionString: connStr
      });

      console.log('[Backlog] SQL connection result:', result);

      if (result.success) {
        sqlConnStatus.value = 'success';
        sqlErrorMsg.value = '';
      } else {
        sqlConnStatus.value = 'error';
        sqlErrorMsg.value = result.error || 'Connection failed';
      }
    } catch (e: any) {
      console.error('[Backlog] SQL connection check failed:', e);
      sqlConnStatus.value = 'error';
      sqlErrorMsg.value = String(e);
    }
  }

  async function initBacklog() {
    try {
      console.log('[Backlog] Initializing backlog state...');
      const savedToken = await getItem('backlog_oauth_token');
      const savedProfile = await getItem('backlog_profile');
      const savedHost = await getItem('backlog_host');

      console.log('[Backlog] Saved token:', savedToken ? 'exists' : 'none');
      console.log('[Backlog] Saved profile:', savedProfile ? 'exists' : 'none');
      console.log('[Backlog] Saved host:', savedHost || 'none');

      if (savedHost) {
        backlog.host = savedHost as string;
        console.log('[Backlog] Host loaded:', backlog.host);
      }

      if (savedToken) {
        const token = savedToken as BacklogOAuthToken;
        if (token.access_token) {
          backlog.token = token;
          console.log('[Backlog] Token loaded, access_token:', token.access_token.substring(0, 10) + '...');
          
          const expiresAt = token.expires_at || (Date.now() + 3600000);
          const timeLeft = expiresAt - Date.now();
          
          if (timeLeft <= 60000 && token.refresh_token) {
            console.log('[Backlog] Token expired or about to expire (' + timeLeft + 'ms left), refreshing...');
            const refreshed = await refreshBacklogToken(token.refresh_token);
            if (!refreshed) {
              console.log('[Backlog] Token refresh failed, clearing token');
              await handleBacklogLogout();
              return;
            }
          }
          
          if (savedProfile) {
            backlog.profile = savedProfile as BacklogProfile;
            console.log('[Backlog] Profile loaded:', backlog.profile.name);
            
            if (backlog.profile.id && !backlog.userAvatars[backlog.profile.id]) {
              const iconResult = await fetchBacklogUserIcon({
                host: backlog.host,
                accessToken: backlog.token!.access_token,
                userId: backlog.profile.id
              });
              if (iconResult.status === 'success') {
                backlog.userAvatars[backlog.profile.id] = iconResult.blobUrl;
                if (backlog.profile.name) {
                  backlog.userAvatarByName[backlog.profile.name] = iconResult.blobUrl;
                }
              }
            }
          }
          backlog.status = 'success';
          await loadBacklogProjects();
        }
      }
    } catch (e) {
      console.error('Failed to load backlog state:', e);
    }
  }

  return {
    backlog,
    loadedIssueTypesProjectKey,
    sqlConnStatus,
    sqlErrorMsg,
    syncService,
    getBacklogIssueUrl,
    buildOAuthState,
    saveOAuthState,
    readOAuthState,
    clearOAuthState,
    startBacklogOAuthLogin,
    isBacklogOAuthCallbackUrl,
    handleBacklogOAuthCallback,
    handleBacklogLogout,
    loadBacklogProjects,
    loadBacklogIssueTypes,
    loadBacklogIssues,
    checkCurrentBacklogIssue,
    checkSqlConnection,
    initBacklog,
    setItem,
    getItem,
  };
});
