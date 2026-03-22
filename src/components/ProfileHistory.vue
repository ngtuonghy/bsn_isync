<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { History, RefreshCw, Clock } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'vue-sonner';

const props = defineProps<{
  open: boolean;
  profile: any;
  syncService: any;
  canEdit: boolean;
}>();

const emit = defineEmits(['update:open', 'restore']);

const historyList = ref<any[]>([]);
const isFetchingHistory = ref(false);

async function fetchHistory() {
  if (!props.profile || !props.syncService) return;
  isFetchingHistory.value = true;
  try {
    historyList.value = await props.syncService.getHistory(props.profile.id);
  } catch (e) {
    console.error("Failed to fetch history", e);
    toast.error("Failed to fetch history", { description: String(e) });
  } finally {
    isFetchingHistory.value = false;
  }
}

function handleRestore(v: any) {
  emit('restore', v);
}

onMounted(() => {
  if (props.open) fetchHistory();
});

// Watch open state to refresh history when opened
import { watch } from 'vue';
watch(() => props.open, (newVal) => {
  if (newVal) fetchHistory();
});
</script>

<template>
  <Dialog :open="open" @update:open="val => emit('update:open', val)">
    <DialogContent class="max-w-2xl max-h-[85vh] bg-background border-border shadow-2xl rounded-[24px] overflow-hidden flex flex-col p-0 gap-0">
      <DialogHeader class="px-8 py-6 border-b bg-card">
        <div class="flex items-center gap-4">
          <div class="flex items-center justify-center size-12 rounded-full bg-secondary text-foreground">
            <History class="size-6" stroke-width="2.5" />
          </div>
          <div>
            <DialogTitle class="text-base font-semibold text-foreground">Version History</DialogTitle>
            <DialogDescription class="text-sm text-muted-foreground mt-1">
              Profile: {{ profile?.name }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-[400px] bg-background">
        <div v-if="isFetchingHistory" class="flex flex-col items-center justify-center h-full gap-4 opacity-50">
          <RefreshCw class="size-8 text-primary animate-spin" />
          <p class="text-[10px] font-black uppercase tracking-[0.2em]">Loading History...</p>
        </div>
        <div v-else-if="historyList.length === 0" class="flex flex-col items-center justify-center h-full gap-4 opacity-30 italic py-20">
          <History class="size-12" />
          <p class="text-[11px] font-bold uppercase tracking-widest">No history found</p>
        </div>
        <div v-else class="space-y-4">
          <div v-for="v in historyList" :key="v.id" 
               class="flex items-center justify-between p-4 rounded-2xl bg-card hover:bg-muted/50 border border-transparent hover:border-border transition-all group/v">
            <div class="flex items-center gap-4">
              <div class="flex flex-col items-center justify-center size-10 rounded-xl bg-secondary text-foreground font-bold text-sm shrink-0 shadow-inner group-hover/v:scale-105 transition-transform border border-border/50">
                <span class="text-[10px] text-muted-foreground leading-none mb-0.5 uppercase tracking-wide">Ver</span>
                {{ v.version }}
              </div>
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-foreground">{{ v.modifier_name }}</span>
                  <span v-if="v.version === profile?.version" class="text-[10px] px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-500 font-semibold uppercase tracking-wider">Current</span>
                </div>
                <span class="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock class="size-3.5 opacity-50" />
                  {{ new Date(v.created_at).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) }}
                </span>
              </div>
            </div>
            
            <Button 
              v-if="v.version !== profile?.version"
              variant="secondary" 
              size="sm" 
              class="h-8 px-4 text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-all rounded-lg shadow-sm"
              :disabled="!canEdit"
              @click="handleRestore(v)"
            >
              RESTORE
            </Button>
          </div>
        </div>
      </div>
      
      <div class="px-8 py-4 border-t bg-card flex justify-end">
         <Button variant="ghost" size="sm" class="text-sm font-medium hover:bg-muted" @click="emit('update:open', false)">Close</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
}
</style>
