<script>
  export let batches = [];

  function allIngredients(batches) {
    const seen = new Map(); // name → unit ('g' | 'u' | 'ml')
    for (const b of batches) {
      for (const s of b.steps || []) {
        for (const i of s.ingredients || []) {
          if (!seen.has(i.name)) {
            const unit = i.quantity_g != null ? 'g'
              : i.quantity_ml != null ? 'ml'
              : 'u';
            seen.set(i.name, unit);
          }
        }
      }
    }
    return [...seen.entries()].map(([name, unit]) => ({ name, unit }));
  }

  function getRatio(batch, ingName, unit) {
    const L = batch.vessel_ml / 1000;
    for (const s of batch.steps || []) {
      for (const i of s.ingredients || []) {
        if (i.name !== ingName) continue;
        const qty = unit === 'g' ? i.quantity_g
          : unit === 'ml' ? i.quantity_ml
          : i.quantity_u;
        if (qty == null) return null;
        return (qty / L).toFixed(1);
      }
    }
    return null;
  }

  function stars(rating) {
    if (!rating) return '—';
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
  }

  $: cols = allIngredients(batches);
  $: sorted = [...batches].sort((a, b) => a.batch_id - b.batch_id);
</script>

<div class="wrap">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>vessel</th>
        <th>steep</th>
        {#each cols as col}
          <th>{col.name}<span class="unit"> {col.unit}/L</span></th>
        {/each}
        <th>rating</th>
      </tr>
    </thead>
    <tbody>
      {#each sorted as b}
        <tr>
          <td class="batch-num">#{b.batch_id}</td>
          <td class="muted">{b.vessel_ml}ml</td>
          <td class="muted">{b.total_steep_hours}h</td>
          {#each cols as col}
            {@const ratio = getRatio(b, col.name, col.unit)}
            <td class:has-val={ratio !== null} class:missing={ratio === null}>
              {ratio !== null ? ratio : '—'}
            </td>
          {/each}
          <td class="rating" class:no-rating={!b.rating}>
            {#if b.rating}
              <span class="stars">{stars(b.rating)}</span>
              <span class="rating-num">{b.rating}</span>
            {:else}
              —
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap { overflow-x: auto; }

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.78rem;
  }

  th, td {
    padding: 0.45rem 0.75rem;
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--border);
  }

  th {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    font-weight: 700;
    border-bottom: 1px solid var(--border);
  }
  .unit { text-transform: none; letter-spacing: 0; font-weight: 400; }

  td { color: var(--text-muted); }
  .batch-num { color: var(--text); font-weight: 700; }
  .muted { color: var(--text-dim); }

  .has-val { color: var(--accent); }
  .missing { color: var(--text-dim); }

  tr:hover td { background: var(--bg-card2); }

  .rating { min-width: 8rem; }
  .stars { color: var(--accent); letter-spacing: 0.05em; }
  .rating-num { color: var(--text-dim); font-size: 0.68rem; margin-left: 0.4rem; }
  .no-rating { color: var(--text-dim); }
</style>
