<script setup lang="ts">
import { } from 'vue';
import { Button } from './ui/button';
import { Beaker, Hammer, Pencil, RotateCw, Trash2, X, Keyboard, Play, Square } from 'lucide-vue-next';
import HotkeyLabel from './HotkeyLabel.vue';

const props = defineProps<{
  shortcuts: Record<string, string>;
  isRecording: boolean;
  recordingAction: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:shortcut', action: string, value: string): void;
  (e: 'start-recording', action: string): void;
  (e: 'stop-recording'): void;
  (e: 'reset-all'): void;
  (e: 'close'): void;
}>();

const actions = [
  { id: 'build', label: 'Build Project', icon: Hammer, color: 'text-amber-500' },
  { id: 'rebuild', label: 'Rebuild All', icon: RotateCw, color: 'text-zinc-500' },
  { id: 'test', label: 'Run Test (BAT)', icon: Beaker, color: 'text-blue-500' },
  { id: 'run', label: 'Run App (EXE)', icon: Play, color: 'text-green-500' },
  { id: 'stop', label: 'Stop Execution', icon: Square, color: 'text-red-500' },
];

function handleResetAction(actionId: string) {
  const defaults: Record<string, string> = {
    test: 'Alt+Shift+T',
    run: 'Alt+Shift+R',
    build: 'Alt+Shift+B',
    rebuild: 'Alt+Shift+U',
    stop: 'Alt+Shift+S'
  };
  emit('update:shortcut', actionId, defaults[actionId]);
}

function handleClearAction(actionId: string) {
  emit('update:shortcut', actionId, '');
}
</script>

<template>
  <div class="p-6 bg-card/95 backdrop-blur-3xl border border-primary/10 rounded-[32px] shadow-2xl w-[420px] animate-in zoom-in-95 fade-in duration-300 origin-top select-none relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
    <!-- Subtle background glow -->
    <div class="absolute -top-24 -right-24 size-48 bg-primary/5 blur-3xl rounded-full"></div>
    <div class="absolute -bottom-24 -left-24 size-48 bg-primary/5 blur-3xl rounded-full"></div>

    <div class="flex items-center justify-between mb-8 relative">
      <div class="flex items-center gap-4">
        <div class="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner ring-1 ring-primary/20">
          <Keyboard class="size-5" />
        </div>
        <div class="flex flex-col">
          <h2 class="text-sm font-black text-foreground uppercase tracking-[0.15em]">Keyboard Shortcuts</h2>
          <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">System-wide Key Bindings</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" class="h-9 w-9 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" @click="$emit('close')">
        <X class="size-4.5" />
      </Button>
    </div>

    <!-- Recording State Overlay (Simplified) -->
    <div v-if="isRecording" class="mb-4 p-4 rounded-2xl bg-primary/5 border border-primary/20 animate-pulse flex items-center justify-center gap-3">
      <div class="size-2 rounded-full bg-primary animate-ping"></div>
      <span class="text-[11px] font-black text-primary uppercase tracking-widest">Recording: Press any combination...</span>
    </div>

    <div class="space-y-1.5 relative">
      <div v-for="action in actions" :key="action.id" 
           class="group/item flex items-center justify-between p-3.5 rounded-[20px] transition-all border border-transparent"
           :class="[
             recordingAction === action.id 
               ? 'bg-primary/10 border-primary/20 shadow-lg shadow-primary/5 scale-[1.02] z-10' 
               : isRecording ? 'opacity-30 grayscale pointer-events-none' : 'hover:bg-muted/40 hover:border-white/5'
           ]">
        
        <div class="flex items-center gap-4">
          <div class="size-10 rounded-[14px] bg-background grid place-items-center shrink-0 border border-border/50 shadow-xs transition-transform group-hover/item:scale-110">
            <component :is="action.icon" :class="['size-4.5', action.id === recordingAction ? 'text-primary' : action.color]" />
          </div>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-[11px] font-black text-foreground/90 tracking-tight uppercase">{{ action.label }}</span>
            <div class="flex items-center gap-2">
               <template v-if="recordingAction === action.id">
                 <span class="text-[9px] font-bold text-primary italic uppercase tracking-tighter">Waiting for input...</span>
               </template>
               <template v-else-if="shortcuts[action.id]">
                 <HotkeyLabel :shortcut="shortcuts[action.id]" size="md" variant="solid" class="transition-transform group-hover/item:scale-105" />
               </template>
               <template v-else>
                 <span class="text-[9px] text-muted-foreground/30 font-bold uppercase tracking-widest">Unassigned</span>
               </template>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1 transition-all" :class="recordingAction === action.id ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'">
          <template v-if="recordingAction !== action.id">
            <Button variant="ghost" size="icon" class="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                    @click="$emit('start-recording', action.id)" title="Change shortcut">
              <Pencil class="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="h-8 w-8 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all"
                    @click="handleResetAction(action.id)" title="Reset to default">
              <RotateCw class="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    @click="handleClearAction(action.id)" title="Clear shortcut">
              <Trash2 class="size-3.5" />
            </Button>
          </template>
          <template v-else>
            <Button variant="ghost" size="sm" class="h-8 px-3 rounded-lg text-primary bg-primary/10 font-black text-[9px] uppercase tracking-widest"
                    @click="$emit('stop-recording')">
              Cancel
            </Button>
          </template>
        </div>
      </div>
    </div>

    <div class="pt-6 mt-4 border-t border-primary/5 flex items-center justify-between relative">
      <Button variant="ghost" size="sm" class="h-9 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary hover:bg-primary/5 rounded-[12px] transition-all" 
              @click="$emit('reset-all')"
              :disabled="isRecording">
        Reset All Defaults
      </Button>
      <div class="flex flex-col items-end opacity-20 group">
        <span class="text-[7px] text-muted-foreground font-black uppercase tracking-[0.25em] group-hover:text-primary transition-colors">Tauri Native Engine</span>
        <span class="text-[6px] text-muted-foreground font-bold uppercase tracking-[0.4em] -mt-1">v2.0.0 Stable</span>
      </div>
    </div>
  </div>
</template>
