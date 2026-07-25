// Where the Android APK is served from (hosted on Cloudflare R2, not in the repo
// because it exceeds GitHub's 100MB limit). Update this when a new release is published.
export const ANDROID_APK_URL =
  'https://pub-4821c2cbfdcb410aaca3f90cb13655ef.r2.dev/application-25c3b1d6-beb1-4406-93da-4e87f2cab147.apk';

// Official app store listings.
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=za.co.bethunanaacademy.app';
export const APP_STORE_URL =
  'https://apps.apple.com/us/app/bethunanaacademy/id6784565840';

export type MobilePlatform = 'ios' | 'android' | 'other';

/** Best-effort device detection from the user agent (used to tailor the app promo). */
export function getMobilePlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}
