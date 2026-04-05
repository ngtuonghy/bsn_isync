import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useUiStore } from './useUiStore';
import { useRunnerStore } from './useRunnerStore';

export const TERMINAL_THEMES = {
  dark: {
    background: '#09090b',
    foreground: '#e4e4e7',
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
    foreground: '#18181b',
    cursor: '#18181b',
    selectionBackground: '#bfdbfe',
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

export const useTerminalStore = defineStore('terminal', () => {
  const mainTermRef = ref<HTMLElement | null>(null);
  const runTermRef = ref<HTMLElement | null>(null);
  const mainScrollRef = ref<HTMLElement | null>(null);
  let unlistenPtyOut: UnlistenFn | null = null;
  
  const termState = ref<Record<string, any>>({
    active: 'main',
    terminals: ['main'],
    main: { term: null as Terminal | null, fit: null as FitAddon | null },
    run: { term: null as Terminal | null, fit: null as FitAddon | null }
  });

  async function setupPtyListener() {
    if (unlistenPtyOut) return;
    
    unlistenPtyOut = await listen<{ id: string; data: string }>('pty-out', (event) => {
      const { id, data } = event.payload;
      if (termState.value[id]?.term) {
        termState.value[id].term.write(data);
      }
    });
  }

  function toggleTheme() {
    const uiStore = useUiStore();
    uiStore.isDarkMode = !uiStore.isDarkMode;
    const el = document.documentElement;
    if (uiStore.isDarkMode) el.classList.add('dark');
    else el.classList.remove('dark');
    
    const theme = uiStore.isDarkMode ? TERMINAL_THEMES.dark : TERMINAL_THEMES.light;
    termState.value.terminals.forEach((tId: string) => {
      if (termState.value[tId]?.term) termState.value[tId].term.options.theme = theme;
    });
  }

  function clearLogs() {
    const runnerStore = useRunnerStore();
    runnerStore.logs = [];
    termState.value.terminals.forEach((tId: string) => {
      if (termState.value[tId]?.term) termState.value[tId].term.clear();
    });
  }

  async function cdToRoot() {
    const runnerStore = useRunnerStore();
    if (!runnerStore.projectRoot) return;
    const cmd = `cd '${runnerStore.projectRoot}'\r`;
    await invoke('pty_write', { id: 'main', data: cmd });
    if (termState.value.active !== 'main') {
      termState.value.active = 'main';
    }
  }

  function switchTerminal(tId: string) {
    termState.value.active = tId;
  }

  async function initPty(id: string, container: HTMLElement) {
    if (termState.value[id]?.term) return;

    const uiStore = useUiStore();
    const runnerStore = useRunnerStore();
    
    const t = new Terminal({
      theme: uiStore.isDarkMode ? TERMINAL_THEMES.dark : TERMINAL_THEMES.light,
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
    
    t.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.code === 'KeyC') {
        if (t.hasSelection()) {
          const text = t.getSelection();
          navigator.clipboard.writeText(text);
          return false;
        }
      }
      return true;
    });

    fit.fit();

    termState.value[id].term = t;
    termState.value[id].fit = fit;

    await invoke('init_pty', {
      id,
      root: runnerStore.workspaceRoot || runnerStore.projectRoot,
      rows: t.rows,
      cols: t.cols,
    }).catch(() => {});

    t.onData((data) => {
      invoke('pty_write', { id, data }).catch(() => {});
    });

    if (!uiStore.isTerminalHistoryEnabled) {
      invoke('pty_write', { id, data: `Set-PSReadLineOption -HistorySaveStyle SaveNothing\r` }).catch(() => {});
    }
  }

  setupPtyListener();

  return {
    mainTermRef,
    runTermRef,
    mainScrollRef,
    termState,
    toggleTheme,
    clearLogs,
    cdToRoot,
    switchTerminal,
    initPty,
    setupPtyListener,
  };
});
