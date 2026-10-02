<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "./Icon.svelte";

  /**
   * Taking a photo with a camera on a laptop (the built-in one, or an iPhone through Continuity Camera).
   * Phones already offer their camera in the file picker. Nothing leaves the device: the photo goes
   * straight to `onphoto`.
   */
  let { onphoto, onclose }: { onphoto: (file: File) => void; onclose: () => void } = $props();

  let video: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | null = null;
  let devices = $state<MediaDeviceInfo[]>([]);
  let deviceId = $state("");
  let error = $state("");
  let ready = $state(false);
  let dialog: HTMLElement | undefined = $state();

  async function start(id?: string) {
    stop();
    ready = false;
    error = "";
    try {
      // Ask for as many pixels as the camera has: small letters need them.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...(id ? { deviceId: { exact: id } } : { facingMode: "environment" }), width: { ideal: 4032 }, height: { ideal: 3024 } },
      });
      await tick();
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      deviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? id ?? "";
      // Names of the cameras are only known once access is allowed.
      devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      ready = true;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      error = name === "NotAllowedError" || name === "SecurityError" ? t("camera.denied") : name === "NotFoundError" || name === "OverconstrainedError" ? t("camera.none") : t("camera.failed");
    }
  }

  function stop() {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
  }

  async function take() {
    const track = stream?.getVideoTracks()[0];
    if (!track || !video) return;
    let blob: Blob | null = null;
    // A real photo at full sensor resolution where the browser can (Chrome); otherwise a video frame.
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
    if (IC) blob = await new IC(track).takePhoto().catch(() => null);
    if (!blob) {
      const c = document.createElement("canvas");
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext("2d")!.drawImage(video, 0, 0);
      blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    }
    if (!blob) return void (error = t("camera.failed"));
    stop();
    onphoto(new File([blob], "camera.jpg", { type: blob.type || "image/jpeg" }));
  }

  function close() {
    stop();
    onclose();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    trap(e);
  }

  // Focus moves into the window, and back to the button that opened it afterwards.
  const opener = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
  $effect(() => {
    void start();
    dialog?.focus();
  });
  onDestroy(() => {
    stop();
    opener?.focus?.();
  });

  /** Keeps Tab inside the window. */
  function trap(e: KeyboardEvent) {
    if (e.key !== "Tab" || !dialog) return;
    const items = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), select")];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<div class="scrim" role="presentation" onclick={close}></div>
<div class="camera card" role="dialog" aria-modal="true" aria-labelledby="camera-title" tabindex="-1" bind:this={dialog} {onkeydown}>
  <div class="head">
    <h2 id="camera-title">{t("camera.title")}</h2>
    <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={close}><Icon name="x" /></button>
  </div>
  <div class="view">
    <video bind:this={video} playsinline muted aria-label={t("camera.preview")}></video>
    {#if !ready && !error}<p class="wait small muted" role="status">{t("camera.starting")}</p>{/if}
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if devices.length > 1}
    <div class="field">
      <label for="camera-device">{t("camera.which")}</label>
      <select id="camera-device" bind:value={deviceId} onchange={() => start(deviceId)}>
        {#each devices as d, i (d.deviceId)}<option value={d.deviceId}>{d.label || t("camera.number", { n: i + 1 })}</option>{/each}
      </select>
    </div>
  {/if}
  <p class="small muted">{t("camera.tip")}</p>
  <div class="row actions">
    <button type="button" class="btn btn-primary btn-lg" disabled={!ready} onclick={take}><Icon name="camera" size={22} />{t("camera.take")}</button>
    <button type="button" class="btn btn-quiet" onclick={close}>{t("common.cancel")}</button>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgb(0 0 0 / 0.55);
  }
  .camera {
    position: fixed;
    left: 50%;
    top: 50%;
    z-index: 71;
    transform: translate(-50%, -50%);
    display: grid;
    gap: 0.875rem;
    width: min(760px, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    overflow: auto;
    padding: 1rem 1.25rem 1.25rem;
    outline: none;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .view {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 200px;
    border-radius: var(--r-md);
    overflow: hidden;
    background: #000;
  }
  video {
    display: block;
    width: 100%;
    max-height: 60dvh;
    object-fit: contain;
  }
  .wait {
    position: absolute;
    color: #fff;
  }
  .actions {
    flex-wrap: wrap;
  }
</style>
