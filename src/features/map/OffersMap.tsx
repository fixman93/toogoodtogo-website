/**
 * Map of locations with live offers (Mapbox or MapLibre, see ./engine).
 * Price pins are HTML markers; nearby pins merge into a numbered bubble when
 * zoomed out and tapping it zooms in. Lazy-loaded (both libraries are big).
 */
import { useEffect, useRef, useState } from 'react'
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl'
import type { BoundingBox, GeoPoint, OfferLocation } from '@/api/types'
import { t } from '@/i18n'
import { formatMoney } from '@/lib/format'
import { collapseAttribution, loadEngine, localizeLabels, type Gl } from './engine'

/** Pins closer than this (screen pixels) are merged into a cluster. */
const CLUSTER_PX = 56
/** From this zoom on, every location gets its own pin. */
const NO_CLUSTER_ZOOM = 15

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function pinElement(location: OfferLocation) {
  const soldOut = location.minPriceMinor == null
  const label = soldOut ? t('map.soldOut') : formatMoney(location.minPriceMinor!, location.currency)
  const tone = soldOut ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'zl-pin'
  el.dataset.id = location.businessId
  el.setAttribute('aria-label', location.name)
  el.title = location.name
  el.innerHTML = `<span class="${tone} inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold shadow-lg ring-2 ring-white">${escapeHtml(label)}</span>`
  return el
}

function clusterElement(count: number) {
  const size = count < 10 ? 40 : count < 100 ? 48 : 56
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'zl-cluster'
  el.style.width = el.style.height = `${size}px`
  el.setAttribute('aria-label', String(count))
  el.innerHTML = `<span class="flex size-full items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground shadow-lg ring-4 ring-primary/25">${count}</span>`
  return el
}

function userElement() {
  const el = document.createElement('div')
  el.className = 'zl-me'
  el.title = t('map.youAreHere')
  el.innerHTML = '<span></span>'
  return el
}

/** Highlight the selected pin in place (colour + on top) — nothing is rebuilt, so nothing moves. */
function markSelected(pins: Map<string, HTMLElement>, selectedId?: string) {
  for (const [id, el] of pins) {
    el.classList.toggle('zl-pin--selected', id === selectedId)
    el.style.zIndex = id === selectedId ? '3' : ''
  }
}

/** Greedy screen-space clustering at the current zoom. */
function cluster(map: MlMap, locations: OfferLocation[]) {
  if (map.getZoom() >= NO_CLUSTER_ZOOM) return locations.map((l) => [l])
  const groups: { x: number; y: number; members: OfferLocation[] }[] = []
  for (const l of locations) {
    const p = map.project([l.location.lng, l.location.lat])
    const near = groups.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < CLUSTER_PX)
    if (near) near.members.push(l)
    else groups.push({ x: p.x, y: p.y, members: [l] })
  }
  return groups.map((g) => g.members)
}

