/**
 * One place on the map (offer / location page), optionally with a route to it:
 * start marker, route line, and the view fitted to both. Lazy-loaded.
 */
import { useEffect, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MlMap, Marker as MlMarker } from 'maplibre-gl'
import type { GeoPoint } from '@/api/types'
import { collapseAttribution, dropPinElement, loadEngine, localizeLabels, type Gl } from './engine'

/** --primary (oklch 0.38 0.08 165) in sRGB — map paint properties don't read CSS variables. */
const ROUTE_COLOR = '#0f5541'

function startElement() {
  const el = document.createElement('div')
  el.className = 'zl-me'
  el.innerHTML = '<span></span>'
  return el
}

const lineData = (line: [number, number][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: line } })

export default function PlaceMap({ place, label, start, line }: { place: GeoPoint; label: string; start?: GeoPoint | null; line?: [number, number][] | null }) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const glRef = useRef<Gl | null>(null)
  const startPin = useRef<MlMarker | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadEngine().then(({ gl, style, kind }) => {
      if (cancelled || !container.current) return
      glRef.current = gl
      const map = new gl.Map({
        container: container.current,
        style,
        center: [place.lng, place.lat],
        zoom: 15,
        minZoom: 5,
        maxZoom: 19,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        // Part of a scrolling page: scroll/one finger moves the page, not the map.
        cooperativeGestures: true,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right')
      const pin = dropPinElement(label)
      pin.style.cursor = 'default'
      new gl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([place.lng, place.lat]).addTo(map)
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
      startPin.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Route: line + start marker, view fitted to the whole route; without one, back to the place.
  useEffect(() => {
    const map = mapRef.current
    const gl = glRef.current
    if (!map || !gl || !ready) return
    ;(map.getSource('route') as GeoJSONSource | undefined)?.setData(lineData(line ?? []))
    startPin.current?.remove()
    startPin.current = start ? new gl.Marker({ element: startElement(), anchor: 'center' }).setLngLat([start.lng, start.lat]).addTo(map) : null
    if (start) {
      const bounds = new gl.LngLatBounds([place.lng, place.lat], [place.lng, place.lat])
      bounds.extend([start.lng, start.lat])
      for (const p of line ?? []) bounds.extend(p)
      map.fitBounds(bounds, { padding: { top: 60, bottom: 40, left: 40, right: 50 }, maxZoom: 16, duration: 700 })
    } else map.easeTo({ center: [place.lng, place.lat], zoom: 15, duration: 500 })
  }, [ready, start, line, place.lat, place.lng])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  )
}
