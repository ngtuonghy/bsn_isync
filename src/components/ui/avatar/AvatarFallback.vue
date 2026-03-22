<script setup lang="ts">
import { AvatarFallback, type AvatarFallbackProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<AvatarFallbackProps & { class?: string }>()
</script>

<template>
  <AvatarFallback
    v-bind="props"
    :class="cn('flex h-full w-full items-center justify-center rounded-inherit bg-muted uppercase font-bold text-[10px]', props.class)"
  >
    <slot />
  </AvatarFallback>
</template>
