<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, LogOut } from "lucide-vue-next";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { BacklogProfile, BacklogProject } from "@/utils/backlogAuth";

defineProps<{
  host: string;
  apiKey: string;
  status: "idle" | "loading" | "success" | "error";
  profile: BacklogProfile | null;
  avatarUrl?: string;
  projects: BacklogProject[];
  selectedProjectKey: string;
  error: string;
}>();

const emit = defineEmits<{
  (e: "update:host", value: string): void;
  (e: "update:apiKey", value: string): void;
  (e: "update:selectedProjectKey", value: string): void;
  (e: "login"): void;
  (e: "login-oauth"): void;
  (e: "logout"): void;
}>();


function initials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <!-- Profile Display -->
      <template v-if="profile">
        <div class="flex items-center gap-1.5 ml-1">
          <!-- Quick Project Dropdown -->
          <div v-if="projects.length > 0">
             <Select :model-value="selectedProjectKey" @update:model-value="(v) => { if (v) emit('update:selectedProjectKey', String(v)); }">
                <SelectTrigger class="h-7 bg-primary/10 border-0 text-[10px] font-bold py-0 px-2.5 rounded-full hover:bg-primary/20 transition-all gap-1 text-primary shadow-sm hover:shadow-md active:scale-95 whitespace-nowrap">
                  <div>
                    <SelectValue :placeholder="'Not selected'">
                     {{ projects.find(p => p.projectKey === selectedProjectKey)?.projectKey || 'Not selected' }}
                    </SelectValue>
                  </div>
                </SelectTrigger>
               <SelectContent class="p-1">
                 <SelectItem v-for="p in projects" :key="p.id" :value="p.projectKey">
                   <div class="flex flex-col gap-0.5">
                     <span class="text-[10px] font-bold">{{ p.name }}</span>
                     <span class="text-[8px] text-muted-foreground opacity-60">{{ p.projectKey }}</span>
                   </div>
                 </SelectItem>
               </SelectContent>
             </Select>
          </div>

        </div>

        <div class="group flex items-center gap-2.5 pl-1.5 pr-1.5 py-1 bg-card/40 hover:bg-card/80 rounded-full border border-black/5 dark:border-white/5 shadow-sm transition-all duration-500 cursor-default ring-1 ring-transparent hover:ring-primary/20 backdrop-blur-md ml-1">
          <Avatar class="h-8 w-8 ml-0.5 shadow-[0_2px_10px_rgba(0,0,0,0.1)] ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300">
            <AvatarImage v-if="avatarUrl" :src="avatarUrl" />
            <AvatarFallback class="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-[11px] font-bold">
              {{ initials(profile.name || "U") }}
            </AvatarFallback>
          </Avatar>
          
          <div class="flex flex-col justify-center py-0.5 min-w-0 ml-1">
            <span class="text-[11px] font-bold leading-none tracking-tight text-foreground/70 group-hover:text-foreground transition-colors duration-300 whitespace-nowrap">{{ profile.name }}</span>
          </div>
          
          <div class="h-5 w-px bg-border/80 mx-0.5"></div>
          
          <button class="p-2 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-all duration-300 active:scale-90" @click="emit('logout')" title="Disconnect Backlog">
            <LogOut class="h-4 w-4" />
          </button>
        </div>
      </template>

      <!-- Login Button -->
      <template v-else>
        <div class="flex items-center gap-1.5">
          <Button 
            variant="default" 
            class="h-9 text-[11px] font-bold px-5 shadow-md bg-linear-to-b from-primary/95 to-primary hover:from-primary hover:to-primary/90 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 rounded-full gap-2 relative overflow-hidden group/btn" 
            :disabled="status === 'loading'" 
            @click="emit('login-oauth')"
          >
            <div class="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span class="relative z-10 flex items-center gap-2">
              <span class="relative flex h-2 w-2" v-if="status === 'loading'">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
              </span>
              {{ status === 'loading' ? 'Connecting...' : 'Login to Backlog' }}
            </span>
          </Button>

          <!-- Error Icon only (Tooltip/Toast provides details) -->
          <div v-if="error" class="text-destructive animate-in fade-in zoom-in duration-300 ml-1 bg-destructive/10 p-1.5 rounded-full" :title="error">
            <AlertCircle class="h-4 w-4" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>