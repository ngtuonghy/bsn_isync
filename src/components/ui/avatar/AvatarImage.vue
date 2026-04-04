<script setup lang="ts">
import { AvatarImage, type AvatarImageProps } from 'reka-ui'
import { cn } from '@/utils/cn'

const props = defineProps<AvatarImageProps & { class?: string }>()
</script>

<template>
  <AvatarImage
    v-bind="props"
    :class="cn('aspect-square h-full w-full', props.class)"
  />
</template>
