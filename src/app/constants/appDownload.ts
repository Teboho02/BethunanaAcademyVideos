// Where the Android APK is served from. The file is self-hosted in public/app/.
// Update this (or the file) when a new release is published.
export const ANDROID_APK_URL = '/app/bethunana-academy.apk';

export type MobilePlatform = 'ios' | 'android' | 'other';

/** Best-effort device detection from the user agent (used to tailor the app promo). */
export function getMobilePlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}
