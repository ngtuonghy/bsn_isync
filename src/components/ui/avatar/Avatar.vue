<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { AvatarRoot } from 'reka-ui'
import { cn } from '@/lib/utils'

interface Props {
  class?: HTMLAttributes['class']
  size?: 'sm' | 'base' | 'lg'
  shape?: 'circle' | 'square'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'base',
  shape: 'circle',
})
</script>

<template>
  <AvatarRoot
    :class="cn(
      'relative flex shrink-0 overflow-hidden',
      props.shape === 'circle' ? 'rounded-full' : 'rounded-md',
      props.size === 'sm' && 'h-6 w-6',
      props.size === 'base' && 'h-8 w-8',
      props.size === 'lg' && 'h-10 w-10',
      props.class,
    )"
  >
    <slot />
  </AvatarRoot>
</template>
