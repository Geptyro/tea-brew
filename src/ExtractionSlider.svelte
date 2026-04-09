<script>
  export let value = null   // null = untouched, 0–100 = rated
  export let onchange = null
</script>

<div class="wrap">
  <span class="lbl">under</span>
  <input type="range" min="0" max="100" step="5"
    value={value ?? 50}
    class="slider"
    class:touched={value !== null}
    oninput={(e) => onchange && onchange(+e.target.value)} />
  <span class="lbl">over</span>
</div>

<style>
  .wrap { display: flex; align-items: center; gap: 0.3rem; }
  .lbl  { font-size: 0.62rem; color: var(--text-dim); white-space: nowrap; }

  .slider {
    -webkit-appearance: none; appearance: none;
    width: 7rem; height: 3px; border: none; outline: none; cursor: pointer;
    background: linear-gradient(to right, #ffb86c 0%, #4ecdc4 50%, #ff6b6b 100%);
    border-radius: 2px; opacity: 0.3; transition: opacity 0.15s;
  }
  .slider.touched       { opacity: 1; }
  .slider:hover         { opacity: 0.8; }
  .slider.touched:hover { opacity: 1; }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none; width: 11px; height: 11px;
    border-radius: 50%; background: #e8eaf0; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.3);
  }
  .slider::-moz-range-thumb {
    width: 11px; height: 11px; border-radius: 50%;
    background: #e8eaf0; cursor: pointer; border: none;
  }
</style>
