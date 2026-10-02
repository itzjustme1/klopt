<script lang="ts">
  /** A QR code for a link, drawn as one SVG path. The QR library is only loaded when a code is shown. */
  let { text, label }: { text: string; label: string } = $props();

  let path = $state("");
  let size = $state(0);

  $effect(() => {
    const value = text;
    let cancelled = false;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      if (cancelled) return;
      // Low error correction keeps the code as small as possible; a phone screen is a clean surface.
      const qr = qrcode(0, "L");
      qr.addData(value, "Byte");
      qr.make();
      const n = qr.getModuleCount();
      let d = "";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
      size = n + 8;
      path = d;
    });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if path}
  <svg class="qr" viewBox="0 0 {size} {size}" role="img" aria-label={label} shape-rendering="crispEdges">
    <rect width={size} height={size} fill="#fff" />
    <path d={path} fill="#000" />
  </svg>
{/if}

<style>
  .qr {
    display: block;
    width: min(100%, 320px);
    height: auto;
    border-radius: var(--r-sm);
  }
</style>
