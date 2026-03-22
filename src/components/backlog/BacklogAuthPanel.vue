<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type { BacklogProfile } from "@/lib/backlogAuth";

defineProps<{
  host: string;
  apiKey: string;
  status: "idle" | "loading" | "success" | "error";
  profile: BacklogProfile | null;
  error: string;
}>();

const emit = defineEmits<{
  (e: "update:host", value: string): void;
  (e: "update:apiKey", value: string): void;
  (e: "login"): void;
  (e: "login-oauth"): void;
}>();


</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <Button hidden variant="secondary" class="h-7 text-xs" :disabled="status === 'loading'" @click="emit('login-oauth')">
        Đăng nhập Backlog
      </Button>
      <span v-if="status === 'loading'" class="text-[11px] text-muted-foreground">Đang mở trang đăng nhập...</span>
    </div>
  </div>
</template>