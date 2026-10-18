/**
 * True inside the iOS/Android app (Capacitor, see mobile/). The web build is
 * the same; only a few things differ — e.g. web push isn't available in the
 * app's web view (native push comes with the App Store release).
 */
export const isNativeApp = (): boolean => {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}
