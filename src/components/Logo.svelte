<script lang="ts">
  import { APP_NAME } from "../config";
  let { size = 32 }: { size?: number } = $props();
</script>

<span class="logo">
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="9" fill="#1660FF" />
    <rect x="7" y="9" width="18" height="14" rx="3" fill="#fff" />
    <path d="m11.5 16.2 3 3 6-6.2" fill="none" stroke="#1660FF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
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
    font-size: 1.25rem;
    letter-spacing: -0.03em;
    color: var(--ink);
  }
</style>