export default function OffersMap({
  locations,
  initialCenter,
  user,
  flyTo,
  selectedId,
  onSelect,
  onViewportChange,
}: {
  locations: OfferLocation[]
  initialCenter: GeoPoint
  user: GeoPoint | null
  flyTo: { target: GeoPoint; version: string }
  selectedId?: string
  onSelect: (businessId: string | undefined) => void
  onViewportChange: (bbox: BoundingBox) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const pins = useRef<MlMarker[]>([])
  /** Pin elements by location id — selection only restyles them (no rebuild, so nothing moves). */
  const pinEls = useRef(new Map<string, HTMLElement>())
  const selectedRef = useRef(selectedId)
  const me = useRef<MlMarker | null>(null)
  const callbacks = useRef({ onSelect, onViewportChange })
  const glRef = useRef<Gl | null>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(14)

  useEffect(() => {
    callbacks.current = { onSelect, onViewportChange }
  })

  // Create the map once (after the engine has loaded).
  useEffect(() => {
    let cancelled = false
    void loadEngine().then(({ gl, style, kind }) => {
      if (cancelled || !container.current) return
      glRef.current = gl
      const map = new gl.Map({
        container: container.current,
        style,
        center: [initialCenter.lng, initialCenter.lat],
        zoom: 14,
        minZoom: 5,
        maxZoom: 19,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right')
      // Visible area (padded 25%) → load pins for it.
      const report = () => {
        const b = map.getBounds()
        if (!b) return
        const dLat = (b.getNorth() - b.getSouth()) * 0.25
        const dLng = (b.getEast() - b.getWest()) * 0.25
        callbacks.current.onViewportChange({ minLat: b.getSouth() - dLat, maxLat: b.getNorth() + dLat, minLng: b.getWest() - dLng, maxLng: b.getEast() + dLng })
      }
      map.on('load', () => {
        localizeLabels(map, kind)
        if (container.current) collapseAttribution(container.current)
        setReady(true)
        report()
      })
      map.on('moveend', report)
      // Tapping the map itself (not a pin) closes the location card.
      map.on('click', () => callbacks.current.onSelect(undefined))
      map.on('zoomend', () => setZoom(map.getZoom()))
      mapRef.current = map
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Price pins and clusters.
  useEffect(() => {
    const map = mapRef.current
    const gl = glRef.current
    if (!map || !gl || !ready) return
    for (const m of pins.current) m.remove()
    pinEls.current.clear()
    pins.current = cluster(map, locations).map((members) => {
      if (members.length === 1) {
        const l = members[0]
        const el = pinElement(l)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          callbacks.current.onSelect(l.businessId)
        })
        pinEls.current.set(l.businessId, el)
        return new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([l.location.lng, l.location.lat]).addTo(map)
      }
      const lng = members.reduce((s, m) => s + m.location.lng, 0) / members.length
      const lat = members.reduce((s, m) => s + m.location.lat, 0) / members.length
      const el = clusterElement(members.length)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const bounds = new gl.LngLatBounds()
        for (const m of members) bounds.extend([m.location.lng, m.location.lat])
        map.fitBounds(bounds, { padding: 56, maxZoom: NO_CLUSTER_ZOOM, duration: 600 })
      })
      return new gl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
    })
    markSelected(pinEls.current, selectedRef.current)
  }, [ready, zoom, locations])

  // Selection: restyle pins in place, and bring the pin into view if the location card would cover it.
  const locationsRef = useRef(locations)
  useEffect(() => {
    locationsRef.current = locations
  })
  useEffect(() => {
    selectedRef.current = selectedId
    markSelected(pinEls.current, selectedId)
    const map = mapRef.current
    const target = locationsRef.current.find((l) => l.businessId === selectedId)
    if (!map || !target) return
    const { clientWidth: w, clientHeight: h } = map.getContainer()
    const p = map.project([target.location.lng, target.location.lat])
    const lngLat: [number, number] = [target.location.lng, target.location.lat]
    if (w < 640 && p.y > h * 0.3) {
      // Phone: the card covers up to the lower 62% → move the pin into the top fifth.
      map.easeTo({ center: lngLat, offset: [0, -h * 0.3], duration: 400 })
    } else if (w >= 640 && p.x < 420 && p.y > h * 0.3) {
      // Wider screens: the card sits bottom-left (380 px) → move the pin to the right of it.
      map.easeTo({ center: lngLat, offset: [(420 + (w - 420) / 2) - w / 2, 0], duration: 400 })
    }
  }, [selectedId])

  // "You are here".
  useEffect(() => {
    const map = mapRef.current
    const gl = glRef.current
    if (!map || !gl || !ready) return
    me.current?.remove()
    me.current = user ? new gl.Marker({ element: userElement(), anchor: 'center' }).setLngLat([user.lng, user.lat]).addTo(map) : null
  }, [ready, user?.lat, user?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to a new location (GPS fix, city picked) — not on first render.
  const firstFly = useRef(true)
  useEffect(() => {
    if (firstFly.current) {
      firstFly.current = false
      return
    }
    mapRef.current?.flyTo({ center: [flyTo.target.lng, flyTo.target.lat], zoom: 14, duration: 800 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo.version])

  // The wrapper fills the frame absolutely, so the canvas never pushes the layout wider and follows
  // the frame on resize. The map gets its own inner element: MapLibre/Mapbox set position:relative on it.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  )
}
