<script>
  export let value = null;
  export let onChange = null;

  let hovered = null;

  function rate(star, half) {
    const v = half ? star - 0.5 : star;
    if (onChange) onChange(v);
  }

  function onMouseMove(e, star) {
    const rect = e.currentTarget.getBoundingClientRect();
    const half = (e.clientX - rect.left) < rect.width / 2;
    hovered = half ? star - 0.5 : star;
  }

  // For each star 1-5, determine fill: 'full', 'half', or 'empty'
  function fill(star, display) {
    const v = display ?? 0;
    if (v >= star) return 'full';
    if (v >= star - 0.5) return 'half';
    return 'empty';
  }
</script>

<div class="stars" onmouseleave={() => hovered = null} role="group" aria-label="rating">
  {#each [1, 2, 3, 4, 5] as star}
    {@const f = fill(star, hovered ?? value)}
    <button
      class="star"
      class:readonly={!onChange}
      onclick={(e) => {
        if (!onChange) return;
        const rect = e.currentTarget.getBoundingClientRect();
        rate(star, (e.clientX - rect.left) < rect.width / 2);
      }}
      onmousemove={(e) => onChange && onMouseMove(e, star)}
      aria-label="{star} stars"
    >
      {#if f === 'full'}
        <span class="s s-full">★</span>
      {:else if f === 'half'}
        <span class="s s-empty">★</span>
        <span class="s s-half-fill">★</span>
      {:else}
        <span class="s s-empty">★</span>
      {/if}
    </button>
  {/each}
  {#if value}
    <span class="val">{value}</span>
  {/if}
</div>

<style>
  .stars { display: flex; align-items: center; gap: 1px; }

  .star {
    background: none; border: none; padding: 0;
    cursor: pointer; font-size: 1.1rem; line-height: 1;
    position: relative; width: 1.1rem;
  }
  .star.readonly { cursor: default; }

  .s { display: block; line-height: 1; }
  .s-full      { color: var(--accent); }
  .s-empty     { color: var(--text-dim); }
  .s-half-fill {
    position: absolute; top: 0; left: 0;
    width: 50%; overflow: hidden;
    color: var(--accent);
  }

  .val {
    font-size: 0.68rem;
    color: var(--text-muted);
    margin-left: 0.2rem;
    min-width: 1.8rem;
    display: inline-block;
  }
</style>
