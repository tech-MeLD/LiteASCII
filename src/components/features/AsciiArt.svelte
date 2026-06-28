<script lang="ts">
  /**
   * AsciiArt.svelte — Swappable ASCII animation container.
   *
   * To use a different animation, change the import below:
   *   import Animation from './ascii/TypeWriter.svelte';   ← current
   *   import Animation from './ascii/WebGLASCII_color.svelte';   ← WebGL ascii color
   */

  import Animation from '../ascii/TypeWriter.svelte';

  interface Props {
    /** 笔记数量 */
    noteCount?: number;
    /** 自定义类名 */
    class?: string;
  }

  let { 
    noteCount = 0,
    class: className = ''
  }: Props = $props();
</script>

<div class="w-full h-full flex items-center justify-center bg-bg-secondary rounded-lg border border-border-color overflow-hidden min-h-[280px] {className}">
  <Animation {noteCount} />
</div>