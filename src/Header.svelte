<script>
  import { onMount } from 'svelte'

  const links = [
    { label: 'Batches', file: 'cold-brew.sveld' },
    { label: 'Compare', file: 'compare.sveld' },
    { label: 'Chart',   file: 'chart.sveld' },
  ];

  const currentFile = typeof __SVELD_FILE__ !== 'undefined' ? __SVELD_FILE__ : '';
  let focusedFile = currentFile;

  onMount(() => {
    window.addEventListener('message', (e) => {
      if (e.data.type === 'focusChange') focusedFile = e.data.file;
    });
  });
</script>

<nav>
  {#each links as link}
    <button
      class="link"
      class:active={link.file === currentFile}
      class:link--focused={link.file === focusedFile}
      onclick={() => link.file !== currentFile && sveldOpen('./' + link.file)}
    >{link.label}</button>
  {/each}
  <button class="btn-edit" onclick={() => sveldEdit()} title="Open in text editor">&lt;/&gt;</button>
</nav>
<div class="nav-spacer"></div>

<style>
  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; gap: 0.15rem;
    padding: 0.5rem 2rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .link {
    font-family: inherit; font-size: 0.7rem;
    text-transform: uppercase; letter-spacing: 0.1em;
    background: none; border: none; cursor: pointer;
    color: var(--text-dim); padding: 3px 10px; border-radius: 3px;
    transition: color 0.15s;
  }
  .link:hover { color: var(--text-muted); }
  .link.active { color: var(--accent); background: var(--accent-bg); cursor: default; }
  .link--focused { color: #ffb86c !important; }
  .btn-edit {
    margin-left: auto;
    font-family: inherit; font-size: 0.7rem;
    background: none; border: none; cursor: pointer;
    color: var(--text-dim); padding: 3px 8px; border-radius: 3px;
    transition: color 0.15s;
  }
  .btn-edit:hover { color: var(--text-muted); }
  .nav-spacer { height: 2.25rem; }
</style>
