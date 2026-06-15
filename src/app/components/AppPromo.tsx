import { Apple, Download, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { ANDROID_APK_URL, getMobilePlatform } from '../constants/appDownload';

/**
 * Self-contained promo card for the mobile app. Reads well on both the dark
 * login panel and the light home page because it brings its own gradient.
 */
export function AppPromo({ className = '' }: { className?: string }) {
  const platform = getMobilePlatform();

  return (
    <div
      className={`rounded-2xl bg-gradient-to-r from-secondary to-blue-700 p-5 sm:p-6 text-white shadow-lg ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Get the Bethunana Academy app</h3>
            <p className="text-sm text-white/80">
              Watch lessons offline and get notified when new content is added.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button asChild variant="secondary" className="bg-white text-secondary hover:bg-white/90">
            <a href={ANDROID_APK_URL} download>
              <Download className="h-4 w-4" />
              Android
            </a>
          </Button>
          <Button
            disabled
            variant="outline"
            className="border-white/40 bg-transparent text-white/80"
          >
            <Apple className="h-4 w-4" />
            iOS — soon
          </Button>
        </div>
      </div>

      {platform === 'ios' ? (
        <p className="mt-3 text-xs text-white/70">
          The Android app is available now — the iOS version is coming soon.
        </p>
      ) : null}
    </div>
  );
}
