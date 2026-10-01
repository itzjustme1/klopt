<script lang="ts">
  import { APP_NAME } from "../config";
  let { size = 30 }: { size?: number } = $props();
</script>

<span class="logo">
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="9" fill="#29B966" />
    <path d="m9.5 16.4 4.2 4.2 8.8-9.2" fill="none" stroke="#08200F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
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
    font-weight: 900;
    font-size: var(--fs-title);
    letter-spacing: -0.02em;
    color: var(--ink);
  }
</style>
