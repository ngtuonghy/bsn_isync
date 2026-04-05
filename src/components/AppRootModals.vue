<script setup lang="ts">
import { Plus, RefreshCw, TerminalSquare, ShieldAlert } from "lucide-vue-next";
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

const uiStore = useUiStore();
const runnerStore = useRunnerStore();
</script>

<template>
  <!-- Sync Conflict Dialog -->
  <Dialog :open="runnerStore.syncConflictDialog.isOpen" @update:open="v => { if(!v && runnerStore.syncConflictDialog.resolve) { runnerStore.syncConflictDialog.resolve('cancel'); runnerStore.syncConflictDialog.isOpen = false; } }">
    <DialogContent class="sm:max-w-[450px] rounded-3xl border border-yellow-500/20 shadow-2xl bg-card/95 backdrop-blur-xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-yellow-500">
          <ShieldAlert class="h-5 w-5" />
          Local Edits Detected
        </DialogTitle>
      </DialogHeader>
      <div class="py-4 space-y-4">
        <p class="text-sm text-foreground/90 leading-relaxed">
          <span v-if="runnerStore.syncConflictDialog.cloudChanged">
            The profile <strong class="text-primary">{{ runnerStore.syncConflictDialog.profileName }}</strong> has been updated on the cloud, but you have un-pushed local edits.
          </span>
          <span v-else>
            You have local edits in <strong class="text-primary">{{ runnerStore.syncConflictDialog.profileName }}</strong>. Do you want to discard them and pull the original from the cloud?
          </span>
        </p>
      </div>
      <div class="flex flex-col gap-2 mt-2">
        <Button variant="default" @click="runnerStore.syncConflictDialog.resolve?.('clone')" class="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
          <Plus class="size-4 mr-2" /> Clone Local Edits & Pull Cloud
        </Button>
        <Button variant="outline" @click="runnerStore.syncConflictDialog.resolve?.('sync')" class="w-full font-bold">
          <RefreshCw class="size-4 mr-2" /> Discard Local Edits & Pull Cloud
        </Button>
        <Button variant="ghost" @click="runnerStore.syncConflictDialog.resolve?.('cancel')" class="w-full text-muted-foreground hover:text-foreground">
          Keep Local Edits (Skip Pull)
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Naming Argument Snippet Dialog -->
  <Dialog :open="uiStore.isNamingArgSnippet" @update:open="v => { if(!v) uiStore.isNamingArgSnippet = false; }">
    <DialogContent class="sm:max-w-[425px] rounded-3xl border border-primary/10 shadow-2xl bg-card/95 backdrop-blur-xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-primary">
          <TerminalSquare class="h-5 w-5" />
          {{ uiStore.namingArgSnippetTitle }}
        </DialogTitle>
      </DialogHeader>
      <div class="grid gap-4 py-4 mt-2">
        <div class="flex flex-col gap-2">
          <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Argument Name</Label>
          <Input v-model="uiStore.namingArgSnippetValue" placeholder="e.g. Test Scenario A" class="h-10 rounded-xl bg-black/5 dark:bg-white/5 border-transparent focus-visible:ring-primary/30" @keydown.enter="runnerStore.commitArgSnippetName()" />
        </div>
      </div>
      <div class="flex items-center justify-end gap-3 mt-2">
        <Button variant="ghost" class="h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest opacity-60 hover:opacity-100" @click="uiStore.isNamingArgSnippet = false">
          Cancel
        </Button>
        <Button class="h-11 px-8 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90" @click="runnerStore.commitArgSnippetName()">
          Save
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
