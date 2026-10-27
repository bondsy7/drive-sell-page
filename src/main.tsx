import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { registerAppServiceWorker } from "./lib/pwa-register";
import { OfflineBanner } from "./components/OfflineBanner";
import "./index.css";
import { installOfflineActionGuard } from "./lib/offline-action-guard";
import { flushUploadQueue } from "./lib/offline-upload-queue";
import { toast } from "sonner";
import { initImageCache, prewarmShowrooms } from "./lib/image-base64-cache";
import { initConsentDefaults } from "./lib/consent";
import { installGlobalErrorGuard } from "./lib/global-error-guard";

// Consent-Default (alles verweigert) setzen, bevor irgendein Tag geladen werden darf
initConsentDefaults();

// Unbehandelte Credit-Fehler (HTTP 402) auffangen, bevor sie die Ansicht leeren
installGlobalErrorGuard();

// Load cached base64 images from localStorage into memory
initImageCache();
// Pre-warm built-in showroom images in background
prewarmShowrooms();

registerAppServiceWorker();
installOfflineActionGuard();

const flushOffline = () => {
  flushUploadQueue().then(r => {
    if (r.uploaded) toast.success(`${r.uploaded} offline aufgenommene(s) Foto(s) hochgeladen`);
  }).catch(() => {});
};
window.addEventListener("online", flushOffline);
flushOffline();

createRoot(document.getElementById("root")!).render(
  <>
    <OfflineBanner />
    <App />
  </>,
);
