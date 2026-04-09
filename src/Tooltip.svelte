<script>
  let visible = false;
</script>

<span class="tooltip-root"
  onmouseenter={() => visible = true}
  onmouseleave={() => visible = false}>
  <slot />
  {#if visible}
    <div class="tooltip-content">
      <slot name="tip" />
    </div>
  {/if}
</span>

<style>
  .tooltip-root {
    position: relative;
    display: inline-flex;
  }
  .tooltip-content {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    pointer-events: none;
  }
</style>
