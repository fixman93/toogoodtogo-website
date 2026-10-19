/** Mapbox public token (pk.…). Without it the app uses free OpenStreetMap services. */
export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || undefined
/** Mapbox style (e.g. streets-v12, light-v11, or your own from Mapbox Studio). */
export const MAPBOX_STYLE = (import.meta.env.VITE_MAPBOX_STYLE as string | undefined) || 'mapbox://styles/mapbox/streets-v12'
