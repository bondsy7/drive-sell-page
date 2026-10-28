import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { canUseExplainerVideo } from "@/lib/remaster-prompt";
import { EXPLAINER_VIDEOS } from "@/lib/explainer-videos";

/** A document player avoids the restrictive CSP of directly opened CDN media. */
export default function RemasterExplainer() {
  const { user } = useAuth();
  const source = EXPLAINER_VIDEOS.fotos;
  if (!canUseExplainerVideo(user?.email)) return <Navigate to="/generator/fotos" replace />;
  if (!source) return null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background">
      <video
        aria-label="Foto & Remastering Erklärung"
        controls
        autoPlay
        playsInline
        preload="metadata"
        poster={source.poster}
        className="aspect-video w-full max-h-dvh object-contain"
      >
        {source.webm && <source src={source.webm} type="video/webm" />}
        {source.mp4 && <source src={source.mp4} type="video/mp4" />}
      </video>
    </main>
  );
}