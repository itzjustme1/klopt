<script lang="ts">
  import { APP_NAME } from "../config";
  /** On the blue band the mark turns white with a blue check. */
  let { size = 32, onBand = false }: { size?: number; onBand?: boolean } = $props();
</script>

<span class="logo" class:on-band={onBand}>
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="9" fill={onBand ? "#ffffff" : "#1660FF"} />
    <path d="m9.5 16.4 4.2 4.2 8.8-9.2" fill="none" stroke={onBand ? "#1660FF" : "#ffffff"} stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <span class="name">{APP_NAME}</span>
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .name {
    font-weight: 800;
    font-size: 1.375rem;
    letter-spacing: -0.03em;
    color: var(--ink);
  }
  .on-band .name {
    color: #ffffff;
  }
</style>
