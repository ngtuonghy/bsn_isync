import { defineStore } from 'pinia';
console.log('[Store] useRunnerStore.ts loading...');
import { ref, computed, reactive, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { watch as fsWatch, watchImmediate as fsWatchImmediate, exists } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { toast } from 'vue-sonner';
import { register as registerShortcut, unregister as unregisterShortcut, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { useStore } from '@/composables/useStore';
import { useUiStore } from './useUiStore';
import { useTerminalStore } from './useTerminalStore';
import { useBacklogStore } from './useBacklogStore';
import { fetchBacklogProfileWithToken } from '@/utils/backlogAuth';

export type ProjectProfile = {
  id: string;
  name: string;
  owner: string;
  workspaceRoot?: string;
  projectRoot: string;
  startupProject: string;
  targetProjects?: string[];
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
  targetConfigs?: Record<string, string>;
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

export const useRunnerStore = defineStore('runner', () => {
  console.log('[Store] useRunnerStore defining...');
  const workspaceRoot = ref('');
  const projectRoot = ref('');
  const startupProject = ref('');
  const targetProjects = ref<string[]>([]);
  const targetConfigs = ref<Record<string, string>>({});
  const urls = ref('');
  const config = ref('Debug');
  const aliasExeName = ref('');
  const batFilePath = ref('');
  const batFiles = ref<string[]>([]);
  const activeBatConfigIndex = ref(0);
  const batFilesActiveArgIds = ref<string[]>([]);
  const batFilesArgs = ref<string[]>([]);
  const runArgs = ref('');
  const exeArgs = ref('');
  const isExeTestMode = ref(false);
  const forceUnicode = ref(localStorage.getItem('bsn_isync:global_force_unicode') !== null ? localStorage.getItem('bsn_isync:global_force_unicode') === 'true' : true);
  const autoWatchBat = ref(localStorage.getItem('bsn_isync:global_watch_bat') !== null ? localStorage.getItem('bsn_isync:global_watch_bat') === 'true' : true);
  const autoWatchTargetTest = ref(localStorage.getItem('bsn_isync:global_watch_test') === 'true');
  const autoWatchTargetRun = ref(localStorage.getItem('bsn_isync:global_watch_run') !== null ? localStorage.getItem('bsn_isync:global_watch_run') === 'true' : true);
  const sqlSetupPath = ref('');
  const sqlServer = ref(localStorage.getItem('bsn_isync:global_sql_server') || '');
  const sqlDatabase = ref(localStorage.getItem('bsn_isync:global_sql_db') || 'Arkbell_01');
  const sqlUser = ref(localStorage.getItem('bsn_isync:global_sql_user') || 'sa');
  const sqlPassword = ref(localStorage.getItem('bsn_isync:global_sql_pass') || 'ArkAdmin@2026');
  const useWindowsAuth = ref(localStorage.getItem('bsn_isync:global_sql_winauth') === 'false' ? false : true);
  const sqlSnippets = ref<Array<{ id: string; name: string; content: string }>>([]);
  const activeSqlSnippetId = ref('');
  const runArgSnippets = ref<Array<{ id: string; name: string; content: string; batPath?: string; batConfigIndex?: number }>>([]);
  const activeRunArgId = ref('');
  const selectedRunArgIds = ref<string[]>([]);
  const exeArgSnippets = ref<Array<{ id: string; name: string; content: string; batPath?: string; batConfigIndex?: number }>>([]);
  const activeExeArgId = ref('');
  const selectedExeArgIds = ref<string[]>([]);
  const buildStatus = ref<string | null>(null);
  const configTemplate = ref(`<?xml version="1.0" encoding="utf-8"?>
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
</configuration>`);
  const runConfigTemplate = ref(`<?xml version="1.0" encoding="utf-8"?>
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
		<add key="Job.BatFilePath" value="C:\\Users\\ngtuonghy_rikai\\source\\repos\\BSN_Improve_Invoice\\Invoice\\batch\\04_レッスンバッチ\\370300_請求書出力_宴集会\\JE5912.bat" />
		<add key="Execute.EnvId" value="Arkbell_Dev" />
	</appSettings>
</configuration>`);
  const connectionStringTemplate = ref('');
  const running = ref(false);
  const loadingTarget = ref<"exe" | "build" | "restore" | "rebuild" | "bat" | null>(null);
  const logs = ref<string[]>([]);
  const childPid = ref<number | 0>(0);
  const backlogProjectKey = ref('');
  const backlogIssueTypeId = ref<number | undefined>(undefined);
  const backlogIssueKey = ref('');
  const backlogIssueSummary = ref('');
  const backlogIssueColor = ref('');
  const backlogIssueStatusName = ref('');
  const backlogIssueStatusColor = ref('');
  const backlogIssueNotFound = ref(false);
  const shortcuts = ref<Record<string, string>>({
    test: 'Alt+Shift+T',
    run: 'Alt+Shift+R',
    build: 'Alt+Shift+B',
    rebuild: 'Alt+Shift+U',
    stop: 'Alt+Shift+S',
  });
  const autoDeployConfig = ref(false);
  const deployPath = ref('');

  const discoveredProjects = ref<Array<{
    name: string;
    root: string;
    startupProject: string;
    slnCount: number;
    csprojCount: number;
  }>>([]);

  const selectedProjectRoot = ref('');
  const selectedBuildProjects = ref<Set<string>>(new Set());
  const buildProjectSearch = ref('');
  const filteredBuildProjects = computed(() => {
    const search = buildProjectSearch.value.toLowerCase().trim();
    if (!search) return discoveredProjects.value;
    return discoveredProjects.value.filter(p => 
      p.name.toLowerCase().includes(search) || 
      p.startupProject.toLowerCase().includes(search) ||
      p.root.toLowerCase().includes(search)
    );
  });
  const setupProfiles = ref<ProjectProfile[]>([]);
  const selectedSetupId = ref('');
  const editableProfileName = ref('');
  const profileSearch = ref('');
  const profileScope = ref<"personal" | "shared" | "team">("team");
  const selectedOwner = ref('');
  const ownerSearch = ref('');
  const projectSearch = ref('');
  const issueSearchQuery = computed({
    get: () => editableProfileName.value,
    set: (val) => { editableProfileName.value = val; }
  });
  const preventAutoSearch = ref(false);
  const profileNameInput = ref<HTMLInputElement | null>(null);
  const argsInputRefBat = ref<any>(null);
  const argsInputRefExe = ref<any>(null);

  const sync = reactive({
    confirmOverwrite: true,
    preserveStructure: true,
    dryRun: false,
    checksum: 'sha256',
    sql: {
      source: '',
      dest: 'database\\sql',
      include: '**/*.sql',
      exclude: '**/*.bak',
    },
    bat: {
      source: '',
      dest: 'tools\\scripts',
      include: '*.bat',
    },
    exe: {
      source: '',
      dest: 'tools\\bin',
      requireSignature: true,
    },
    logs: [] as string[],
  });

  const uiStore = useUiStore();
  const terminalStore = useTerminalStore();
  const backlogStore = useBacklogStore();
  const { setItem, getItem } = useStore();

  const currentUser = computed(() => backlogStore.backlog.profile?.name || backlogStore.backlog.profile?.userId || '');

  const canBuild = computed(() => !running.value && projectRoot.value && startupProject.value);
  const canTest = computed(() => running.value || (projectRoot.value && startupProject.value && batFilePath.value));
  const canRun = computed(() => !running.value && projectRoot.value && startupProject.value && aliasExeName.value && batFilePath.value);
  
const getTargetProjectName = (targetProjectPath: string) => {
    if (!targetProjectPath) return '';
    // First try to find in discoveredProjects
    if (discoveredProjects.value && discoveredProjects.value.length > 0) {
      const found = discoveredProjects.value.find(p => {
        if (!p.startupProject) return false;
        const fullPath = p.root ? (p.root + '\\' + p.startupProject) : p.startupProject;
        return targetProjectPath === fullPath ||
               targetProjectPath === p.startupProject ||
               targetProjectPath.endsWith('\\' + p.startupProject) ||
               targetProjectPath.endsWith('/' + p.startupProject);
      });
      if (found) return found.name;
    }
    // Fallback: show the startup project name (without .csproj)
    const cleanName = targetProjectPath.replace(/\.csproj$/i, '').split(/[\\/]/).pop() || '';
    return cleanName || targetProjectPath;
  };
  const canEditSelected = computed(() => {
    if (backlogStore.backlog.status !== 'success') return false;
    if (!selectedProfile.value) return false;
    return !selectedProfile.value.owner || selectedProfile.value.owner === currentUser.value;
  });
  const canExecuteSelected = computed(() => !!selectedProfile.value);

  const currentBatArgId = computed({
    get: () => {
      if (activeBatConfigIndex.value === 0) return activeRunArgId.value;
      const idx = activeBatConfigIndex.value - 1;
      return batFilesActiveArgIds.value?.[idx] || '';
    },
    set: (val: string) => {
      if (activeBatConfigIndex.value === 0) {
        activeRunArgId.value = val;
      } else {
        const idx = activeBatConfigIndex.value - 1;
        if (!batFilesActiveArgIds.value) batFilesActiveArgIds.value = [];
        batFilesActiveArgIds.value[idx] = val;
      }
    }
  });

  const currentBatArgs = computed({
    get: () => {
      if (activeBatConfigIndex.value === 0) return runArgs.value;
      const idx = activeBatConfigIndex.value - 1;
      return batFilesArgs.value?.[idx] || '';
    },
    set: (val: string) => {
      if (activeBatConfigIndex.value === 0) {
        runArgs.value = val;
      } else {
        const idx = activeBatConfigIndex.value - 1;
        if (!batFilesArgs.value) batFilesArgs.value = [];
        batFilesArgs.value[idx] = val;
      }
    }
  });

  const currentBatArgSnippets = computed(() => {
    return runArgSnippets.value.filter(s => s.batConfigIndex === activeBatConfigIndex.value || (s.batConfigIndex === undefined && activeBatConfigIndex.value === 0));
  });

  const ownerOptions = computed(() => {
    const owners = new Set<string>();
    if (currentUser.value) {
      owners.add(currentUser.value);
    }
    setupProfiles.value.forEach((p) => {
      if (p.owner && p.owner !== 'Guest') {
        owners.add(p.owner);
      }
    });
    return Array.from(owners);
  });

  const filteredOwnerOptions = computed(() => {
    const q = ownerSearch.value.trim().toLowerCase();
    if (!q) return ownerOptions.value;
    return ownerOptions.value.filter(o => o.toLowerCase().includes(q));
  });

  const filteredDiscoveredProjects = computed(() => {
    const q = projectSearch.value.trim().toLowerCase();
    if (!q) return discoveredProjects.value;
    return discoveredProjects.value.filter(p => p.name.toLowerCase().includes(q) || p.root.toLowerCase().includes(q));
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
    if (profileScope.value === 'team') return visibleProfiles.value;
    if (profileScope.value === 'personal') {
      return visibleProfiles.value.filter((p) => p.owner === currentUser.value);
    }
    return visibleProfiles.value.filter((p) => p.owner !== currentUser.value);
  });

  const selectedProfile = computed(() => setupProfiles.value.find((p) => p.id === selectedSetupId.value));

  const filteredBacklogIssues = computed(() => {
    const q = issueSearchQuery.value.trim().toLowerCase();
    let result = backlogStore.backlog.issues;
    
    console.log('[RunnerStore] filteredBacklogIssues: query=', q, 'total issues=', result.length);
    
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

    if (backlogStore.backlog.profile?.id) {
      const myId = backlogStore.backlog.profile.id;
      result = [...result].sort((a, b) => {
        const aIsMine = a.assignee?.id === myId ? 1 : 0;
        const bIsMine = b.assignee?.id === myId ? 1 : 0;
        return bIsMine - aIsMine;
      });
    }
    
    return result;
  });

  const backlogIssueUrl = computed(() => {
    if (!backlogStore.backlog.host || !backlogIssueKey.value) return undefined;
    const host = backlogStore.backlog.host.replace(/^https?:\/\//, '');
    return `https://${host}/view/${backlogIssueKey.value}`;
  });

  function initials(name: string) {
    const cleanName = name.split('-').pop()?.trim() || name.trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length === 0) return '?';
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase();
  }

  function makeProfileId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizePath(path: string) {
    let s = path.replace(/\//g, '\\');
    if (s.startsWith('\\\\?\\')) {
      s = s.substring(4);
    }
    return s;
  }

  function setupStorageKey() {
    return `bsn_isync:project_profiles`;
  }

  function buildSetupFromRunner(name: string): ProjectProfile {
    const toRel = (p: string) => {
      if (!p || !workspaceRoot.value) return p;
      const ws = workspaceRoot.value.replace(/[\\/]$/, '');
      if (p.startsWith(ws)) {
        let rel = p.substring(ws.length);
        if (rel.startsWith('\\') || rel.startsWith('/')) rel = rel.substring(1);
        return rel;
      }
      return p;
    };

    return {
      id: makeProfileId(),
      name,
      owner: currentUser.value,
      projectRoot: toRel(projectRoot.value),
      startupProject: startupProject.value,
      buildConfig: config.value === 'Release' ? 'Release' : 'Debug',
      urls: urls.value,
      aliasExeName: aliasExeName.value,
      batFilePath: toRel(batFilePath.value),
      batFiles: batFiles.value ? [...batFiles.value].map(toRel) : [],
      batFilesActiveArgIds: batFilesActiveArgIds.value ? [...batFilesActiveArgIds.value] : [],
      batFilesArgs: batFilesArgs.value ? [...batFilesArgs.value] : [],
      runArgs: runArgs.value,
      exeArgs: exeArgs.value,
      isExeTestMode: isExeTestMode.value,
      forceUnicode: forceUnicode.value,
      autoWatchBat: autoWatchBat.value,
      autoWatchTargetTest: autoWatchTargetTest.value,
      autoWatchTargetRun: autoWatchTargetRun.value,
      sqlSetupPath: sqlSetupPath.value,
      sqlServer: sqlServer.value,
      sqlSnippets: JSON.parse(JSON.stringify(sqlSnippets.value)),
      activeSqlSnippetId: activeSqlSnippetId.value,
      runArgSnippets: JSON.parse(JSON.stringify(runArgSnippets.value || [])),
      activeRunArgId: activeRunArgId.value,
      exeArgSnippets: JSON.parse(JSON.stringify(exeArgSnippets.value || [])),
      activeExeArgId: activeExeArgId.value,
      backlogProjectKey: backlogProjectKey.value,
      backlogIssueTypeId: backlogIssueTypeId.value,
      backlogIssueKey: backlogIssueKey.value,
      backlogIssueSummary: backlogIssueSummary.value,
      deployPath: toRel(deployPath.value),
      sync: (() => {
        const { logs, ...syncData } = sync;
        return JSON.parse(JSON.stringify(syncData));
      })(),
      updatedAt: Date.now(),
    };
  }

  function applySetupToRunner(setup: ProjectProfile) {
    const toAbs = (p: string) => {
      if (!p) return '';
      if (/^[A-Z]:\\/i.test(p) || p.startsWith('\\\\') || p.startsWith('/')) return p;
      const ws = workspaceRoot.value.replace(/[\\/]$/, '');
      return ws ? `${ws}\\${p}` : p;
    };

    projectRoot.value = normalizePath(toAbs(setup.projectRoot || ''));
    selectedProjectRoot.value = projectRoot.value;
    startupProject.value = setup.startupProject || '';
    targetProjects.value = setup.targetProjects ? [...setup.targetProjects] : [];
    config.value = setup.buildConfig;
    urls.value = setup.urls || '';
    aliasExeName.value = setup.aliasExeName || '';
    batFilePath.value = toAbs(setup.batFilePath || '');
    batFiles.value = setup.batFiles ? [...setup.batFiles].map(toAbs) : [];
    batFilesActiveArgIds.value = setup.batFilesActiveArgIds ? [...setup.batFilesActiveArgIds] : [];
    batFilesArgs.value = setup.batFilesArgs ? [...setup.batFilesArgs] : [];
    runArgs.value = setup.runArgs || '';
    exeArgs.value = setup.exeArgs || '';
    isExeTestMode.value = setup.isExeTestMode || false;
    deployPath.value = toAbs(setup.deployPath || '');
    sqlSetupPath.value = setup.sqlSetupPath || '';

    if (setup.sqlSnippets && Array.isArray(setup.sqlSnippets)) {
      sqlSnippets.value = JSON.parse(JSON.stringify(setup.sqlSnippets));
    } else if (setup.sqlSetupPath) {
      sqlSnippets.value = [{ id: 'default_snippet_1', name: 'Default Script', content: setup.sqlSetupPath }];
    } else {
      sqlSnippets.value = [];
    }
    
    activeSqlSnippetId.value = setup.activeSqlSnippetId || (sqlSnippets.value.length > 0 ? sqlSnippets.value[0].id : '');

    if (setup.runArgSnippets && setup.runArgSnippets.length > 0) {
      runArgSnippets.value = setup.runArgSnippets.map(s => ({ ...s, batPath: s.batPath ? toAbs(s.batPath) : s.batPath }));
    } else if (setup.runArgs) {
      runArgSnippets.value = [{ id: 'default_run_arg_1', name: 'Default Argument', content: setup.runArgs }];
    } else {
      runArgSnippets.value = [];
    }
    activeRunArgId.value = setup.activeRunArgId || (runArgSnippets.value.length > 0 ? runArgSnippets.value[0].id : '');
    selectedRunArgIds.value = setup.selectedRunArgIds || [];
    const activeRunArg = runArgSnippets.value.find(s => s.id === activeRunArgId.value);
    runArgs.value = activeRunArg ? activeRunArg.content : (setup.runArgs || '');

    if (setup.exeArgSnippets && setup.exeArgSnippets.length > 0) {
      exeArgSnippets.value = setup.exeArgSnippets.map(s => ({ ...s, batPath: s.batPath ? toAbs(s.batPath) : s.batPath }));
    } else if (setup.exeArgs) {
      exeArgSnippets.value = [{ id: 'default_exe_arg_1', name: 'Default Argument', content: setup.exeArgs }];
    } else {
      exeArgSnippets.value = [];
    }
    activeExeArgId.value = setup.activeExeArgId || (exeArgSnippets.value.length > 0 ? exeArgSnippets.value[0].id : '');
    selectedExeArgIds.value = setup.selectedExeArgIds || [];
    const activeExeArg = exeArgSnippets.value.find(s => s.id === activeExeArgId.value);
    exeArgs.value = activeExeArg ? activeExeArg.content : (setup.exeArgs || '');
    const activeSnippet = sqlSnippets.value.find(s => s.id === activeSqlSnippetId.value);
    sqlSetupPath.value = activeSnippet ? activeSnippet.content : (setup.sqlSetupPath || '');

    backlogProjectKey.value = setup.backlogProjectKey || '';
    backlogIssueTypeId.value = setup.backlogIssueTypeId;
    backlogIssueKey.value = setup.backlogIssueKey || '';
    backlogIssueSummary.value = setup.backlogIssueSummary || '';

    if (setup.sync) {
      Object.assign(sync, setup.sync);
    }

    loadConfigsForCurrentProject();
  }

  async function loadSetupsForCurrentRoot() {
    const raw = await getItem<ProjectProfile[]>(setupStorageKey());
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      const defaultSetup = buildSetupFromRunner('Default');
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
      })).filter((p) => {
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      });

      const editedCount = normalized.filter(p => p.isLocalEdited).length;
      console.log('[RunnerStore] Loaded profiles, isLocalEdited count:', editedCount);
      
      setupProfiles.value = normalized;
      ensureVisibleSelection();
      
      if (workspaceRoot.value) {
        await discoverProjects(true);
      }
      
      if (selectedSetupId.value) applySelectedSetupProfile();

      if (sqlServer.value && sqlDatabase.value) {
        setTimeout(() => backlogStore.checkSqlConnection(sqlServer.value, sqlDatabase.value, sqlSetupPath.value), 1000);
      }
    } catch (e) {
      console.error('Failed to load profiles', e);
    }
  }

  async function saveSetupsForCurrentRoot() {
    const cleanProfiles = setupProfiles.value.map(p => {
      const { backlogIssueColor, backlogIssueStatusName, backlogIssueStatusColor, backlogIssueNotFound, ...clean } = p as any;
      console.log('[Sync] saveSetupsForCurrentRoot profile:', p.name, 'isLocalEdited:', p.isLocalEdited);
      return clean;
    });
    console.log('[Sync] Saving profiles, isLocalEdited count:', cleanProfiles.filter(p => p.isLocalEdited).length);
    await setItem(setupStorageKey(), cleanProfiles);
    if (!uiStore.isApplyingProfile) {
      triggerSync(selectedSetupId.value);
    }
  }

  function ensureVisibleSelection() {
    const owners = ownerOptions.value;
    if (owners.length > 0 && !owners.includes(selectedOwner.value)) {
      selectedOwner.value = owners[0];
    }
    const visible = scopedProfiles.value;
    if (!visible.some((p) => p.id === selectedSetupId.value)) {
      selectedSetupId.value = visible[0]?.id ?? '';
    }
  }

  async function applySelectedSetupProfile(silent = false) {
    const setup = setupProfiles.value.find((x) => x.id === selectedSetupId.value);
    if (!setup) {
      if (!silent) toast.error('Setup profile not selected');
      return;
    }
    
    uiStore.isApplyingProfile = true;
    editableProfileName.value = setup.name;
    applySetupToRunner(setup);
    
    setTimeout(() => {
      uiStore.isApplyingProfile = false;
    }, 500);
  }

  function saveCurrentToSelectedSetupProfile() {
    console.log('[SaveProfile] saveCurrentToSelectedSetupProfile called, selectedSetupId:', selectedSetupId.value);
    const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
    if (idx < 0) {
      console.log('[SaveProfile] No profile found with id:', selectedSetupId.value);
      return;
    }
    
    const cleanObj = (obj: any) => {
      const res = { ...obj };
      for (const key in res) {
        if (res[key] === null || res[key] === undefined || (Array.isArray(res[key]) && res[key].length === 0) || res[key] === '') {
          delete res[key];
        }
      }
      return res;
    };
    const oldSetupStr = JSON.stringify(cleanObj(setupProfiles.value[idx]), Object.keys(cleanObj(setupProfiles.value[idx])).sort());
    const setup = { ...setupProfiles.value[idx] };
    
    const toRel = (p: string) => {
      if (!p || !workspaceRoot.value) return p;
      const ws = workspaceRoot.value.replace(/\\/g, '/').replace(/\/$/, '');
      const normP = p.replace(/\\/g, '/');
      if (normP.toLowerCase().startsWith(ws.toLowerCase())) {
        const rel = normP.substring(ws.length).replace(/^\//, '');
        return rel.replace(/\//g, '\\');
      }
      return p;
    };

    setup.projectRoot = toRel(projectRoot.value);
    setup.startupProject = startupProject.value;
    setup.targetProjects = targetProjects.value ? [...targetProjects.value].map(toRel) : [];
    setup.buildConfig = config.value === 'Release' ? 'Release' : 'Debug';
    setup.urls = urls.value;
    setup.aliasExeName = aliasExeName.value;
    setup.batFilePath = toRel(batFilePath.value);
    setup.batFiles = batFiles.value ? [...batFiles.value].map(toRel) : [];
    setup.batFilesActiveArgIds = batFilesActiveArgIds.value ? [...batFilesActiveArgIds.value] : [];
    setup.batFilesArgs = batFilesArgs.value ? [...batFilesArgs.value] : [];
    setup.runArgs = runArgs.value;
    setup.exeArgs = exeArgs.value;
    setup.isExeTestMode = isExeTestMode.value;
    setup.sqlSetupPath = sqlSetupPath.value;
    setup.sqlSnippets = JSON.parse(JSON.stringify(sqlSnippets.value));
    setup.activeSqlSnippetId = activeSqlSnippetId.value;
    setup.runArgSnippets = runArgSnippets.value ? JSON.parse(JSON.stringify(runArgSnippets.value)).map((s: any) => ({ ...s, batPath: s.batPath ? toRel(s.batPath) : s.batPath })) : [];
    setup.activeRunArgId = activeRunArgId.value;
    setup.selectedRunArgIds = JSON.parse(JSON.stringify(selectedRunArgIds.value || []));
    setup.exeArgSnippets = exeArgSnippets.value ? JSON.parse(JSON.stringify(exeArgSnippets.value)).map((s: any) => ({ ...s, batPath: s.batPath ? toRel(s.batPath) : s.batPath })) : [];
    setup.activeExeArgId = activeExeArgId.value;
    setup.selectedExeArgIds = JSON.parse(JSON.stringify(selectedExeArgIds.value || []));
    setup.sync = (() => {
      const { logs: _logs, ...syncData } = sync;
      return JSON.parse(JSON.stringify(syncData));
    })();
    setup.backlogProjectKey = backlogProjectKey.value;
    setup.backlogIssueTypeId = backlogIssueTypeId.value;
    setup.backlogIssueKey = backlogIssueKey.value;
    setup.backlogIssueSummary = backlogIssueSummary.value;
    setup.deployPath = toRel(deployPath.value);
    setup.targetConfigs = JSON.parse(JSON.stringify(targetConfigs.value || {}));
    
    const setupForCompare = { ...setup, updatedAt: setupProfiles.value[idx].updatedAt };
    const newSetupStr = JSON.stringify(cleanObj(setupForCompare), Object.keys(cleanObj(setupForCompare)).sort());
    if (oldSetupStr !== newSetupStr) {
      setup.updatedAt = Date.now();
      setup.isLocalEdited = true;
      console.log('[Sync] Profile edited, isLocalEdited set to true:', setup.name, setup.id);
      setupProfiles.value[idx] = setup;
      saveSetupsForCurrentRoot();
    }
  }

  function focusProfileName() {
    if (!selectedProfile.value) return;
    nextTick(() => {
      profileNameInput.value?.focus();
    });
  }

  function commitProfileName() {
    const namePart = editableProfileName.value.trim();
    if (!namePart) return;
    const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
    if (idx < 0) return;
    
    const setup = { ...setupProfiles.value[idx] };
    setup.name = namePart;
    setupProfiles.value[idx] = setup;
    saveSetupsForCurrentRoot();
  }

  function createNewSetupProfile() {
    if (running.value) return;
    if (backlogStore.backlog.status !== 'success') {
      toast.error('Backlog Login Required', {
        description: 'You need to log in to Backlog to use this feature.',
        duration: 5000,
      });
      return;
    }
    
    aliasExeName.value = '';
    runArgs.value = '';
    exeArgs.value = '';
    isExeTestMode.value = false;
    sqlSetupPath.value = '';
    configTemplate.value = '';
    runConfigTemplate.value = '';
    connectionStringTemplate.value = '';
    projectRoot.value = '';
    startupProject.value = '';
    batFilePath.value = '';
    batFiles.value = [];
    batFilesActiveArgIds.value = [];
    batFilesArgs.value = [];
    selectedProjectRoot.value = '';
    activeRunArgId.value = '';
    activeExeArgId.value = '';
    selectedRunArgIds.value = [];
    selectedExeArgIds.value = [];
    backlogIssueKey.value = '';
    backlogIssueSummary.value = '';
    backlogIssueTypeId.value = undefined;
    backlogIssueColor.value = '';
    backlogIssueStatusName.value = '';
    backlogIssueStatusColor.value = '';
    backlogIssueNotFound.value = false;
    issueSearchQuery.value = '';
    uiStore.isIssueSearchVisible = false;
    
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

  function cloneSelectedSetupProfile() {
    if (running.value) return;
    if (backlogStore.backlog.status !== 'success') {
      toast.error('Backlog Login Required', {
        description: 'You need to log in to Backlog to use this feature.',
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
    
    toast.success('Profile Cloned', { description: 'You can now edit your local copy.' });
  }

  async function deleteSelectedSetupProfile() {
    if (running.value) return;
    if (setupProfiles.value.length <= 1) {
      toast.error('Must keep at least 1 setup');
      return;
    }
    const idx = setupProfiles.value.findIndex((x) => x.id === selectedSetupId.value);
    if (idx < 0) return;
    
    const profileToDelete = setupProfiles.value[idx];
    uiStore.deletedProfileIds.set(profileToDelete.id, Date.now());
    uiStore.saveDeletedProfileIds();
    
    setupProfiles.value.splice(idx, 1);
    selectedSetupId.value = setupProfiles.value[0]?.id ?? '';
    applySelectedSetupProfile();
    await saveSetupsForCurrentRoot();
    
    if (backlogStore.syncService && profileToDelete.owner === currentUser.value) {
      try {
        await backlogStore.syncService.deleteProfile(profileToDelete.id);
      } catch (e) {
        console.error('Failed to delete profile from server', e);
      }
    }
  }

  function validatePaths() {
    return projectRoot.value.trim().length > 0 && startupProject.value.trim().length > 0;
  }

  function resolveArgs(args: string) {
    if (!args) return '';
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    
    const hms = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const ms = pad(Math.floor(now.getMilliseconds() / 10));
    const time8 = `${hms}${ms}`;
    const host6 = uiStore.localHostname.substring(0, 6).toUpperCase();

    return args.replace(/{time}/g, time8).replace(/{hostname}/g, host6).replace(/\s+/g, ' ').trim();
  }

  async function pickProjectFolder() {
    const picked = await invoke<string | null>('pick_project_folder');
    if (!picked) return;
    workspaceRoot.value = normalizePath(picked);
    console.log('[RunnerStore] Workspace root set to:', workspaceRoot.value);
    await saveUIState();
    await discoverProjects(true);
  }

  async function discoverProjects(autoSelect = false) {
    if (!workspaceRoot.value.trim()) return;
    try {
      const mapped = await invoke<Array<{
        name: string;
        root: string;
        startup_project: string;
        sln_count: number;
        csproj_count: number;
      }>>('discover_projects', { root: normalizePath(workspaceRoot.value.trim()) });
      discoveredProjects.value = mapped.map((x) => ({
        name: x.name,
        root: x.root,
        startupProject: x.startup_project,
        slnCount: x.sln_count,
        csprojCount: x.csproj_count,
      }));
      
      if (autoSelect && discoveredProjects.value.length > 0) {
        if (!projectRoot.value) {
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
    if (!selected) return;
    
    aliasExeName.value = '';
    runArgs.value = '';
    exeArgs.value = '';
    sqlSetupPath.value = '';
    isExeTestMode.value = false;
    
    projectRoot.value = normalizePath(selected.root);
    if (selected.startupProject) {
      startupProject.value = selected.startupProject;
    }

    if ((selected as any).foundBat) {
      const ws = workspaceRoot.value.replace(/[\\/]$/, '');
      batFilePath.value = normalizePath(`${ws}\\${(selected as any).foundBat}`);
      toast.info('Auto-discovered matching BAT file', { description: (selected as any).foundBat });
    }
    
    invoke('pty_write', { id: 'main', data: `cd '${projectRoot.value}'\r` }).catch(() => {});
    loadConfigsForCurrentProject();
  }

  async function loadConfigsForCurrentProject() {
    if (!projectRoot.value || !startupProject.value) return;
    
    try {
      const targetContent = await invoke('fetch_project_config', {
        projectRoot: projectRoot.value,
        startupProject: startupProject.value,
      }).catch(e => { console.warn('Failed to fetch target config', e); return null; });
      
      if (targetContent) {
        configTemplate.value = targetContent as string;
      }
      
      const runContent = await invoke('fetch_project_config', {
        projectRoot: 'D:\\workspace\\invoice\\Arkbell.Console\\Arkbell.Console.ReceiveBatchAction',
        startupProject: 'Arkbell.Console.ReceiveBatchAction.csproj',
      }).catch(e => { console.warn('Failed to fetch run config', e); return null; });

      if (runContent) {
        runConfigTemplate.value = runContent as string;
      }
      
      applyConfigSyncToTemplates();
    } catch (e: any) {
      console.error('Auto-sync configs failed:', e);
    }
  }

  function getSyncedTpl(tpl: string, isRunConfig = false) {
    if (!tpl) return tpl;
    
    let msmq = aliasExeName.value.replace(/\.exe$/i, '');
    const batIndex = activeBatConfigIndex.value || 0;
    const activeBatPath = batIndex === 0 ? batFilePath.value : (batFiles.value?.[batIndex - 1] || batFilePath.value);
    if (activeBatPath) {
      const m = activeBatPath.match(/([^\\]+)\.bat$/i);
      if (m) msmq = m[1];
    }

    let t = tpl;
    
    if (connectionStringTemplate.value && connectionStringTemplate.value.trim()) {
      const connStrSection = connectionStringTemplate.value.trim();
      const sectionMatch = /<connectionStrings>[\s\S]*?<\/connectionStrings>/i;
      if (sectionMatch.test(t)) {
        t = t.replace(sectionMatch, connStrSection);
      }
    }
    
    t = t.replace(/(<add\s+key="Job\.MsmqName"\s+value=")([^"]*)("\s*\/>)/gi, `$1${msmq}$3`);
    
    // For RUN CONFIG (EXE): use _isync bat path when forceUnicode is on
    let batPathForConfig = activeBatPath || '.\\';
    if (isRunConfig && forceUnicode.value && activeBatPath) {
      batPathForConfig = activeBatPath.replace(/\.bat$/i, '_isync.bat');
    }
    t = t.replace(/(<add\s+key="Job\.BatFilePath"\s+value=")([^"]*)("\s*\/>)/gi, `$1${batPathForConfig}$3`);
    
    if (sqlServer.value) {
      t = t.replace(/(<add\s+key="Report\.DBServer"\s+value=")([^"]*)("\s*\/>)/gi, `$1${sqlServer.value}$3`);
    }

    // Replace Execute.EnvId with dev environment value
    t = t.replace(/(<add\s+key="Execute\.EnvId"\s+value=")([^"]*)("\s*\/>)/gi, `$1Arkbell_Dev$3`);

    t = t.replace(new RegExp('(connectionString=")([^"]*)(")','gi'), (_match: string, pre: string, cs: string, post: string) => {
      const parts = cs.split(';').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      const kv: Record<string, string> = {};
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

      if (sqlServer.value) {
        if ('server' in kv) {
          setKey('Server', sqlServer.value);
          removeKey('Data Source');
        } else {
          setKey('Data Source', sqlServer.value);
        }
      }
      if (sqlDatabase.value) setKey('Initial Catalog', sqlDatabase.value);
      
      if (useWindowsAuth.value) {
        setKey('Integrated Security', 'True');
        removeKey('Trusted_Connection');
        removeKey('TrustedConnection');
        removeKey('User ID'); removeKey('Password'); removeKey('Uid'); removeKey('Pwd');
      } else {
        setKey('Integrated Security', 'False');
        removeKey('Trusted_Connection');
        removeKey('TrustedConnection');
        if (sqlUser.value) { setKey('User ID', sqlUser.value); setKey('Password', sqlPassword.value || ''); }
      }

      const resCs = keyOrder.map(k => `${(kv as any)['orig_' + k] || k}=${kv[k]}`).join(';') + (keyOrder.length > 0 ? ';' : '');
      return `${pre}${resCs}${post}`;
    });

    return t;
  }

  function applyConfigSyncToTemplates() {
    const nConf = getSyncedTpl(configTemplate.value);
    if (nConf !== configTemplate.value) configTemplate.value = nConf;
    const nRun = getSyncedTpl(runConfigTemplate.value, true);
    if (nRun !== runConfigTemplate.value) runConfigTemplate.value = nRun;
  }

  async function runDotnetAndCollect(mode: 'restore' | 'build') {
    const allProjects: { project: string; root: string; startup: string; config: string }[] = [];
    
    // Build only selected projects in checkbox
    for (const discovered of discoveredProjects.value) {
      if (discovered.startupProject && selectedBuildProjects.value.has(discovered.root)) {
        allProjects.push({
          project: discovered.startupProject,
          root: discovered.root,
          startup: discovered.startupProject,
          config: targetConfigs.value?.[discovered.startupProject] || config.value
        });
      }
    }
    
    // Fallback: if nothing selected, build all
    if (allProjects.length === 0) {
      for (const discovered of discoveredProjects.value) {
        if (discovered.startupProject) {
          allProjects.push({
            project: discovered.startupProject,
            root: discovered.root,
            startup: discovered.startupProject,
            config: targetConfigs.value?.[discovered.startupProject] || config.value
          });
        }
      }
    }
    
    for (let i = 0; i < allProjects.length; i++) {
      const proj = allProjects[i];
      
      const isAbsolute = /^[a-zA-Z]:\\/.test(proj.project) || proj.project.startsWith('/');
      
      let projectPath: string;
      let targetProjectRoot = proj.root;
      let targetStartupProject = proj.startup;
      let buildConfig: string = proj.config;
      
      if (isAbsolute) {
        projectPath = proj.project;
        targetProjectRoot = projectPath.substring(0, projectPath.lastIndexOf('\\'));
        targetStartupProject = projectPath.split('\\').pop() || '';
      } else if (proj.project.includes('\\') || proj.project.includes('/')) {
        const projectFileName = proj.project.split('\\').pop()?.split('/').pop();
        const discovered = discoveredProjects.value.find(d => 
          d.startupProject === projectFileName ||
          proj.project.endsWith('\\' + d.startupProject) ||
          proj.project.endsWith('/' + d.startupProject)
        );
        
        if (discovered && discovered.root) {
          projectPath = discovered.root + '\\' + projectFileName;
          targetProjectRoot = discovered.root;
          targetStartupProject = projectFileName || '';
          if (projectFileName && targetConfigs.value && targetConfigs.value[projectFileName]) {
            buildConfig = targetConfigs.value[projectFileName];
          }
        } else {
          projectPath = projectRoot.value + '\\' + proj.project;
          targetStartupProject = proj.project;
        }
      } else {
        projectPath = proj.root + '\\' + proj.project;
        if (targetConfigs.value && targetConfigs.value[proj.project]) {
          buildConfig = targetConfigs.value[proj.project];
        }
      }

      console.log(`[${mode}] Building ${targetStartupProject} (${buildConfig}) in ${targetProjectRoot}...`);
      
      try {
        const result = await invoke<{ code: number, stdout: string, stderr: string }>('dotnet_plain_command', {
          mode: mode,
          projectRoot: targetProjectRoot,
          startupProject: targetStartupProject,
          buildConfig: buildConfig,
        });

        if (result.code !== 0) {
           toast.error(`Background ${mode} failed for ${targetStartupProject}`, { description: result.stderr || result.stdout });
           if (mode === 'build') continue;
        }

        if (mode === 'build') {
          try {
            const targetContent = await invoke<string>('fetch_project_config', {
              projectRoot: targetProjectRoot,
              startupProject: targetStartupProject,
            });
            
            if (targetContent) {
              const synced = getSyncedTpl(targetContent);
              await invoke('write_project_config_output', {
                projectPath: projectPath,
                buildConfig: buildConfig,
                content: synced,
              });
              console.log(`[build] Overwrote synced config for ${targetStartupProject}`);
            }
          } catch (configErr) {
            console.warn(`[build] Failed to fetch/write config for ${targetStartupProject}`, configErr);
          }
        }
      } catch (err: any) {
        console.error(`[${mode}] Failed for ${targetStartupProject}:`, err);
      }
      
      if (mode === 'build') {
        await invoke('invalidate_build_fingerprint').catch(() => {});
      }
    }
  }

  async function dotnet(cmd: 'restore' | 'build' | 'run', target: 'exe' | 'bat' = 'exe', overrideArgs?: string) {
    const loadingKey = cmd === 'run' ? target : cmd;
    loadingTarget.value = loadingKey;
    
    saveCurrentToSelectedSetupProfile();
    if (!validatePaths()) {
      toast.error('Please enter projectRoot and startupProject');
      loadingTarget.value = null;
      return;
    }
    if (aliasExeName.value && !aliasExeName.value.toLowerCase().endsWith('.exe')) {
      aliasExeName.value += '.exe';
    }
    if (cmd === 'restore') {
      await runDotnetAndCollect('restore');
      loadingTarget.value = null;
      return;
    } else if (cmd === 'build') {
      await runDotnetAndCollect('build');
      loadingTarget.value = null;
      return;
    }
    
    // Build all projects before running (for both bat and exe targets)
    await runDotnetAndCollect('build');
    
    const isTestButton = cmd === 'run' && target === 'bat';
    const isExeTest = isTestButton && isExeTestMode.value;
    const actualTarget = isExeTest ? 'test_exe' : target;
    const fallbackArgs = isExeTest ? exeArgs.value : runArgs.value;
    const actualArgs = overrideArgs ?? (target === 'bat' && !isExeTest ? currentBatArgs.value : fallbackArgs);

    let runId = '';
    let runName = '';
    try {
      // Use shared terminal for bat and test_exe, separate for exe
      const useSharedTerminal = actualTarget === 'bat' || actualTarget === 'test_exe';
      if (actualTarget === 'exe' || actualTarget === 'test_exe' || actualTarget === 'bat') {
        runName = actualTarget === 'bat' ? 'BAT' : 'EXE';
        if (actualTarget === 'bat' && activeRunArgId.value) {
          const snip = runArgSnippets.value?.find(s => s.id === activeRunArgId.value);
          if (snip) runName = snip.name;
        } else if (actualTarget !== 'bat' && activeExeArgId.value) {
          const snip = exeArgSnippets.value?.find(s => s.id === activeExeArgId.value);
          if (snip) runName = snip.name;
        }

        if (useSharedTerminal) {
          runId = 'main';
          terminalStore.termState.active = 'main';
          nextTick(() => terminalStore.termState.main.fit?.fit());
        } else {
          runId = `run-1`;
          if (!terminalStore.termState.terminals.includes(runId)) {
            terminalStore.termState.terminals.push(runId);
            terminalStore.termState[runId] = { term: null as any, fit: null as any, name: runName };
          } else {
            terminalStore.termState[runId].name = runName;
          }
          terminalStore.termState.active = 'main';
          await nextTick();
          const el = document.getElementById('term-' + runId);
          if (el && !terminalStore.termState[runId].term) {
            await terminalStore.initPty(runId as any, el);
          }
          terminalStore.termState[runId].fit?.fit();
        }
      }

      // For bat/test target: only run selected BAT. For exe target: run all BATs
      const batIndex = activeBatConfigIndex.value || 0;
      const activeBatPath = batIndex === 0 ? batFilePath.value : (batFiles.value?.[batIndex - 1] || batFilePath.value);
      
      let allBats: string[] = [];
      if (!activeBatPath || !activeBatPath.trim()) {
        allBats = [];
      } else if (actualTarget === 'exe') {
        // Run all BATs for exe target
        allBats = [batFilePath.value, ...(batFiles.value || [])].filter(b => b && b.trim());
      } else {
        // Only run selected BAT for bat/test target
        allBats = [activeBatPath];
      }
      
      const tasks: { target: string, batPath: string | null, ptyId: string, name: string, args: string }[] = [];
      
      if (allBats.length === 0) {
        tasks.push({ target: actualTarget, batPath: null, ptyId: runId, name: runName, args: actualTarget === 'exe' ? '' : actualArgs });
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
            args: actualTarget === 'exe' ? '' : (i === 0 ? actualArgs : (batFilesArgs.value?.[i - 1] || ''))
          });
        }
      }

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        if (task.ptyId !== 'main' && terminalStore.termState[task.ptyId]) {
          terminalStore.termState[task.ptyId].name = task.name;
        }

        if (task.ptyId !== runId) {
          if (!terminalStore.termState.terminals.includes(task.ptyId)) {
            terminalStore.termState.terminals.push(task.ptyId);
            terminalStore.termState[task.ptyId] = { term: null as any, fit: null as any, name: task.name };
          }
          terminalStore.termState.active = 'main';

          await nextTick();
          const el = document.getElementById('term-' + task.ptyId);
          if (el && !terminalStore.termState[task.ptyId].term) {
            await terminalStore.initPty(task.ptyId as any, el);
          }
          terminalStore.termState[task.ptyId].fit?.fit();
          await new Promise(r => setTimeout(r, 1000));
        }

        const isAppRun = actualTarget === 'exe' || actualTarget === 'test_exe';
        
        let taskAliasExeName = aliasExeName.value;
        let taskConfigTemplate = configTemplate.value;
        let taskRunConfigTemplate = runConfigTemplate.value;
        
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

        await invoke('dotnet_run_start', {
          request: {
            projectRoot: projectRoot.value,
            startupProject: startupProject.value,
            urls: urls.value || null,
            buildConfig: config.value,
            aliasExeName: taskAliasExeName,
            batFilePath: task.batPath,
            target: task.target,
            configTemplate: taskConfigTemplate,
            sqlSetupPath: sqlSetupPath.value || null,
            sqlServer: sqlServer.value || null,
            sqlDatabase: sqlDatabase.value || null,
            sqlUser: sqlUser.value || null,
            sqlPassword: sqlPassword.value || null,
            sqlUseWindowsAuth: useWindowsAuth.value,
            runArgs: resolveArgs(task.args),
            deployPath: deployPath.value || null,
            runConfigTemplate: taskRunConfigTemplate,
            forceUnicode: forceUnicode.value,
            ptyId: task.ptyId,
            isAppRunning: running.value,
          },
        });
      }

      if (actualTarget === 'exe') {
        running.value = true;
        // Switch to the first run terminal so user sees exe output
        if (runId && runId !== 'main') {
          terminalStore.termState.active = runId;
          nextTick(() => terminalStore.termState[runId]?.fit?.fit());
        }
      }
    } catch (e: any) {
      toast.error(String(e));
      terminalStore.termState.active = 'main';
    } finally {
      loadingTarget.value = null;
    }
  }

  async function rebuild() {
    loadingTarget.value = 'rebuild';
    saveCurrentToSelectedSetupProfile();
    if (!validatePaths()) {
      toast.error('Please enter projectRoot and startupProject');
      loadingTarget.value = null;
      return;
    }
    try {
      await runDotnetAndCollect('build');
      toast.success('All projects rebuilt with synchronized configs!');
    } catch (e: any) {
      toast.error(String(e));
    } finally {
      loadingTarget.value = null;
    }
  }

  async function stop() {
    try {
      await invoke('dotnet_run_stop');
      running.value = false;
      terminalStore.termState.terminals = terminalStore.termState.terminals.filter((t: string) => t === 'main');
      terminalStore.termState.active = 'main';
      nextTick(() => terminalStore.termState.main.fit?.fit());
    } catch (e: any) {
      // Silent error
    }
  }

  async function browseBatFile(index?: number) {
    const defaultDir = `${workspaceRoot.value}\\batch`;
    const picked = await invoke('pick_file', { defaultPath: defaultDir }) as string | null;
    if (picked) {
      if (typeof index === 'number') {
        if (!batFiles.value) batFiles.value = [];
        batFiles.value[index] = picked;
      } else {
        batFilePath.value = picked;
      }
      
      if (!aliasExeName.value.trim()) {
        const filenameMatch = picked.match(/[^\\/]+$/);
        if (filenameMatch) {
          aliasExeName.value = filenameMatch[0].replace(/\.[^/.]+$/, '') + '.exe';
        }
      }
      const currentId = typeof index === 'number' ? (batFilesActiveArgIds.value?.[index] || '') : activeRunArgId.value;
      const s = runArgSnippets.value.find(x => x.id === currentId);
      if(s) s.batPath = picked;
      const s2 = exeArgSnippets.value.find(x => x.id === activeExeArgId.value);
      if(s2) s2.batPath = picked;
    }
  }

  async function runSqlOnly() {
    if (!sqlServer.value?.trim()) {
      toast.error('Please enter SQL Server');
      return;
    }
    if (!sqlDatabase.value?.trim()) {
      toast.error('Please enter Database name');
      return;
    }
    if (!useWindowsAuth.value && (!sqlUser.value?.trim() || !sqlPassword.value?.trim())) {
      toast.error('Please enter SQL Username/Password');
      return;
    }
    
    const activeSnippet = sqlSnippets.value.find(s => s.id === activeSqlSnippetId.value);
    const sqlContent = activeSnippet?.content || sqlSetupPath.value;
    
    if (!sqlContent || !sqlContent.trim()) {
      toast.error('Missing SQL content', {
        description: 'Please enter SQL code directly in the box below.'
      });
      return;
    }

    uiStore.showSqlResult = true;
    uiStore.isSqlRunning = true;
    uiStore.sqlResultData = { columns: [], rows: [] };
    
    try {
      const result = await executeSqlQuery(sqlContent.trim());
      uiStore.sqlResultData = result;
    } catch (e: any) {
      uiStore.sqlResultData = { columns: ['Error'], rows: [{ Error: String(e) }] };
    } finally {
      uiStore.isSqlRunning = false;
    }
  }

  async function getSqlTables(): Promise<{ name: string; schema: string }[]> {
    if (!sqlServer.value?.trim() || !sqlDatabase.value?.trim()) {
      return [];
    }
    try {
      const result = await invoke<{ name: string; schema: string }[]>('sql_get_tables', {
        server: sqlServer.value,
        database: sqlDatabase.value,
        user: sqlUser.value || '',
        password: sqlPassword.value || '',
        useWindowsAuth: useWindowsAuth.value
      });
      return result;
    } catch {
      return [];
    }
  }

  async function executeSqlQuery(sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
    const result = await invoke<{ columns: string[]; rows: Record<string, unknown>[] }>('sql_execute_async', {
      server: sqlServer.value,
      database: sqlDatabase.value,
      user: useWindowsAuth.value ? '' : (sqlUser.value || ''),
      password: useWindowsAuth.value ? '' : (sqlPassword.value || ''),
      useWindowsAuth: useWindowsAuth.value,
      sql
    });
    return result;
  }

  async function runAllSqlSnippets() {
    if (!sqlServer.value?.trim()) {
      toast.error('Please enter SQL Server');
      return;
    }
    if (!sqlDatabase.value?.trim()) {
      toast.error('Please enter Database name');
      return;
    }
    if (!useWindowsAuth.value && (!sqlUser.value?.trim() || !sqlPassword.value?.trim())) {
      toast.error('Please enter SQL Username/Password');
      return;
    }
    if (sqlSnippets.value.length === 0) {
      toast.error('No SQL Scripts found to run.');
      return;
    }

    let combinedSql = '';
    for (const snippet of sqlSnippets.value) {
      if (snippet.content.trim()) {
        combinedSql += `\r\nPRINT '----------------------------------------'\r\n`;
        combinedSql += `PRINT '--- Executing: ${snippet.name.replace(/'/g, "''")} ---'\r\n`;
        combinedSql += `PRINT '----------------------------------------'\r\nGO\r\n`;
        combinedSql += snippet.content.trim() + `\r\nGO\r\n`;
      }
    }

    if (!combinedSql.trim()) {
      toast.info('All scripts are empty.');
      return;
    }

    uiStore.showSqlResult = true;
    uiStore.isSqlRunning = true;
    uiStore.sqlResultData = { columns: ['Status'], rows: [{ Status: 'Running all scripts...' }] };
    
    try {
      const result = await executeSqlQuery(combinedSql);
      uiStore.sqlResultData = result;
    } catch (e: any) {
      uiStore.sqlResultData = { columns: ['Error'], rows: [{ Error: String(e) }] };
    } finally {
      uiStore.isSqlRunning = false;
    }
  }

  function onSnippetSelected(id: string | null) {
    if (!id) return;
    const snippet = sqlSnippets.value.find(s => s.id === id);
    if (snippet) {
      sqlSetupPath.value = snippet.content;
    }
  }

  function createNewSqlSnippet() {
    uiStore.namingSqlSnippetMode = 'create';
    uiStore.namingSqlSnippetValue = 'New Script';
    uiStore.isNamingSqlSnippet = true;
  }

  function renameActiveSqlSnippet() {
    uiStore.namingSqlSnippetMode = 'rename';
    const snippet = sqlSnippets.value.find(s => s.id === activeSqlSnippetId.value);
    uiStore.namingSqlSnippetValue = snippet?.name || '';
    uiStore.isNamingSqlSnippet = true;
  }

  function deleteActiveSqlSnippet() {
    const idx = sqlSnippets.value.findIndex(s => s.id === activeSqlSnippetId.value);
    if (idx === -1) return;
    if (!confirm(`Delete SQL script "${sqlSnippets.value[idx].name}"?`)) return;
    sqlSnippets.value.splice(idx, 1);
    if (sqlSnippets.value.length > 0) {
      activeSqlSnippetId.value = sqlSnippets.value[0].id;
      sqlSetupPath.value = sqlSnippets.value[0].content;
    } else {
      activeSqlSnippetId.value = '';
      sqlSetupPath.value = '';
    }
  }

  function commitSqlSnippetName() {
    const name = uiStore.namingSqlSnippetValue.trim();
    if (!name) return;

    if (uiStore.namingSqlSnippetMode === 'create') {
      const id = 'snippet_' + Date.now();
      sqlSnippets.value.push({ id, name, content: '' });
      activeSqlSnippetId.value = id;
      sqlSetupPath.value = '';
    } else {
      const snippet = sqlSnippets.value.find(s => s.id === activeSqlSnippetId.value);
      if (snippet) snippet.name = name;
    }
    
    uiStore.isNamingSqlSnippet = false;
  }

  function startNamingArgSnippet(mode: 'create' | 'rename', target: 'bat' | 'exe') {
    uiStore.namingArgSnippetMode = mode;
    uiStore.namingArgSnippetTarget = target;
    if (mode === 'create') {
      uiStore.namingArgSnippetValue = 'New Argument';
    } else {
      const list = target === 'bat' ? runArgSnippets.value : exeArgSnippets.value;
      const activeId = target === 'bat' ? currentBatArgId.value : activeExeArgId.value;
      const snippet = list.find(s => s.id === activeId);
      uiStore.namingArgSnippetValue = snippet?.name || '';
    }
    uiStore.isNamingArgSnippet = true;
  }

  function commitArgSnippetName() {
    const name = uiStore.namingArgSnippetValue.trim();
    if (!name) return;
    const target = uiStore.namingArgSnippetTarget;
    const list = target === 'bat' ? runArgSnippets.value : exeArgSnippets.value;

    if (uiStore.namingArgSnippetMode === 'create') {
      const id = 'arg_' + Date.now();
      list.push({ id, name, content: '', batConfigIndex: target === 'bat' ? activeBatConfigIndex.value : undefined, batPath: target === 'bat' ? (activeBatConfigIndex.value === 0 ? batFilePath.value : (batFiles.value?.[activeBatConfigIndex.value - 1] || '')) : undefined });
      if (target === 'bat') {
        currentBatArgId.value = id;
        currentBatArgs.value = '';
      } else {
        activeExeArgId.value = id;
        exeArgs.value = '';
      }
    } else {
      const activeId = target === 'bat' ? currentBatArgId.value : activeExeArgId.value;
      const snippet = list.find(s => s.id === activeId);
      if (snippet) snippet.name = name;
    }
    uiStore.isNamingArgSnippet = false;
  }

  function deleteActiveArgSnippet(target: 'bat' | 'exe') {
    const list = target === 'bat' ? runArgSnippets.value : exeArgSnippets.value;
    const activeId = target === 'bat' ? currentBatArgId.value : activeExeArgId.value;
    const idx = list.findIndex(s => s.id === activeId);
    if (idx === -1) return;
    if (!confirm(`Delete argument "${list[idx].name}"?`)) return;
    list.splice(idx, 1);
    
    if (target === 'bat') {
      if (currentBatArgSnippets.value.length > 0) {
        currentBatArgId.value = currentBatArgSnippets.value[0].id;
        currentBatArgs.value = currentBatArgSnippets.value[0].content;
      } else {
        currentBatArgId.value = '';
        currentBatArgs.value = '';
      }
    } else {
      if (list.length > 0) {
        activeExeArgId.value = list[0].id;
        exeArgs.value = list[0].content;
      } else {
        activeExeArgId.value = '';
        exeArgs.value = '';
      }
    }
  }

  function onArgSnippetSelected(target: 'bat' | 'exe', snippetId: string) {
    const list = target === 'bat' ? runArgSnippets.value : exeArgSnippets.value;
    const s = list.find(s => s.id === snippetId);
    if (s) {
      if (target === 'bat') {
        currentBatArgId.value = snippetId;
        currentBatArgs.value = s.content;
      } else {
        activeExeArgId.value = snippetId;
        exeArgs.value = s.content;
        if (s.batPath) batFilePath.value = s.batPath;
      }
    }
  }

  function removeBatConfig(idx: number) {
    if (!batFiles.value) return;
    batFiles.value.splice(idx, 1);
    const deletedIndex = idx + 1;
    runArgSnippets.value = runArgSnippets.value.filter(s => s.batConfigIndex !== deletedIndex);
    runArgSnippets.value.forEach(s => {
      if (s.batConfigIndex !== undefined && s.batConfigIndex > deletedIndex) {
        s.batConfigIndex -= 1;
      }
    });
    if (batFilesArgs.value) {
      batFilesArgs.value.splice(idx, 1);
    }
    if (batFilesActiveArgIds.value) {
      batFilesActiveArgIds.value.splice(idx, 1);
    }
    if (activeBatConfigIndex.value === deletedIndex) {
      activeBatConfigIndex.value = 0;
    } else if (activeBatConfigIndex.value > deletedIndex) {
      activeBatConfigIndex.value -= 1;
    }
  }

  async function browseTargetProject() {
    const defaultDir = projectRoot.value || workspaceRoot.value;
    const picked = await invoke('pick_file', { defaultPath: defaultDir, filters: [{ name: 'Project Files', extensions: ['csproj'] }] }) as string | null;
    if (picked) {
      if (!targetProjects.value) targetProjects.value = [];
      targetProjects.value.push(picked);
    }
  }

  function removeTargetProject(idx: number) {
    if (!targetProjects.value) return;
    targetProjects.value.splice(idx, 1);
  }

  function toggleBuildProject(root: string) {
    if (selectedBuildProjects.value.has(root)) {
      selectedBuildProjects.value.delete(root);
    } else {
      selectedBuildProjects.value.add(root);
    }
    selectedBuildProjects.value = new Set(selectedBuildProjects.value);
  }

  function selectBacklogIssue(issue: any) {
    backlogIssueKey.value = issue.issueKey;
    backlogIssueSummary.value = issue.summary;
    backlogIssueColor.value = issue.issueType?.color || '';
    backlogIssueStatusName.value = issue.status?.name || '';
    backlogIssueStatusColor.value = issue.status?.color || '';
    backlogIssueNotFound.value = false;
    saveCurrentToSelectedSetupProfile();
  }

  function unlinkBacklogIssue() {
    backlogIssueKey.value = '';
    backlogIssueSummary.value = '';
    backlogIssueColor.value = '';
    backlogIssueStatusName.value = '';
    backlogIssueStatusColor.value = '';
    backlogIssueNotFound.value = false;
    saveCurrentToSelectedSetupProfile();
  }

  function insertTimePlaceholder() {
    const placeholder = '{time}';
    const isExe = isExeTestMode.value;
    
    // Try to find the currently focused input
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | undefined;
    let input: HTMLInputElement | HTMLTextAreaElement | undefined;
    let inputVal: string;
    let setValue: (v: string) => void;
    
    if (isExe) {
      inputVal = exeArgs.value;
      setValue = (v) => { exeArgs.value = v; };
    } else {
      inputVal = runArgs.value;
      setValue = (v) => { runArgs.value = v; };
    }
    
    // Use active element if it's an input and belongs to our args
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      // Check if this is one of our args inputs by checking parent class
      if (activeEl.closest('.group\\/args')) {
        input = activeEl;
      }
    }
    
    // If no valid input found, fallback to append
    if (!input) {
      setValue(inputVal + ' ' + placeholder);
      return;
    }
    
    // Insert at cursor position
    const start = input.selectionStart ?? inputVal.length;
    const end = input.selectionEnd ?? start;
    const prefix = inputVal.substring(0, start);
    const suffix = inputVal.substring(end);
    const insertStr = (prefix.length > 0 && !prefix.endsWith(' ')) ? ' ' + placeholder : placeholder;
    const newVal = prefix + insertStr + suffix;
    
    setValue(newVal);
    
    nextTick(() => {
      input?.focus();
      const newPos = start + insertStr.length;
      input?.setSelectionRange(newPos, newPos);
    });
  }

  function insertHostnamePlaceholder() {
    const placeholder = '{hostname}';
    const isExe = isExeTestMode.value;
    
    // Try to find the currently focused input
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | undefined;
    let input: HTMLInputElement | HTMLTextAreaElement | undefined;
    let inputVal: string;
    let setValue: (v: string) => void;
    
    if (isExe) {
      inputVal = exeArgs.value;
      setValue = (v) => { exeArgs.value = v; };
    } else {
      inputVal = runArgs.value;
      setValue = (v) => { runArgs.value = v; };
    }
    
    // Use active element if it's an input and belongs to our args
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      // Check if this is one of our args inputs by checking parent class
      if (activeEl.closest('.group\\/args')) {
        input = activeEl;
      }
    }
    
    // If no valid input found, fallback to append
    if (!input) {
      setValue(inputVal + ' ' + placeholder);
      return;
    }
    
    // Insert at cursor position
    const start = input.selectionStart ?? inputVal.length;
    const end = input.selectionEnd ?? start;
    const prefix = inputVal.substring(0, start);
    const suffix = inputVal.substring(end);
    const insertStr = (prefix.length > 0 && !prefix.endsWith(' ')) ? ' ' + placeholder : placeholder;
    const newVal = prefix + insertStr + suffix;
    
    setValue(newVal);
    
    nextTick(() => {
      input?.focus();
      const newPos = start + insertStr.length;
      input?.setSelectionRange(newPos, newPos);
    });
  }

  async function exportProfileToDoc() {
    if (!selectedProfile.value) return;
    const p = selectedProfile.value;
    
    const content = `# Profile: ${p.name}
> Exported from BSN iSync on ${new Date().toLocaleString()}

## 1. General Configuration
- **Owner**: ${p.owner}
- **Workspace**: ${workspaceRoot.value || 'Not Set'}
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
        toast.success('Documentation exported successfully!', {
          description: `Saved to: ${path.split('\\').pop()}`,
          action: {
            label: 'Open File',
            onClick: () => invoke('open_file', { path })
          }
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Export failed', {
        description: String(err)
      });
    }
  }

  async function restoreVersion(v: any) {
    if (!selectedProfile.value) return;
    const content = typeof v.content === 'string' ? JSON.parse(v.content) : v.content;
    
    const idx = setupProfiles.value.findIndex(p => p.id === selectedSetupId.value);
    if (idx !== -1) {
      setupProfiles.value[idx] = { 
        ...content, 
        version: (content as any).version
      };
      applySelectedSetupProfile(true);
      await saveSetupsForCurrentRoot();
      toast.success(`Restored to version ${v.version}`);
      uiStore.isHistoryDialogOpen = false;
    }
  }

  let syncTimer: number | undefined;
  let lastSyncContext = { targetId: undefined as string | undefined, skipPush: false, manual: false };

  function triggerSync(id?: string, skipPush = false, manual = false) {
    if (syncTimer) clearTimeout(syncTimer);
    
    const effectiveId = (id && id.trim()) ? id : undefined;
    
    let currentTargetId: string | undefined = effectiveId;
    if (syncTimer && lastSyncContext.targetId !== effectiveId) {
      currentTargetId = undefined;
    }
    
    lastSyncContext = { targetId: currentTargetId, skipPush, manual };
    
    syncTimer = window.setTimeout(async () => {
      const context = { ...lastSyncContext };
      lastSyncContext = { targetId: undefined, skipPush: false, manual: false };
      
      if (context.skipPush) uiStore.syncStatus = 'idle';
      await syncProfilesWithCloudflare(context.targetId, context.skipPush, context.manual);
      syncTimer = undefined;
    }, 1000); 
  }

  function getProfileHashContent(p: any) {
    const { 
      updatedAt, version, sync, lastSyncedHash, isLocalEdited, 
      isExeTestMode, forceUnicode, autoWatchBat, autoWatchTargetTest, autoWatchTargetRun, 
      sqlServer, sqlDatabase, sqlUser, sqlPassword, useWindowsAuth, 
      configTemplate, runConfigTemplate, connectionStringTemplate, 
      backlogIssueColor, backlogIssueStatusName, backlogIssueStatusColor, backlogIssueNotFound, 
      ...rest 
    } = p || {};
    const clean: any = {};
    for (const k of Object.keys(rest).sort()) {
      if (rest[k] !== undefined && rest[k] !== null && rest[k] !== '') clean[k] = rest[k];
    }
    return JSON.stringify(clean);
  }

  async function syncProfilesWithCloudflare(targetId?: string, skipPush = false, manual = false) {
    if (!backlogStore.syncService) {
      uiStore.syncStatus = 'idle';
      return;
    }

    const isLazyPull = !!targetId && skipPush;
    const isTargetedSync = !!targetId && !skipPush;
    const isFullSync = !targetId;

    if (isLazyPull) uiStore.isFetchingProfile = true;

    let pullCount = 0;
    let pushCount = 0;
    
    try {
      const localMap = new Map(setupProfiles.value.map(p => [p.id, p]));
      let profilesChanged = false;
      let backlogChanged = false;
      let currentProfilePulled = false;

        const processPulledProfile = async (cpId: string, cpVersion: number, content: any, local: ProjectProfile | undefined) => {
        const cloudHashable = getProfileHashContent(content);
        const lastHash = local?.lastSyncedHash || uiStore.profileHashes.get(cpId);
        const cloudChanged = !lastHash || lastHash !== cloudHashable;

        const localOwnerMatches = local?.owner === currentUser.value;
        const hasLocalEdits = local?.isLocalEdited === true;

        console.log('[Sync] processPulledProfile:', {
          cpId,
          localExists: !!local,
          localOwner: local?.owner,
          currentUser: currentUser.value,
          localOwnerMatches,
          hasLocalEdits,
          cloudChanged,
        });

        if (local && local.owner !== currentUser.value) {
          if (!manual && !cloudChanged) {
            const idx = setupProfiles.value.findIndex(p => p.id === cpId);
            if (idx !== -1) {
              setupProfiles.value[idx].version = cpVersion;
              setupProfiles.value[idx].lastSyncedHash = cloudHashable;
              uiStore.profileHashes.set(cpId, cloudHashable);
              profilesChanged = true;
            }
            return;
          }

          if (local.isLocalEdited) {
            const action = await new Promise<'sync' | 'clone' | 'cancel'>((resolve) => {
              syncConflictDialog.profileName = local.name;
              syncConflictDialog.cloudChanged = cloudChanged;
              syncConflictDialog.resolve = resolve;
              syncConflictDialog.isOpen = true;
            });
            
            syncConflictDialog.isOpen = false;
            await new Promise(r => setTimeout(r, 300));
            
            if (action === 'cancel') return;
            
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
        } else if (local && local.owner === currentUser.value && local.isLocalEdited) {
          console.log('[Sync] Showing conflict dialog for:', local.name);
          const action = await new Promise<'sync' | 'clone' | 'cancel'>((resolve) => {
            syncConflictDialog.profileName = local.name;
            syncConflictDialog.cloudChanged = cloudChanged;
            syncConflictDialog.resolve = resolve;
            syncConflictDialog.isOpen = true;
          });
          
          console.log('[Sync] Dialog action:', action);
          syncConflictDialog.isOpen = false;
          await new Promise(r => setTimeout(r, 300));
          
          if (action === 'cancel') return;
          
          if (action === 'clone') {
            const clone = JSON.parse(JSON.stringify(local));
            clone.id = makeProfileId();
            clone.name = `${clone.name} (Local Edits)`;
            delete clone.version;
            delete clone.isLocalEdited;
            setupProfiles.value.push(clone);
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
        uiStore.profileHashes.set(cpId, contentHash);
        
        const pIdx = setupProfiles.value.findIndex(p => p.id === cpId);
        if (pIdx !== -1) {
          setupProfiles.value[pIdx].lastSyncedHash = contentHash;
        }
        
        profilesChanged = true;
        if (cpId === selectedSetupId.value) currentProfilePulled = true;
        pullCount++;
      };

      if (isLazyPull) {
        const cloudProfile = await backlogStore.syncService.getProfile(targetId!);
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
        const cloudMetas = await backlogStore.syncService.getProfiles();
        const profilesToPull: string[] = [];

        for (const meta of cloudMetas) {
          if (meta.name === 'Global Backlog Settings') {
            console.log('[Sync] Deleting leaked OAuth profile from cloud:', meta.name);
            await backlogStore.syncService.deleteProfile(meta.id).catch(() => {});
            continue;
          }

          if (isTargetedSync && meta.id !== targetId) continue;

          const deletedAt = uiStore.deletedProfileIds.get(meta.id);
          if (deletedAt) continue;

          const local = localMap.get(meta.id);
          const serverVersion = Number(meta.version) || 0;
          const localVersion = Number(local?.version) || 0;
          if (!local || serverVersion > localVersion || manual) {
            profilesToPull.push(meta.id);
          }
        }

        if (isFullSync) {
          const cloudIds = new Set(cloudMetas.map((m: any) => m.id));
          
          let tombstoneChanged = false;
          uiStore.deletedProfileIds.forEach((_, id) => {
             if (!cloudIds.has(id)) {
               uiStore.deletedProfileIds.delete(id);
               tombstoneChanged = true;
             }
          });
          if (tombstoneChanged) uiStore.saveDeletedProfileIds();

          const toRemoveLocally = setupProfiles.value.filter(p => 
            p.owner !== 'Guest' && 
            p.version !== undefined &&
            !cloudIds.has(p.id) && 
            !uiStore.deletedProfileIds.has(p.id)
          );

          if (toRemoveLocally.length > 0) {
            uiStore.syncStatus = 'saving';
            console.log(`[Sync] Removing ${toRemoveLocally.length} profiles deleted on other machines.`);
            setupProfiles.value = setupProfiles.value.filter(p => !toRemoveLocally.includes(p));
            profilesChanged = true;
          }
        }
        
        const emptyDefaultIdx = setupProfiles.value.findIndex(p => p.name === 'Default' && !p.projectRoot && !p.startupProject);
        if (emptyDefaultIdx !== -1 && setupProfiles.value.length > 1) {
          const removedId = setupProfiles.value[emptyDefaultIdx].id;
          setupProfiles.value.splice(emptyDefaultIdx, 1);
          profilesChanged = true;
          if (selectedSetupId.value === removedId) {
            selectedSetupId.value = setupProfiles.value[0].id;
          }
        }
      }

      if (!skipPush) {
        const pushProfile = async (p: ProjectProfile) => {
          if (p.owner !== currentUser.value) return;

          if (p.name === 'Default' && !p.projectRoot && !p.startupProject) return;

          const currentContentStr = getProfileHashContent(p);
          const lastHash = p.lastSyncedHash || uiStore.profileHashes.get(p.id);
          if (lastHash === currentContentStr) return;

          const meta = await backlogStore.syncService!.getProfile(p.id);
          const serverVer = Number(meta?.version) || 0;
          const localVer = Number(p.version) || 0;

          if (localVer >= serverVer || !meta) {
             uiStore.syncStatus = 'saving';
             const { sync: _sync, lastSyncedHash: _lsh, isLocalEdited: _ile, isExeTestMode: _ietm, forceUnicode: _f, autoWatchBat: _awb, autoWatchTargetTest: _awtt, autoWatchTargetRun: _awtr, sqlServer: _ss, sqlDatabase: _sdb, sqlUser: _su, sqlPassword: _sp, useWindowsAuth: _uwa, configTemplate: _ct, runConfigTemplate: _rct, connectionStringTemplate: _cst, backlogIssueColor: _bic, backlogIssueStatusName: _bisn, backlogIssueStatusColor: _bisc, backlogIssueNotFound: _binf, ...payloadToSync } = p as any;
             const result = await backlogStore.syncService!.upsertProfile({
               id: p.id,
               name: p.name,
               content: payloadToSync,
               version: localVer
             });
             if (result.success && result.version) {
               p.version = result.version;
               p.lastSyncedHash = currentContentStr;
               uiStore.profileHashes.set(p.id, currentContentStr);
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

      uiStore.lastSyncTime = Date.now();
      if (pullCount > 0 || pushCount > 0 || manual) {
        uiStore.syncStatus = 'saved';
        if (manual || isFullSync) {
           toast.success(`Sync complete: ${pullCount} pulled, ${pushCount} pushed.`);
        }
        setTimeout(() => { if (uiStore.syncStatus === 'saved') uiStore.syncStatus = 'idle'; }, 3000);
      } else {
        if (uiStore.syncStatus !== 'idle') uiStore.syncStatus = 'idle';
      }
    } catch (e) {
      console.error('Sync failed', e);
      uiStore.syncStatus = 'error';
      if (manual) toast.error('Sync failed', { description: String(e) });
    } finally {
      uiStore.isFetchingProfile = false;
    }
  }

  const syncConflictDialog = reactive({
    isOpen: false,
    profileName: '',
    cloudChanged: false,
    resolve: null as ((value: 'sync' | 'clone' | 'cancel') => void) | null,
  });

  let unwatchBatFile: any;
  let unwatchTargetDir: any;

  async function setupTargetWatcher() {
    if (unwatchTargetDir) {
      unwatchTargetDir();
      unwatchTargetDir = undefined;
    }
    
    if (!autoWatchTargetTest.value && !autoWatchTargetRun.value) return;
    if (!startupProject.value) return;

    const targetDir = startupProject.value.replace(/[\\/][^\\/]+$/, '');
    if (!targetDir) return;

    const targetDirExists = await exists(targetDir).catch(() => false);
    if (!targetDirExists) return;

    try {
      unwatchTargetDir = await fsWatch(targetDir, (event: any) => {
        const typeStr = JSON.stringify(event.type);
        if (typeStr.includes('modify') || typeStr.includes('any')) {
          const paths = event.paths || [];
          const isCodeChange = paths.some((p: string) => p.endsWith('.cs') || p.endsWith('.csproj') || p.endsWith('.json') || p.endsWith('.config'));
          
          if (isCodeChange) {
            if (autoWatchTargetTest.value && !loadingTarget.value && !buildStatus.value) {
              uiStore.notify('BSN iSync', 'Target code changed. Auto-running test...');
              dotnet('run', 'bat');
            } else if (autoWatchTargetRun.value && running.value && !loadingTarget.value && !buildStatus.value) {
              uiStore.notify('BSN iSync', 'Target code changed. Auto-restarting app...');
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
      console.error('Failed to watch target dir', e);
    }
  }

  async function setupBatWatcher() {
    console.log('[BatWatcher] ===== setupBatWatcher START =====');
    console.log('[BatWatcher] autoWatchTargetTest:', autoWatchTargetTest.value, 'autoWatchTargetRun:', autoWatchTargetRun.value);
    console.log('[BatWatcher] batFilePath:', batFilePath.value);
    console.log('[BatWatcher] batFiles:', batFiles.value);
    
    if (unwatchBatFile) {
      console.log('[BatWatcher] Cleaning up existing watcher');
      unwatchBatFile();
      unwatchBatFile = undefined;
    }
    
    if (!autoWatchTargetTest.value && !autoWatchTargetRun.value) {
      console.log('[BatWatcher] Watch disabled, returning');
      return;
    }
    
    const filesToWatch = [batFilePath.value, ...(batFiles.value || [])].filter(b => b && b.trim());
    console.log('[BatWatcher] filesToWatch:', filesToWatch);
    
    if (filesToWatch.length === 0) {
      console.log('[BatWatcher] No files to watch');
      return;
    }

    const validFiles: string[] = [];
    for (const f of filesToWatch) {
      console.log('[BatWatcher] Checking file:', f);
      try {
        const fileExists = await exists(f);
        console.log('[BatWatcher] exists (original path):', fileExists);
        if (fileExists) {
          validFiles.push(f);
        } else {
          const normalizedPath = f.replace(/\\/g, '/');
          const normalizedExists = await exists(normalizedPath);
          console.log('[BatWatcher] exists (normalized):', normalizedExists);
          if (normalizedExists) {
            validFiles.push(normalizedPath);
          }
        }
      } catch (e) {
        console.error('[BatWatcher] exists error:', e);
      }
    }

    console.log('[BatWatcher] validFiles:', validFiles);

    if (validFiles.length === 0) {
      console.log('[BatWatcher] No valid files to watch');
      return;
    }

    console.log('[BatWatcher] Calling fsWatch with:', validFiles);
    
    try {
      unwatchBatFile = await fsWatchImmediate(validFiles, (event: any) => {
        console.log('[BatWatcher] ===== FILE CHANGE DETECTED (immediate) =====');
        console.log('[BatWatcher] event:', JSON.stringify(event));
        
        const type = event?.type || event?.kind;
        const paths = event?.paths || [];
        console.log('[BatWatcher] type:', JSON.stringify(type), 'paths:', paths);
        
        const hasModify = type && (type.modify || type.any || type.create || type.remove);
        console.log('[BatWatcher] hasModify:', hasModify);
        
        if (hasModify) {
          const matchingPath = paths.find((p: string) => validFiles.some(vf => p.includes(vf)));
          console.log('[BatWatcher] matchingPath:', matchingPath);
          
          if (matchingPath) {
            console.log('[BatWatcher] Triggering auto-run, autoWatchTargetTest:', autoWatchTargetTest.value, 'loadingTarget:', loadingTarget.value, 'buildStatus:', buildStatus.value);
            if (autoWatchTargetTest.value && !loadingTarget.value && !buildStatus.value) {
              uiStore.notify('BSN iSync', 'BAT file changed. Auto-running test...');
              dotnet('run', 'bat');
            } else if (autoWatchTargetRun.value && running.value && !loadingTarget.value && !buildStatus.value) {
              uiStore.notify('BSN iSync', 'BAT file changed. Auto-restarting app...');
              stop().then(() => {
                setTimeout(() => {
                  dotnet('run', 'exe');
                }, 1000);
              });
            }
          }
        }
      }, { recursive: false });
      console.log('[BatWatcher] fsWatch started, unwatchBatFile:', unwatchBatFile);
    } catch (e) {
      console.error('[BatWatcher] ERROR:', e);
    }
    console.log('[BatWatcher] ===== setupBatWatcher END =====');
  }

  async function saveUIState() {
    try {
      backlogStore.backlog.updatedAt = Date.now();
      const state = {
        activeTab: uiStore.activeTab,
        dark: uiStore.isDarkMode,
        selectedSetupId: selectedSetupId.value,
        selectedOwner: selectedOwner.value,
        profileScope: profileScope.value,
        workspaceRoot: workspaceRoot.value,
        isNotificationEnabled: uiStore.isNotificationEnabled,
        isTerminalHistoryEnabled: uiStore.isTerminalHistoryEnabled,
        shortcuts: shortcuts.value,
        backlog: {
          host: backlogStore.backlog.host,
          apiKey: backlogStore.backlog.apiKey,
          token: backlogStore.backlog.token,
          profile: backlogStore.backlog.profile,
          updatedAt: backlogStore.backlog.updatedAt,
        }
      };
      console.log('[RunnerStore] saveUIState called, workspaceRoot:', workspaceRoot.value);
      await setItem('ui_state', state);
      console.log('[RunnerStore] UI state saved successfully');
    } catch (e) {
      console.error('[RunnerStore] Failed to save UI state:', e);
    }
  }

  async function loadWorkspaceRoot() {
    const savedWorkspaceRoot = window.localStorage.getItem('bsn_isync:workspace_root');
    if (savedWorkspaceRoot) {
      workspaceRoot.value = savedWorkspaceRoot;
      console.log('[RunnerStore] Loaded workspaceRoot from localStorage:', savedWorkspaceRoot);
    }
  }

  async function loadUIState() {
    console.log('[RunnerStore] Loading UI State...');
    try {
      const savedProjectKey = window.localStorage.getItem('backlog_last_project');
      if (savedProjectKey) {
        backlogProjectKey.value = savedProjectKey;
        console.log('[RunnerStore] Loaded backlogProjectKey from localStorage:', savedProjectKey);
      }

      const state = await getItem<any>('ui_state');
      if (!state) {
        console.log('[RunnerStore] No UI state found in store.');
        return;
      }
      console.log('[RunnerStore] UI State loaded:', JSON.stringify(state, null, 2));
      if (state.activeTab) uiStore.activeTab = state.activeTab;
      if (state.dark !== undefined) {
        uiStore.isDarkMode = state.dark;
        const el = document.documentElement;
        if (uiStore.isDarkMode) el.classList.add('dark');
        else el.classList.remove('dark');
      }
      if (state.selectedSetupId) selectedSetupId.value = state.selectedSetupId;
      if (state.selectedOwner) selectedOwner.value = state.selectedOwner;
      if (state.profileScope) profileScope.value = state.profileScope;
      if (state.workspaceRoot) workspaceRoot.value = state.workspaceRoot;
      if (state.isNotificationEnabled !== undefined) uiStore.isNotificationEnabled = state.isNotificationEnabled;
      if (state.isTerminalHistoryEnabled !== undefined) uiStore.isTerminalHistoryEnabled = state.isTerminalHistoryEnabled;
      if (state.shortcuts) {
        Object.assign(shortcuts.value, {
          test: 'Alt+Shift+T',
          run: 'Alt+Shift+R',
          build: 'Alt+Shift+B',
          rebuild: 'Alt+Shift+U',
          stop: 'Alt+Shift+S',
          ...state.shortcuts
        });
      }
      if (state.backlog) {
        if (state.backlog.host) backlogStore.backlog.host = state.backlog.host;
        if (state.backlog.token) {
          const token = state.backlog.token;
          backlogStore.backlog.token = token;
          if (token.access_token && !token.expires_at && token.expires_in) {
            token.expires_at = Date.now() + (token.expires_in * 1000);
          }
        }
        if (state.backlog.profile) {
          backlogStore.backlog.profile = state.backlog.profile;
          backlogStore.backlog.status = 'success';
          if (!selectedOwner.value || selectedOwner.value === 'Guest') {
             selectedOwner.value = currentUser.value;
          }
          backlogStore.loadBacklogIssues();
        } else if (backlogStore.backlog.token?.access_token) {
          backlogStore.backlog.status = 'loading';
          const token = backlogStore.backlog.token;
          const res = await fetchBacklogProfileWithToken({
            host: backlogStore.backlog.host,
            accessToken: token.access_token,
          });
          if (res.status === 'success') {
            backlogStore.backlog.profile = res.profile;
            backlogStore.backlog.status = 'success';
            if (!selectedOwner.value || selectedOwner.value === 'Guest') {
              selectedOwner.value = currentUser.value;
            }
            backlogStore.loadBacklogIssues();
            saveUIState();
          } else {
            backlogStore.backlog.status = 'error';
            backlogStore.backlog.error = res.error;
          }
        }
      }
    } catch (e) {
      console.error('[Store] Failed to load UI state', e);
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
    if (uiStore.isRecordingShortcut) return;
    uiStore.isRecordingShortcut = true;
    uiStore.recordingAction = action;
    window.addEventListener('keydown', handleShortcutKeydown, true);
    toast.info(`Recording shortcut... Press any combination for ${action.toUpperCase()}`, { duration: 4000 });
  }

  function stopRecordingShortcut() {
    uiStore.isRecordingShortcut = false;
    uiStore.recordingAction = null;
    window.removeEventListener('keydown', handleShortcutKeydown, true);
  }

  async function handleShortcutKeydown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      stopRecordingShortcut();
      toast.info('Recording cancelled');
      return;
    }

    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const shortcut = formatTauriShortcut(e);
    if (shortcut && uiStore.recordingAction) {
      const action = uiStore.recordingAction;
      const oldShortcut = shortcuts.value[action];
      shortcuts.value[action] = shortcut;
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
            uiStore.notify('BSN iSync', `${action.toUpperCase()} triggered via shortcut`);
          }
        });
      }
    } catch (e) {
      console.error('Failed to update global shortcut:', e);
    }
  }

  async function registerAllShortcuts() {
    for (const [action, shortcut] of Object.entries(shortcuts.value)) {
      if (shortcut) {
        await updateGlobalShortcut(action, shortcut);
      }
    }
  }

  async function unregisterAllShortcuts() {
    for (const shortcut of Object.values(shortcuts.value)) {
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
    Object.assign(shortcuts.value, defaults);
    await registerAllShortcuts();
    saveUIState();
    toast.success('All shortcuts reset to defaults');
  }

  watch(() => forceUnicode.value, (val) => {
    localStorage.setItem('bsn_isync:global_force_unicode', String(val));
  });

  watch(() => autoWatchBat.value, (val) => {
    localStorage.setItem('bsn_isync:global_watch_bat', String(val));
  });

  watch(() => autoWatchTargetTest.value, (val) => {
    localStorage.setItem('bsn_isync:global_watch_test', String(val));
  });

  watch(() => autoWatchTargetRun.value, (val) => {
    localStorage.setItem('bsn_isync:global_watch_run', String(val));
  });

console.log('[Store] useRunnerStore initializing');
console.log('[Watch] registering watchers');
  watch(() => [autoWatchTargetTest.value, autoWatchTargetRun.value, batFilePath.value, batFiles.value], () => {
    console.log('[Watch] batFilePath changed, calling setupBatWatcher');
    setupBatWatcher();
  }, { deep: true, immediate: true });

  watch(() => [autoWatchTargetTest.value, autoWatchTargetRun.value, startupProject.value], () => {
    console.log('[Watch] startupProject changed, calling setupTargetWatcher');
    setupTargetWatcher();
  }, { deep: true, immediate: true });
console.log('[Store] watchers registered');

  let sqlCheckTimeout: any;

  watch(
    () => [sqlServer.value, sqlDatabase.value, sqlUser.value, sqlPassword.value, useWindowsAuth.value],
    () => {
      if (!sqlServer.value || !sqlDatabase.value) {
        backlogStore.sqlConnStatus = 'idle';
        return;
      }
      if (sqlCheckTimeout) clearTimeout(sqlCheckTimeout);
      sqlCheckTimeout = setTimeout(() => backlogStore.checkSqlConnection(sqlServer.value, sqlDatabase.value, sqlSetupPath.value), 3000);
    },
    { deep: true }
  );

  async function checkSqlConnectionOnStartup() {
    if (!sqlServer.value || !sqlDatabase.value) {
      toast.warning('SQL Server Not Configured', {
        description: 'Please set up SQL Server name and database in the Workspace SQL bar.',
        duration: 10000,
      });
    } else {
      await backlogStore.checkSqlConnection(sqlServer.value, sqlDatabase.value, sqlSetupPath.value);
      if (backlogStore.sqlConnStatus === 'error') {
        toast.warning('SQL Connection Failed', {
          description: backlogStore.sqlErrorMsg || 'Cannot connect to SQL server. Please check your settings.',
          duration: 10000,
        });
      }
    }
  }

  watch(() => backlogProjectKey.value, async (newKey) => {
    if (newKey) {
      window.localStorage.setItem('backlog_last_project', newKey);
      console.log('[RunnerStore] backlogProjectKey changed to:', newKey);
      console.log('[RunnerStore] backlog projects count:', backlogStore.backlog.projects.length);
      
      void backlogStore.loadBacklogIssueTypes(newKey);
      
      if (backlogStore.backlog.projects.length === 0) {
        console.log('[RunnerStore] Projects empty, loading...');
        await backlogStore.loadBacklogProjects();
      }
      
      const project = backlogStore.backlog.projects.find(p => p.projectKey === newKey);
      console.log('[RunnerStore] Found project:', project);
      void backlogStore.loadBacklogIssues(project?.id);
    } else {
      backlogStore.backlog.issueTypes = [];
      backlogStore.loadedIssueTypesProjectKey = null;
      backlogStore.backlog.issues = [];
    }
  });

  watch(
    () => [
      aliasExeName.value, batFilePath.value, batFiles.value, activeBatConfigIndex.value, sqlServer.value, sqlDatabase.value, 
      connectionStringTemplate.value, useWindowsAuth.value, sqlUser.value, sqlPassword.value
    ], 
    applyConfigSyncToTemplates,
    { deep: true }
  );

  watch(() => batFilePath.value, (newPath) => {
    if (newPath) {
      const filenameMatch = newPath.match(/[^\\/]+$/);
      if (filenameMatch) {
        aliasExeName.value = filenameMatch[0].replace(/\.[^/.]+$/, '') + '.exe';
      }
    } else {
      aliasExeName.value = '';
    }
  });

  watch(() => sqlServer.value, (val) => localStorage.setItem('bsn_isync:global_sql_server', val || ''));
  watch(() => sqlDatabase.value, (val) => localStorage.setItem('bsn_isync:global_sql_db', val || ''));
  watch(() => sqlUser.value, (val) => localStorage.setItem('bsn_isync:global_sql_user', val || ''));
  watch(() => sqlPassword.value, (val) => localStorage.setItem('bsn_isync:global_sql_pass', val || ''));
  watch(() => useWindowsAuth.value, (val) => localStorage.setItem('bsn_isync:global_sql_winauth', String(val)));

  watch([selectedOwner, profileSearch, profileScope, setupProfiles], () => {
    ensureVisibleSelection();
  }, { deep: true });

  watch([uiStore.activeTab, uiStore.isDarkMode, selectedSetupId, selectedOwner, profileScope, () => workspaceRoot.value, () => backlogStore.backlog.host, () => backlogStore.backlog.apiKey, () => backlogStore.backlog.token, () => backlogStore.backlog.profile], () => {
    window.localStorage.setItem('bsn_isync:workspace_root', workspaceRoot.value);
    saveUIState();
  }, { deep: true });

  watch(currentUser, (newVal) => {
    if (newVal && newVal !== 'Guest') {
      const migrated = setupProfiles.value.map(p => {
        if (!p.owner || p.owner === 'Guest' || p.owner === 'ngtuonghy') {
          return { ...p, owner: newVal };
        }
        return p;
      });
      
      if (JSON.stringify(migrated) !== JSON.stringify(setupProfiles.value)) {
        setupProfiles.value = migrated;
        saveSetupsForCurrentRoot();
      }
      
      if (!selectedOwner.value || selectedOwner.value === 'Guest' || selectedOwner.value === 'ngtuonghy') {
        selectedOwner.value = newVal;
      }
    }
  }, { immediate: true });

  watch(() => backlogStore.backlog.status, (newStatus, oldStatus) => {
    if (newStatus === 'success' && oldStatus !== 'success') {
      void syncProfilesWithCloudflare(undefined, true, false);
    }
  });

  watch(selectedSetupId, (next, prev) => {
    if (next && next !== prev) {
      applySelectedSetupProfile(true);
      void syncProfilesWithCloudflare(next, true, false);
    }
  });

  let isSavingProfile = false;
  watch(
    () => [
      projectRoot.value, startupProject.value, config.value, urls.value, aliasExeName.value,
      batFilePath.value, runArgs.value, exeArgs.value, isExeTestMode.value,
      sqlSetupPath.value, deployPath.value, backlogProjectKey.value, backlogIssueKey.value,
      JSON.stringify(batFiles.value), JSON.stringify(runArgSnippets.value), JSON.stringify(exeArgSnippets.value)
    ],
    () => {
      if (selectedSetupId.value && !isSavingProfile && !uiStore.isApplyingProfile) {
        isSavingProfile = true;
        saveCurrentToSelectedSetupProfile();
        triggerSync(selectedSetupId.value);
        setTimeout(() => { isSavingProfile = false; }, 100);
      }
    },
    { deep: true }
  );

  watch(() => uiStore.isTerminalHistoryEnabled, (enabled) => {
    const cmd = enabled 
      ? `Set-PSReadLineOption -HistorySaveStyle SaveIncrementally\r` 
      : `Set-PSReadLineOption -HistorySaveStyle SaveNothing\r`;
    
    terminalStore.termState.terminals.forEach((tId: string) => {
      if (terminalStore.termState[tId]?.term) {
        invoke('pty_write', { id: tId, data: cmd }).catch(() => {});
      }
    });
    saveUIState();
  });

  watch(() => uiStore.isNotificationEnabled, () => {
    saveUIState();
  });

  watch(() => backlogIssueKey.value, async (key) => {
    if (key) {
      const issue = await backlogStore.checkCurrentBacklogIssue(key);
      if (issue) {
        backlogIssueColor.value = issue.issueType?.color || '';
        backlogIssueStatusName.value = issue.status?.name || '';
        backlogIssueStatusColor.value = issue.status?.color || '';
        backlogIssueSummary.value = issue.summary;
        backlogIssueNotFound.value = false;
      } else {
        backlogIssueNotFound.value = true;
      }
    }
  });

  // Listen for build-status and runner-log events from Rust backend
  listen<string>('build-status', (event) => {
    const status = event.payload;
    if (status === 'done' || status === 'error') {
      buildStatus.value = null;
    } else {
      buildStatus.value = status;
    }
  });

  listen<string>('runner-log', (event) => {
    const msg = event.payload;
    logs.value.push(msg);
  });

  return {
    workspaceRoot,
    projectRoot,
    startupProject,
    targetProjects,
    targetConfigs,
    urls,
    config,
    aliasExeName,
    batFilePath,
    batFiles,
    activeBatConfigIndex,
    batFilesActiveArgIds,
    batFilesArgs,
    runArgs,
    exeArgs,
    isExeTestMode,
    forceUnicode,
    autoWatchBat,
    autoWatchTargetTest,
    autoWatchTargetRun,
    sqlSetupPath,
    sqlServer,
    sqlDatabase,
    sqlUser,
    sqlPassword,
    useWindowsAuth,
    sqlSnippets,
    activeSqlSnippetId,
    runArgSnippets,
    activeRunArgId,
    selectedRunArgIds,
    exeArgSnippets,
    activeExeArgId,
    selectedExeArgIds,
    buildStatus,
    configTemplate,
    runConfigTemplate,
    connectionStringTemplate,
    running,
    loadingTarget,
    logs,
    childPid,
    backlogProjectKey,
    backlogIssueTypeId,
    backlogIssueKey,
    backlogIssueSummary,
    backlogIssueColor,
    backlogIssueStatusName,
    backlogIssueStatusColor,
    backlogIssueNotFound,
    shortcuts,
    autoDeployConfig,
    deployPath,
    discoveredProjects,
    getTargetProjectName,
    selectedProjectRoot,
    selectedBuildProjects,
    toggleBuildProject,
    buildProjectSearch,
    filteredBuildProjects,
    setupProfiles,
    selectedSetupId,
    editableProfileName,
    profileSearch,
    profileScope,
    selectedOwner,
    ownerSearch,
    projectSearch,
    issueSearchQuery,
    preventAutoSearch,
    profileNameInput,
    argsInputRefBat,
    argsInputRefExe,
    sync,
    syncConflictDialog,
    currentUser,
    canBuild,
    canTest,
    canRun,
    canEditSelected,
    canExecuteSelected,
    currentBatArgId,
    currentBatArgs,
    currentBatArgSnippets,
    ownerOptions,
    filteredOwnerOptions,
    filteredDiscoveredProjects,
    visibleProfiles,
    scopedProfiles,
    selectedProfile,
    filteredBacklogIssues,
    backlogIssueUrl,
    initials,
    makeProfileId,
    normalizePath,
    setupStorageKey,
    buildSetupFromRunner,
    applySetupToRunner,
    loadSetupsForCurrentRoot,
    saveSetupsForCurrentRoot,
    ensureVisibleSelection,
    applySelectedSetupProfile,
    saveCurrentToSelectedSetupProfile,
    focusProfileName,
    commitProfileName,
    createNewSetupProfile,
    cloneSelectedSetupProfile,
    deleteSelectedSetupProfile,
    validatePaths,
    resolveArgs,
    pickProjectFolder,
    discoverProjects,
    applySelectedProject,
    loadConfigsForCurrentProject,
    applyConfigSyncToTemplates,
    runDotnetAndCollect,
    dotnet,
    rebuild,
    stop,
    browseBatFile,
    runSqlOnly,
    runAllSqlSnippets,
    getSqlTables,
    executeSqlQuery,
    onSnippetSelected,
    createNewSqlSnippet,
    renameActiveSqlSnippet,
    deleteActiveSqlSnippet,
    commitSqlSnippetName,
    startNamingArgSnippet,
    commitArgSnippetName,
    deleteActiveArgSnippet,
    onArgSnippetSelected,
    removeBatConfig,
    browseTargetProject,
    removeTargetProject,
    selectBacklogIssue,
    unlinkBacklogIssue,
    insertTimePlaceholder,
    insertHostnamePlaceholder,
    exportProfileToDoc,
    restoreVersion,
    triggerSync,
    getProfileHashContent,
    syncProfilesWithCloudflare,
    setupTargetWatcher,
    setupBatWatcher,
    loadWorkspaceRoot,
    saveUIState,
    checkSqlConnectionOnStartup,
    loadUIState,
    formatTauriShortcut,
    startRecordingShortcut,
    stopRecordingShortcut,
    handleShortcutKeydown,
    updateGlobalShortcut,
    registerAllShortcuts,
    unregisterAllShortcuts,
    resetAllShortcuts,
  };
  console.log('[Store] useRunnerStore created successfully');
});
