<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  shortcut: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}>();

const keys = computed(() => {
  if (!props.shortcut) return [];
  return props.shortcut.split('+').map(k => k.trim());
});
</script>

<template>
  <div v-if="keys.length" 
       class="flex items-center select-none shrink-0"
       :class="size === 'lg' ? 'gap-1.5' : size === 'md' ? 'gap-1' : 'gap-0.5'">
    <template v-for="(key, i) in keys" :key="i">
      <span v-if="i > 0" 
            class="font-black opacity-20 mx-0.5"
            :class="size === 'lg' ? 'text-[10px]' : size === 'md' ? 'text-[9px]' : 'text-[7.5px]'">+</span>
      <kbd 
        class="rounded-[6px] border border-zinc-200 dark:border-white/10 border-b-[3px] border-b-zinc-300 dark:border-b-white/20 font-mono font-black flex items-center justify-center uppercase tracking-normal transition-all active:translate-y-px active:border-b shadow-md bg-linear-to-b from-white to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 text-foreground"
        :class="[
          size === 'lg' ? 'min-w-[26px] h-7 px-2 text-[11px]' : 
          size === 'md' ? 'min-w-[22px] h-6 px-1.5 text-[9px]' :
          'min-w-[18px] h-4.5 px-1 text-[8px]'
        ]"
      >
        {{ 
          key === 'CommandOrControl' ? 'Ctrl' : 
          key === 'Cmd' || key === 'Super' ? '⌘' : 
          key === 'Shift' ? '⇧' : 
          key === 'Alt' ? '⌥' : 
          key === 'Ctrl' ? '⌃' : 
          key 
        }}
      </kbd>
    </template>
  </div>
</template>

<style scoped>
kbd {
  line-height: 1;
}
</style>
