<script>
  import Rating from './Rating.svelte'
  import ExtractionSlider from './ExtractionSlider.svelte'
  import Tooltip from './Tooltip.svelte'
  import { now } from './now.js'

  export let brew;
  export let variant = 'steeping'; // 'steeping' | 'planned' | 'done'
  export let icons = {};

  let addMode = 'note'; // 'note' | 'extend' | 'taste'
  let extendValue = '';
  let extendNote = '';
  let noteInputValue = '';

  // Taste review state — keyed by ingredient name
  let reviewRatings = {};
  let reviewNote = '';

  $: lastTasteRatings = (() => {
    const last = [...(brew.notes || [])].reverse().find(n => n.type === 'taste');
    return last?.ratings ?? {};
  })();

  function initReview() {
    reviewRatings = Object.fromEntries(allIngredients.map(i => {
      const prev = lastTasteRatings[i.name]?.extraction;
      return [i.name, { extraction: prev != null ? normalizeExtraction(prev) : 50, note: '' }];
    }));
    reviewNote = '';
    addMode = 'taste';
  }

  function normalizeExtraction(val) {
    if (typeof val === 'number') return val;
    if (val === 'under') return 25;
    if (val === 'right') return 50;
    if (val === 'over') return 75;
    return null;
  }

  function extractionZone(val) {
    const n = normalizeExtraction(val);
    if (n === null) return null;
    if (n < 40) return 'under';
    if (n > 60) return 'over';
    return 'right';
  }

  async function submitReview() {
    await sveldAction('addTasteSession', { id: brew.batch_id, ratings: reviewRatings, note: reviewNote });
    addMode = 'note';
    reviewRatings = {};
    reviewNote = '';
  }

  // Edit existing taste entry
  let editingTasteIndex = null;
  let editRatings = {};
  let editTasteNote = '';

  function startEditTaste(ev) {
    editingTasteIndex = ev.index;
    editRatings = Object.fromEntries(
      Object.entries(ev.ratings).map(([name, r]) => [name, { extraction: normalizeExtraction(r.extraction) ?? 50, note: r.note || '' }])
    );
    editTasteNote = ev.text || '';
  }

  async function saveEditTaste(ev) {
    await sveldAction('updateTasteSession', { id: brew.batch_id, index: ev.index, date: ev.date, ratings: editRatings, note: editTasteNote });
    editingTasteIndex = null;
  }

  function toDatetimeLocal(ms) {
    const d = new Date(ms);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtIngredient(i) {
    return `${i.name}${i.quantity_g ? ` ${i.quantity_g}g` : ''}${i.quantity_ml ? ` ${i.quantity_ml}ml` : ''}${i.quantity_u ? ` ${i.quantity_u}u` : ''}`;
  }

  function fmtTime(date) {
    return new Date(date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function fmtDuration(ms) {
    if (ms <= 0) return '0m';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  }

  function lerpColor(a, b, t) {
    const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
    const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    const r = Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0');
    const g = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0');
    const bl = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0');
    return `#${r}${g}${bl}`;
  }

  function confirmColor(minutesFromDue) {
    if (minutesFromDue >= 0) return '#4ecdc4';
    if (minutesFromDue <= -120) return '#ff6b6b';
    if (minutesFromDue <= -60) return lerpColor('#ff6b6b', '#ffb86c', (minutesFromDue + 120) / 60);
    return lerpColor('#ffb86c', '#4ecdc4', (minutesFromDue + 60) / 60);
  }

  function steepedDuration(b) {
    const startMs = b.steps?.[0]?.confirmed_at ?? b.date_start;
    if (!startMs || !b.date_end) return null;
    return fmtDuration(new Date(b.date_end) - new Date(startMs));
  }

  function onNoteKeydown(e, b) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = e.target.value.trim();
      if (text) {
        sveldAction('addNote', { id: b.batch_id, text });
        e.target.value = '';
      }
    }
  }

  function brewTimeline(b, now) {
    const steps = b.steps || [{ offset_hours: 0, ingredients: b.ingredients || [] }];
    const totalHours = b.total_steep_hours ?? b.planned_steep_hours ?? 0;
    const isStarted = !!steps[0]?.confirmed_at;
    const startMs = isStarted ? new Date(steps[0].confirmed_at).getTime() : null;
    const plannedStartMs = b.date_start ? new Date(b.date_start).getTime() : null;
    const finalDone = !!b.date_end;
    const events = [];
    let foundActive = false;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const offset = step.offset_hours ?? 0;
      const isDone = !!step.confirmed_at;
      const prevDone = i === 0 ? isStarted : !!steps[i - 1].confirmed_at;
      const isActive = !isDone && prevDone && !foundActive;
      if (isActive) foundActive = true;

      const stepMs = step.confirmed_at
        ? new Date(step.confirmed_at).getTime()
        : ((startMs ?? plannedStartMs) ? (startMs ?? plannedStartMs) + offset * 3600000 : null);

      const minutesFromDue = stepMs !== null ? Math.round((now - stepMs) / 60000) : null;
      const disabled = minutesFromDue !== null && minutesFromDue < -180;
      const waitAfterHours = i < steps.length - 1
        ? steps[i + 1].offset_hours - offset
        : totalHours - offset;

      events.push({
        type: 'step',
        offset,
        isDone,
        isActive,
        stepMs,
        ingredients: step.ingredients || [],
        showAction: !isDone,
        isFirstStep: offset === 0,
        disabled,
        minutesFromDue,
        waitAfterHours,
        sortMs: stepMs ?? (i * 1e-6),
      });
    }

    // End event
    const lastDone = !!steps[steps.length - 1].confirmed_at;
    const endMs = (startMs ?? plannedStartMs) ? (startMs ?? plannedStartMs) + totalHours * 3600000 : null;
    const finalActive = lastDone && !finalDone;
    const endActualMs = b.date_end ? new Date(b.date_end).getTime() : endMs;
    const endMinutesFromDue = endMs !== null ? Math.round((now - endMs) / 60000) : null;

    events.push({
      type: 'end',
      isDone: finalDone,
      isActive: finalActive,
      stepMs: endActualMs,
      totalHours,
      minutesFromDue: finalActive ? endMinutesFromDue : null,
      waitAfterHours: null,
      sortMs: endActualMs ?? Infinity,
    });

    // Notes & taste sessions
    for (let i = 0; i < (b.notes || []).length; i++) {
      const note = b.notes[i];
      const noteMs = new Date(note.date).getTime();
      if (note.type === 'taste') {
        events.push({
          type: 'taste',
          sortMs: noteMs,
          index: i,
          ratings: note.ratings || {},
          text: note.text || '',
          date: note.date,
          waitAfterHours: null,
        });
      } else {
        events.push({
          type: 'note',
          sortMs: noteMs,
          index: i,
          text: note.text,
          date: note.date,
          waitAfterHours: null,
        });
      }
    }

    events.sort((a, ev2) => {
      if (a.sortMs === ev2.sortMs) return 0;
      if (a.sortMs === Infinity) return 1;
      if (ev2.sortMs === Infinity) return -1;
      return a.sortMs - ev2.sortMs;
    });

    // Move last step's waitAfterHours to the event just before end
    const endIdx = events.findIndex(e => e.type === 'end');
    if (endIdx > 0) {
      const lastStep = [...events].reverse().find(e => e.type === 'step');
      if (lastStep && events[endIdx - 1] !== lastStep) {
        events[endIdx - 1].waitAfterHours = lastStep.waitAfterHours;
        lastStep.waitAfterHours = null;
      }
    }

    // Compute real time diff between every consecutive pair of dots
    // Skip planned batches (no real timestamps yet)
    for (let i = 0; i < events.length - 1; i++) {
      if (!isStarted && !finalDone) break;
      const curr = events[i];
      const next = events[i + 1];
      if (curr.sortMs === Infinity || curr.sortMs <= 0) continue;
      const nextMs = next.sortMs === Infinity ? null : next.sortMs;
      if (nextMs === null) continue;
      const diffMs = nextMs - curr.sortMs;
      if (diffMs <= 0) continue;
      curr.realDiffIsRemaining = isStarted && nextMs > now;
      curr.realDiffMs = curr.realDiffIsRemaining ? nextMs - now : diffMs;
    }

    // Insert gap rows between events (and after last, to connect to the add-item)
    const result = [];
    for (let i = 0; i < events.length; i++) {
      result.push(events[i]);
      result.push({
        type: 'gap',
        waitAfterHours: events[i].waitAfterHours ?? null,
        realDiffMs: events[i].realDiffMs ?? null,
        realDiffIsRemaining: events[i].realDiffIsRemaining ?? false,
      });
      events[i].waitAfterHours = null;
      events[i].realDiffMs = null;
    }
    return result;
  }

  $: tl = brewTimeline(brew, $now);
  $: endEvent = tl.find(e => e.type === 'end');

  $: allIngredients = (brew.steps || [{ ingredients: brew.ingredients || [] }]).flatMap(s => s.ingredients || []);
  $: ratios = allIngredients
    .filter(i => i.quantity_g || i.quantity_ml || i.quantity_u)
    .map(i => ({
      name: i.name,
      label: i.quantity_g
        ? `${(i.quantity_g / (brew.vessel_ml / 1000)).toFixed(1)}g/L`
        : i.quantity_ml
          ? `${(i.quantity_ml / (brew.vessel_ml / 1000)).toFixed(1)}ml/L`
          : `${(i.quantity_u / (brew.vessel_ml / 1000)).toFixed(1)}u/L`
    }));
