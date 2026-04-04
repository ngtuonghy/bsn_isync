<script setup lang="ts">
import { FolderOpen, ScanSearch, Database, Server, User, Lock, RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  checkSqlConnection,
  discoverProjects,
  pickProjectFolder,
  runner,
  sqlConnStatus,
  sqlErrorMsg,
} from "@/composables/appBindings";
</script>

<template>
  <div class="mx-6 mb-2 bg-muted/20 backdrop-blur-3xl p-1.5 px-3 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all duration-500">
    <div class="flex items-center gap-5">
      <!-- Workspace Group (Pro Balance) -->
      <div class="flex items-center gap-2 min-w-0 flex-[0.6] pr-4 border-r border-white/5">
        <div class="flex items-center gap-2 p-1 px-2 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 flex-1 min-w-0 group/ws">
          <FolderOpen class="size-3.5 text-primary opacity-60 group-hover/ws:opacity-100 transition-opacity shrink-0" />
          <input v-model="runner.workspaceRoot"
                 class="bg-transparent border-0 h-7 text-[12px] flex-1 min-w-0 focus:outline-none placeholder:text-muted-foreground/30 font-bold"
                 placeholder="Workspace..." />
          <div class="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" class="h-6 text-[10px] px-2.5 hover:bg-white/10 transition-all font-black uppercase tracking-tight rounded-md" @click="pickProjectFolder">Browse</Button>
            <Button variant="secondary" class="h-7 text-[10px] px-3 font-black uppercase tracking-widest rounded-lg" @click="discoverProjects">
              <ScanSearch class="size-3.5 mr-1.5" /> SCAN
            </Button>
          </div>
        </div>
      </div>

      <!-- Global SQL Context Group (Pro Balance) -->
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <div class="flex items-center gap-1.5 shrink-0 pr-3 border-r border-white/5">
          <Database class="size-3.5 text-primary opacity-50" />
          <span class="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">SQL CONTEXT</span>
        </div>

        <!-- Integrated SQL Context Group (Server & DB) -->
        <div class="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner ring-1 ring-white/5">
          <div class="flex items-center gap-1.5 px-2.5 py-0.5 bg-background/40 rounded-lg border border-white/5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all min-w-[130px]">
            <Server class="size-3 text-primary/40" />
            <input v-model="runner.sqlServer"
                   class="bg-transparent border-0 h-6 w-full text-xs font-mono font-black focus:outline-none placeholder:text-muted-foreground/20"
                   placeholder="Server..." />
          </div>
          <div class="w-px h-4 bg-white/10 mx-1"></div>
          <div class="flex items-center gap-1.5 px-2.5 py-0.5 bg-background/40 rounded-lg border border-white/5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all min-w-[130px]">
            <Database class="size-3 text-primary/40" />
            <input v-model="runner.sqlDatabase"
                   class="bg-transparent border-0 h-6 w-full text-xs font-mono font-black focus:outline-none placeholder:text-muted-foreground/20"
                   placeholder="Database..." />
          </div>

          <!-- SQL Connection Diagnosis Indicator -->
          <div class="flex items-center gap-1.5 px-1.5 shrink-0 border-l border-white/10 ml-0.5">
            <div class="relative group/sql-status">
              <div v-if="sqlConnStatus === 'loading'" class="size-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
              <div v-else-if="sqlConnStatus === 'success'" class="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div v-else-if="sqlConnStatus === 'error'" class="size-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
              <div v-else class="size-2 rounded-full bg-muted shadow-inner opacity-40"></div>

              <!-- Error Tooltip (Simplified) -->
              <div v-if="sqlConnStatus === 'error' && sqlErrorMsg" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-destructive text-white text-[9px] font-bold rounded-lg shadow-xl opacity-0 group-hover/sql-status:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {{ sqlErrorMsg.length > 50 ? sqlErrorMsg.substring(0, 50) + '...' : sqlErrorMsg }}
                <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-destructive"></div>
              </div>
            </div>

            <Button variant="ghost" size="icon" class="size-7 rounded-md hover:bg-white/10 transition-all" @click="() => checkSqlConnection(true)" :disabled="sqlConnStatus === 'loading' || !runner.sqlServer || !runner.sqlDatabase" title="Test SQL Connection">
              <RefreshCw class="size-3.5 text-primary/60 hover:text-primary transition-colors" :class="sqlConnStatus === 'loading' ? 'animate-spin' : ''" />
            </Button>
          </div>
        </div>

        <div class="w-px h-6 bg-white/10 shrink-0"></div>

        <!-- Pro Auth Mode Toggle -->
        <div class="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 shadow-inner">
          <button
            class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
            :class="runner.useWindowsAuth ? 'bg-primary text-primary-foreground shadow-lg scale-105' : 'text-muted-foreground hover:text-foreground opacity-40 hover:opacity-100'"
            @click="runner.useWindowsAuth = true"
          >WIN</button>
          <button
            class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
            :class="!runner.useWindowsAuth ? 'bg-primary text-primary-foreground shadow-lg scale-105' : 'text-muted-foreground hover:text-foreground opacity-40 hover:opacity-100'"
            @click="runner.useWindowsAuth = false"
          >SQL</button>
        </div>

        <div v-if="!runner.useWindowsAuth" class="w-px h-6 bg-white/10 shrink-0"></div>

        <!-- Integrated Credentials (SQL Auth) -->
        <transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="transform translate-x-4 opacity-0 scale-95"
          enter-to-class="transform translate-x-0 opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="transform translate-x-0 opacity-100 scale-100"
          leave-to-class="transform translate-x-4 opacity-0 scale-95"
        >
          <div v-if="!runner.useWindowsAuth" class="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner ring-1 ring-white/5 mr-1">
            <div class="flex items-center gap-1.5 px-2 py-0.5 bg-background/40 rounded-lg border border-white/5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <User class="size-3 text-primary/40" />
              <input v-model="runner.sqlUser"
                     class="bg-transparent border-0 h-6 w-16 text-[11px] font-mono font-black focus:outline-none placeholder:text-muted-foreground/20"
                     placeholder="User" />
            </div>
            <div class="flex items-center gap-1.5 px-2 py-0.5 bg-background/40 rounded-lg border border-white/5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <Lock class="size-3 text-primary/40" />
              <input v-model="runner.sqlPassword"
                     class="bg-transparent border-0 h-6 w-20 text-[11px] font-mono font-black focus:outline-none placeholder:text-muted-foreground/20"
                     placeholder="Password" />
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>
