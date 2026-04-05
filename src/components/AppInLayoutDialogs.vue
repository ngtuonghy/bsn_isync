<script setup lang="ts">
import { Code2, Play, ListTree, X, Server, Database } from "lucide-vue-next";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProfileHistory from "@/components/ProfileHistory.vue";
import HotkeyManager from "@/components/HotkeyManager.vue";
import SqlEditor from "@/components/SqlEditor.vue";
import { useUiStore } from '@/stores/useUiStore';
import { useRunnerStore } from '@/stores/useRunnerStore';
import { useBacklogStore } from '@/stores/useBacklogStore';

const uiStore = useUiStore();
const runnerStore = useRunnerStore();
const backlogStore = useBacklogStore();
</script>

<template>
    <Toaster richColors position="bottom-right" closeButton expand />

    <ProfileHistory 
      v-model:open="uiStore.isHistoryDialogOpen"
      :profile="runnerStore.selectedProfile"
      :syncService="backlogStore.syncService"
      :canEdit="runnerStore.canEditSelected"
      @restore="runnerStore.restoreVersion"
    />

    <!-- Premium Global Hotkey Dialog -->
    <Dialog :open="uiStore.isHotkeySettingsOpen" @update:open="val => { uiStore.isHotkeySettingsOpen = val; if(!val) runnerStore.stopRecordingShortcut(); }">
      <DialogContent class="max-w-2xl p-0 border-0 bg-transparent shadow-none overflow-visible">
        <HotkeyManager 
          :shortcuts="runnerStore.shortcuts"
          :isRecording="uiStore.isRecordingShortcut"
          :recordingAction="uiStore.recordingAction"
          @start-recording="runnerStore.startRecordingShortcut"
          @stop-recording="runnerStore.stopRecordingShortcut"
          @update:shortcut="(action: string, val: string) => { runnerStore.shortcuts[action] = val; runnerStore.saveUIState(); runnerStore.updateGlobalShortcut(action, val); }"
          @reset-all="runnerStore.resetAllShortcuts"
          @close="uiStore.isHotkeySettingsOpen = false"
        />
      </DialogContent>
    </Dialog>

    <Dialog :open="uiStore.isNamingSqlSnippet" @update:open="val => uiStore.isNamingSqlSnippet = val">
      <DialogContent class="sm:max-w-[425px] rounded-3xl border border-primary/10 shadow-2xl bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle class="text-[14px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Code2 class="size-4" /> {{ uiStore.namingSqlSnippetTitle }}
          </DialogTitle>
        </DialogHeader>
        <div class="py-6 space-y-4">
          <div class="space-y-2">
            <Label class="text-[10px] font-black uppercase text-muted-foreground opacity-60 ml-1 font-mono">Script Name</Label>
            <Input 
              v-model="uiStore.namingSqlSnippetValue" 
              class="h-11 rounded-xl bg-muted/30 border-primary/5 focus:border-primary/20 focus:ring-2 focus:ring-primary/10 transition-all font-bold px-4" 
              placeholder="e.g., Update Database Schema"
              autofocus
              @keydown.enter="runnerStore.commitSqlSnippetName"
            />
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 mt-2">
          <Button variant="ghost" class="h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest opacity-60 hover:opacity-100" @click="uiStore.isNamingSqlSnippet = false">
            Cancel
          </Button>
          <Button class="h-11 px-8 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90" @click="runnerStore.commitSqlSnippetName()">
            Save Script
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Professional Fullscreen SQL Editor Dialog -->
    <Dialog :open="uiStore.isSqlEditorFullscreen" @update:open="val => uiStore.isSqlEditorFullscreen = val">
      <DialogContent class="max-w-none! sm:max-w-none! w-[90vw]! h-[88vh] p-0 border-0 bg-transparent shadow-none overflow-hidden flex flex-col pointer-events-auto transition-all duration-500 [&>button]:hidden">
        <div class="flex-1 bg-background/95 backdrop-blur-3xl border border-border shadow-[0_0_100px_rgba(0,0,0,0.2)] rounded-[24px] overflow-hidden flex flex-col ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-500">
          <!-- Pro Toolbar Header (Theme Synced) -->
          <div class="h-14 px-6 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
            <!-- Left: Brand -->
            <div class="flex items-center gap-3">
              <div class="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
                <Code2 class="size-5" />
              </div>
              <div class="flex flex-col">
                <span class="text-[12px] font-black uppercase tracking-[0.2em] text-foreground">SQL PRO ENGINE</span>
                <span class="text-[8px] font-black text-muted-foreground/60 uppercase tracking-tighter">Synchronized Environment</span>
              </div>
            </div>

            <!-- Center: Snippet Sync & Context -->
            <div class="flex items-center gap-4 flex-1 max-w-[550px] mx-6">
              <div class="flex-1 flex items-center gap-2 bg-background border border-border p-1 rounded-xl shadow-sm group/sync focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Select v-model="runnerStore.activeSqlSnippetId" @update:model-value="(v: any) => runnerStore.onSnippetSelected(v)">
                  <SelectTrigger class="h-8 flex-1 text-[10.5px] font-bold bg-muted/30 border-0 rounded-lg hover:bg-muted/50 transition-all">
                    <SelectValue placeholder="Select script..." />
                  </SelectTrigger>
                  <SelectContent class="max-w-[300px] shadow-2xl">
                    <SelectItem v-for="snippet in runnerStore.sqlSnippets" :key="snippet.id" :value="snippet.id" class="text-[10.5px] font-bold py-2">
                      <div class="flex items-center gap-2">
                        <Code2 class="size-3.5 text-primary/70" />
                        <span>{{ snippet.name }}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                <div class="w-px h-5 bg-border mx-1"></div>
                
                <div class="flex items-center gap-3 px-2 shrink-0">
                  <div class="flex items-center gap-1.5 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                    <Server class="size-3 text-primary" />
                    <span class="text-[10px] font-mono font-bold truncate max-w-[80px]">{{ runnerStore.sqlServer || '?' }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                    <Database class="size-3 text-primary" />
                    <span class="text-[10px] font-mono font-bold truncate max-w-[80px]">{{ runnerStore.sqlDatabase || '?' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: Action Controls -->
            <div class="flex items-center gap-2">
              <Button variant="ghost" class="h-9 px-4 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all rounded-lg border border-primary/20 bg-primary/5 group/run-all min-w-[110px]" @click="runnerStore.runAllSqlSnippets()" :disabled="runnerStore.sqlSnippets.length === 0">
                <ListTree class="size-3.5 opacity-70 group-hover/run-all:scale-110 transition-transform mr-1.5" />
                Run All
              </Button>
              <Button class="h-9 px-5 text-[9px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 rounded-lg group/run shadow-lg shadow-primary/10 min-w-[120px]" @click="runnerStore.runSqlOnly()" :disabled="runnerStore.sqlSnippets.length === 0">
                <Play class="size-3.5 fill-current group-hover/run:scale-110 transition-transform" />
                Run Script
              </Button>
              
              <div class="w-px h-6 bg-border mx-2"></div>
              
              <Button variant="ghost" size="icon" class="size-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all border border-transparent hover:border-destructive/20" @click="uiStore.isSqlEditorFullscreen = false">
                <X class="size-5" />
              </Button>
            </div>
          </div>

          <!-- Code Editor Area -->
          <div class="flex-1 min-h-0 relative">
            <SqlEditor
              v-model="runnerStore.sqlSetupPath"
              :is-dark="uiStore.isDarkMode"
              height="100%"
              font-size="14px"
              placeholder="-- Write your SQL pro queries here..."
              @change="(v: string) => { 
                 const s = runnerStore.sqlSnippets.find(s => s.id === runnerStore.activeSqlSnippetId);
                 if(s) s.content = v;
              }"
            />
            
            <!-- Floating Indicator -->
            <div class="absolute bottom-6 left-6 flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border shadow-sm opacity-60 hover:opacity-100 transition-opacity pointer-events-none">
              <div class="size-2 rounded-full" :class="uiStore.isDarkMode ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]'"></div>
              <span class="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">PRO Mode Active</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
</template>
