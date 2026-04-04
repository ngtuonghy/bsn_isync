<script setup lang="ts">
import {
  RefreshCw,
  ArrowUpCircle,
  ShieldCheck,
  ShieldAlert,
  Moon,
  Sun,
  History,
  Bell,
  BellOff,
  Settings2,
  Keyboard,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import BacklogAuthPanel from "@/components/BacklogAuthPanel.vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  APP_VERSION,
  applyUpdate,
  backlog,
  checkEnv,
  checkForUpdates,
  dark,
  downloadUpdate,
  envStatus,
  handleBacklogLogout,
  isNotificationEnabled,
  isTerminalHistoryEnabled,
  isUpdateDownloading,
  isUpdateReady,
  runner,
  showHotkeySettings,
  startBacklogOAuthLogin,
  toggleTheme,
  updateVersion,
} from "@/composables/appBindings";
</script>

<template>
  <header class="border-b border-black/5 dark:border-white/5 bg-card sticky top-0 z-50 shadow-sm transition-all duration-300">
    <div class="px-6 py-1.5 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">IS</div>
        <div class="flex flex-col select-none">
          <div class="flex items-baseline gap-2">
            <div class="text-sm font-semibold tracking-tight">BSN iSync</div>
            <span class="text-[11px] text-muted-foreground font-medium uppercase tracking-tighter">v{{ APP_VERSION }}</span>
          </div>
          <span class="text-[8px] font-bold bg-linear-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(59,130,246,0.2)] uppercase tracking-widest leading-none mt-0.5">by ngtuonghy</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <BacklogAuthPanel
          class="mr-2"
          v-model:host="backlog.host"
          :apiKey="backlog.apiKey"
          :status="backlog.status"
          :profile="backlog.profile"
          :avatarUrl="backlog.profile ? backlog.userAvatars[backlog.profile.id] : undefined"
          :projects="backlog.projects"
          v-model:selectedProjectKey="runner.backlogProjectKey"
          :error="backlog.error"
          @login-oauth="startBacklogOAuthLogin"
          @logout="handleBacklogLogout"
        />
        <div class="h-4 w-px bg-border mx-1"></div>

        <!-- Update status indicator -->
        <template v-if="updateVersion">
          <template v-if="isUpdateReady">
            <Button @click="applyUpdate" variant="default" size="sm" class="h-8 gap-1.5 px-3 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 animate-in fade-in zoom-in duration-300">
              <RefreshCw class="size-3.5 animate-spin-slow" />
              <span class="text-[11px] font-bold">Restart Now</span>
            </Button>
          </template>
          <template v-else>
            <Button @click="downloadUpdate" :disabled="isUpdateDownloading" variant="secondary" size="sm" class="h-8 gap-1.5 px-3 transition-all">
              <ArrowUpCircle class="size-3.5" :class="isUpdateDownloading ? 'animate-bounce' : ''" />
              <span class="text-[11px] font-bold">{{ isUpdateDownloading ? 'Downloading...' : `Update Now (v${updateVersion})` }}</span>
            </Button>
          </template>
          <div class="h-4 w-px bg-border mx-1"></div>
        </template>

        <!-- Environment Status (Errors Only) -->
        <div v-if="envStatus.some((x) => !x.found)" class="relative group/env mr-1">
          <Button variant="ghost" size="icon" class="h-7 w-7 transition-all hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg"
                  :class="envStatus.some((x) => !x.found) ? 'text-amber-500' : 'text-green-500'">
            <ShieldCheck v-if="envStatus.every((x) => x.found)" class="size-4" />
            <ShieldAlert v-else class="size-4" />
          </Button>

          <div class="absolute right-0 top-full mt-2 w-72 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] opacity-0 invisible group-hover/env:opacity-100 group-hover/env:visible transition-all z-50 p-4 scale-95 group-hover/env:scale-100 origin-top-right ring-1 ring-white/10">
            <div class="flex items-center justify-between mb-4">
              <div class="flex flex-col gap-0.5">
                <span class="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Environment</span>
                <span class="text-[8px] text-muted-foreground/50 font-bold uppercase tracking-widest">System Requirements</span>
              </div>
              <Button variant="ghost" size="icon" class="h-6 w-6 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all" @click="checkEnv" title="Re-check environment">
                <RefreshCw class="size-3" />
              </Button>
            </div>

            <div class="space-y-2">
              <div v-for="tool in envStatus" :key="tool.name"
                   class="flex items-center justify-between p-2.5 rounded-xl border border-white/5 transition-all"
                   :class="tool.found ? 'bg-green-500/5 border-green-500/10' : 'bg-amber-500/5 border-amber-500/10'">
                <div class="flex items-center gap-3">
                  <div class="size-2 rounded-full" :class="tool.found ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'"></div>
                  <div class="flex flex-col">
                    <span class="text-[11px] font-black text-foreground/90 uppercase tracking-tight">{{ tool.name }}</span>
                    <span class="text-[9px] text-muted-foreground font-bold tracking-tight opacity-70">{{ tool.found ? tool.version : 'Not found in PATH' }}</span>
                  </div>
                </div>
                <Button v-if="!tool.found"
                        variant="secondary"
                        size="sm"
                        class="h-7 px-3 text-[9px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-lg shrink-0"
                        @click="openUrl(tool.downloadUrl)">
                  Install
                </Button>
                <div v-else class="px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 text-[8px] font-black uppercase tracking-tighter">OK</div>
              </div>
            </div>

            <div v-if="envStatus.some((x) => !x.found)" class="mt-4 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <p class="text-[9px] text-amber-500/80 font-bold leading-relaxed text-center italic opacity-80">Some features might be unavailable until tools are installed.</p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 bg-background/50 border border-border/50 p-1 rounded-full shadow-inner mr-2">
          <label class="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-all select-none" :class="runner.forceUnicode ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-muted-foreground'">
            <input type="checkbox" v-model="runner.forceUnicode" class="sr-only" />
            <span class="text-[9px] font-black uppercase tracking-wider">Shift-JIS</span>
          </label>
          <div class="w-px h-3 bg-border/50 mx-0.5"></div>
          <label class="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-all select-none" :class="runner.autoWatchTargetTest ? 'bg-blue-500 text-white shadow-sm' : 'hover:bg-muted text-muted-foreground'">
            <input type="checkbox" v-model="runner.autoWatchTargetTest" class="sr-only" />
            <span class="text-[9px] font-black uppercase tracking-wider">Watch Test</span>
          </label>
          <label class="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-all select-none" :class="runner.autoWatchTargetRun ? 'bg-green-500 text-white shadow-sm' : 'hover:bg-muted text-muted-foreground'">
            <input type="checkbox" v-model="runner.autoWatchTargetRun" class="sr-only" />
            <span class="text-[9px] font-black uppercase tracking-wider">Watch Run</span>
          </label>
        </div>

        <!-- System Settings Dropdown -->
        <div class="relative group/sys-settings ml-1">
          <Button variant="ghost" size="icon" class="h-8 w-8 rounded-xl hover:bg-muted/50 text-muted-foreground transition-all">
            <Settings2 class="size-4 group-hover/sys-settings:rotate-90 transition-transform duration-500" />
          </Button>
          <div class="absolute right-0 top-full mt-2 w-48 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover/sys-settings:opacity-100 group-hover/sys-settings:visible transition-all z-50 p-2 scale-95 group-hover/sys-settings:scale-100 origin-top-right">
            <div class="flex flex-col gap-1">
              <button @click="toggleTheme" class="flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground w-full text-left transition-colors">
                <Moon v-if="!dark" class="size-3.5" />
                <Sun v-else class="size-3.5 text-yellow-500" />
                <span>Theme ({{ dark ? 'Dark' : 'Light' }})</span>
              </button>
              <button @click="isTerminalHistoryEnabled = !isTerminalHistoryEnabled" class="flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground w-full text-left transition-colors">
                <History class="size-3.5" :class="isTerminalHistoryEnabled ? 'text-primary' : ''" />
                <span>Terminal History: {{ isTerminalHistoryEnabled ? 'On' : 'Off' }}</span>
              </button>
              <button @click="isNotificationEnabled = !isNotificationEnabled" class="flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground w-full text-left transition-colors">
                <Bell v-if="isNotificationEnabled" class="size-3.5 text-primary" />
                <BellOff v-else class="size-3.5" />
                <span>Notifications: {{ isNotificationEnabled ? 'On' : 'Off' }}</span>
              </button>
              <button @click="showHotkeySettings = true" class="flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground w-full text-left transition-colors">
                <Keyboard class="size-3.5" />
                <span>Global Hotkeys</span>
              </button>
              <div class="h-px bg-border/50 my-1"></div>
              <button @click="() => checkForUpdates(true)" class="flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground w-full text-left transition-colors">
                <RefreshCw class="size-3.5" />
                <span>Check for Updates</span>
              </button>
              <button v-if="envStatus.every((x) => x.found)" @click="checkEnv" class="flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted rounded-lg text-green-500 hover:text-green-600 w-full text-left transition-colors">
                <ShieldCheck class="size-3.5" />
                <span>Environment OK</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
