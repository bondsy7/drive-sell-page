import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-primary px-4 py-2 text-sm text-primary-foreground shadow">
      <WifiOff className="h-4 w-4" />
      Offline – bereits geladene Inhalte bleiben sichtbar. Generierung und Speichern erst wieder mit Verbindung möglich.
    </div>
  );
}
