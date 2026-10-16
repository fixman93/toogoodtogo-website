/**
 * Web push on this device: register the service worker, ask permission,
 * subscribe with the server's VAPID key and send the subscription to the API.
 * iPhone/iPad: works only when Foodnesi is added to the home screen (iOS 16.4+).
 */
import { pushApi } from '@/api/services'

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export type PushResult = 'enabled' | 'unsupported' | 'denied' | 'server-disabled'

export async function enablePush(): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported'
  const { enabled, publicKey } = await pushApi.key()
  if (!enabled || !publicKey) return 'server-disabled'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }))
  await pushApi.subscribe(sub.toJSON())
  return 'enabled'
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await pushApi.unsubscribe(sub.endpoint).catch(() => undefined)
  await sub.unsubscribe()
}
