<script setup lang="ts">
import { Settings2, Folder, ExternalLink, Info, Cpu, Zap, ZapOff } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUiStore } from '@/stores/useUiStore';
import { useRunnerStore } from '@/stores/useRunnerStore';
import { invoke } from '@tauri-apps/api/core';

const uiStore = useUiStore();
const runnerStore = useRunnerStore();

async function browseMsbuild() {
  const picked = await invoke('pick_file', { 
    defaultPath: runnerStore.customMsbuildPath || 'C:\\Program Files\\Microsoft Visual Studio'
  }) as string | null;
  if (picked) {
    runnerStore.customMsbuildPath = picked;
    runnerStore.saveCurrentToSelectedSetupProfile();
    // Re-check environment to update found status
    uiStore.checkEnv(picked);
  }
}
</script>

<template>
  <Dialog :open="uiStore.isRunnerSettingsOpen" @update:open="val => uiStore.isRunnerSettingsOpen = val">
    <DialogContent class="max-w-xl p-0 border-0 bg-transparent shadow-none overflow-visible">
      <div class="p-8 bg-card/95 backdrop-blur-3xl border border-primary/10 rounded-[32px] shadow-2xl animate-in zoom-in-95 fade-in duration-300 origin-top select-none relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
        <!-- Subtle background glow -->
        <div class="absolute -top-24 -right-24 size-48 bg-primary/5 blur-3xl rounded-full"></div>
        <div class="absolute -bottom-24 -left-24 size-48 bg-primary/5 blur-3xl rounded-full"></div>

        <DialogHeader class="mb-8 relative">
          <div class="flex items-center gap-4">
            <div class="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner ring-1 ring-primary/20">
              <Settings2 class="size-5.5" />
            </div>
            <div class="flex flex-col">
              <DialogTitle class="text-[14px] font-black uppercase tracking-[0.15em] text-foreground">Build Engine Settings</DialogTitle>
              <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">Configure MSBuild & Build Args</p>
            </div>
          </div>
        </DialogHeader>

        <div class="space-y-8 relative">
          <!-- MSBuild Configuration -->
          <div class="space-y-4">
            <div class="flex items-center justify-between px-1">
              <Label class="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                <Cpu class="size-3.5 text-primary" /> MSBuild Executable
              </Label>
              <a href="https://visualstudio.microsoft.com/downloads/" target="_blank" class="text-[8px] font-black text-primary/60 hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                Get Tools <ExternalLink class="size-2.5" />
              </a>
            </div>

            <div class="flex gap-2.5">
              <div class="relative flex-1">
                <Input 
                  v-model="runnerStore.customMsbuildPath" 
                  class="h-11 rounded-xl bg-muted/30 border-primary/5 focus:border-primary/20 focus:ring-2 focus:ring-primary/10 transition-all text-[12px] font-bold px-4" 
                  placeholder="e.g., C:\Program Files\...\MSBuild.exe"
                />
              </div>
              <Button variant="secondary" class="h-11 w-11 p-0 rounded-xl border border-primary/5 hover:bg-primary/10 hover:border-primary/20 text-muted-foreground hover:text-primary transition-all group shadow-sm bg-muted/40" @click="browseMsbuild">
                <Folder class="size-4.5 group-hover:scale-110 transition-transform" />
              </Button>
            </div>

            <div class="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <Info class="size-4 text-primary shrink-0 mt-0.5" />
              <p class="text-[10px] font-semibold text-muted-foreground/80 leading-relaxed italic">
                Prioritized over standard 'dotnet' CLI. Essential for legacy .NET Framework projects (4.x) that require MSBuild specific features or x86/x64 targeting.
              </p>
            </div>
          </div>

          <!-- Build Arguments & Behavior -->
          <div class="space-y-6">
             <div class="space-y-4">
                <Label class="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Extra Build Arguments</Label>
                <div class="relative">
                  <Input 
                    v-model="runnerStore.extraBuildArgs" 
                    class="h-11 rounded-xl bg-muted/30 border-primary/5 focus:border-primary/20 focus:ring-2 focus:ring-primary/10 transition-all text-[12px] font-mono font-bold px-4" 
                    placeholder="/p:Platform=x86 /m /v:m"
                  />
                </div>
             </div>

             <div class="space-y-3">
                <Label class="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Execution Behavior</Label>
                <div class="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-primary/5 hover:border-primary/10 transition-all group">
                  <div class="flex items-center gap-3">
                    <div class="size-9 rounded-xl flex items-center justify-center transition-all" :class="runnerStore.autoRebuild ? 'bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'">
                      <component :is="runnerStore.autoRebuild ? Zap : ZapOff" class="size-4.5" />
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[11px] font-black uppercase tracking-wider">Auto Rebuild</span>
                      <span class="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest -mt-0.5">Build before Run/Test</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    class="h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                    :class="runnerStore.autoRebuild ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted hover:bg-muted/80 text-muted-foreground'"
                    @click="runnerStore.autoRebuild = !runnerStore.autoRebuild"
                  >
                    {{ runnerStore.autoRebuild ? 'Enabled' : 'Disabled' }}
                  </Button>
                </div>
             </div>

            <div class="flex items-center gap-2 pb-2">
              <div class="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[8px] font-black uppercase tracking-tighter">Note</div>
              <p class="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest leading-none">Configuration is locked to 'Debug' for build execution.</p>
            </div>
          </div>
        </div>

        <!-- Professional Footer Actions -->
        <div class="flex items-center justify-between mt-10 pt-6 border-t border-primary/5 relative">
          <Button variant="ghost" class="h-10 px-6 rounded-[14px] text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all" @click="uiStore.isRunnerSettingsOpen = false">
            Cancel
          </Button>
          <div class="flex items-center gap-3">
             <div class="flex flex-col items-end opacity-20 mr-2">
                <span class="text-[7px] text-muted-foreground font-black uppercase tracking-[0.25em]">Build Profile</span>
                <span class="text-[6px] text-muted-foreground font-bold uppercase tracking-[0.4em] -mt-1">Synced & Persistent</span>
             </div>
             <Button class="h-11 px-8 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all transform hover:scale-[1.02] active:scale-95" @click="() => { runnerStore.saveCurrentToSelectedSetupProfile(); uiStore.isRunnerSettingsOpen = false; }">
               Save Configuration
             </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
