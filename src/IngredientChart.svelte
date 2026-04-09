<script>
  export let points = []
  export let mode = 'time'     // 'time' | 'quantity'

  let container
  let width = 300

  $: if (container) {
    const ro = new ResizeObserver(([e]) => { width = e.contentRect.width })
    ro.observe(container)
  }

  const H = 110
  const PAD = { top: 12, right: 40, bottom: 22, left: 16 }
  $: plotW = width - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  function normalize(val) {
    if (typeof val === 'number') return val;
    if (val === 'under') return 25;
    if (val === 'right') return 50;
    if (val === 'over')  return 75;
    return null;
  }

  function dotColor(val) {
    const n = normalize(val) ?? 50;
    return n <= 50
      ? lerpHex('#ffb86c', '#4ecdc4', n / 50)
      : lerpHex('#4ecdc4', '#ff6b6b', (n - 50) / 50);
  }

  function lerpHex(a, b, t) {
    const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
    const r  = Math.round(((ah>>16)&0xff) + (((bh>>16)&0xff)-((ah>>16)&0xff))*t).toString(16).padStart(2,'0');
    const g  = Math.round(((ah>> 8)&0xff) + (((bh>> 8)&0xff)-((ah>> 8)&0xff))*t).toString(16).padStart(2,'0');
    const bl = Math.round(( ah     &0xff) + (( bh     &0xff)-( ah     &0xff))*t).toString(16).padStart(2,'0');
    return `#${r}${g}${bl}`;
  }

  $: pts = points
    .map(p => ({ ...p, val: normalize(p.extraction), xRaw: mode === 'time' ? p.infusion_hours : p.quantity_per_l }))
    .filter(p => p.val !== null && p.xRaw !== null)

  $: xMax  = Math.max(...pts.map(p => p.xRaw), mode === 'time' ? 12 : 1)
  $: xStep = mode === 'time' ? 6 : niceTick(xMax)
  $: xTicks = Array.from({ length: Math.floor(xMax / xStep) + 1 }, (_, i) => i * xStep)
  $: xUnit  = mode === 'time' ? 'h' : (pts[0]?.quantity_unit ?? 'g/L')

  function niceTick(max) {
    const candidates = [0.5, 1, 2, 5, 10, 20, 50];
    return candidates.find(c => max / c <= 6) ?? 50;
  }

  function xPos(v) { return PAD.left + (v / xMax) * plotW }
  function yPos(v) { return PAD.top + plotH - (v / 100) * plotH }
  function jitter(id) { return ((id * 7) % 9 - 4) * 0.6 }
</script>

<div bind:this={container} class="chart-wrap">
<svg {width} height={H} class="chart">
  <!-- zone bands -->
  <rect x={PAD.left} y={yPos(100)} width={plotW} height={plotH*0.4} fill="#ff6b6b08"/>
  <rect x={PAD.left} y={yPos(60)}  width={plotW} height={plotH*0.2} fill="#4ecdc408"/>
  <rect x={PAD.left} y={yPos(40)}  width={plotW} height={plotH*0.4} fill="#ffb86c08"/>

  <!-- y axis labels -->
  <text x={PAD.left + plotW + 4} y={yPos(100)+3} font-size="9" fill="#ff6b6b99">over</text>
  <text x={PAD.left + plotW + 4} y={yPos(50) +3} font-size="9" fill="#4ecdc499">right</text>
  <text x={PAD.left + plotW + 4} y={yPos(0)  +3} font-size="9" fill="#ffb86c99">under</text>

  <!-- center line -->
  <line x1={PAD.left} x2={PAD.left+plotW} y1={yPos(50)} y2={yPos(50)}
    stroke="#4ecdc420" stroke-width="1" stroke-dasharray="3 4"/>

  <!-- x ticks -->
  {#each xTicks as v}
    {@const x = xPos(v)}
    <line x1={x} x2={x} y1={PAD.top} y2={H-PAD.bottom+3} stroke="#ffffff08" stroke-width="1"/>
    <text x={x} y={H-PAD.bottom+13} text-anchor="middle" font-size="9" fill="#555">{v}{xUnit}</text>
  {/each}

  <!-- dots -->
  {#each pts as p}
    {@const cx = xPos(p.xRaw) + jitter(p.batch_id)}
    {@const cy = yPos(p.val)}
    {@const col = dotColor(p.extraction)}
    <circle {cx} {cy} r="5" fill={col} fill-opacity="0.8" stroke={col} stroke-width="1">
      <title>#{p.batch_id} · {p.xRaw}{xUnit} · {p.val}{p.note ? ` — ${p.note}` : ''}</title>
    </circle>
  {/each}

  {#if pts.length === 0}
    <text x={width/2} y={H/2+4} text-anchor="middle" font-size="11" fill="#444">no data yet</text>
  {/if}
</svg>

</div>

<style>
  .chart-wrap { width: 100%; }
  .chart { display: block; }
</style>
