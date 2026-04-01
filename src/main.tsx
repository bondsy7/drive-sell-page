import { createRoot } from 'react-dom/client';
import App from "./App.tsx";
import "./index.css";
import { initImageCache, prewarmShowrooms } from "./lib/image-base64-cache";

// Load cached base64 images from localStorage into memory
initImageCache();
// Pre-warm built-in showroom images in background
prewarmShowrooms();

createRoot(document.getElementById("root")!).render(<App />);
