<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { FolderOpen, Maximize2, Lock, Plus, Pencil, Trash2, Hammer, Play, Square, RotateCcw, Beaker, Home, Search, Clock, RefreshCw, ExternalLink, X, ShieldAlert, Cloud, History, Code2, ListTree, Layers, FilePlus2, TerminalSquare, FileDown, Monitor, Target, Check, Settings2, Box } from "lucide-vue-next";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import SqlEditor from "@/components/SqlEditor.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { openUrl } from "@tauri-apps/plugin-opener";
import HotkeyLabel from "@/components/HotkeyLabel.vue";
import { useUiStore } from '@/stores/useUiStore';
import { useRunnerStore } from '@/stores/useRunnerStore';
import { useBacklogStore } from '@/stores/useBacklogStore';
import { useTerminalStore } from '@/stores/useTerminalStore';

const uiStore = useUiStore();
const runnerStore = useRunnerStore();
const backlogStore = useBacklogStore();
const terminalStore = useTerminalStore();

const mainTermRef = ref<HTMLElement | null>(null);
const mainScrollRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (mainTermRef.value) {
    await terminalStore.initPty('main', mainTermRef.value);
  }
});
</script>

<template>
        <TabsContent value="runner" class="flex-1 min-h-0 m-0 border-0 p-0 outline-none">
          <section class="flex h-full gap-4 items-stretch overflow-hidden">
            <div ref="mainScrollRef" class="w-[58%] min-h-0 flex flex-col gap-6 pt-2 pl-6 pr-4 pb-0 overflow-hidden">
              <section class="rounded-3xl bg-card/98 flex-1 flex flex-col min-h-0 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden shadow-sm transition-all duration-300">
                <div class="px-4 py-3 border-b border-primary/5 flex items-center justify-between bg-muted/20">
                  <div class="flex items-center gap-3">
                    <div class="text-[13px] font-black tracking-tight uppercase flex items-center gap-2">
                       <Layers class="size-4 text-primary" /> PROFILES
                    </div>
                    <div v-if="runnerStore.selectedProfile && runnerStore.selectedProfile.owner" class="text-[9px] px-2 py-0.5 rounded-full bg-muted font-medium uppercase tracking-tighter">{{ runnerStore.selectedProfile.owner }}</div>
                    <div v-if="runnerStore.selectedProfile && !runnerStore.canEditSelected" class="flex items-center gap-1.5">
                      <div class="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold uppercase tracking-tighter flex items-center gap-1.5 border border-amber-500/20 shadow-xs">
                        <Lock class="size-3" /> Local Edit
                      </div>
                      <Button 
                        v-if="backlogStore.syncService"
                        variant="outline" 
                        size="sm" 
                        class="h-6 px-3 rounded-full hover:bg-amber-500/10 text-amber-600 hover:text-amber-700 border-amber-500/20 transition-all gap-1.5 text-[10px] font-bold tracking-tight shadow-xs bg-transparent" 
                        title="Force Pull Latest from Cloud" 
                        :disabled="uiStore.syncStatus === 'saving'"
                        @click="runnerStore.triggerSync(runnerStore.selectedSetupId, false, true)"
                      >
                        <RefreshCw v-if="uiStore.syncStatus === 'saving'" class="size-3 animate-spin text-amber-500" />
                        <Cloud v-else class="size-3" />
                        <span>Pull Latest</span>
                      </Button>
                    </div>
                    
                    <!-- Professional Profile Sync Status -->
                    <div v-if="runnerStore.selectedProfile && runnerStore.selectedProfile.owner === runnerStore.currentUser" class="flex items-center gap-1.5">
                      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter transition-all border shadow-xs"
                           :class="uiStore.syncStatus === 'saving' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : uiStore.syncStatus === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-green-500/10 text-green-600 border-green-500/20'">
                        <RefreshCw v-if="uiStore.syncStatus === 'saving'" class="size-3 animate-spin" />
                        <Cloud v-else class="size-3" />
                        <span v-if="uiStore.syncStatus === 'saving'">Cloud Syncing...</span>
                        <span v-else-if="uiStore.syncStatus === 'error'">Sync Error</span>
                        <span v-else>Cloud Protected <span v-if="uiStore.lastSyncTime" class="opacity-70 ml-1 font-semibold">({{ new Date(uiStore.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }})</span></span>
                      </div>
                      <Button v-if="uiStore.syncStatus !== 'saving'" 
                              variant="outline" 
                              size="sm" 
                              class="h-6 px-3 rounded-full hover:bg-green-500/10 text-green-600 hover:text-green-700 border-green-500/20 transition-all gap-1.5 text-[10px] font-bold tracking-tight shadow-xs bg-transparent" 
                              title="Refresh from Cloud" 
                              @click="() => runnerStore.syncProfilesWithCloudflare(undefined, false, true)">
                        <RefreshCw class="size-3" />
                        <span>Sync</span>
                      </Button>
                    </div>
                  </div>

                  <Button 
                    variant="default" 
                    size="sm" 
                    class="h-8 px-3.5 font-black uppercase text-[10px] tracking-widest relative group/create shrink-0 shadow-sm transition-all bg-primary/90 hover:bg-primary" 
                    :disabled="runnerStore.running || backlogStore.backlog.status !== 'success'" 
                    @click="runnerStore.createNewSetupProfile"
                  >
                    <FilePlus2 class="size-3.5 mr-1.5 opacity-80" /> NEW PROFILE
                  </Button>
                </div>

                
                <div class="p-4 flex-1 overflow-hidden">
                  <div class="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 h-full">
                    <!-- Left Column: Search & List -->
                    <div class="flex flex-col gap-3 h-full min-h-0">
                        <div class="space-y-2.5 pb-2 border-b border-white/5 shrink-0">
                          <!-- Row 1: Owner Selection & Home -->
                          <div class="flex items-center gap-1.5">
                            <Select v-model="runnerStore.selectedOwner" :disabled="runnerStore.running">
                              <SelectTrigger class="h-9 text-[10.5px] bg-muted/20 border-input pl-1.5 flex-1 overflow-hidden">
                                <div class="flex items-center gap-2 overflow-hidden text-left">
                                  <Avatar size="sm" class="h-5 w-5 ring-1 ring-primary/20">
                                    <AvatarImage v-if="backlogStore.backlog.userAvatarByName[runnerStore.selectedOwner || '']" :src="backlogStore.backlog.userAvatarByName[runnerStore.selectedOwner || '']" />
                                    <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[8px] font-bold">{{ runnerStore.initials(runnerStore.selectedOwner || "") }}</AvatarFallback>
                                  </Avatar>
                                  <div class="truncate flex-1">
                                    <SelectValue placeholder="Owner" />
                                  </div>
                                </div>
                              </SelectTrigger>
                              <SelectContent class="p-1">
                                <div class="py-2 px-1">
                                  <div class="relative">
                                    <Search class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground opacity-40" />
                                    <input v-model="runnerStore.ownerSearch" 
                                           class="w-full bg-background border border-input h-9 text-[11px] pl-9 pr-2 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all font-medium" 
                                           placeholder="Filter owners..."
                                           @mousedown.stop
                                           @keydown.stop />
                                  </div>
                                </div>
                                <div class="max-h-[200px] overflow-y-auto custom-scrollbar">
                                  <SelectItem v-for="owner in runnerStore.filteredOwnerOptions" :key="owner" :value="owner" :text-value="owner">
                                    <template #leading>
                                      <Avatar size="sm" class="h-5 w-5 ring-1 ring-primary/20" aria-hidden="true">
                                        <AvatarImage v-if="backlogStore.backlog.userAvatarByName[owner]" :src="backlogStore.backlog.userAvatarByName[owner]" />
                                        <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[8px] font-bold">{{ runnerStore.initials(owner) }}</AvatarFallback>
                                      </Avatar>
                                    </template>
                                    <span class="text-[10.5px] font-medium">{{ owner }}</span>
                                  </SelectItem>
                                  <div v-if="runnerStore.filteredOwnerOptions.length === 0" class="px-2 py-4 text-center text-[10px] text-muted-foreground italic opacity-50">
                                    No owners found
                                  </div>
                                </div>
                              </SelectContent>
                            </Select>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              class="h-9 w-9 shrink-0 rounded-xl hover:bg-primary/10 transition-all duration-300"
                              :class="runnerStore.selectedOwner === runnerStore.currentUser && runnerStore.profileScope === 'personal' ? 'text-primary bg-primary/5 shadow-inner' : 'text-muted-foreground/60'"
                              @click="() => { runnerStore.selectedOwner = runnerStore.currentUser; runnerStore.profileScope = 'personal'; }"
                              title="My Profiles"
                            >
                              <Home class="size-4" :class="runnerStore.selectedOwner === runnerStore.currentUser && runnerStore.profileScope === 'personal' ? 'scale-110' : ''" />
                            </Button>
                          </div>

                          <!-- Row 4: Search -->
                          <div class="relative w-full">
                            <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground opacity-50" />
                            <Input v-model="runnerStore.profileSearch" placeholder="Search profiles..." :disabled="runnerStore.running" class="pl-9 h-9 text-[11px]" />
                          </div>

                        </div>

                      <div class="flex-1 overflow-y-auto px-2 pt-2 pb-4 space-y-2 custom-scrollbar">
                        <button v-for="setup in runnerStore.scopedProfiles" :key="setup.id"
                                :disabled="runnerStore.running"
                                class="w-full flex text-left rounded-xl p-4 transition-all duration-300 group/item relative border items-center gap-4 overflow-hidden"
                                :class="[
                                  setup.id === runnerStore.selectedSetupId 
                                    ? 'bg-card border-primary/40 shadow-xl ring-1 ring-primary/20 scale-[1.02] z-10' 
                                    : 'bg-background/40 border-border/40 hover:bg-muted/60 hover:border-border/80 hover:shadow-md hover:scale-[1.01]',
                                  runnerStore.running ? 'opacity-50 cursor-not-allowed' : ''
                                ]"
                                @click="runnerStore.selectedSetupId = setup.id">
                                 
                            <!-- Active Indicator -->
                            <div v-if="setup.id === runnerStore.selectedSetupId" class="absolute left-0 top-3 bottom-3 w-1.5 bg-primary rounded-r-full shadow-[0_0_12px_rgba(var(--primary-rgb),0.6)] animate-in slide-in-from-left duration-300"></div>
                                 
                            <div class="flex-1 min-w-0 flex flex-col py-0.5">
                              <div class="flex items-start justify-between w-full mb-1 gap-2">
                                <div class="text-[14px] font-bold leading-tight text-foreground group-hover/item:text-primary transition-colors truncate flex-1 min-w-0">
                                  {{ setup.name }}
                                </div>
                                <div class="flex items-center gap-1.5 opacity-50 group-hover/item:opacity-100 transition-opacity shrink-0 mt-0.5">
                                  <!-- Cloud Icon for owned profiles -->
                                  <RefreshCw v-if="setup.id === runnerStore.selectedSetupId && (uiStore.syncStatus === 'saving' || uiStore.isFetchingProfile)" 
                                             class="size-3.5 text-green-500 animate-spin" />
                                  <Cloud v-else-if="setup.owner === runnerStore.currentUser" 
                                         class="size-3.5 transition-colors"
                                         :class="[
                                           setup.id === runnerStore.selectedSetupId && uiStore.syncStatus === 'error' ? 'text-destructive' : 'text-primary/70'
                                         ]" />
                                  <Lock v-else class="size-3.5 text-muted-foreground/60" />
                                </div>
                              </div>
                              
                              <div class="flex items-center flex-wrap gap-x-2 gap-y-1 mt-0.5">
                                <div v-if="setup.backlogIssueKey" 
                                     class="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight text-muted-foreground bg-muted/60 border border-border/50">
                                  <div class="size-1.5 rounded-full" :style="{ backgroundColor: backlogStore.backlog.issues.find(i => i.issueKey === setup.backlogIssueKey)?.issueType?.color || 'var(--primary)' }"></div>
                                  {{ setup.backlogIssueKey }}
                                </div>
                                

                              </div>
                            </div>
                        </button>
                      </div>
                    </div>

                    <!-- Right Column: Detail Form -->
                    <div class="flex flex-col gap-4 border-l border-white/5 pl-4 overflow-y-auto custom-scrollbar">
                      <div class="flex flex-col gap-2 pb-3 border-b border-primary/5">
                        <div class="flex items-center justify-between gap-2 shrink-0">
                          <span v-if="runnerStore.selectedProfile" class="text-[9px] font-bold text-muted-foreground opacity-30 font-mono tracking-tighter mt-0.5 ml-0.5">ID: {{ runnerStore.selectedProfile.id }}</span>
                          <div v-else></div>

                          <div v-if="runnerStore.selectedProfile" class="flex items-center gap-2 shrink-0">
                            <div class="flex items-center bg-muted/40 border border-border/50 rounded-lg p-0.5 shadow-xs mr-1">
                              <Button 
                                v-if="backlogStore.syncService"
                                variant="ghost" 
                                size="icon" 
                                class="h-7 w-7 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all"
                                title="View History"
                                @click="uiStore.isHistoryDialogOpen = true"
                              >
                                <History class="size-3.5" />
                              </Button>

                              <div v-if="backlogStore.syncService && backlogStore.getBacklogIssueUrl(runnerStore.backlogIssueKey)" class="h-3 w-px bg-border/50 mx-0.5"></div>

                              <Button 
                                v-if="backlogStore.getBacklogIssueUrl(runnerStore.backlogIssueKey)"
                                variant="ghost" 
                                size="icon" 
                                class="h-7 w-7 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all"
                                title="View on Backlog"
                                @click="() => { const url = backlogStore.getBacklogIssueUrl(runnerStore.backlogIssueKey); if (url) openUrl(url); }"
                              >
                                <ExternalLink class="size-3.5" />
                              </Button>

                              <div v-if="backlogStore.getBacklogIssueUrl(runnerStore.backlogIssueKey) || backlogStore.syncService" class="h-3 w-px bg-border/50 mx-0.5"></div>

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                class="h-7 w-7 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all"
                                title="Export Documentation"
                                @click="runnerStore.exportProfileToDoc"
                              >
                                <FileDown class="size-3.5" />
                              </Button>
                            </div>

                            <Button 
                              variant="outline" 
                              size="sm" 
                              class="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-primary hover:text-primary bg-primary/5 hover:bg-primary/10 transition-all border-primary/20 font-bold tracking-widest text-[10px] shadow-xs uppercase shrink-0"
                              title="Clone to your account"
                              :disabled="runnerStore.running"
                              @click="runnerStore.cloneSelectedSetupProfile"
                            >
                              <FilePlus2 class="size-3.5 opacity-80" /> CLONE
                            </Button>
                            
                            <Button 
                              v-if="runnerStore.canEditSelected"
                              variant="outline" 
                              size="sm" 
                              class="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-destructive hover:text-destructive-foreground bg-destructive/5 hover:bg-destructive/10 transition-all border-destructive/20 font-bold tracking-widest text-[10px] shadow-xs uppercase shrink-0"
                              title="Delete this Profile"
                              :disabled="runnerStore.running"
                              @click="runnerStore.deleteSelectedSetupProfile"
                            >
                              <Trash2 class="size-3.5 opacity-80" /> DELETE
                            </Button>
                          </div>
                        </div>
                      </div>

                         <div class="min-w-0 flex-1 relative px-0.5">
                          <template v-if="runnerStore.selectedProfile">
                            <div ref="uiStore.issueSearchContainerRef" class="relative group/identity flex flex-col pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div class="flex items-center gap-2">
                                <div class="relative flex-1 flex items-center bg-muted/20 border border-primary/5 shadow-inner-sm rounded-2xl px-3.5 transition-all focus-within:bg-background focus-within:border-primary/30 focus-within:shadow-md h-11"
                                     :class="[!uiStore.isNamingSqlSnippet ? 'ring-primary/5' : '']">
                                  <Pencil class="size-4 text-muted-foreground/30 mr-2.5 shrink-0 group-focus-within/identity:text-primary transition-colors" />
                                  <Input 
                                    ref="uiStore.profileNameInput" 
                                    v-model="runnerStore.editableProfileName" 
                                    class="font-bold h-full border-0 bg-transparent focus-visible:ring-0 px-0 transition-all text-[15px] flex-1 min-w-0 cursor-text shadow-none" 
                                    placeholder="Enter profile name (e.g. SKSE001)..."
                                    @focus="() => { if (!runnerStore.preventAutoSearch) uiStore.isIssueSearchVisible = true; }"
                                    @input="uiStore.isIssueSearchVisible = true"
                                    @blur="runnerStore.commitProfileName"
                                    @keydown.enter="runnerStore.commitProfileName" 
                                  />
                                  <div v-if="runnerStore.backlogIssueKey" class="flex items-center shrink-0 ml-2 group/badge transition-all rounded-lg overflow-hidden shadow-sm h-[26px]" :class="runnerStore.backlogIssueNotFound ? 'opacity-70 border border-dashed border-muted-foreground grayscale' : ''">
                                    <div class="flex items-center gap-1.5 px-2.5 h-full text-[9px] font-black shrink-0 text-white"
                                         :style="{ backgroundColor: runnerStore.backlogIssueColor || 'var(--primary)' }"
                                         :title="runnerStore.backlogIssueNotFound ? 'Issue may have been deleted' : runnerStore.backlogIssueSummary">
                                      <ShieldAlert v-if="runnerStore.backlogIssueNotFound" class="size-3 shrink-0 text-white" />
                                      <span class="block text-left" :class="runnerStore.backlogIssueNotFound ? 'line-through' : ''">{{ runnerStore.backlogIssueKey }}</span>
                                      <button v-if="runnerStore.backlogIssueNotFound || !runnerStore.backlogIssueStatusName" @click.stop="runnerStore.unlinkBacklogIssue" 
                                              class="hover:bg-white/30 rounded-full p-0.5 transition-colors opacity-60 group-hover/badge:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed ml-0.5" 
                                              title="Unlink issue">
                                        <X class="size-2.5" />
                                      </button>
                                    </div>
                                    <div v-if="!runnerStore.backlogIssueNotFound && runnerStore.backlogIssueStatusName" 
                                         class="flex items-center gap-1 px-2 h-full border-l border-white/40 text-[9px] font-bold shrink-0 text-white"
                                         :style="{ backgroundColor: runnerStore.backlogIssueStatusColor || '#999' }">
                                      <span class="block">{{ runnerStore.backlogIssueStatusName }}</span>
                                      <button @click.stop="runnerStore.unlinkBacklogIssue" 
                                              class="hover:bg-white/30 rounded-full p-0.5 transition-colors opacity-60 group-hover/badge:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed" 
                                              title="Unlink issue">
                                        <X class="size-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <!-- Unified Search Dropdown under Title -->
                              <div v-if="uiStore.isIssueSearchVisible && backlogStore.backlog.profile && !runnerStore.backlogIssueKey" 
                                   class="absolute top-12 left-0 w-full z-50 bg-card/95 backdrop-blur-xl border border-primary/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 origin-top">
                                <div class="p-2 border-b border-white/5 bg-primary/5 flex items-center justify-between">
                                  <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Suggestions from Backlog</span>
                                  <Button variant="ghost" size="icon" class="h-5 w-5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive" @click="uiStore.isIssueSearchVisible = false">
                                    <Plus class="size-3 rotate-45" />
                                  </Button> 
                                </div>
                                <div class="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                  <div v-if="runnerStore.filteredBacklogIssues.length === 0" class="py-12 text-center flex flex-col items-center">
                                    <Search class="size-8 mx-auto opacity-10 mb-2" />
                                    <p class="text-[10px] uppercase font-bold text-muted-foreground opacity-40 mb-3">No issues found</p>
                                    <Button v-if="runnerStore.issueSearchQuery.trim()" variant="outline" size="sm" class="h-7 text-[10px] uppercase tracking-widest font-bold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" @mousedown.prevent="uiStore.isIssueSearchVisible = false; runnerStore.commitProfileName()">
                                      <Plus class="size-3 mr-1" /> Use "{{ runnerStore.issueSearchQuery.trim() }}"
                                    </Button>
                                  </div>
                                  <button v-for="issue in runnerStore.filteredBacklogIssues.slice(0, 15)" :key="issue.id"
                                          class="w-full flex flex-col items-start p-2.5 rounded-xl transition-all hover:bg-primary/10 group/item text-left"
                                          @mousedown.prevent="runnerStore.selectBacklogIssue(issue); uiStore.isIssueSearchVisible = false; uiStore.profileNameInput?.focus()">
                                    <div class="flex flex-col gap-1.5 items-start w-full min-w-0">
                                      <div class="flex items-center gap-2 w-full min-w-0">
                                        <div class="inline-flex max-w-[50%] h-5 px-1.5 rounded-[4px] border border-b-2 text-[10px] font-mono font-bold items-center justify-center uppercase tracking-normal bg-background shadow-xs transition-all active:translate-y-px active:border-b truncate shrink-0" 
                                             :title="issue.issueKey">
                                          <span class="truncate block w-full">{{ issue.issueKey }}</span>  
                                        </div>
                                        <span v-if="issue.issueType" class="text-[9px] font-bold px-1.5 py-0.5 rounded text-white truncate shrink-0" 
                                              :style="{ backgroundColor: issue.issueType.color }"
                                              :title="issue.issueType.name">{{ issue.issueType.name }}</span>
                                        <span v-if="issue.status" class="text-[9px] font-bold px-1.5 py-0.5 rounded text-white truncate shrink-0" 
                                              :style="{ backgroundColor: issue.status.color || '#999' }"
                                              :title="issue.status.name">{{ issue.status.name }}</span>
                                      </div>
                                      <span class="text-[11px] font-bold text-foreground opacity-80 pl-0.5 block w-full truncate" :title="issue.summary">{{ issue.summary }}</span>
                                      <div v-if="issue.assignee" class="flex items-center gap-1.5 text-[9px] font-medium text-muted-foreground pl-0.5 mt-1 w-full">
                                        <Avatar size="sm" class="h-4 w-4 ring-1 ring-primary/20 shrink-0">
                                          <AvatarImage v-if="backlogStore.backlog.userAvatars[issue.assignee.id]" :src="backlogStore.backlog.userAvatars[issue.assignee.id]" :alt="issue.assignee.name" />
                                          <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[7px] font-bold">{{ runnerStore.initials(issue.assignee.name) }}</AvatarFallback>
                                        </Avatar>
                                        <span class="truncate">{{ issue.assignee.name }}</span>
                                      </div>
                                    </div>
                                  </button>
                                </div>
                              </div>

                              <div class="mt-4 pt-4 border-t border-dashed border-border/40 px-2 pb-2">
                                <div class="flex items-center justify-between mb-2">
                                  <div class="flex items-center gap-2">
                                    <Label class="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
                                      <Target class="size-3 text-primary/60" />
                                      <span>Build Targets</span>
                                    </Label>
                                    
                                    <Dialog>
                                      <DialogTrigger as-child>
                                        <Button variant="ghost" size="icon" class="size-5 h-5 w-5 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group/settings" title="Configuration & SQL Setup">
                                          <Settings2 class="size-2.5 group-hover/settings:rotate-90 transition-transform duration-500" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent class="max-w-6xl w-[90vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-primary/20 shadow-2xl rounded-2xl">
                                        <DialogHeader class="px-6 py-4 border-b bg-muted/30">
                                          <div class="flex items-center gap-3">
                                            <div class="p-2 rounded-xl bg-primary/10 text-primary">
                                              <Settings2 class="size-5" />
                                            </div>
                                            <div>
                                              <DialogTitle class="text-xl font-black uppercase tracking-tight">Project Configuration</DialogTitle>
                                              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">SQL Setup & App.config Template</p>
                                            </div>
                                          </div>
                                        </DialogHeader>
                                        
                                        <div class="flex-1 overflow-hidden p-6">
                                            <Tabs defaultValue="target" class="h-full flex flex-col gap-6">
                                              <TabsList class="grid w-full grid-cols-3 h-10 p-1 bg-muted/50 rounded-xl">
                                                <TabsTrigger value="target" class="rounded-lg font-bold uppercase tracking-widest text-[11px]">Target Config (Test)</TabsTrigger>
                                                <TabsTrigger value="run" class="rounded-lg font-bold uppercase tracking-widest text-[11px]">Run Config (Exe)</TabsTrigger>
                                                <TabsTrigger value="conn" class="rounded-lg font-bold uppercase tracking-widest text-[11px]">Connection Strings</TabsTrigger>
                                              </TabsList>
                                              
                                              <TabsContent value="target" class="flex flex-col flex-1 min-h-0 mt-0 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                                 <!-- 1. App.config Setup (Target/Test) -->
                                                 <div class="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-2xl overflow-hidden bg-background/50 shadow-inner">
                                                    <div class="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-primary/10 shrink-0">
                                                      <div class="flex items-center gap-2">
                                                        <div class="size-2 rounded-full bg-blue-500"></div>
                                                        <Label class="text-[10px] uppercase font-black text-muted-foreground tracking-widest">App.config (Target Template)</Label>
                                                      </div>
                                                    </div>
                                                    <Textarea v-model="runnerStore.configTemplate" 
                                                              class="flex-1 font-mono text-[11px] p-4 leading-relaxed bg-transparent border-0 focus-visible:ring-0 resize-none custom-scrollbar rounded-none" 
                                                              placeholder="<!-- XML Template content (for Test) -->" />
                                                 </div>
          
                                              </TabsContent>
          
                                              <TabsContent value="run" class="flex flex-col flex-1 min-h-0 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                 <div class="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-2xl overflow-hidden bg-background/50 shadow-inner">
                                                    <div class="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-primary/10 shrink-0">
                                                      <div class="flex items-center gap-2">
                                                        <div class="size-2 rounded-full bg-green-500"></div>
                                                        <Label class="text-[10px] uppercase font-black text-muted-foreground tracking-widest">App.config (Run Template)</Label>
                                                      </div>
                                                    </div>
                                                    <Textarea v-model="runnerStore.runConfigTemplate" 
                                                              class="flex-1 font-mono text-[11px] p-4 leading-relaxed bg-transparent border-0 focus-visible:ring-0 resize-none custom-scrollbar rounded-none" 
                                                              placeholder="<!-- Run XML content -->" />
                                                 </div>
                                              </TabsContent>
                                              <TabsContent value="conn" class="flex flex-col flex-1 min-h-0 mt-0 animate-in fade-in slide-in-from-top-4 duration-300">
                                                 <div class="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-2xl overflow-hidden bg-background/50 shadow-inner">
                                                    <div class="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-primary/10 shrink-0">
                                                      <div class="flex items-center gap-2">
                                                        <div class="size-2 rounded-full bg-orange-500"></div>
                                                        <Label class="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Connection Strings Override</Label>
                                                      </div>
                                                    </div>
                                                    <Textarea v-model="runnerStore.connectionStringTemplate" 
                                                              class="flex-1 font-mono text-[11px] p-4 leading-relaxed bg-transparent border-0 focus-visible:ring-0 resize-none custom-scrollbar rounded-none" 
                                                              placeholder="<connectionStrings>&#10;  <add name=&quot;EntityFramework&quot; connectionString=&quot;Data Source=...;Initial Catalog=...;Integrated Security=True&quot; />&#10;</connectionStrings>" />
                                                    <div class="px-4 py-2 bg-primary/5 text-[9px] font-bold text-primary/60 uppercase tracking-widest border-t border-primary/5">
                                                      SQL Server and Database will still be automatically mapped.
                                                    </div>
                                                 </div>
                                              </TabsContent>
                                            </Tabs>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                    
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      class="size-5 h-5 w-5 bg-primary/5 hover:bg-primary/10 text-primary/60 transition-all rounded-full" 
                                      title="Check Sync Status Now"
                                      @click.stop="runnerStore.checkProjectSyncs"
                                    >
                                      <RefreshCw class="size-2.5" />
                                    </Button>
                                  </div>
                                  <span class="text-[9px] font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">
                                    {{ runnerStore.selectedBuildProjects.size }} / {{ runnerStore.discoveredProjects.length }}
                                  </span>
                                </div>
                                
                                <div class="space-y-1.5">
                                  <Select>
                                    <SelectTrigger class="w-full h-11 bg-background/50 border-input hover:bg-background hover:border-primary/40 hover:shadow-md text-xs font-bold transition-all px-4 rounded-xl shadow-sm">
                                      <SelectValue>
                                        {{ runnerStore.selectedBuildProjects.size > 0 
                                          ? runnerStore.selectedBuildProjects.size + ' project(s) selected' 
                                          : '+ Select build targets' }}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent class="p-0">
                                      <div class="p-2 border-b border-border/30 space-y-2">
                                        <div class="relative group/search">
                                          <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/30 group-focus-within/search:text-primary transition-colors" />
                                          <Input 
                                            v-model="runnerStore.buildProjectSearch" 
                                            placeholder="Filter projects..."
                                            class="h-9 text-[11px] pl-9 pr-8 bg-muted/20 border-primary/5 focus-visible:ring-primary/20 focus-visible:bg-background transition-all rounded-xl"
                                          />
                                          <button 
                                            v-if="runnerStore.buildProjectSearch"
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-destructive transition-colors"
                                            @click.stop="runnerStore.buildProjectSearch = ''"
                                          >
                                            <X class="size-3" />
                                          </button>
                                        </div>
                                        <div class="flex items-center justify-between w-full px-1">
                                          <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-black">Available Targets</span>
                                        </div>
                                      </div>
                                        
                                        <div class="p-2 border-b border-border/30 space-y-1.5 pt-0">
                                          <div class="flex items-center justify-between">
                                            <button 
                                              v-if="runnerStore.filteredBuildProjects.length > 0"
                                              class="text-[9px] font-medium text-primary hover:text-primary/80"
                                              @click.stop="runnerStore.selectedBuildProjects.size === runnerStore.filteredBuildProjects.length ? runnerStore.selectedBuildProjects.clear() : runnerStore.selectedBuildProjects = new Set(runnerStore.filteredBuildProjects.map((p: any) => p.root))"
                                            >
                                              {{ runnerStore.selectedBuildProjects.size === runnerStore.filteredBuildProjects.length ? 'Uncheck All' : 'Check All' }}
                                            </button>
                                            <span v-else></span>
                                          </div>
                                        </div>
                                        
                                        <div class="max-h-[180px] overflow-y-auto custom-scrollbar p-1">
                                          <div v-if="runnerStore.filteredBuildProjects.length === 0" class="px-2 py-3 text-[10px] text-muted-foreground/50 text-center italic">
                                            No projects found
                                          </div>
                                          <div 
                                            v-for="proj in runnerStore.filteredBuildProjects" 
                                            :key="proj.root"
                                            class="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 cursor-pointer transition-all"
                                            :class="runnerStore.selectedBuildProjects.has(proj.root) ? 'bg-primary/5' : ''"
                                            @click="runnerStore.toggleBuildProject(proj.root)"
                                          >
                                            <div 
                                              class="w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 shadow-sm"
                                              :class="runnerStore.selectedBuildProjects.has(proj.root) 
                                                ? 'bg-primary border-primary text-primary-foreground' 
                                                : 'border-border/50 bg-background'"
                                            >
                                              <Check v-if="runnerStore.selectedBuildProjects.has(proj.root)" class="size-2.5" />
                                            </div>
                                            <div class="flex-1 min-w-0">
                                              <div class="flex items-center gap-1.5">
                                                <div class="text-[12px] font-bold truncate text-foreground/80 group-hover:text-primary transition-colors">{{ proj.name }}</div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                    </SelectContent>
                                  </Select>
                                  
                                  <TransitionGroup name="list-stagger" tag="div" class="space-y-1.5">
                                    <div v-for="proj in runnerStore.discoveredProjects.filter((p: any) => runnerStore.selectedBuildProjects.has(p.root))" 
                                         :key="proj.root" 
                                         class="group relative flex items-stretch rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer h-12 bg-background/40 border-primary/5 hover:border-primary/20 hover:bg-muted/30"
                                    >
                                      <!-- Sync Status Indicator Bar -->
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger as-child>
                                            <div 
                                              class="w-9 flex flex-col items-center justify-center border-r border-primary/5 transition-all duration-300"
                                              :class="[
                                                !runnerStore.projectSyncStates[proj.root] || runnerStore.projectSyncStates[proj.root] === 'missing' 
                                                  ? 'bg-muted/10 opacity-50' 
                                                  : runnerStore.projectSyncStates[proj.root] === 'synced'
                                                    ? 'bg-emerald-500/10'
                                                    : 'bg-amber-500/10'
                                              ]"
                                            >
                                              <div 
                                                class="size-5 rounded-md flex items-center justify-center transition-all duration-300"
                                                :class="[
                                                  !runnerStore.projectSyncStates[proj.root] || runnerStore.projectSyncStates[proj.root] === 'missing' 
                                                    ? 'text-muted-foreground/30' 
                                                    : runnerStore.projectSyncStates[proj.root] === 'synced'
                                                      ? 'text-emerald-500 bg-emerald-500/10'
                                                      : 'text-amber-500 bg-amber-500/10'
                                                ]"
                                              >
                                                <Hammer class="size-3" />
                                              </div>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="right">
                                            <div class="text-[10px] font-medium">
                                              <span v-if="runnerStore.projectSyncStates[proj.root] === 'synced'">✅ Configuration Synchronized</span>
                                              <span v-else-if="runnerStore.projectSyncStates[proj.root] === 'mismatch'">️⚠️ Config Mismatch (Needs Rebuild)</span>
                                              <span v-else>⚪ No config detected in output</span>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
    
                                      <div class="flex-1 flex flex-col justify-center p-2.5 min-w-0 pr-10">
                                        <div class="flex items-center gap-2 min-w-0">
                                          <div class="text-[11px] font-black truncate text-foreground/80 group-hover:text-primary transition-colors leading-tight">{{ proj.name }}</div>
                                        </div>
                                      </div>
                                      
                                      <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0">
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          class="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive text-destructive/50 transition-all" 
                                          @click.stop="runnerStore.toggleBuildProject(proj.root)"
                                          title="Remove Target"
                                        >
                                          <X class="size-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </TransitionGroup>
                                  
                                  <div v-if="runnerStore.selectedBuildProjects.size === 0" class="text-[10px] text-muted-foreground/40 italic text-center py-1">
                                    No targets selected - all projects will be built
                                  </div>
                                </div>
                              </div>
                            </div>

                    <div class="space-y-4 pt-4 mt-2 border-t border-primary/10">
                          <div class="flex items-center justify-between px-1">
                            <div class="flex items-center gap-2">
                              <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
                                <TerminalSquare class="size-4" />
                              </div>
                              <div class="flex flex-col">
                                <span class="text-[11px] font-black uppercase tracking-tight text-foreground/90">Test Configuration</span>
                                <span class="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Execution Mode</span>
                              </div>
                            </div>

                            <div class="relative flex items-center bg-muted/30 p-1 rounded-[14px] border border-primary/5 shadow-inner-sm overflow-hidden" style="min-width: 180px;">
                              <!-- Sliding Background Indicator -->
                              <div 
                                class="absolute top-1 bottom-1 left-1 rounded-xl bg-background shadow-md border border-primary/10 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                :style="{ 
                                  width: 'calc(50% - 4px)', 
                                  transform: runnerStore.isExeTestMode ? 'translateX(100%)' : 'translateX(0)' 
                                }"
                              ></div>
                              
                              <button @click="runnerStore.isExeTestMode = false" 
                                      class="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-colors duration-300"
                                      :class="!runnerStore.isExeTestMode ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'">
                                <Code2 class="size-3" />
                                <span>BAT</span>
                              </button>
                              <button @click="runnerStore.isExeTestMode = true" 
                                      class="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-colors duration-300"
                                      :class="runnerStore.isExeTestMode ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'">
                                <Box class="size-3" />
                                <span>EXE</span>
                              </button>
                            </div>
                          </div>

                          <div v-if="!runnerStore.isExeTestMode" class="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                            <!-- Top-level Addition Trigger -->
                            <Button 
                              variant="outline" 
                              class="w-full h-11 bg-background/50 border-primary/10 hover:bg-background hover:border-primary/40 hover:shadow-md text-xs font-bold transition-all px-4 rounded-xl shadow-sm group/add-bat flex items-center justify-between"
                              @click="() => { 
                                if (!runnerStore.batFilePath) {
                                  runnerStore.browseBatFile();
                                } else {
                                  if(!runnerStore.batFiles) runnerStore.batFiles = [];
                                  runnerStore.batFiles.push('');
                                }
                              }"
                            >
                              <div class="flex items-center gap-2">
                                <Plus class="size-4 text-primary group-hover/add-bat:scale-110 transition-transform" />
                                <span>Add Batch Script</span>
                              </div>
                              <span class="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Select File</span>
                            </Button>

                            <div class="grid grid-cols-1 gap-2.5">
                              <!-- Main BAT File Card (Uniform) -->
                              <div 
                                class="group relative flex items-stretch rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer h-12 bg-background/40 border-primary/5 hover:border-primary/20 hover:bg-muted/30" 
                                @click="runnerStore.activeBatConfigIndex = 0" 
                                :class="runnerStore.activeBatConfigIndex === 0 
                                  ? 'bg-primary/5 border-primary/30 shadow-primary/5 ring-1 ring-primary/20' 
                                  : ''"
                              >
                                <!-- Index Indicator -->
                                <div class="w-9 flex flex-col items-center justify-center border-r border-primary/5 transition-colors"
                                     :class="runnerStore.activeBatConfigIndex === 0 ? 'bg-primary/10' : 'bg-muted/10 group-hover:bg-primary/5'">
                                  <span class="text-[10px] font-black" :class="runnerStore.activeBatConfigIndex === 0 ? 'text-primary' : 'text-muted-foreground/40'">01</span>
                                </div>

                                <div class="flex-1 flex flex-col justify-center p-2.5 min-w-0 pr-10">
                                  <div class="flex items-center gap-2 min-w-0">
                                    <div class="size-6 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                                      <TerminalSquare class="size-3.5 text-primary" />
                                    </div>
                                    <div v-if="runnerStore.batFilePath" class="flex items-center text-[11px] font-mono leading-tight truncate min-w-0">
                                      <span class="opacity-40 truncate">{{ runnerStore.batFilePath.replace(/[^/\\]+$/, '') }}</span>
                                      <span class="font-black text-primary whitespace-nowrap">{{ runnerStore.batFilePath.match(/[^/\\]+$/)?.[0] }}</span>
                                    </div>
                                    <span v-else class="text-[11px] font-bold italic text-muted-foreground/30">Entry point script...</span>
                                  </div>
                                </div>

                                <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0">
                                  <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg bg-background/80 border shadow-sm hover:text-primary transition-all" @click.stop="() => runnerStore.browseBatFile()" title="Browse File">
                                    <FolderOpen class="size-3.5" />
                                  </Button>
                                </div>
                              </div>

                              <!-- Chained BAT Files -->
                              <TransitionGroup name="list-stagger">
                                <div v-for="(_bat, idx) in runnerStore.batFiles" :key="idx" 
                                     class="group relative flex items-stretch rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer h-12 bg-background/40 border-primary/5 hover:border-primary/20 hover:bg-muted/30" 
                                     @click="runnerStore.activeBatConfigIndex = idx + 1" 
                                     :class="runnerStore.activeBatConfigIndex === idx + 1 
                                      ? 'bg-primary/5 border-primary/40 shadow-primary/5 ring-1 ring-primary/20' 
                                      : ''"
                                >
                                  <div class="w-9 flex flex-col items-center justify-center border-r border-primary/5 transition-colors"
                                       :class="runnerStore.activeBatConfigIndex === idx + 1 ? 'bg-primary/10' : 'bg-muted/10 group-hover:bg-primary/5'">
                                    <span class="text-[10px] font-black" :class="runnerStore.activeBatConfigIndex === idx + 1 ? 'text-primary' : 'text-muted-foreground/40'">{{ (idx + 2).toString().padStart(2, '0') }}</span>
                                  </div>

                                  <div class="flex-1 flex flex-col justify-center p-2.5 min-w-0 pr-10">
                                    <div class="flex items-center gap-2 min-w-0">
                                      <div class="size-6 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                                        <TerminalSquare class="size-3.5 text-primary/70" />
                                      </div>
                                      <div v-if="runnerStore.batFiles[idx]" class="flex items-center text-[11px] font-mono leading-tight truncate min-w-0">
                                        <span class="opacity-40 truncate">{{ runnerStore.batFiles[idx].replace(/[^/\\]+$/, '') }}</span>
                                        <span class="font-black text-primary/90 whitespace-nowrap">{{ runnerStore.batFiles[idx].match(/[^/\\]+$/)?.[0] }}</span>
                                      </div>
                                      <span v-else class="text-[11px] font-bold italic text-muted-foreground/30">Select script...</span>
                                    </div>
                                  </div>

                                  <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0">
                                    <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg bg-background/80 backdrop-blur-sm border shadow-sm hover:text-primary transition-all" @click.stop="() => runnerStore.browseBatFile(idx)" title="Browse File">
                                      <FolderOpen class="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 shadow-sm hover:scale-105 transition-all" @click.stop="runnerStore.removeBatConfig(idx)" title="Remove Script">
                                      <Trash2 class="size-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </TransitionGroup>
                            </div>
                          </div>
                          
                          <div class="space-y-1.5 pt-1">
                            <div class="flex flex-col px-1">
                              <div class="flex items-center justify-between mb-1 pb-0.5 border-b border-primary/5">
                                <Label class="text-[10px] font-black text-foreground/70 uppercase tracking-tighter flex items-center gap-1.5">
                                  <div class="p-0.5 rounded bg-muted/50">
                                    <TerminalSquare class="size-3 text-primary" />
                                  </div>
                                  <span>{{ runnerStore.isExeTestMode ? 'EXE ARGUMENTS' : 'BAT ARGUMENTS' }}</span>
                                </Label>
                                <span class="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">Workbench</span>
                              </div>
                              
                              <div v-if="!runnerStore.isExeTestMode" class="relative flex flex-col group/args gap-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div class="flex items-center gap-1 w-full">
                                  <div class="flex-1 relative">
                                    <Select v-model="runnerStore.currentBatArgId" @update:model-value="(v: any) => runnerStore.onArgSnippetSelected('bat', v)" :disabled="runnerStore.currentBatArgSnippets.length === 0">
                                      <SelectTrigger class="h-8 text-[11px] font-bold bg-background/50 border-primary/10 hover:border-primary/30 focus:ring-primary/20 transition-all w-full rounded-xl shadow-xs">
                                        <SelectValue placeholder="Select Script Argument..." class="truncate" />
                                      </SelectTrigger>
                                      <SelectContent class="bg-card/95 backdrop-blur-2xl border-primary/10 rounded-xl shadow-2xl">
                                        <div v-for="snippet in runnerStore.currentBatArgSnippets" :key="snippet.id" class="flex items-center px-1 py-0.5">
                                          <SelectItem :value="snippet.id" class="text-[10px] font-bold py-2.5 flex-1 cursor-pointer rounded-lg">
                                            {{ snippet.name }}
                                          </SelectItem>
                                        </div>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div class="flex items-center bg-muted/30 p-1 rounded-xl border border-primary/10 shadow-inner-sm">
                                    <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all" @click="runnerStore.startNamingArgSnippet('create', 'bat')" title="New Argument">
                                      <Plus class="size-3" />
                                    </Button>
                                    <div class="w-px h-3 bg-primary/10 mx-0.5"></div>
                                    <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all" @click="runnerStore.startNamingArgSnippet('rename', 'bat')" :disabled="runnerStore.currentBatArgSnippets.length === 0" title="Rename">
                                      <Pencil class="size-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-all" @click="runnerStore.deleteActiveArgSnippet('bat')" :disabled="runnerStore.currentBatArgSnippets.length === 0" title="Delete">
                                      <Trash2 class="size-3" />
                                    </Button>
                                  </div>
                                </div>

                                <div class="group/input relative flex items-center w-full">
                                  <div class="absolute inset-0 bg-primary/5 blur-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity"></div>
                                  <Input 
                                    ref="argsInputRefBat" 
                                    v-model="runnerStore.currentBatArgs" 
                                    @update:model-value="(v: any) => { const s = runnerStore.runArgSnippets.find(x => x.id === runnerStore.currentBatArgId); if(s) s.content = v; }" 
                                    placeholder="Enter parameters (e.g. -debug -v)..." 
                                    class="relative h-9 pr-24 pl-3 text-[12px] font-mono bg-background/30 border-primary/10 transition-all focus-visible:ring-primary/20 focus-visible:bg-background focus-visible:border-primary/30 rounded-xl shadow-xs selection:bg-primary/30" 
                                  />
                                  <div class="absolute right-1 flex items-center gap-1">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger as-child>
                                          <Button variant="ghost" size="sm" class="h-6 px-1.5 font-bold text-[8px] text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-all rounded-md border border-transparent hover:border-primary/10" @click="runnerStore.insertTimePlaceholder">
                                            {time}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>ISO Timestamp</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger as-child>
                                          <Button variant="ghost" size="sm" class="h-6 px-1.5 font-bold text-[8px] text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-all rounded-md border border-transparent hover:border-primary/10" @click="runnerStore.insertHostnamePlaceholder">
                                            {host}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Hostname</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>
                              </div>
                              
                              <div v-else class="relative flex flex-col group/args gap-1 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div class="flex items-center gap-1 w-full">
                                  <div class="flex-1 relative">
                                    <Select v-model="runnerStore.activeExeArgId" @update:model-value="(v: any) => runnerStore.onArgSnippetSelected('exe', v)" :disabled="runnerStore.exeArgSnippets.length === 0">
                                      <SelectTrigger class="h-8 text-[11px] font-bold bg-background/50 border-primary/10 hover:border-primary/30 focus:ring-primary/20 transition-all w-full rounded-xl shadow-xs">
                                        <SelectValue placeholder="Select Application parameters..." class="truncate" />
                                      </SelectTrigger>
                                      <SelectContent class="bg-card/95 backdrop-blur-2xl border-primary/10 rounded-xl shadow-2xl">
                                        <div v-for="snippet in runnerStore.exeArgSnippets" :key="snippet.id" class="flex items-center px-1 py-0.5">
                                          <SelectItem :value="snippet.id" class="text-[10px] font-bold py-2.5 flex-1 cursor-pointer rounded-lg">
                                            {{ snippet.name }}
                                          </SelectItem>
                                        </div>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div class="flex items-center bg-muted/30 p-1 rounded-xl border border-primary/10 shadow-inner-sm">
                                    <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all" @click="runnerStore.startNamingArgSnippet('create', 'exe')" title="New Argument">
                                      <Plus class="size-3" />
                                    </Button>
                                    <div class="w-px h-3 bg-primary/10 mx-0.5"></div>
                                    <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all" @click="runnerStore.startNamingArgSnippet('rename', 'exe')" :disabled="runnerStore.exeArgSnippets.length === 0" title="Rename">
                                      <Pencil class="size-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-all" @click="runnerStore.deleteActiveArgSnippet('exe')" :disabled="runnerStore.exeArgSnippets.length === 0" title="Delete">
                                      <Trash2 class="size-3" />
                                    </Button>
                                  </div>
                                </div>

                                <div class="group/input relative flex items-center w-full">
                                  <div class="absolute inset-0 bg-primary/5 blur-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity"></div>
                                  <Input 
                                    ref="argsInputRefExe" 
                                    v-model="runnerStore.exeArgs" 
                                    @update:model-value="(v: any) => { const s = runnerStore.exeArgSnippets.find(x => x.id === runnerStore.activeExeArgId); if(s) s.content = v; }" 
                                    placeholder="Enter parameters (e.g. 100 200)..." 
                                    class="relative h-9 pr-24 pl-3 text-[12px] font-mono bg-background/30 border-primary/10 transition-all focus-visible:ring-primary/20 focus-visible:bg-background focus-visible:border-primary/30 rounded-xl shadow-xs selection:bg-primary/30" 
                                  />
                                  <div class="absolute right-1 flex items-center gap-1">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger as-child>
                                          <Button variant="ghost" size="sm" class="h-6 px-1.5 font-bold text-[8px] text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-all rounded-md border border-transparent hover:border-primary/10" @click="runnerStore.insertTimePlaceholder">
                                            {time}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>ISO Timestamp</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger as-child>
                                          <Button variant="ghost" size="sm" class="h-6 px-1.5 font-bold text-[8px] text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-all rounded-md border border-transparent hover:border-primary/10" @click="runnerStore.insertHostnamePlaceholder">
                                            {host}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Hostname</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div class="space-y-4 pb-2 border-t border-white/5 pt-3">
                            <!-- SQL Snippets & Execution -->
                            <div class="space-y-1.5 min-h-0">
                              <div class="flex items-center justify-between px-0.5 mb-1.5">
                                <Label class="text-[9px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1.5">
                                  <Code2 class="size-3.5 text-primary opacity-80" /> SQL Scripts
                                </Label>

                                <div class="flex items-center gap-2">
                                  <span class="text-[8px] font-black py-0.5 px-2 rounded bg-primary/10 text-primary uppercase tracking-tighter">Profile-specific scripts</span>
                                  <div class="w-px h-3 bg-white/10"></div>
                                  <Button variant="ghost" size="sm" class="h-7 px-3.5 text-[9px] font-black tracking-widest text-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-500 transition-all flex items-center gap-2 rounded-lg group/full border border-cyan-500/20 bg-cyan-500/5 shadow-sm" title="Open Fullscreen Editor (Serious Mode)" @click="uiStore.isSqlEditorFullscreen = true">
                                    <Maximize2 class="size-3 group-hover/full:scale-110 transition-transform" />
                                    FULLSCREEN
                                  </Button>
                                </div>
                              </div>
                              <div class="flex gap-1.5">
                                <Button variant="ghost" size="sm" class="h-5 px-2.5 py-0 text-[8.5px] font-black tracking-widest text-[#FF7500] hover:bg-[#FF7500]/10 hover:text-[#FF7500] rounded-md shadow-sm border border-[#FF7500]/20 bg-[#FF7500]/5" title="Run All Scripts" @click="runnerStore.runAllSqlSnippets" :disabled="!runnerStore.canExecuteSelected || runnerStore.sqlSnippets.length === 0">
                                  <ListTree class="size-2.5 mr-1" /> RUN ALL
                                </Button>
                                <Button variant="ghost" size="sm" class="h-5 px-2.5 py-0 text-[8.5px] font-black tracking-widest text-primary hover:bg-primary/10 hover:text-primary rounded-md shadow-sm border border-primary/20 bg-primary/5" title="Run Current Script" @click="runnerStore.runSqlOnly" :disabled="!runnerStore.canExecuteSelected || runnerStore.sqlSnippets.length === 0">
                                  <Play class="size-2.5 mr-1" /> RUN
                                </Button>
                              </div>
                            </div>
                              
                              <div class="flex items-center gap-1.5 p-1.5 rounded-xl bg-muted/40 shadow-inner border border-primary/5">
                                <Select v-model="runnerStore.activeSqlSnippetId" @update:model-value="(v: any) => runnerStore.onSnippetSelected(v)" :disabled="runnerStore.sqlSnippets.length === 0">
                                  <SelectTrigger class="h-8 flex-1 text-[10px] font-bold bg-background shadow-sm border-primary/10 rounded-lg hover:border-primary/30 transition-colors">
                                    <SelectValue placeholder="No scripts found..." />
                                  </SelectTrigger>
                                  <SelectContent class="max-w-[250px] shadow-xl">
                                    <SelectItem v-for="snippet in runnerStore.sqlSnippets" :key="snippet.id" :value="snippet.id" class="text-[10px] font-medium py-2">
                                      <div class="flex items-center gap-2">
                                        <Code2 class="size-3.5 text-primary/70" />
                                        <span>{{ snippet.name }}</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                <div class="w-px h-5 bg-border/80 mx-0.5"></div>

                                <Button variant="outline" size="sm" class="h-8 px-3 rounded-lg border-primary/20 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground shadow-sm transition-all focus:ring-2 focus:ring-primary/20 font-black tracking-widest text-[9px]" @click="runnerStore.createNewSqlSnippet" title="Create a new query script">
                                  <Plus class="size-3.5 mr-1.5" /> CREATE
                                </Button>
                                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-lg hover:bg-background shadow-xs text-muted-foreground transition-all" @click="runnerStore.renameActiveSqlSnippet" :disabled="runnerStore.sqlSnippets.length === 0" title="Rename Script">
                                  <Pencil class="size-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-lg hover:bg-destructive shadow-xs hover:text-destructive-foreground text-destructive/80 transition-all" @click="runnerStore.deleteActiveSqlSnippet" :disabled="runnerStore.sqlSnippets.length === 0" title="Delete Script">
                                  <Trash2 class="size-3.5" />
                                </Button>
                              </div>

                              <SqlEditor
                                v-model="runnerStore.sqlSetupPath"
                                placeholder="-- Write SQL queries here..."
                                height="260px"
                                font-size="11px"
                                :is-dark="uiStore.isDarkMode"
                                :disabled="runnerStore.sqlSnippets.length === 0"
                                :show-result="uiStore.showSqlResult"
                                :result-data="uiStore.sqlResultData"
                                :is-running="uiStore.isSqlRunning"
                                @toggleResult="uiStore.showSqlResult = !uiStore.showSqlResult"
                                @change="(v: string) => { 
                                   console.log('[SQL Editor] Change triggered, activeSqlSnippetId:', runnerStore.activeSqlSnippetId);
                                   const s = runnerStore.sqlSnippets.find(s => s.id === runnerStore.activeSqlSnippetId);
                                   if(s) s.content = v;
                                   
                                   // Directly update in setupProfiles and save
                                   const profile = runnerStore.setupProfiles?.find((p: any) => p.id === runnerStore.selectedSetupId);
                                    if(profile && profile.sqlSnippets) {
                                      const snippetIdx = profile.sqlSnippets.findIndex((s: any) => s.id === runnerStore.activeSqlSnippetId);
                                      if(snippetIdx >= 0) {
                                        profile.sqlSnippets[snippetIdx].content = v;
                                       profile.isLocalEdited = true;
                                       profile.updatedAt = Date.now();
                                       runnerStore.saveSetupsForCurrentRoot();
                                       runnerStore.triggerSync(runnerStore.selectedSetupId);
                                       console.log('[SQL Editor] Saved to profile, snippetIdx:', snippetIdx);
                                     } else {
                                       console.log('[SQL Editor] Snippet not found in profile sqlSnippets');
                                     }
                                   } else {
                                     console.log('[SQL Editor] Profile not found');
                                   }
                               }"
                              />
                             </div>
                           </div>
                         </template>
                         <template v-else>
                           <div class="flex-1 h-full flex flex-col items-center justify-center p-12 text-center opacity-30 animate-in fade-in zoom-in-95 duration-700">
                             <div class="p-8 rounded-full bg-muted/20 mb-8 ring-1 ring-border/50 shadow-inner relative group/fallback">
                               <div class="absolute inset-0 bg-primary/10 rounded-full blur-2xl opacity-0 group-hover/fallback:opacity-100 transition-opacity duration-1000"></div>
                               <UserCircle2 class="size-20 text-muted-foreground/20 relative z-10" />
                             </div>
                             <h3 class="text-2xl font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4">No Profile Selected</h3>
                             <p class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 max-w-[280px] leading-loose">Choose a profile from the left sidebar to access build targets and SQL configuration.</p>
                           </div>
                         </template>
 
                       </div>
                     </div>
                   </div>
                 </div>
               </section>
             </div>
            <div class="flex-1 h-full flex flex-col gap-4 min-w-0 pt-2 pr-6 pl-2 pb-0 overflow-hidden">
              <section class="rounded-3xl bg-card/25 flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-2xl">
                <!-- Header with Session Switcher -->
                <div class="px-3 py-1 flex items-center justify-between gap-4 border-b bg-muted/50 shrink-0 w-full min-w-0">
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mr-2">Terminal</span>
                  </div>

                  <div class="flex items-center justify-end gap-3 flex-1 min-w-0 overflow-hidden">
                    <div class="flex items-center gap-1 bg-background/50 p-1 rounded-md border shadow-inner flex-nowrap overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ml-auto max-w-full" v-if="terminalStore.termState.terminals && terminalStore.termState.terminals.length > 1">
                      <button v-for="(tId, idx) in (terminalStore.termState.terminals || [])" :key="tId"
                              @click="terminalStore.switchTerminal(tId)" 
                              :class="terminalStore.termState.active === tId ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
                              class="px-2.5 py-0.5 rounded-sm text-[10px] font-bold transition-all uppercase tracking-tighter max-w-[150px] truncate shrink-0 whitespace-nowrap" :title="terminalStore.termState[tId]?.name || tId">
                        {{ idx + 1 }} {{ tId === 'main' ? 'Shell' : (terminalStore.termState[tId]?.name || 'Run ' + idx) }}
                      </button>
                    </div>

                    <div class="flex items-center gap-1 border-l ml-1 pl-1 shrink-0">
                      <Button variant="ghost" size="sm" class="h-6 w-6 p-0 text-muted-foreground hover:text-primary transition-colors" title="Jump to Project Root" @click="terminalStore.cdToRoot">
                        <Home class="size-3" />
                      </Button>
                      <Button variant="ghost" size="sm" class="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors" @click="terminalStore.clearLogs">Clear</Button>
                    </div>
                  </div>
                </div>

                <div class="flex-1 flex flex-row min-h-0 min-w-0 bg-card relative overflow-hidden">
                  <div class="flex-1 relative min-w-0 min-h-0">
                    <!-- Main Shell Viewport -->
                    <div :class="terminalStore.termState.active === 'main' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'" ref="mainTermRef" class="absolute inset-0 overflow-hidden terminal-custom-scroll"></div>
                    
                    <!-- Run Output Viewport -->
                    <div v-for="tId in (terminalStore.termState.terminals || []).filter((t: any) => t !== 'main')" :key="tId" :class="terminalStore.termState.active === tId ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'" :id="'term-' + tId" class="absolute inset-0 overflow-hidden terminal-custom-scroll"></div>
                  </div>
                    <!-- Premium Vertical Execution Sidebar -->
                  <div class="w-14 border-l bg-muted/40 flex flex-col shrink-0 overflow-y-auto scrollbar-none z-10 relative">
                    <TooltipProvider>
                      <div class="flex-1"></div>

                      <div class="flex flex-col items-center py-8 gap-6 relative">
                        <!-- Status Indicator with Glow -->
                        <div class="flex flex-col items-center gap-2 mb-4 group/status cursor-default">
                          <div class="size-2 rounded-full transition-all duration-500" 
                               :class="runnerStore.running ? 'bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]' : 'bg-zinc-700 shadow-[0_0_4px_rgba(0,0,0,0.5)]'">
                          </div>
                          <span class="text-[7.5px] uppercase tracking-[0.15em] font-bold transition-colors duration-300" 
                                :class="runnerStore.running ? 'text-green-400' : 'text-zinc-600'">
                            {{ runnerStore.running ? 'Run' : 'Idle' }}
                          </span>
                        </div>

                        <div class="w-8 h-px bg-white/10 opacity-50"></div>

                        <!-- Build Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90 relative"
                                    :class="((runnerStore.buildStatus || runnerStore.loadingTarget === 'build') ? '' : (!runnerStore.canBuild || runnerStore.loadingTarget || runnerStore.buildStatus) ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50')"
                                    :disabled="!runnerStore.canBuild || !!runnerStore.loadingTarget || !!runnerStore.buildStatus"
                                    @click="runnerStore.dotnet('build')">
                              <div :class="runnerStore.buildStatus ? 'animate-hammer-grow' : ''">
                                <component :is="runnerStore.loadingTarget === 'build' ? RotateCcw : Hammer" 
                                           :class="[
                                             'size-4 transition-all duration-300',
                                             runnerStore.loadingTarget === 'build' ? 'animate-spin' : '',
                                             runnerStore.buildStatus ? 'animate-hammer-hit text-[#FC6400]' : 'group-hover/btn:rotate-12 text-zinc-500'
                                           ]" />
                              </div>
                              <div v-if="runnerStore.buildStatus" class="absolute size-4 bg-[#FAC000]/40 rounded-full animate-spark-pop blur-sm z-0"></div>
                              <span class="text-[7.5px] uppercase tracking-tighter font-bold transition-all duration-300" 
                                    :class="runnerStore.buildStatus ? 'text-[#FF7500] animate-pulse scale-110' : 'text-zinc-600'">
                                {{ runnerStore.loadingTarget === 'build' ? '...' : (runnerStore.buildStatus ? 'Building' : 'Build') }}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-zinc-400 font-semibold tracking-wide">Build Project</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runnerStore.shortcuts.build" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        
                        <!-- Rebuild Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90 relative"
                                    :class="(runnerStore.loadingTarget === 'rebuild') ? 'text-zinc-200' : (!runnerStore.canBuild || runnerStore.loadingTarget || runnerStore.buildStatus) ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50'"
                                    :disabled="!runnerStore.canBuild || !!runnerStore.loadingTarget || !!runnerStore.buildStatus"
                                    @click="runnerStore.rebuild">
                              <RotateCcw :class="[
                                           'size-4 transition-transform duration-300',
                                           runnerStore.loadingTarget === 'rebuild' ? 'animate-spin' : 'group-hover/btn:-rotate-45'
                                         ]" />
                              <span class="text-[8px] uppercase tracking-wide font-semibold">{{ runnerStore.loadingTarget === 'rebuild' ? '...' : 'Rebuild' }}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-zinc-400 font-semibold tracking-wide">Rebuild All</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runnerStore.shortcuts.rebuild" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>

                        <div class="w-8 h-px bg-white/10 opacity-50 my-1"></div>

                        <!-- Test Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-blue-500" 
                                    :class="((runnerStore.canTest && runnerStore.loadingTarget === 'bat') ? 'text-blue-500' : (runnerStore.canTest && !runnerStore.loadingTarget && !runnerStore.buildStatus) 
                                      ? 'text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                      : 'text-zinc-700 cursor-not-allowed opacity-40')"
                                    :disabled="!runnerStore.canTest || !!runnerStore.loadingTarget || !!runnerStore.buildStatus"
                                    @click="runnerStore.dotnet('run', 'bat')">
                              <div class="relative inline-flex">
                                <div v-if="runnerStore.autoWatchTargetTest" class="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 border border-card shadow-sm z-10" title="Watch Test Mode Active">
                                  <RefreshCw class="size-2 text-white animate-spin-slow" />
                                </div>
                                <component :is="runnerStore.loadingTarget === 'bat' ? RotateCcw : (runnerStore.isExeTestMode ? TerminalSquare : Beaker)"
                                           :class="[
                                             'size-5 transition-transform duration-300',
                                             runnerStore.loadingTarget === 'bat' ? 'animate-spin' : 'group-hover/btn:-rotate-12'
                                           ]" />
                              </div>
                              <span class="text-[7px] uppercase tracking-wide font-bold truncate max-w-[46px] text-center">{{ runnerStore.loadingTarget === 'bat' ? '...' : 'Test' }}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-blue-400 font-semibold tracking-wide">Run Test (BAT)</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runnerStore.shortcuts.test" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>

                        <!-- Run Button with Tooltip -->
                        <template v-if="!runnerStore.running">
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button variant="ghost" 
                                      class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-green-500" 
                                      :class="(runnerStore.loadingTarget === 'exe') ? 'opacity-100' : (!runnerStore.canRun || runnerStore.loadingTarget || runnerStore.buildStatus) ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:text-green-400 hover:bg-green-500/10'"
                                      :disabled="!runnerStore.canRun || !!runnerStore.loadingTarget || !!runnerStore.buildStatus"
                                      @click="runnerStore.dotnet('run', 'exe')">
                                <div class="relative inline-flex">
                                  <div v-if="runnerStore.autoWatchTargetRun" class="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 border border-card shadow-sm z-10" title="Watch Run Mode Active">
                                    <RefreshCw class="size-2 text-white animate-spin-slow" />
                                  </div>
                                  <component :is="runnerStore.loadingTarget === 'exe' ? RotateCcw : Play"
                                             :class="[
                                               'size-5 transition-transform duration-300',
                                               runnerStore.loadingTarget === 'exe' ? 'animate-spin' : 'fill-current group-hover/btn:scale-110'
                                             ]" />
                                </div>
                                <span class="text-[8px] uppercase tracking-wide font-bold">{{ runnerStore.loadingTarget === 'exe' ? '...' : 'Run' }}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" :side-offset="12">
                              <div class="flex items-center gap-3">
                                <span class="text-green-400 font-semibold tracking-wide">Run Application</span>
                                <div class="h-4 w-px bg-white/10"></div>
                                <HotkeyLabel :shortcut="runnerStore.shortcuts.run" size="lg" variant="solid" />
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </template>

                        <!-- Stop Button with Tooltip -->
                        <template v-else>
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button variant="ghost" 
                                      class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-red-500 hover:text-red-400 hover:bg-red-500/10 relative" 
                                      @click="runnerStore.stop">
                                <Square class="size-5 fill-current group-hover/btn:drop-shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all" />
                                <span class="text-[8px] uppercase tracking-wide font-bold">Stop</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" :side-offset="12">
                              <div class="flex items-center gap-3">
                                <span class="text-red-400 font-semibold tracking-wide">Stop Execution</span>
                                <div class="h-4 w-px bg-white/10"></div>
                                <HotkeyLabel :shortcut="runnerStore.shortcuts.stop" size="lg" variant="solid" />
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </template>
                      </div>
                    </TooltipProvider>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </TabsContent>
</template>
