<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    help,
    disabled = false,
    onchange,
  }: { checked?: boolean; label: string; help?: string; disabled?: boolean; onchange?: (checked: boolean) => void } = $props();
  const uid = $props.id();
</script>

<div class="switch-row">
  <label class="switch">
    <input type="checkbox" role="switch" bind:checked {disabled} aria-describedby={help ? `help-${uid}` : undefined} onchange={() => onchange?.(checked)} />
    <span class="track" aria-hidden="true"><span class="thumb"></span></span>
    <span class="text">{label}</span>
  </label>
  {#if help}<p class="small muted" id="help-{uid}">{help}</p>{/if}
</div>

<style>
  .switch-row {
    display: grid;
    gap: 0.25rem;
  }
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    min-height: var(--tap);
    font-weight: 700;
    cursor: pointer;
  }
  .switch input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .track {
    position: relative;
    width: 52px;
    height: 32px;
    border-radius: var(--r-pill);
    background: var(--line-strong);
    transition: background-color var(--t-base) var(--ease);
    flex: none;
  }
  .thumb {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ffffff;
    transition: transform var(--t-base) var(--ease);
  }
  .switch input:checked + .track {
    background: var(--accent);
  }
  .switch input:checked + .track .thumb {
    transform: translateX(20px);
  }
  .switch input:focus-visible + .track {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .switch input:disabled + .track {
    opacity: 0.5;
  }
  .switch-row p {
    padding-left: calc(52px + 0.75rem);
  }
</style>