</script>

<div class="card card--{variant}">
  <div class="card-inner">
    <div class="card-main">

      <div class="card-top">
        <div class="card-title">
          <span class="batch-num">#{brew.batch_id}</span>
          <span class="vessel-pill">{brew.vessel_ml}ml</span>
          {#if variant === 'done'}
            {#if steepedDuration(brew)}<span class="steep-dur">{steepedDuration(brew)}</span>{/if}
          {:else if variant === 'planned'}
            <span class="steep-dur">{brew.total_steep_hours ?? brew.planned_steep_hours}h</span>
          {/if}
        </div>
        {#if variant === 'done'}
          <Rating value={brew.rating} onChange={(r) => sveldAction('updateRating', { id: brew.batch_id, rating: r })} />
        {/if}
      </div>

      <div class="timeline">
        {#each tl as ev}

          {#if ev.type === 'gap'}
            <div class="tl-gap">
              <div class="tl-action-col">
                {#if ev.realDiffMs}<span class="tl-wait-real" class:tl-wait-remaining={ev.realDiffIsRemaining}>{fmtDuration(ev.realDiffMs)}{ev.realDiffIsRemaining ? ' left' : ''}</span>{/if}
              </div>
              <div class="tl-gap-left"><div class="tl-gap-line"></div></div>
              {#if ev.waitAfterHours}
                <div class="tl-gap-label">
                  <span class="tl-wait-planned">{ev.waitAfterHours}h</span>
                </div>
              {/if}
            </div>

          {:else if ev.type === 'step'}
            {@const dotColor = ev.isDone ? 'var(--c-done)' : ev.isActive ? 'var(--c-active)' : 'var(--c-pending)'}
            {@const btnCol = ev.minutesFromDue !== null
              ? (ev.disabled ? 'rgba(232,234,240,0.2)' : confirmColor(ev.minutesFromDue))
              : 'var(--c-pending)'}
            <div class="tl-item">
              <div class="tl-action-col">
                {#if ev.showAction}
                  <button class="btn-action" disabled={ev.disabled}
                    style="color:{btnCol}; background:{btnCol}18; border-color:{btnCol}55;"
                    onclick={() => sveldAction('confirmStep', { id: brew.batch_id, offset_hours: ev.offset })}>
                    {ev.isFirstStep ? 'start' : 'done'}
                  </button>
                {/if}
              </div>
              <div class="tl-left">
                <div class="tl-dot" style="background:{dotColor}; box-shadow:0 0 0 3px {dotColor}22"></div>
                <div class="tl-conn"></div>
              </div>
              <div class="tl-right">
                <div class="tl-cols">
                  <span class="tl-date" class:tl-date--done={ev.isDone} class:tl-date--active={ev.isActive} class:tl-date--muted={!ev.stepMs}>
                    {ev.stepMs ? fmtTime(ev.stepMs) : (ev.isFirstStep ? 'not scheduled' : 'not started')}
                  </span>
                  <div class="tl-ingrs">
                    {#each ev.ingredients as ing}
                      <div class="tl-ingr"
                        class:tl-ingr--done={ev.isDone}
                        class:tl-ingr--active={ev.isActive}>
                        {#if icons[ing.name]}<span class="tl-ingr-icon">{icons[ing.name]}</span>{/if}{fmtIngredient(ing)}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>

          {:else if ev.type === 'end'}
            {@const dotColor = ev.isDone ? 'var(--c-done)' : ev.isActive ? 'var(--c-active)' : 'var(--c-pending)'}
            {@const btnCol = ev.isActive ? confirmColor(ev.minutesFromDue ?? 0) : 'var(--c-pending)'}
            <div class="tl-item">
              <div class="tl-action-col">
                {#if ev.isActive}
                  <button class="btn-action"
                    style="color:{btnCol}; background:{btnCol}18; border-color:{btnCol}55;"
                    onclick={() => sveldAction('markDone', { id: brew.batch_id })}>done</button>
                {/if}
              </div>
              <div class="tl-left">
                <div class="tl-dot tl-dot--end" style="background:{dotColor}; box-shadow:0 0 0 3px {dotColor}22"></div>
                <div class="tl-conn"></div>
              </div>
              <div class="tl-right">
                <div class="tl-cols">
                  <span class="tl-date" class:tl-date--done={ev.isDone} class:tl-date--active={ev.isActive} class:tl-date--muted={!ev.stepMs}>
                    {ev.stepMs ? fmtTime(ev.stepMs) : ev.totalHours + 'h total'}
                  </span>
                </div>
              </div>
            </div>

          {:else if ev.type === 'taste'}
            <div class="tl-item">
              <div class="tl-action-col">
                {#if editingTasteIndex === ev.index}
                  <button class="btn-extend-ok"  onclick={() => saveEditTaste(ev)}>✓</button>
                  <button class="btn-extend-cancel" onclick={() => editingTasteIndex = null}>✕</button>
                {/if}
              </div>
              <div class="tl-left">
                <div class="tl-dot tl-dot--taste"></div>
                <div class="tl-conn"></div>
              </div>
              <div class="tl-right">
                {#if editingTasteIndex === ev.index}
                  <div class="taste-review">
                    {#each Object.keys(editRatings) as name}
                      <div class="taste-row">
                        <span class="taste-ingr">{name}</span>
                        <ExtractionSlider
                          value={editRatings[name].extraction}
                          onchange={(v) => editRatings = { ...editRatings, [name]: { ...editRatings[name], extraction: v } }} />
                        <input class="taste-note-input" type="text" placeholder="note…"
                          value={editRatings[name].note}
                          oninput={(e) => editRatings = { ...editRatings, [name]: { ...editRatings[name], note: e.target.value } }} />
                      </div>
                    {/each}
                    <div class="taste-footer">
                      <input class="note-input" type="text" placeholder="overall note…" bind:value={editTasteNote} />
                    </div>
                  </div>
                {:else}
                  <div class="tl-row-hover">
                    <div class="tl-cols">
                      <span class="tl-date tl-date--muted">{fmtTime(ev.date)}</span>
                      {#each Object.entries(ev.ratings) as [name, r]}
                        {@const zone = extractionZone(r.extraction)}
                        <Tooltip>
                          <div class="tl-ingr"
                            class:tl-ingr--under={zone === 'under'}
                            class:tl-ingr--right={zone === 'right'}
                            class:tl-ingr--over={zone === 'over'}>
                            {#if icons[name]}<span class="tl-ingr-icon">{icons[name]}</span>{/if}{name}{zone === 'under' ? ' ↓' : zone === 'right' ? ' ✓' : zone === 'over' ? ' ↑' : ''}
                          </div>
                          <svelte:fragment slot="tip">
                            <ExtractionSlider value={normalizeExtraction(r.extraction)} onchange={null} />
                            {#if r.note}<div class="tl-taste-note">{r.note}</div>{/if}
                          </svelte:fragment>
                        </Tooltip>
                      {/each}
                    </div>
                    <div class="tl-actions">
                      <button class="btn-edit-taste" title="edit" onclick={() => startEditTaste(ev)}><span class="pen-icon">✏</span></button>
                      <button class="btn-delete" title="delete"
                        onclick={() => sveldAction('deleteNote', { id: brew.batch_id, index: ev.index })}>×</button>
                    </div>
                  </div>
                  {#if ev.text}<span class="tl-note-text">{ev.text}</span>{/if}
                {/if}
              </div>
            </div>

          {:else if ev.type === 'note'}
            <div class="tl-item">
              <div class="tl-action-col"></div>
              <div class="tl-left">
                <div class="tl-dot tl-dot--note"></div>
                <div class="tl-conn"></div>
              </div>
              <div class="tl-right tl-right--note">
                <div class="tl-row-hover">
                  <div class="tl-cols">
                    <span class="tl-date tl-date--muted">{fmtTime(ev.date)}</span>
                    <span class="tl-note-text" contenteditable="true"
                      onblur={(e) => {
                        const text = e.target.innerText.trim();
                        if (text !== ev.text) sveldAction('editNote', { id: brew.batch_id, index: ev.index, text });
                      }}>{ev.text}</span>
                  </div>
                  <div class="tl-actions">
                    <button class="btn-delete" title="delete"
                      onclick={() => sveldAction('deleteNote', { id: brew.batch_id, index: ev.index })}>×</button>
                  </div>
                </div>
              </div>
            </div>
          {/if}

        {/each}

        <div class="tl-item tl-item--add">
          <div class="tl-action-col"></div>
          <div class="tl-left">
            <div class="tl-dot tl-dot--add"></div>
          </div>
          <div class="tl-right tl-right--add">
            <div class="add-tabs">
              <button class="add-tab" class:add-tab--active={addMode === 'note'} onclick={() => addMode = 'note'}>note</button>
              {#if variant === 'steeping'}
                <button class="add-tab" class:add-tab--active={addMode === 'extend'} onclick={() => { addMode = 'extend'; extendValue = endEvent?.stepMs ? toDatetimeLocal(endEvent.stepMs) : ''; }}>extend</button>
              {/if}
              {#if allIngredients.length}
                <button class="add-tab" class:add-tab--active={addMode === 'taste'} onclick={initReview}>taste</button>
              {/if}
            </div>

            {#if addMode === 'note'}
              <input class="note-input" type="text" placeholder="add note…"
                bind:value={noteInputValue}
                onkeydown={(e) => { onNoteKeydown(e, brew); if (e.key === 'Enter' && !e.shiftKey) noteInputValue = ''; }} />

            {:else if addMode === 'extend'}
              <div class="tl-extend">
                <input type="datetime-local" class="extend-input" bind:value={extendValue} />
                <button class="btn-extend-ok" onclick={() => {
                  sveldAction('extendSteep', { id: brew.batch_id, newEndMs: new Date(extendValue).getTime(), noteText: extendNote.trim() });
                  addMode = 'note';
                  extendNote = '';
                }}>✓</button>
                <button class="btn-extend-cancel" onclick={() => addMode = 'note'}>✕</button>
              </div>
              <input class="note-input" type="text" placeholder="reason (optional)…" bind:value={extendNote} />

            {:else if addMode === 'taste'}
              <div class="taste-review">
                {#each allIngredients as ing}
                  {@const ext = reviewRatings[ing.name]?.extraction}
                  <div class="taste-row">
                    <span class="taste-ingr">{fmtIngredient(ing)}</span>
                    <ExtractionSlider
                      value={reviewRatings[ing.name]?.extraction ?? 50}
                      onchange={(v) => reviewRatings = { ...reviewRatings, [ing.name]: { ...reviewRatings[ing.name], extraction: v } }} />
                    <input class="taste-note-input" type="text" placeholder="note…"
                      value={reviewRatings[ing.name]?.note ?? ''}
                      oninput={(e) => reviewRatings = { ...reviewRatings, [ing.name]: { ...reviewRatings[ing.name], note: e.target.value } }} />
                  </div>
                {/each}
                <div class="taste-footer">
                  <input class="note-input" type="text" placeholder="overall note (optional)…" bind:value={reviewNote} />
                  <button class="btn-submit-review" onclick={submitReview}>save</button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

</div><!-- /.card-main -->

    {#if ratios.length}
      <div class="ratios">
        {#each ratios as r}
          <div class="ratio-row">
            <span class="ratio-name">{r.name}</span>
            <span class="ratio-val">{r.label}</span>
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>

<style>
  * { box-sizing: border-box; }

  .card {
    position: relative;
    background: var(--bg-card);
    border: 1px solid var(--border-card);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow);
    transition: border-color 0.15s ease;
    flex: 0 0 auto;
    max-width: 100%;
  }
  .card:hover { border-color: rgba(100,150,255,0.3); }

  .card-inner { display: flex; flex-direction: row; }
  .card-main {
    display: flex; flex-direction: column; gap: 0.5rem; flex: 1; min-width: 0;
    padding: 0.6rem 0.75rem 0.6rem 0.85rem;
  }

  .card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .card-title { display: flex; align-items: center; gap: 0.5rem; }

  .batch-num { font-size: 1.1rem; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
  .vessel-pill {
    font-size: 0.72rem; padding: 2px 9px; border-radius: 10px;
    background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent);
  }
  .steep-dur { font-size: 0.75rem; color: var(--text-muted); }

  /* ── Vertical Timeline ── */
  .timeline { display: flex; flex-direction: column; }

  .tl-item {
    display: flex;
    gap: 0.65rem;
    align-items: stretch;
  }

  .tl-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 14px;
  }

  .tl-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .tl-dot--end { border-radius: 2px; }
  .tl-dot--note {
    width: 10px; height: 10px;
    background: var(--border);
    border-radius: 50%;
    margin-top: 4px;
  }
  .tl-dot--taste {
    width: 10px; height: 10px;
    background: #ffb86c55;
    border: 1px solid #ffb86c;
    border-radius: 50%;
    margin-top: 4px;
  }
  .tl-taste-note {
    font-size: 0.68rem; color: var(--text-dim); font-style: italic;
  }
  .tl-dot--add {
    width: 10px; height: 10px;
    background: transparent;
    border: 1px dashed var(--text-dim);
    border-radius: 50%;
    margin-top: 3px;
  }

  .tl-conn {
    flex: 1;
    width: 1px;
    background: var(--border);
    margin-top: 2px;
  }

  .tl-gap {
    display: flex;
    gap: 0.65rem;
    align-items: stretch;
    min-height: 0.6rem;
  }
  .tl-gap-left {
    width: 14px; flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center;
  }
  .tl-gap-line { flex: 1; width: 1px; background: var(--border); }
  .tl-gap-label {
    flex: 1; display: flex; align-items: center; gap: 0.5rem;
    padding: 0.1rem 0;
  }

  .tl-wait-planned { font-size: 0.58rem; color: var(--text-dim); white-space: nowrap; }
  .tl-wait-real    { font-size: 0.58rem; color: var(--text-muted); white-space: nowrap; text-align: right; width: 100%; }
  .tl-wait-real.tl-wait-remaining { color: var(--c-active); }

  .tl-right {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 0.2rem;
    padding-bottom: 0.25rem;
  }
  .tl-right--add  { padding-bottom: 0.1rem; }

  .btn-delete {
    font-size: 0.8rem; line-height: 1;
    background: none; border: none; cursor: pointer;
    color: var(--text-dim); padding: 1px 3px; border-radius: 2px;
    transition: color 0.15s;
  }
  .btn-delete:hover { color: #ff6b6b; }

  .tl-row-hover { display: flex; align-items: flex-start; gap: 0.3rem; min-width: 0; }
  .tl-row-hover .tl-cols { flex: 1; min-width: 0; }
  .tl-actions {
    display: flex; align-items: center; gap: 0.1rem;
    flex-shrink: 0; opacity: 0; transition: opacity 0.15s;
  }
  .tl-item:hover .tl-actions { opacity: 1; }

  .tl-action-col {
    width: 52px;
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding-top: 2px;
  }
  .tl-cols { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.3rem 0.4rem; }
  .tl-ingrs { display: contents; }

  .tl-date { font-size: 0.72rem; color: var(--text-muted); }
  .tl-date--done   { color: var(--c-done); }
  .tl-date--active { color: var(--c-active); }
  .tl-date--muted  { color: var(--text-dim); font-style: italic; }


  .tl-ingr-icon { margin-right: 2px; }

  .tl-ingr {
    font-size: 0.72rem; color: var(--text-muted);
    background: var(--bg-card2);
    border-radius: 2px; padding: 0 6px;
  }
  .tl-ingr--done   { color: var(--c-done);   background: var(--c-done-bg); }
  .tl-ingr--active { color: var(--c-active); background: var(--c-active-bg); }
  .tl-ingr--under  { color: #ffb86c; background: rgba(255,184,108,0.12); }
  .tl-ingr--right  { color: #4ecdc4; background: rgba(78,205,196,0.12); }
  .tl-ingr--over   { color: #ff6b6b; background: rgba(255,107,107,0.12); }

  .btn-extend {
    font-size: 0.7rem; cursor: pointer; border-radius: 2px; border: 1px solid;
    font-family: inherit; letter-spacing: 0.05em; text-transform: uppercase;
    padding: 2px 8px; transition: all 0.15s ease;
    color: var(--text-dim); background: transparent; border-color: var(--text-dim)33;
  }
  .btn-extend:hover { color: var(--accent); border-color: var(--accent-border); }

  .tl-extend {
    display: flex; align-items: center; gap: 0.3rem;
  }
  .extend-input {
    font-size: 0.72rem; font-family: inherit;
    background: var(--bg-input); color: var(--text);
    border: 1px solid var(--accent-border); border-radius: 3px;
    padding: 2px 6px; outline: none;
    color-scheme: dark;
  }
  .btn-extend-ok, .btn-extend-cancel {
    font-size: 0.75rem; background: none; border: none;
    cursor: pointer; padding: 1px 4px; border-radius: 2px;
    transition: color 0.15s;
  }
  .btn-extend-ok     { color: var(--c-done); }
  .btn-extend-cancel { color: var(--text-dim); }
  .btn-extend-ok:hover     { color: var(--accent); }
  .btn-extend-cancel:hover { color: #ff6b6b; }

  .tl-note-text {
    font-size: 0.75rem; color: var(--text-muted); font-style: italic;
    outline: none; border-radius: 2px; padding: 1px 4px; flex: 1;
  }
  .tl-note-text:focus {
    background: var(--bg-input); outline: 1px solid var(--accent-border);
    color: var(--text); font-style: normal;
  }

  .btn-action {
    font-size: 0.7rem; padding: 2px 8px; border-radius: 2px; border: 1px solid;
    font-family: inherit; letter-spacing: 0.05em; text-transform: uppercase;
    cursor: pointer; transition: all 0.15s ease;
  }
  .btn-action:hover:not(:disabled) { filter: brightness(1.2); }
  .btn-action:disabled { cursor: not-allowed; }

  .note-input {
    font-size: 0.75rem; font-family: inherit;
    background: transparent; border: none; border-bottom: 1px solid var(--border);
    color: var(--text-muted); padding: 2px 4px; outline: none; width: 100%;
  }
  .note-input:focus { border-color: var(--accent-border); color: var(--text); }
  .note-input::placeholder { color: var(--text-dim); }

  /* ── Mode tabs ── */
  .add-tabs { display: flex; gap: 0.25rem; margin-bottom: 0.3rem; }
  .add-tab {
    font-size: 0.65rem; font-family: inherit; text-transform: uppercase; letter-spacing: 0.08em;
    background: none; border: 1px solid transparent; border-radius: 3px;
    cursor: pointer; color: var(--text-dim); padding: 1px 7px; transition: all 0.15s;
  }
  .add-tab:hover { color: var(--text-muted); }
  .add-tab--active { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }

  /* ── Taste review ── */
  .taste-review { display: flex; flex-direction: column; gap: 0.35rem; }
  .taste-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .taste-ingr { font-size: 0.72rem; color: var(--text-muted); min-width: 8rem; }

  .btn-edit-taste {
    font-size: 0.7rem; background: none; border: none; cursor: pointer;
    color: var(--text-dim); padding: 1px 3px; border-radius: 2px; transition: color 0.15s;
  }
  .btn-edit-taste:hover { color: var(--accent); }
  .pen-icon { display: inline-block; transform: rotate(-90deg); }
  .taste-note-input {
    font-size: 0.7rem; font-family: inherit;
    background: transparent; border: none; border-bottom: 1px solid var(--border);
    color: var(--text-muted); padding: 1px 4px; outline: none; width: 7rem;
    flex-shrink: 1;
  }
  .taste-note-input:focus { border-color: var(--accent-border); color: var(--text); }
  .taste-note-input::placeholder { color: var(--text-dim); }
  .taste-footer { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem; }
  .btn-submit-review {
    font-size: 0.7rem; font-family: inherit; padding: 2px 10px; border-radius: 3px;
    border: 1px solid var(--accent-border); background: var(--accent-bg);
    color: var(--accent); cursor: pointer; white-space: nowrap; transition: all 0.15s;
  }
  .btn-submit-review:hover { filter: brightness(1.2); }

  /* ── Ratios ── */
  .ratios {
    flex-shrink: 0; display: flex; flex-direction: column; justify-content: flex-start;
    border-left: 1px solid var(--border);
    padding: 0.6rem 0.85rem 0.6rem 0.75rem; gap: 0.2rem;
  }
  .ratio-row { display: flex; gap: 0.5rem; align-items: baseline; }
  .ratio-name { font-size: 0.68rem; color: var(--text-muted); white-space: nowrap; }
  .ratio-val  { font-size: 0.75rem; color: var(--accent); font-weight: 700; white-space: nowrap; margin-left: auto; }
</style>
