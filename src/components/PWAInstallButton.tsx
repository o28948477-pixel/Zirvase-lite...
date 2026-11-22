import { useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { useOnlineStatus, usePWAInstall } from "../hooks/usePWAInstall";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install JARVIS App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl">
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Install JARVIS on iPhone / iPad
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Local Memory &amp; Studio Active</span>
    </div>
  );
}
