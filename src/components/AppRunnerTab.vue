<script setup lang="ts">
import { FolderOpen, Maximize2, Lock, Plus, Pencil, Trash2, Hammer, Play, Square, RotateCcw, Beaker, Home, Search, Clock, RefreshCw, ExternalLink, X, ShieldAlert, Cloud, History, Settings2, Code2, ListTree, Layers, FilePlus2, AppWindow, TerminalSquare, FileDown, Monitor } from "lucide-vue-next";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import SqlEditor from "@/components/SqlEditor.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openUrl } from "@tauri-apps/plugin-opener";
import HotkeyLabel from "@/components/HotkeyLabel.vue";
import {
applySelectedProject,
  argsInputRefBat,
  argsInputRefExe,
  backlog,
  backlogIssueUrl,
  browseBatFile,
  canBuild,
  canEditSelected,
  canExecuteSelected,
  canRun,
  canTest,
  cdToRoot,
  clearLogs,
  cloneSelectedSetupProfile,
  commitProfileName,
  createNewSetupProfile,
  createNewSqlSnippet,
  currentBatArgId,
  currentBatArgSnippets,
  currentBatArgs,
  currentUser,
  deleteActiveArgSnippet,
  deleteActiveSqlSnippet,
  deleteSelectedSetupProfile,
  discoveredProjects,
  dotnet,
  editableProfileName,
  exportProfileToDoc,
  filteredBacklogIssues,
  filteredDiscoveredProjects,
  filteredOwnerOptions,
  initials,
  insertHostnamePlaceholder,
  insertTimePlaceholder,
  isFetchingProfile,
  isNamingSqlSnippet,
  isSqlSnippetFullscreen,
  issueSearchContainerRef,
  issueSearchQuery,
  lastSyncTime,
  mainScrollRef,
  mainTermRef,
  onArgSnippetSelected,
  onSnippetSelected,
  ownerSearch,
  preventAutoSearch,
  profileNameInput,
  profileScope,
  profileSearch,
  projectSearch,
  rebuild,
  removeBatConfig,
  renameActiveSqlSnippet,
  runAllSqlSnippets,
  runSqlOnly,
  runner,
  scopedProfiles,
  selectBacklogIssue,
  selectedOwner,
  selectedProfile,
  selectedProjectRoot,
  selectedSetupId,
  showHistoryDialog,
  showIssueSearch,
  startNamingArgSnippet,
  stop,
  switchTerminal,
  syncProfilesWithCloudflare,
  syncService,
  syncStatus,
  termState,
  triggerSync,
  unlinkBacklogIssue
} from "@/composables/appBindings";
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
                    <div v-if="selectedProfile && selectedProfile.owner" class="text-[9px] px-2 py-0.5 rounded-full bg-muted font-medium uppercase tracking-tighter">{{ selectedProfile.owner }}</div>
                    <div v-if="selectedProfile && !canEditSelected" class="flex items-center gap-1.5">
                      <div class="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold uppercase tracking-tighter flex items-center gap-1.5 border border-amber-500/20 shadow-xs">
                        <Lock class="size-3" /> Local Edit
                      </div>
                      <Button 
                        v-if="syncService"
                        variant="outline" 
                        size="sm" 
                        class="h-6 px-3 rounded-full hover:bg-amber-500/10 text-amber-600 hover:text-amber-700 border-amber-500/20 transition-all gap-1.5 text-[10px] font-bold tracking-tight shadow-xs bg-transparent" 
                        title="Force Pull Latest from Cloud" 
                        :disabled="syncStatus === 'saving'"
                        @click="triggerSync(selectedSetupId, false, true)"
                      >
                        <RefreshCw v-if="syncStatus === 'saving'" class="size-3 animate-spin text-amber-500" />
                        <Cloud v-else class="size-3" />
                        <span>Pull Latest</span>
                      </Button>
                    </div>
                    
                    <!-- Professional Profile Sync Status -->
                    <div v-if="selectedProfile && selectedProfile.owner === currentUser" class="flex items-center gap-1.5">
                      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter transition-all border shadow-xs"
                           :class="syncStatus === 'saving' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : syncStatus === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-green-500/10 text-green-600 border-green-500/20'">
                        <RefreshCw v-if="syncStatus === 'saving'" class="size-3 animate-spin" />
                        <Cloud v-else class="size-3" />
                        <span v-if="syncStatus === 'saving'">Cloud Syncing...</span>
                        <span v-else-if="syncStatus === 'error'">Sync Error</span>
                        <span v-else>Cloud Protected <span v-if="lastSyncTime" class="opacity-70 ml-1 font-semibold">({{ new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }})</span></span>
                      </div>
                      <Button v-if="syncStatus !== 'saving'" 
                              variant="outline" 
                              size="sm" 
                              class="h-6 px-3 rounded-full hover:bg-green-500/10 text-green-600 hover:text-green-700 border-green-500/20 transition-all gap-1.5 text-[10px] font-bold tracking-tight shadow-xs bg-transparent" 
                              title="Refresh from Cloud" 
                              @click="() => syncProfilesWithCloudflare(undefined, false, true)">
                        <RefreshCw class="size-3" />
                        <span>Sync</span>
                      </Button>
                    </div>
                  </div>

                  <Button 
                    variant="default" 
                    size="sm" 
                    class="h-8 px-3.5 font-black uppercase text-[10px] tracking-widest relative group/create shrink-0 shadow-sm transition-all bg-primary/90 hover:bg-primary" 
                    :disabled="runner.running || backlog.status !== 'success'" 
                    @click="createNewSetupProfile"
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
                            <Select v-model="selectedOwner" :disabled="runner.running">
                              <SelectTrigger class="h-9 text-[10.5px] bg-muted/20 border-input pl-1.5 flex-1 overflow-hidden">
                                <div class="flex items-center gap-2 overflow-hidden text-left">
                                  <Avatar size="sm" class="h-5 w-5 ring-1 ring-primary/20">
                                    <AvatarImage v-if="backlog.userAvatarByName[selectedOwner || '']" :src="backlog.userAvatarByName[selectedOwner || '']" />
                                    <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[8px] font-bold">{{ initials(selectedOwner || "") }}</AvatarFallback>
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
                                    <input v-model="ownerSearch" 
                                           class="w-full bg-background border border-input h-9 text-[11px] pl-9 pr-2 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all font-medium" 
                                           placeholder="Filter owners..."
                                           @mousedown.stop
                                           @keydown.stop />
                                  </div>
                                </div>
                                <div class="max-h-[200px] overflow-y-auto custom-scrollbar">
                                  <SelectItem v-for="owner in filteredOwnerOptions" :key="owner" :value="owner" :text-value="owner">
                                    <template #leading>
                                      <Avatar size="sm" class="h-5 w-5 ring-1 ring-primary/20" aria-hidden="true">
                                        <AvatarImage v-if="backlog.userAvatarByName[owner]" :src="backlog.userAvatarByName[owner]" />
                                        <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[8px] font-bold">{{ initials(owner) }}</AvatarFallback>
                                      </Avatar>
                                    </template>
                                    <span class="text-[10.5px] font-medium">{{ owner }}</span>
                                  </SelectItem>
                                  <div v-if="filteredOwnerOptions.length === 0" class="px-2 py-4 text-center text-[10px] text-muted-foreground italic opacity-50">
                                    No owners found
                                  </div>
                                </div>
                              </SelectContent>
                            </Select>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              class="h-9 w-9 shrink-0 rounded-xl hover:bg-primary/10 transition-all duration-300"
                              :class="selectedOwner === currentUser && profileScope === 'personal' ? 'text-primary bg-primary/5 shadow-inner' : 'text-muted-foreground/60'"
                              @click="() => { selectedOwner = currentUser; profileScope = 'personal'; }"
                              title="My Profiles"
                            >
                              <Home class="size-4" :class="selectedOwner === currentUser && profileScope === 'personal' ? 'scale-110' : ''" />
                            </Button>
                          </div>

                          <!-- Row 4: Search -->
                          <div class="relative w-full">
                            <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground opacity-50" />
                            <Input v-model="profileSearch" placeholder="Search profiles..." :disabled="runner.running" class="pl-9 h-9 text-[11px]" />
                          </div>

                        </div>

                      <div class="flex-1 overflow-y-auto px-2 pt-2 pb-4 space-y-2 custom-scrollbar">
                        <button v-for="setup in scopedProfiles" :key="setup.id"
                                :disabled="runner.running"
                                class="w-full flex text-left rounded-xl p-3 transition-all duration-200 group/item relative border items-center gap-3 overflow-hidden shadow-sm"
                                :class="[
                                  setup.id === selectedSetupId 
                                    ? 'bg-card border-primary/40 shadow-md ring-1 ring-primary/20 scale-[1.01] z-10' 
                                    : 'bg-background/40 border-border/40 hover:bg-muted/60 hover:border-border/80 hover:shadow hover:scale-[1.005]',
                                  runner.running ? 'opacity-50 cursor-not-allowed' : ''
                                ]"
                                @click="selectedSetupId = setup.id">
                                 
                            <div class="flex-1 min-w-0 flex flex-col py-0.5">
                              <div class="flex items-start justify-between w-full mb-1 gap-2">
                                <div class="text-[14px] font-bold leading-tight text-foreground group-hover/item:text-primary transition-colors truncate flex-1 min-w-0">
                                  {{ setup.name }}
                                </div>
                                <div class="flex items-center gap-1.5 opacity-50 group-hover/item:opacity-100 transition-opacity shrink-0 mt-0.5">
                                  <!-- Cloud Icon for owned profiles -->
                                  <RefreshCw v-if="setup.id === selectedSetupId && (syncStatus === 'saving' || isFetchingProfile)" 
                                             class="size-3.5 text-green-500 animate-spin" />
                                  <Cloud v-else-if="setup.owner === currentUser" 
                                         class="size-3.5 transition-colors"
                                         :class="[
                                           setup.id === selectedSetupId && syncStatus === 'error' ? 'text-destructive' : 'text-primary/70'
                                         ]" />
                                  <Lock v-else class="size-3.5 text-muted-foreground/60" />
                                </div>
                              </div>
                              
                              <div class="flex items-center flex-wrap gap-x-2 gap-y-1 mt-0.5">
                                <div v-if="setup.backlogIssueKey" 
                                     class="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight text-muted-foreground bg-muted/60 border border-border/50">
                                  <div class="size-1.5 rounded-full" :style="{ backgroundColor: backlog.issues.find(i => i.issueKey === setup.backlogIssueKey)?.issueType?.color || 'var(--primary)' }"></div>
                                  {{ setup.backlogIssueKey }}
                                </div>
                                
                                <div class="flex items-center gap-1.5 overflow-hidden max-w-full">
                                  <FolderOpen class="size-3 text-muted-foreground/50 group-hover/item:text-primary/60 transition-colors shrink-0" />
                                  <div class="text-[11px] text-muted-foreground truncate font-medium opacity-80 group-hover/item:opacity-100 transition-opacity">
                                    {{ (() => {
                                      const ws = (runner.workspaceRoot || "").replace(/[\\/]$/, "");
                                      const fullRoot = setup.projectRoot ? `${ws}\\${setup.projectRoot}` : "";
                                      const normFull = fullRoot.replace(/\//g, "\\").toLowerCase();
                                      const found = discoveredProjects.find(p => (p.root || "").replace(/\//g, "\\").toLowerCase() === normFull);
                                      return found?.name || setup.projectRoot?.split('\\').pop() || "No project selected";
                                    })() }}
                                  </div>
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
                          <span v-if="selectedProfile" class="text-[9px] font-bold text-muted-foreground opacity-30 font-mono tracking-tighter mt-0.5 ml-0.5">ID: {{ selectedProfile.id }}</span>
                          <div v-else></div>

                          <div v-if="selectedProfile" class="flex items-center gap-2 shrink-0">
                            <div class="flex items-center bg-muted/40 border border-border/50 rounded-lg p-0.5 shadow-xs mr-1">
                              <Button 
                                v-if="syncService"
                                variant="ghost" 
                                size="icon" 
                                class="h-7 w-7 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all"
                                title="View History"
                                @click="showHistoryDialog = true"
                              >
                                <History class="size-3.5" />
                              </Button>

                              <div v-if="syncService && backlogIssueUrl" class="h-3 w-px bg-border/50 mx-0.5"></div>

                              <Button 
                                v-if="backlogIssueUrl"
                                variant="ghost" 
                                size="icon" 
                                class="h-7 w-7 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all"
                                title="View on Backlog"
                                @click="() => { if (backlogIssueUrl) openUrl(backlogIssueUrl); }"
                              >
                                <ExternalLink class="size-3.5" />
                              </Button>

                              <div v-if="backlogIssueUrl || syncService" class="h-3 w-px bg-border/50 mx-0.5"></div>

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                class="h-7 w-7 rounded-md hover:bg-background text-muted-foreground hover:text-primary transition-all"
                                title="Export Documentation"
                                @click="exportProfileToDoc"
                              >
                                <FileDown class="size-3.5" />
                              </Button>
                            </div>

                            <Button 
                              variant="outline" 
                              size="sm" 
                              class="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-primary hover:text-primary bg-primary/5 hover:bg-primary/10 transition-all border-primary/20 font-bold tracking-widest text-[10px] shadow-xs uppercase shrink-0"
                              title="Clone to your account"
                              :disabled="runner.running"
                              @click="cloneSelectedSetupProfile"
                            >
                              <FilePlus2 class="size-3.5 opacity-80" /> CLONE
                            </Button>
                            
                            <Button 
                              v-if="canEditSelected"
                              variant="outline" 
                              size="sm" 
                              class="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-destructive hover:text-destructive-foreground bg-destructive/5 hover:bg-destructive/10 transition-all border-destructive/20 font-bold tracking-widest text-[10px] shadow-xs uppercase shrink-0"
                              title="Delete this Profile"
                              :disabled="runner.running"
                              @click="deleteSelectedSetupProfile"
                            >
                              <Trash2 class="size-3.5 opacity-80" /> DELETE
                            </Button>
                          </div>
                        </div>

                        <div class="min-w-0 flex-1 relative">
                          <template v-if="selectedProfile">
                            <div ref="issueSearchContainerRef" class="relative group/identity flex flex-col pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div class="flex items-center gap-2">
                                <div class="relative flex-1 flex items-center bg-transparent border-b-2 border-transparent pb-0.5 rounded-none px-0 transition-all"
                                     :class="[!isNamingSqlSnippet ? 'focus-within:border-primary/50' : '']">
                                  <Input 
                                    ref="profileNameInput" 
                                    v-model="editableProfileName" 
                                    class="font-black h-10 border-0 bg-transparent focus-visible:ring-0 px-2 -ml-2 transition-all rounded-md text-xl flex-1 min-w-0 cursor-text shadow-none" 
                                    placeholder="Profile name or search issue..."
                                    @focus="() => { if (!preventAutoSearch) showIssueSearch = true; }"
                                    @input="showIssueSearch = true"
                                    @blur="commitProfileName"
                                    @keydown.enter="commitProfileName" 
                                  />
                                  <div v-if="runner.backlogIssueKey" class="flex items-center shrink-0 mx-1 group/badge transition-all rounded-lg overflow-hidden shadow-sm h-[26px]" :class="runner.backlogIssueNotFound ? 'opacity-70 border border-dashed border-muted-foreground grayscale' : ''">
                                    <div class="flex items-center gap-1.5 px-2.5 h-full text-[9px] font-black shrink-0 text-white"
                                         :style="{ backgroundColor: runner.backlogIssueColor || 'var(--primary)' }"
                                         :title="runner.backlogIssueNotFound ? 'Issue may have been deleted' : runner.backlogIssueSummary">
                                      <ShieldAlert v-if="runner.backlogIssueNotFound" class="size-3 shrink-0 text-white" />
                                      <span class="block text-left" :class="runner.backlogIssueNotFound ? 'line-through' : ''">{{ runner.backlogIssueKey }}</span>
                                      <button v-if="runner.backlogIssueNotFound || !runner.backlogIssueStatusName" @click.stop="unlinkBacklogIssue" 
                                              class="hover:bg-white/30 rounded-full p-0.5 transition-colors opacity-60 group-hover/badge:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed ml-0.5" 
                                              title="Unlink issue">
                                        <X class="size-2.5" />
                                      </button>
                                    </div>
                                    <div v-if="!runner.backlogIssueNotFound && runner.backlogIssueStatusName" 
                                         class="flex items-center gap-1 px-2 h-full border-l border-white/40 text-[9px] font-bold shrink-0 text-white"
                                         :style="{ backgroundColor: runner.backlogIssueStatusColor || '#999' }">
                                      <span class="block">{{ runner.backlogIssueStatusName }}</span>
                                      <button @click.stop="unlinkBacklogIssue" 
                                              class="hover:bg-white/30 rounded-full p-0.5 transition-colors opacity-60 group-hover/badge:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed" 
                                              title="Unlink issue">
                                        <X class="size-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <!-- Unified Search Dropdown under Title -->
                              <div v-if="showIssueSearch && backlog.profile && !runner.backlogIssueKey" 
                                   class="absolute top-12 left-0 w-full z-50 bg-card/95 backdrop-blur-xl border border-primary/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 origin-top">
                                <div class="p-2 border-b border-white/5 bg-primary/5 flex items-center justify-between">
                                  <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Suggestions from Backlog</span>
                                  <Button variant="ghost" size="icon" class="h-5 w-5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive" @click="showIssueSearch = false">
                                    <Plus class="size-3 rotate-45" />
                                  </Button> 
                                </div>
                                <div class="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                  <div v-if="filteredBacklogIssues.length === 0" class="py-12 text-center flex flex-col items-center">
                                    <Search class="size-8 mx-auto opacity-10 mb-2" />
                                    <p class="text-[10px] uppercase font-bold text-muted-foreground opacity-40 mb-3">No issues found</p>
                                    <Button v-if="issueSearchQuery.trim()" variant="outline" size="sm" class="h-7 text-[10px] uppercase tracking-widest font-bold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" @mousedown.prevent="showIssueSearch = false; commitProfileName()">
                                      <Plus class="size-3 mr-1" /> Use "{{ issueSearchQuery.trim() }}"
                                    </Button>
                                  </div>
                                  <button v-for="issue in filteredBacklogIssues.slice(0, 15)" :key="issue.id"
                                          class="w-full flex flex-col items-start p-2.5 rounded-xl transition-all hover:bg-primary/10 group/item text-left"
                                          @mousedown.prevent="selectBacklogIssue(issue); showIssueSearch = false; profileNameInput?.focus()">
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
                                          <AvatarImage v-if="backlog.userAvatars[issue.assignee.id]" :src="backlog.userAvatars[issue.assignee.id]" :alt="issue.assignee.name" />
                                          <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[7px] font-bold">{{ initials(issue.assignee.name) }}</AvatarFallback>
                                        </Avatar>
                                        <span class="truncate">{{ issue.assignee.name }}</span>
                                      </div>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </template>
                          <template v-else>
                            <h2 class="text-xl font-black tracking-tight text-muted-foreground/40 mt-1">Select a Profile</h2>
                          </template>
                        </div>
                      </div>

                      <div class="space-y-6 pt-2">
                        <div class="flex items-center justify-between mb-1.5 px-0.5">
                          <Label class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5"><AppWindow class="size-3.5 text-primary opacity-80" /> Target Project</Label>
                          
                          <Dialog>
                            <DialogTrigger as-child>
                              <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group/settings" title="Configuration & SQL Setup">
                                <Settings2 class="size-4 group-hover/settings:rotate-90 transition-transform duration-500" />
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
                                          <Textarea v-model="runner.configTemplate" 
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
                                          <Textarea v-model="runner.runConfigTemplate" 
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
                                          <Textarea v-model="runner.connectionStringTemplate" 
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
                        </div>
                            <Select v-model="selectedProjectRoot" @update:model-value="applySelectedProject">
                              <SelectTrigger class="w-full h-9 bg-muted/20 border-input">
                                <div class="truncate max-w-full font-medium text-xs">
                                  <SelectValue placeholder="Scan projects to select...">
                                    {{ discoveredProjects.find(p => p.root === selectedProjectRoot)?.name }}
                                  </SelectValue>
                                </div>
                              </SelectTrigger>
                              <SelectContent class="p-1">
                                <div class="py-2 px-1">
                                  <div class="relative">
                                    <Search class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground opacity-40" />
                                    <input v-model="projectSearch" 
                                           class="w-full bg-background border border-input h-9 text-[11px] pl-9 pr-2 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all font-medium" 
                                           placeholder="Filter projects..."
                                           @mousedown.stop
                                           @keydown.stop />
                                  </div>
                                </div>
                                <div class="max-h-[250px] overflow-y-auto custom-scrollbar">
                                  <SelectItem v-for="item in filteredDiscoveredProjects" :key="item.root" :value="item.root">
                                    <div class="flex flex-col items-start gap-0.5">
                                      <span class="text-xs font-bold">{{ item.name }}</span>
                                      <span class="text-[9px] text-muted-foreground opacity-60 truncate max-w-[300px]">{{ item.root }}</span>
                                    </div>
                                  </SelectItem>
                                </div>
                              </SelectContent>
                            </Select>
                          </div>


                        <div class="space-y-3 pt-2 mt-2 border-t border-border/40">
                          <div class="flex items-center justify-between px-0.5">
                            <Label class="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                              <TerminalSquare class="size-3.5 text-primary opacity-80" /> 
                              <span class="opacity-80">Test Configuration</span>
                            </Label>
                            <div class="flex items-center bg-muted/50 p-0.5 rounded-md border shadow-inner">
                              <button @click="runner.isExeTestMode = false" 
                                      :class="!runner.isExeTestMode ? 'bg-background shadow-sm text-foreground ring-1 ring-black/5 dark:ring-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
                                      class="px-2.5 py-0.5 rounded-sm text-[9px] font-bold transition-all uppercase tracking-wider">
                                BAT Mode
                              </button>
                              <button @click="runner.isExeTestMode = true" 
                                      :class="runner.isExeTestMode ? 'bg-background shadow-sm text-foreground ring-1 ring-black/5 dark:ring-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
                                      class="px-2.5 py-0.5 rounded-sm text-[9px] font-bold transition-all uppercase tracking-wider">
                                EXE Mode
                              </button>
                            </div>
                          </div>

                          <div v-if="!runner.isExeTestMode" class="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div class="flex flex-col gap-2">
                              <div class="flex items-center gap-1.5 p-1 rounded-xl border bg-card shadow-sm transition-all duration-200 group relative cursor-pointer" @click="runner.activeBatConfigIndex = 0" :class="runner.activeBatConfigIndex === 0 ? 'ring-1 ring-primary/50 border-primary/30 shadow-primary/5 bg-primary/5' : 'border-border/50 hover:border-border'">
                                <div class="flex-1 relative flex items-center h-8 pl-[34px] pr-2 overflow-hidden" :title="runner.batFilePath">
                                  <div class="absolute left-2 flex items-center justify-center size-5 rounded-md bg-primary/10 text-primary border border-primary/20 shadow-sm">
                                    <span class="text-[9px] font-black">1</span>
                                  </div>
                                  <div v-if="runner.batFilePath" class="flex items-center truncate text-xs font-mono w-full cursor-pointer pointer-events-none">
                                    <span class="truncate text-muted-foreground min-w-0">{{ runner.batFilePath.replace(/[^/\\]+$/, '') }}</span>
                                    <span class="font-bold text-primary shrink-0">{{ runner.batFilePath.match(/[^/\\]+$/)?.[0] || runner.batFilePath }}</span>
                                  </div>
                                  <div v-else class="text-xs font-mono text-muted-foreground/50 cursor-pointer pointer-events-none">.bat file</div>
                                </div>
                                <div class="flex items-center gap-0.5 pr-1 shrink-0 transition-opacity">
                                  <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-background hover:text-foreground shadow-sm border border-transparent hover:border-border/50 transition-all" @click.stop="() => browseBatFile()" title="Browse"><FolderOpen class="size-3.5" /></Button>
                                  <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-primary/10 hover:text-primary text-primary/70 transition-all" @click.stop="() => { if(!runner.batFiles) runner.batFiles = []; runner.batFiles.push(''); }" title="Add another .bat file"><Plus class="size-3.5" /></Button>
                                </div>
                              </div>
                              <div v-for="(_bat, idx) in runner.batFiles" :key="idx" class="flex items-center gap-1.5 p-1 rounded-xl border bg-card shadow-sm transition-all duration-200 group relative cursor-pointer" @click="runner.activeBatConfigIndex = idx + 1" :class="runner.activeBatConfigIndex === idx + 1 ? 'ring-1 ring-primary/50 border-primary/30 shadow-primary/5 bg-primary/5' : 'border-border/50 hover:border-border'">
                                <div class="flex-1 relative flex items-center h-8 pl-[34px] pr-2 overflow-hidden" :title="runner.batFiles[idx]">
                                  <div class="absolute left-2 flex items-center justify-center size-5 rounded-md bg-primary/10 text-primary border border-primary/20 shadow-sm">
                                    <span class="text-[9px] font-black">{{ idx + 2 }}</span>
                                  </div>
                                  <div v-if="runner.batFiles[idx]" class="flex items-center truncate text-xs font-mono w-full cursor-pointer pointer-events-none">
                                    <span class="truncate text-muted-foreground min-w-0">{{ runner.batFiles[idx].replace(/[^/\\]+$/, '') }}</span>
                                    <span class="font-bold text-primary shrink-0">{{ runner.batFiles[idx].match(/[^/\\]+$/)?.[0] || runner.batFiles[idx] }}</span>
                                  </div>
                                  <div v-else class="text-xs font-mono text-muted-foreground/50 cursor-pointer pointer-events-none">.bat file</div>
                                </div>
                                <div class="flex items-center gap-0.5 pr-1 shrink-0 transition-opacity">
                                  <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-background hover:text-foreground shadow-sm border border-transparent hover:border-border/50 transition-all" @click.stop="browseBatFile(idx)" title="Browse"><FolderOpen class="size-3.5" /></Button>
                                  <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-destructive/10 hover:text-destructive text-destructive/70 transition-all" @click.stop="removeBatConfig(idx)" title="Remove"><Trash2 class="size-3.5" /></Button>
                                </div>
                              </div>
                            </div>
                            <div class="flex items-center justify-end pr-1 mt-1.5">

                            </div>
                          </div>
                          
                          <div class="space-y-1.5 pb-2">
                            <div class="flex flex-col mb-2 px-1">
                              <Label class="text-[9px] font-bold text-muted-foreground uppercase mb-1.5 pl-0.5 flex items-center gap-1.5">
                                <span class="opacity-70">{{ runner.isExeTestMode ? 'EXE ARGUMENTS' : 'BAT ARGUMENTS' }}</span> 
                                <span class="text-[8px] opacity-40 normal-case font-normal leading-none">{{ runner.isExeTestMode ? '(passed to .exe during TEST)' : '(passed to .bat during TEST)' }}</span>
                              </Label>
                              
                              <div v-if="!runner.isExeTestMode" class="relative flex flex-col group/args animate-in fade-in slide-in-from-right-2 duration-300">
                                <div class="flex items-center gap-2 mb-2 w-full">
                                  <Select v-model="currentBatArgId" @update:model-value="(v: any) => onArgSnippetSelected('bat', v)" :disabled="currentBatArgSnippets.length === 0">
                                    <SelectTrigger class="h-7 text-xs font-mono bg-muted/50 border-primary/20 hover:border-primary/40 focus:ring-primary/20 transition-colors w-full flex-1">
                                      <SelectValue placeholder="Select Argument" class="truncate" />
                                    </SelectTrigger>
                                    <SelectContent class="bg-background/95 backdrop-blur-xl border-primary/20">
                                      <div v-for="snippet in currentBatArgSnippets" :key="snippet.id" class="flex items-center pl-2 pr-1 gap-2 hover:bg-muted/50">
                                        <SelectItem :value="snippet.id" class="text-[10px] font-medium py-2 flex-1 cursor-pointer">
                                          {{ snippet.name }}
                                        </SelectItem>
                                      </div>
                                    </SelectContent>
                                  </Select>
                                  <div class="flex items-center gap-1 transition-opacity">
                                    <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-background text-muted-foreground" @click="startNamingArgSnippet('create', 'bat')" title="New Argument">
                                      <Plus class="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-background text-muted-foreground" @click="startNamingArgSnippet('rename', 'bat')" :disabled="currentBatArgSnippets.length === 0" title="Rename">
                                      <Pencil class="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-destructive hover:text-destructive-foreground text-destructive/80" @click="deleteActiveArgSnippet('bat')" :disabled="currentBatArgSnippets.length === 0" title="Delete">
                                      <Trash2 class="size-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div class="relative flex items-center group/args w-full">
                                  <Input ref="argsInputRefBat" v-model="currentBatArgs" @update:model-value="(v: any) => { const s = runner.runArgSnippets.find(x => x.id === currentBatArgId); if(s) s.content = v; }" placeholder="-debug ..." class="pr-20 selection:bg-primary/30 selection:text-primary" />
                                  <div class="absolute right-1 flex items-center gap-0.5 transition-opacity">
                                    <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {time}" @click="insertTimePlaceholder">
                                      <Clock class="size-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {hostname}" @click="insertHostnamePlaceholder">
                                      <Monitor class="size-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              
                              <div v-else class="relative flex flex-col group/args animate-in fade-in slide-in-from-right-2 duration-300">
                                <div class="flex items-center gap-2 mb-2 w-full">
                                  <Select v-model="runner.activeExeArgId" @update:model-value="(v: any) => onArgSnippetSelected('exe', v)" :disabled="runner.exeArgSnippets.length === 0">
                                    <SelectTrigger class="h-7 text-xs font-mono bg-muted/50 border-primary/20 hover:border-primary/40 focus:ring-primary/20 transition-colors w-full flex-1">
                                      <SelectValue placeholder="Select Argument" class="truncate" />
                                    </SelectTrigger>
                                    <SelectContent class="bg-background/95 backdrop-blur-xl border-primary/20">
                                      <div v-for="snippet in runner.exeArgSnippets" :key="snippet.id" class="flex items-center pl-2 pr-1 gap-2 hover:bg-muted/50">
                                        <SelectItem :value="snippet.id" class="text-[10px] font-medium py-2 flex-1 cursor-pointer">
                                          {{ snippet.name }}
                                        </SelectItem>
                                      </div>
                                    </SelectContent>
                                  </Select>
                                  <div class="flex items-center gap-1 transition-opacity">
                                    <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-background text-muted-foreground" @click="startNamingArgSnippet('create', 'exe')" title="New Argument">
                                      <Plus class="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-background text-muted-foreground" @click="startNamingArgSnippet('rename', 'exe')" :disabled="runner.exeArgSnippets.length === 0" title="Rename">
                                      <Pencil class="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-destructive hover:text-destructive-foreground text-destructive/80" @click="deleteActiveArgSnippet('exe')" :disabled="runner.exeArgSnippets.length === 0" title="Delete">
                                      <Trash2 class="size-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div class="relative flex items-center group/args w-full">
                                  <Input ref="argsInputRefExe" v-model="runner.exeArgs" @update:model-value="(v: any) => { const s = runner.exeArgSnippets.find(x => x.id === runner.activeExeArgId); if(s) s.content = v; }" placeholder="1 2 3 4 5 ..." class="pr-20 selection:bg-primary/30 selection:text-primary" />
                                  <div class="absolute right-1 flex items-center gap-0.5 transition-opacity">
                                    <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {time}" @click="insertTimePlaceholder">
                                      <Clock class="size-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-primary" title="Insert {hostname}" @click="insertHostnamePlaceholder">
                                      <Monitor class="size-3" />
                                    </Button>
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
                                  <Button variant="ghost" size="sm" class="h-7 px-3.5 text-[9px] font-black tracking-widest text-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-500 transition-all flex items-center gap-2 rounded-lg group/full border border-cyan-500/20 bg-cyan-500/5 shadow-sm" title="Open Fullscreen Editor (Serious Mode)" @click="isSqlSnippetFullscreen = true">
                                    <Maximize2 class="size-3 group-hover/full:scale-110 transition-transform" />
                                    FULLSCREEN
                                  </Button>
                                </div>
                              </div>
                              <div class="flex gap-1.5">
                                <Button variant="ghost" size="sm" class="h-5 px-2.5 py-0 text-[8.5px] font-black tracking-widest text-[#FF7500] hover:bg-[#FF7500]/10 hover:text-[#FF7500] rounded-md shadow-sm border border-[#FF7500]/20 bg-[#FF7500]/5" title="Run All Scripts" @click="runAllSqlSnippets" :disabled="!canExecuteSelected || runner.sqlSnippets.length === 0">
                                  <ListTree class="size-2.5 mr-1" /> RUN ALL
                                </Button>
                                <Button variant="ghost" size="sm" class="h-5 px-2.5 py-0 text-[8.5px] font-black tracking-widest text-primary hover:bg-primary/10 hover:text-primary rounded-md shadow-sm border border-primary/20 bg-primary/5" title="Run Current Script" @click="runSqlOnly" :disabled="!canExecuteSelected || runner.sqlSnippets.length === 0">
                                  <Play class="size-2.5 mr-1" /> RUN
                                </Button>
                              </div>
                            </div>
                              
                              <div class="flex items-center gap-1.5 p-1.5 rounded-xl bg-muted/40 shadow-inner border border-primary/5">
                                <Select v-model="runner.activeSqlSnippetId" @update:model-value="(v: any) => onSnippetSelected(v)" :disabled="runner.sqlSnippets.length === 0">
                                  <SelectTrigger class="h-8 flex-1 text-[10px] font-bold bg-background shadow-sm border-primary/10 rounded-lg hover:border-primary/30 transition-colors">
                                    <SelectValue placeholder="No scripts found..." />
                                  </SelectTrigger>
                                  <SelectContent class="max-w-[250px] shadow-xl">
                                    <SelectItem v-for="snippet in runner.sqlSnippets" :key="snippet.id" :value="snippet.id" class="text-[10px] font-medium py-2">
                                      <div class="flex items-center gap-2">
                                        <Code2 class="size-3.5 text-primary/70" />
                                        <span>{{ snippet.name }}</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                <div class="w-px h-5 bg-border/80 mx-0.5"></div>

                                <Button variant="outline" size="sm" class="h-8 px-3 rounded-lg border-primary/20 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground shadow-sm transition-all focus:ring-2 focus:ring-primary/20 font-black tracking-widest text-[9px]" @click="createNewSqlSnippet" title="Create a new query script">
                                  <Plus class="size-3.5 mr-1.5" /> CREATE
                                </Button>
                                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-lg hover:bg-background shadow-xs text-muted-foreground transition-all" @click="renameActiveSqlSnippet" :disabled="runner.sqlSnippets.length === 0" title="Rename Script">
                                  <Pencil class="size-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-lg hover:bg-destructive shadow-xs hover:text-destructive-foreground text-destructive/80 transition-all" @click="deleteActiveSqlSnippet" :disabled="runner.sqlSnippets.length === 0" title="Delete Script">
                                  <Trash2 class="size-3.5" />
                                </Button>
                              </div>

                              <SqlEditor
                                v-model="runner.sqlSetupPath"
                                placeholder="-- Write SQL queries here..."
                                height="260px"
                                font-size="11px"
                                :disabled="runner.sqlSnippets.length === 0"
                                @change="(v: string) => { 
                                   const s = runner.sqlSnippets.find(s => s.id === runner.activeSqlSnippetId);
                                   if(s) s.content = v;
                                }"
                              />
                            </div>
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
                    <div class="flex items-center gap-1 bg-background/50 p-1 rounded-md border shadow-inner flex-nowrap overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ml-auto max-w-full" v-if="termState.terminals && termState.terminals.length > 1">
                      <button v-for="(tId, idx) in (termState.terminals || [])" :key="tId"
                              @click="switchTerminal(tId)" 
                              :class="termState.active === tId ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
                              class="px-2.5 py-0.5 rounded-sm text-[10px] font-bold transition-all uppercase tracking-tighter max-w-[150px] truncate shrink-0 whitespace-nowrap" :title="termState[tId]?.name || tId">
                        {{ idx + 1 }} {{ tId === 'main' ? 'Shell' : (termState[tId]?.name || 'Run ' + idx) }}
                      </button>
                    </div>

                    <div class="flex items-center gap-1 border-l ml-1 pl-1 shrink-0">
                      <Button variant="ghost" size="sm" class="h-6 w-6 p-0 text-muted-foreground hover:text-primary transition-colors" title="Jump to Project Root" @click="cdToRoot">
                        <Home class="size-3" />
                      </Button>
                      <Button variant="ghost" size="sm" class="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors" @click="clearLogs">Clear</Button>
                    </div>
                  </div>
                </div>

                <div class="flex-1 flex flex-row min-h-0 min-w-0 bg-card relative overflow-hidden">
                  <div class="flex-1 relative min-w-0 min-h-0">
                    <!-- Main Shell Viewport -->
                    <div :class="termState.active === 'main' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'" ref="mainTermRef" class="absolute inset-0 overflow-hidden terminal-custom-scroll"></div>
                    
                    <!-- Run Output Viewport -->
                    <div v-for="tId in (termState.terminals || []).filter((t: any) => t !== 'main')" :key="tId" :class="termState.active === tId ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'" :id="'term-' + tId" class="absolute inset-0 overflow-hidden terminal-custom-scroll"></div>
                  </div>
                    <!-- Premium Vertical Execution Sidebar -->
                  <div class="w-14 border-l bg-muted/40 flex flex-col shrink-0 overflow-y-auto scrollbar-none z-10 relative">
                    <TooltipProvider>
                      <div class="flex-1"></div>

                      <div class="flex flex-col items-center py-8 gap-6 relative">
                        <!-- Status Indicator with Glow -->
                        <div class="flex flex-col items-center gap-2 mb-4 group/status cursor-default">
                          <div class="size-2 rounded-full transition-all duration-500" 
                               :class="runner.running ? 'bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]' : 'bg-zinc-700 shadow-[0_0_4px_rgba(0,0,0,0.5)]'">
                          </div>
                          <span class="text-[7.5px] uppercase tracking-[0.15em] font-bold transition-colors duration-300" 
                                :class="runner.running ? 'text-green-400' : 'text-zinc-600'">
                            {{ runner.running ? 'Run' : 'Idle' }}
                          </span>
                        </div>

                        <div class="w-8 h-px bg-white/10 opacity-50"></div>

                        <!-- Build Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90 relative"
                                    :class="((runner.buildStatus || runner.loadingTarget === 'build') ? '' : (!canBuild || runner.loadingTarget || runner.buildStatus) ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50')"
                                    :disabled="!canBuild || !!runner.loadingTarget || !!runner.buildStatus"
                                    @click="dotnet('build')">
                              <div :class="runner.buildStatus ? 'animate-hammer-grow' : ''">
                                <component :is="runner.loadingTarget === 'build' ? RotateCcw : Hammer" 
                                           :class="[
                                             'size-4 transition-all duration-300',
                                             runner.loadingTarget === 'build' ? 'animate-spin' : '',
                                             runner.buildStatus ? 'animate-hammer-hit text-[#FC6400]' : 'group-hover/btn:rotate-12 text-zinc-500'
                                           ]" />
                              </div>
                              <div v-if="runner.buildStatus" class="absolute size-4 bg-[#FAC000]/40 rounded-full animate-spark-pop blur-sm z-0"></div>
                              <span class="text-[7.5px] uppercase tracking-tighter font-bold transition-all duration-300" 
                                    :class="runner.buildStatus ? 'text-[#FF7500] animate-pulse scale-110' : 'text-zinc-600'">
                                {{ runner.loadingTarget === 'build' ? '...' : (runner.buildStatus ? 'Building' : 'Build') }}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-zinc-400 font-semibold tracking-wide">Build Project</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runner.shortcuts.build" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        
                        <!-- Rebuild Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-90 relative"
                                    :class="(runner.loadingTarget === 'rebuild') ? 'text-zinc-200' : (!canBuild || runner.loadingTarget || runner.buildStatus) ? 'text-zinc-700 cursor-not-allowed opacity-40' : 'text-zinc-500 hover:text-foreground dark:hover:text-white hover:bg-muted/50'"
                                    :disabled="!canBuild || !!runner.loadingTarget || !!runner.buildStatus"
                                    @click="rebuild">
                              <RotateCcw :class="[
                                           'size-4 transition-transform duration-300',
                                           runner.loadingTarget === 'rebuild' ? 'animate-spin' : 'group-hover/btn:-rotate-45'
                                         ]" />
                              <span class="text-[8px] uppercase tracking-wide font-semibold">{{ runner.loadingTarget === 'rebuild' ? '...' : 'Rebuild' }}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-zinc-400 font-semibold tracking-wide">Rebuild All</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runner.shortcuts.rebuild" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>

                        <div class="w-8 h-px bg-white/10 opacity-50 my-1"></div>

                        <!-- Test Button with Tooltip -->
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" 
                                    class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-blue-500" 
                                    :class="((canTest && runner.loadingTarget === 'bat') ? 'text-blue-500' : (canTest && !runner.loadingTarget && !runner.buildStatus) 
                                      ? 'text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                      : 'text-zinc-700 cursor-not-allowed opacity-40')"
                                    :disabled="!canTest || !!runner.loadingTarget || !!runner.buildStatus"
                                    @click="dotnet('run', 'bat')">
                              <div class="relative inline-flex">
                                <div v-if="runner.autoWatchTargetTest" class="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 border border-card shadow-sm z-10" title="Watch Test Mode Active">
                                  <RefreshCw class="size-2 text-white animate-spin-slow" />
                                </div>
                                <component :is="runner.loadingTarget === 'bat' ? RotateCcw : (runner.isExeTestMode ? TerminalSquare : Beaker)"
                                           :class="[
                                             'size-5 transition-transform duration-300',
                                             runner.loadingTarget === 'bat' ? 'animate-spin' : 'group-hover/btn:-rotate-12'
                                           ]" />
                              </div>
                              <span class="text-[7px] uppercase tracking-wide font-bold truncate max-w-[46px] text-center">{{ runner.loadingTarget === 'bat' ? '...' : 'Test' }}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" :side-offset="12">
                            <div class="flex items-center gap-3">
                              <span class="text-blue-400 font-semibold tracking-wide">Run Test (BAT)</span>
                              <div class="h-4 w-px bg-white/10"></div>
                              <HotkeyLabel :shortcut="runner.shortcuts.test" size="lg" variant="solid" />
                            </div>
                          </TooltipContent>
                        </Tooltip>

                        <!-- Run Button with Tooltip -->
                        <template v-if="!runner.running">
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button variant="ghost" 
                                      class="w-12 h-14 flex flex-col items-center justify-center gap-1.5 px-0 transition-all group/btn active:scale-95 text-green-500" 
                                      :class="(runner.loadingTarget === 'exe') ? 'opacity-100' : (!canRun || runner.loadingTarget || runner.buildStatus) ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:text-green-400 hover:bg-green-500/10'"
                                      :disabled="!canRun || !!runner.loadingTarget || !!runner.buildStatus"
                                      @click="dotnet('run', 'exe')">
                                <div class="relative inline-flex">
                                  <div v-if="runner.autoWatchTargetRun" class="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 border border-card shadow-sm z-10" title="Watch Run Mode Active">
                                    <RefreshCw class="size-2 text-white animate-spin-slow" />
                                  </div>
                                  <component :is="runner.loadingTarget === 'exe' ? RotateCcw : Play"
                                             :class="[
                                               'size-5 transition-transform duration-300',
                                               runner.loadingTarget === 'exe' ? 'animate-spin' : 'fill-current group-hover/btn:scale-110'
                                             ]" />
                                </div>
                                <span class="text-[8px] uppercase tracking-wide font-bold">{{ runner.loadingTarget === 'exe' ? '...' : 'Run' }}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" :side-offset="12">
                              <div class="flex items-center gap-3">
                                <span class="text-green-400 font-semibold tracking-wide">Run Application</span>
                                <div class="h-4 w-px bg-white/10"></div>
                                <HotkeyLabel :shortcut="runner.shortcuts.run" size="lg" variant="solid" />
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
                                      @click="stop">
                                <Square class="size-5 fill-current group-hover/btn:drop-shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all" />
                                <span class="text-[8px] uppercase tracking-wide font-bold">Stop</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" :side-offset="12">
                              <div class="flex items-center gap-3">
                                <span class="text-red-400 font-semibold tracking-wide">Stop Execution</span>
                                <div class="h-4 w-px bg-white/10"></div>
                                <HotkeyLabel :shortcut="runner.shortcuts.stop" size="lg" variant="solid" />
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
