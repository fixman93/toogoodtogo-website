/**
 * Leaflet map of locations with live offers (OpenStreetMap tiles, no API key).
 * Nearby pins merge into a numbered bubble when zoomed out; tapping a bubble
 * zooms in. Lazy-loaded so Leaflet stays out of the main bundle.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { BoundingBox, GeoPoint, OfferLocation } from '@/api/types'
import { t } from '@/i18n'
import { formatMoney } from '@/lib/format'

/** Pins closer than this (screen pixels) are merged into a cluster. */
const CLUSTER_PX = 56
/** From this zoom on, every location gets its own pin. */
const NO_CLUSTER_ZOOM = 15

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function pinIcon(location: OfferLocation, selected: boolean) {
  const soldOut = location.minPriceMinor == null
  const label = soldOut ? t('map.soldOut') : formatMoney(location.minPriceMinor!, location.currency)
  const tone = soldOut ? 'bg-muted text-muted-foreground' : selected ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div class="zl-pin ${selected ? 'zl-pin--selected' : ''}" aria-label="${escapeHtml(location.name)}">
      <span class="${tone} inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold shadow-lg ring-2 ring-white">${escapeHtml(label)}</span>
    </div>`,
  })
}

function clusterIcon(count: number) {
  const size = count < 10 ? 40 : count < 100 ? 48 : 56
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div class="zl-cluster" style="width:${size}px;height:${size}px" aria-label="${count}">
      <span class="flex size-full items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground shadow-lg ring-4 ring-primary/25">${count}</span>
    </div>`,
  })
}

const userIcon = L.divIcon({
  className: '',
  iconSize: [0, 0],
  html: `<div class="zl-me" title="${escapeHtml(t('map.youAreHere'))}"><span></span></div>`,
})

interface Cluster {
  key: string
  center: GeoPoint
  members: OfferLocation[]
}

/** Greedy screen-space clustering at the current zoom level. */
function cluster(map: L.Map, zoom: number, locations: OfferLocation[]): Cluster[] {
  if (zoom >= NO_CLUSTER_ZOOM) return locations.map((l) => ({ key: l.businessId, center: l.location, members: [l] }))
  const groups: { point: L.Point; members: OfferLocation[] }[] = []
  for (const l of locations) {
    const point = map.project([l.location.lat, l.location.lng], zoom)
    const near = groups.find((g) => g.point.distanceTo(point) < CLUSTER_PX)
    if (near) near.members.push(l)
    else groups.push({ point, members: [l] })
  }
  return groups.map((g) => ({
    key: g.members.map((m) => m.businessId).join('|'),
    center: {
      lat: g.members.reduce((s, m) => s + m.location.lat, 0) / g.members.length,
      lng: g.members.reduce((s, m) => s + m.location.lng, 0) / g.members.length,
    },
    members: g.members,
  }))
}

function Pins({ locations, selectedId, onSelect }: { locations: OfferLocation[]; selectedId?: string; onSelect: (id: string) => void }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const clusters = useMemo(() => cluster(map, zoom, locations), [map, zoom, locations])

  return clusters.map((c) =>
    c.members.length === 1 ? (
      <Marker
        key={c.key}
        position={[c.center.lat, c.center.lng]}
        icon={pinIcon(c.members[0], c.members[0].businessId === selectedId)}
        zIndexOffset={c.members[0].businessId === selectedId ? 500 : 0}
        eventHandlers={{ click: () => onSelect(c.members[0].businessId) }}
        title={c.members[0].name}
        keyboard
      />
    ) : (
      <Marker
        key={c.key}
        position={[c.center.lat, c.center.lng]}
        icon={clusterIcon(c.members.length)}
        eventHandlers={{
          click: () => map.fitBounds(L.latLngBounds(c.members.map((m) => [m.location.lat, m.location.lng])), { padding: [48, 48], maxZoom: NO_CLUSTER_ZOOM }),
        }}
        keyboard
      />
    ),
  )
}

/** Reports the visible area (slightly padded) after every pan/zoom. */
function ViewportWatcher({ onChange }: { onChange: (bbox: BoundingBox) => void }) {
  const map = useMapEvents({ moveend: () => report() })
  const report = () => {
    const b = map.getBounds().pad(0.25)
    onChange({ minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() })
  }
  const reported = useRef(false)
  useEffect(() => {
    if (reported.current) return
    reported.current = true
    // The container may get its final size after Suspense resolves.
    map.whenReady(() =>
      setTimeout(() => {
        map.invalidateSize()
        report()
      }, 0),
    )
  })
  return null
}

/** Flies to `target` whenever `version` changes (e.g. when GPS arrives). */
function FlyTo({ target, version }: { target: GeoPoint; version: string }) {
  const map = useMap()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    map.flyTo([target.lat, target.lng], 14, { duration: 0.8 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])
  return null
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
  return (
    <MapContainer center={[initialCenter.lat, initialCenter.lng]} zoom={14} minZoom={6} className="size-full" zoomControl={false} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ViewportWatcher onChange={onViewportChange} />
      <FlyTo target={flyTo.target} version={flyTo.version} />
      {user && <Marker position={[user.lat, user.lng]} icon={userIcon} zIndexOffset={1000} interactive={false} />}
      <Pins locations={locations} selectedId={selectedId} onSelect={onSelect} />
    </MapContainer>
  )
}
