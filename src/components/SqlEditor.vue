<script setup lang="ts">
import { Codemirror } from 'vue-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { computed } from 'vue';
import { type Extension } from '@codemirror/state';

interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  height?: string;
  fontSize?: string;
  isDark?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '-- Write SQL queries here...',
  disabled: false,
  height: '100%',
  fontSize: '11px',
  isDark: true
});

const emit = defineEmits(['update:modelValue', 'change']);

/** Reactive binding between the modelValue prop and the CodeMirror editor. */
const editorContent = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const extensions = computed(() => {
  const exts: Extension[] = [sql()];
  if (props.isDark) {
    exts.push(oneDark);
  }
  return exts;
});

const editorStyle = computed(() => ({
  height: props.height,
  fontSize: props.fontSize
}));

/** Forward the editor change event to the parent component. */
function handleChange(val: string) {
  emit('change', val);
}
</script>

<template>
  <div class="sql-editor-wrapper w-full h-full relative group/cm rounded-xl overflow-hidden border border-primary/20 bg-background transition-all duration-300 shadow-inner" :class="!isDark ? 'bg-white border-border/50' : 'bg-background/50 border-primary/20'">
    <codemirror
      v-model="editorContent"
      :placeholder="placeholder"
      :style="editorStyle"
      :autofocus="true"
      :indent-with-tab="true"
      :tab-size="2"
      :extensions="extensions"
      :disabled="disabled"
      @change="handleChange"
      class="h-full font-mono selection:bg-primary/30"
      :class="!isDark ? 'cm-light' : ''"
    />
    
    <!-- Decorative Mode Indicator (Optional, but looks pro) -->
    <div v-if="isDark" class="absolute bottom-2 right-2 flex items-center gap-1.5 pointer-events-none opacity-40 group-hover/cm:opacity-100 transition-opacity">
      <span class="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded shadow-sm">SQL PRO</span>
    </div>
  </div>
</template>

<style>
.cm-editor {
  height: 100% !important;
  background-color: transparent !important;
}
.cm-scroller {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace !important;
  line-height: 1.6 !important;
  padding: 8px !important;
}
.cm-light .cm-gutters {
  background-color: #f8f9fa !important;
  border-right: 1px solid #e9ecef !important;
  color: #adb5bd !important;
}
.cm-gutters {
  background-color: transparent !important;
  border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.2) !important;
}
.cm-activeLineGutter {
  background-color: rgba(var(--primary), 0.05) !important;
  color: var(--primary) !important;
}
</style>
