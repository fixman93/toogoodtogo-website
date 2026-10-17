/** Per-device scanner preferences (the phone at the counter). */
const KEYS = { onLaunch: 'zalogaj.scan.onLaunch', autoCollect: 'zalogaj.scan.autoCollect', cameraOk: 'zalogaj.scan.cameraOk' } as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export const scannerPrefs = {
  /** Open the scanner when the app starts (default: on for partners and staff). */
  openOnLaunch: () => read(KEYS.onLaunch) !== 'off',
  setOpenOnLaunch: (on: boolean) => write(KEYS.onLaunch, on ? 'on' : 'off'),
  /** Hand over valid codes immediately, without the confirm tap (default: off). */
  autoCollect: () => read(KEYS.autoCollect) === 'on',
  setAutoCollect: (on: boolean) => write(KEYS.autoCollect, on ? 'on' : 'off'),
  /** The camera worked on this device before → start it right away next time. */
  cameraOk: () => read(KEYS.cameraOk) === '1',
  setCameraOk: () => write(KEYS.cameraOk, '1'),
}
