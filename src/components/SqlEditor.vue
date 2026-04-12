<script setup lang="ts">
import { Codemirror } from 'vue-codemirror';
import { MySQL, PostgreSQL, MariaSQL, MSSQL } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { computed, ref, watch, type Ref } from 'vue';
import type { Extension } from '@codemirror/state';

interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  height?: string;
  fontSize?: string;
  isDark?: boolean;
  dialect?: 'mysql' | 'pgsql' | 'mariadb' | 'mssql';
  isFullscreen?: boolean;
  showResult?: boolean;
  resultData?: { columns: string[]; rows: Record<string, unknown>[] };
  isRunning?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '-- Write SQL queries here...',
  disabled: false,
  height: '100%',
  fontSize: '11px',
  isDark: true,
  dialect: 'mssql',
  isFullscreen: false,
  showResult: false,
  resultData: () => ({ columns: [], rows: [] }),
  isRunning: false
});

const emit = defineEmits(['update:modelValue', 'change', 'toggleResult', 'execute', 'stop']);

const collapsed: Ref<boolean> = ref(false);

// Auto expand when showResult becomes true
watch(() => props.showResult, (newVal) => {
  if (newVal && !props.isFullscreen) {
    collapsed.value = false;
  }
});
const resultHeightPercent = ref(40);
const isDragging = ref(false);
const editorHeight = computed(() => {
  if (props.isFullscreen) return 'auto';
  if (props.showResult && !collapsed.value) return '100px';
  return props.height;
});

const editorContent = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val)
});

const getDialect = () => {
  switch (props.dialect) {
    case 'mysql': return MySQL;
    case 'pgsql': return PostgreSQL;
    case 'mariadb': return MariaSQL;
    default: return MSSQL;
  }
};

const extensions = computed(() => {
  const exts: Extension[] = [
    getDialect(),
    autocompletion(),
    keymap.of(completionKeymap)
  ];
  if (props.isDark) exts.push(oneDark);
  return exts;
});

function handleChange(val: string) { emit('change', val); }
function toggleCollapse() { collapsed.value = !collapsed.value; }

function startDrag(e: MouseEvent) {
  isDragging.value = true;
  const container = (e.target as HTMLElement).closest('.sql-editor-wrapper');
  if (!container) return;
  const containerHeight = container.clientHeight;
  const startY = e.clientY;
  const startPercent = resultHeightPercent.value;
  const onMove = (e: MouseEvent) => {
    const delta = startY - e.clientY;
    const deltaPercent = (delta / containerHeight) * 100;
    resultHeightPercent.value = Math.max(10, Math.min(80, startPercent + deltaPercent));
  };
  const onUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
</script>

<template>
  <div class="sql-editor-wrapper w-full flex flex-col relative group/cm overflow-hidden border transition-all duration-300" 
    :class="[!isDark ? 'bg-white border-border/50' : 'bg-background/50 border-primary/20', isFullscreen ? 'h-full rounded-none' : 'rounded-xl']">
    
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none shrink-0"
      :class="!isDark ? 'bg-gray-50 border-b border-border/30' : 'bg-background/80 border-b border-primary/10'"
      @click="!isFullscreen && toggleCollapse()">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold uppercase tracking-wider" :class="!isDark ? 'text-gray-500' : 'text-primary/60'">SQL Editor</span>
        <span v-if="dialect !== 'mssql'" class="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{{ dialect?.toUpperCase() }}</span>
      </div>
      <div class="flex items-center gap-1">
        <span v-if="isRunning" class="text-[9px] font-bold text-amber-500 animate-pulse mr-1">Running...</span>
        <button v-if="!isFullscreen" class="p-1 rounded hover:bg-primary/10 transition-colors" @click.stop="toggleCollapse()">
          <svg class="w-4 h-4 transition-transform" :class="collapsed ? '' : 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <button v-if="showResult" class="p-1 rounded hover:bg-primary/10 transition-colors text-primary" @click.stop="$emit('toggleResult')">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        </button>
      </div>
    </div>
    
    <!-- Editor -->
    <codemirror v-show="!collapsed || isFullscreen" v-model="editorContent" :placeholder="placeholder" :style="isFullscreen ? { height: '150px' } : { height: editorHeight, fontSize }" :autofocus="true" :indent-with-tab="true" :tab-size="2" :extensions="extensions" :disabled="disabled" @change="handleChange" class="font-mono selection-bg-primary/30 shrink-0" :class="!isDark ? 'cm-light' : ''" />
    
    <div v-if="collapsed && !isFullscreen" class="px-3 py-1 text-[10px] text-gray-400 truncate font-mono">{{ modelValue || placeholder }}</div>
    
    <!-- Result -->
    <div v-if="showResult && (isFullscreen || !collapsed)" class="flex flex-col overflow-hidden" :style="isFullscreen ? { flex: '1 1 auto', minHeight: '0' } : { flex: '1 1 auto', minHeight: '100px', maxHeight: '300px' }">
      <template v-if="resultData.rows.length > 0">
        <div class="h-1 bg-primary/20 cursor-row-resize hover:bg-primary/40 transition-colors shrink-0" :class="isFullscreen ? 'hidden' : ''" @mousedown="startDrag" />
        <div class="flex-1 overflow-auto min-h-0">
          <table class="w-full text-xs font-mono border-collapse">
            <thead class="sticky top-0 z-10">
              <tr class="bg-primary/90 text-white">
                <th v-for="col in resultData.columns" :key="col" class="px-3 py-2 text-left font-semibold border-r border-white/20 cursor-pointer hover:bg-primary/70 select-none whitespace-nowrap">
                  <span>{{ col }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in resultData.rows" :key="idx" class="border-b border-primary/10 hover:bg-primary/5">
                <td v-for="col in resultData.columns" :key="col" class="px-3 py-1.5 border-r border-primary/10 truncate max-w-[200px] whitespace-nowrap" :title="String(row[col])">{{ row[col] }}</td>
              </tr>
            </tbody>
          </table>
          <div class="px-3 py-1.5 text-[10px] text-gray-400 bg-primary/5 border-t border-primary/10">{{ resultData.rows.length }} rows returned</div>
        </div>
      </template>
      <template v-else-if="resultData.rows.length === 0 && resultData.columns.length > 0 && !resultData.columns.includes('Error')">
        <div class="p-3 text-xs text-muted-foreground">No results returned</div>
      </template>
    </div>
    
    <!-- Error Display -->
    <div v-if="showResult && resultData.rows.length === 0 && resultData.columns.includes('Error')" class="p-3 bg-red-500/10 border-t border-red-500/30">
      <div class="text-red-500 text-xs font-mono">{{ resultData.rows[0]?.Error }}</div>
    </div>
  </div>
</template>

<style>
.sql-editor-wrapper { height: 100%; display: flex; flex-direction: column; }
.cm-editor { height: 100%; min-height: 100px; background: transparent; }
.cm-scroller { font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace; line-height: 1.6; padding: 8px; overflow: auto; }
.cm-light .cm-gutters { background: #f8f9fa; border-right: 1px solid #e9ecef; color: #adb5bd; }
.cm-gutters { background: transparent; border-right: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.2); }
.cm-activeLineGutter { background: rgba(var(--primary),0.05); color: var(--primary); }
</style>