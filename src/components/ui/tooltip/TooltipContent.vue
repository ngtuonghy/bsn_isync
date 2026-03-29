<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui"
import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(), {
  sideOffset: 4,
})

const emits = defineEmits<TooltipContentEmits>()

const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn('z-9999 overflow-hidden rounded-lg bg-zinc-950 px-3 py-2 text-[11px] font-medium text-zinc-50 shadow-xl border border-white/10 backdrop-blur-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-4 data-[side=right]:slide-in-from-left-4 data-[side=top]:slide-in-from-bottom-2', props.class)"
    >
      <slot />

      <TooltipArrow class="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
    </TooltipContent>
  </TooltipPortal>
</template>
