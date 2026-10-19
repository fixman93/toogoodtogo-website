/**
 * Live delivery map: the shop, the delivery address and the courier, who
 * glides to each new position. Optional route line (courier → address).
 * Lazy-loaded like the other maps.
 */
import { useEffect, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MlMap, Marker as MlMarker } from 'maplibre-gl'
import type { GeoPoint } from '@/api/types'
import { collapseAttribution, dropPinElement, loadEngine, localizeLabels, type Gl } from '@/features/map/engine'

/** --primary in sRGB — map paint properties don't read CSS variables. */
const ROUTE_COLOR = '#0f5541'
const lineData = (line: [number, number][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: line } })

function shopElement(label: string) {
  const el = document.createElement('div')
  el.className = 'zl-shop'
  el.title = label
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/></svg>'
  return el
}

/**
 * Courier on a scooter with a Foodnesi delivery box (side view, facing right).
 * Wheels spin while moving; the rider flips to face the direction of travel.
 */
const RIDER_SVG = `<svg viewBox="0 0 64 60" width="58" height="54" aria-hidden="true">
  <rect x="5" y="17" width="19" height="19" rx="4" fill="var(--primary)"/>
  <path d="M9.5 32c.2-6.6 4.2-10.2 10.5-10.4-.2 6.5-4.2 10.2-10.5 10.4z" fill="#fff"/>
  <path d="M10.5 31 17 24.6" stroke="var(--primary)" stroke-width="1.3" stroke-linecap="round"/>
  <rect x="8" y="38" width="34" height="6" rx="3" fill="var(--accent)"/>
  <path d="M40 41 49 20" stroke="#24313a" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M46 20h8" stroke="#24313a" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M42 49a7.5 7.5 0 0 1 14 -2" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" fill="none"/>
  <path d="M25 39h8l4-8" stroke="#24313a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M27 37 31 22" stroke="var(--primary)" stroke-width="9" stroke-linecap="round"/>
  <path d="M32 25.5 45 22" stroke="var(--primary)" stroke-width="4" stroke-linecap="round"/>
  <circle cx="32" cy="13.5" r="5.5" fill="#f1c7a0"/>
  <path d="M25.8 13.5a6.3 6.3 0 0 1 12.6 0z" fill="#fff" stroke="var(--primary)" stroke-width="1.6"/>
  <path d="M38.4 13.5h2.4" stroke="var(--primary)" stroke-width="1.6" stroke-linecap="round"/>
  <g class="zl-wheel"><circle cx="15" cy="51" r="7" fill="#24313a"/><circle cx="15" cy="51" r="3.2" fill="#e8e6df"/><path d="M15 45v12M9 51h12" stroke="#24313a" stroke-width="1.4"/></g>
  <g class="zl-wheel"><circle cx="49" cy="51" r="7" fill="#24313a"/><circle cx="49" cy="51" r="3.2" fill="#e8e6df"/><path d="M49 45v12M43 51h12" stroke="#24313a" stroke-width="1.4"/></g>
</svg>`

function courierElement(label: string) {
  const el = document.createElement('div')
  el.className = 'zl-courier'
  el.title = label
  el.setAttribute('aria-label', label)
  el.innerHTML = `<span class="zl-courier__ping"></span><span class="zl-courier__ride">${RIDER_SVG}</span>`
  return el
}

export default function TrackingMap({
  shop,
  shopLabel,
  destination,
  destinationLabel,
  courier,
  courierLabel,
  line,
}: {
  shop: GeoPoint
  shopLabel: string
  destination: GeoPoint
  destinationLabel: string
  courier: GeoPoint | null
  courierLabel: string
  line?: [number, number][] | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const glRef = useRef<Gl | null>(null)
  const courierPin = useRef<MlMarker | null>(null)
  const movingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const shown = useRef<GeoPoint | null>(null)
  const frame = useRef(0)
  const [ready, setReady] = useState(false)

  const fitAll = (points: GeoPoint[]) => {
    const map = mapRef.current
    const gl = glRef.current
    if (!map || !gl) return
    const bounds = new gl.LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat])
    for (const p of points) bounds.extend([p.lng, p.lat])
    map.fitBounds(bounds, { padding: { top: 60, bottom: 50, left: 50, right: 60 }, maxZoom: 16, duration: 700 })
  }

  useEffect(() => {
    let cancelled = false
    void loadEngine().then(({ gl, style, kind }) => {
      if (cancelled || !container.current) return
      glRef.current = gl
      const map = new gl.Map({
        container: container.current,
        style,
        bounds: [
          [Math.min(shop.lng, destination.lng), Math.min(shop.lat, destination.lat)],
          [Math.max(shop.lng, destination.lng), Math.max(shop.lat, destination.lat)],
        ],
        fitBoundsOptions: { padding: 60, maxZoom: 16 },
        minZoom: 5,
        maxZoom: 19,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: true,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right')
      new gl.Marker({ element: shopElement(shopLabel), anchor: 'center' }).setLngLat([shop.lng, shop.lat]).addTo(map)
      const home = dropPinElement(destinationLabel)
      home.style.cursor = 'default'
      new gl.Marker({ element: home, anchor: 'bottom' }).setLngLat([destination.lng, destination.lat]).addTo(map)
      map.on('load', () => {
        localizeLabels(map, kind)
        if (container.current) collapseAttribution(container.current)
        map.addSource('route', { type: 'geojson', data: lineData([]) })
        map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9 } })
        map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROUTE_COLOR, 'line-width': 5 } })
        setReady(true)
      })
      mapRef.current = map
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame.current)
      clearTimeout(movingTimer.current)
      courierPin.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Courier: appears (and the view fits everyone once), then glides to each new position.
  useEffect(() => {
    const map = mapRef.current
    const gl = glRef.current
    if (!map || !gl || !ready) return
    if (!courier) {
      courierPin.current?.remove()
      courierPin.current = null
      shown.current = null
      return
    }
    if (!courierPin.current) {
      courierPin.current = new gl.Marker({ element: courierElement(courierLabel), anchor: 'bottom', offset: [0, 6] }).setLngLat([courier.lng, courier.lat]).addTo(map)
      shown.current = courier
      fitAll([shop, destination, courier])
      return
    }
    const from = shown.current ?? courier
    // Face the direction of travel; wheels spin while gliding and a moment after.
    const el = courierPin.current.getElement()
    if (Math.abs(courier.lng - from.lng) > 1e-6) el.classList.toggle('zl-courier--left', courier.lng < from.lng)
    el.classList.add('zl-courier--moving')
    clearTimeout(movingTimer.current)
    movingTimer.current = setTimeout(() => el.classList.remove('zl-courier--moving'), 3_000)
    const start = performance.now()
    cancelAnimationFrame(frame.current)
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1200)
      const p = { lat: from.lat + (courier.lat - from.lat) * k, lng: from.lng + (courier.lng - from.lng) * k }
      courierPin.current?.setLngLat([p.lng, p.lat])
      shown.current = p
      if (k < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, courier?.lat, courier?.lng])

  useEffect(() => {
    if (!ready) return
    ;(mapRef.current?.getSource('route') as GeoJSONSource | undefined)?.setData(lineData(line ?? []))
  }, [ready, line])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  )
}
