import { Download, Smartphone } from 'lucide-react';
import { ANDROID_APK_URL } from '../constants/appDownload';

/**
 * Compact promo for the mobile app. Designed to sit on the dark login panel, so
 * it uses a translucent surface matching the surrounding glass cards/pills.
 */
export function AppPromo({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-white">Get the mobile app</p>
          <p className="text-xs leading-tight text-white/60">Offline lessons &amp; alerts</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={ANDROID_APK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-white/90"
          >
            <Download className="h-3.5 w-3.5" />
            Android
          </a>
          <span className="rounded-lg border border-white/25 px-2.5 py-1.5 text-xs font-medium text-white/60">
            iOS soon
          </span>
        </div>
      </div>
    </div>
  );
}
