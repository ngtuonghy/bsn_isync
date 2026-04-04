<script setup lang="ts">
import { setupApp } from "@/composables/useApp";
import { activeTab } from "@/composables/appBindings";
import AppTopHeader from "@/components/AppTopHeader.vue";
import AppWorkspaceSqlBar from "@/components/AppWorkspaceSqlBar.vue";
import AppRunnerTab from "@/components/AppRunnerTab.vue";
import AppInLayoutDialogs from "@/components/AppInLayoutDialogs.vue";
import AppRootModals from "@/components/AppRootModals.vue";
import { Tabs } from "@/components/ui/tabs";

setupApp();
</script>
<template>
  <div class="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/5 via-background to-background text-foreground overflow-x-hidden selection:bg-primary/20">
    <AppTopHeader />

    <main class="h-[calc(100vh-61px)] flex flex-col px-0 pb-4 pt-2">
      <Tabs v-model="activeTab" class="flex-1 flex flex-col min-h-0">
        <AppWorkspaceSqlBar />

        <AppRunnerTab />
      </Tabs>
    </main>
    <AppInLayoutDialogs />
  </div>
  <AppRootModals />
</template>
