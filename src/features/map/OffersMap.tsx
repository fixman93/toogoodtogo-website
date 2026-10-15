/**
 * Leaflet map of locations with live offers (OpenStreetMap tiles, no API key).
 * Lazy-loaded from the Browse page so Leaflet stays out of the main bundle.
 */
import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { GeoPoint } from '@/api/types'
import { t } from '@/i18n'
import { formatMoney } from '@/lib/format'
import { distanceMeters } from '@/lib/geo'
import type { MapLocation } from './group'

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function pinIcon(location: MapLocation, selected: boolean) {
  const available = location.offers.filter((o) => o.quantityAvailable > 0)
  const cheapest = available.length ? Math.min(...available.map((o) => o.priceMinor)) : null
  const label = cheapest == null ? t('map.soldOut') : formatMoney(cheapest, location.offers[0].currency)
  const tone = cheapest == null ? 'bg-muted text-muted-foreground' : selected ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div class="zl-pin ${selected ? 'zl-pin--selected' : ''}" aria-label="${escapeHtml(location.name)}">
      <span class="${tone} inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold shadow-lg ring-2 ring-white">${escapeHtml(label)}</span>
    </div>`,
  })
}

const userIcon = L.divIcon({
  className: '',
  iconSize: [0, 0],
  html: `<div class="zl-me" title="${escapeHtml(t('map.youAreHere'))}"><span></span></div>`,
})

/** Reports the visible area (center + radius) after the user pans/zooms. */
function ViewportWatcher({ onChange }: { onChange: (center: GeoPoint, radiusKm: number) => void }) {
  const map = useMapEvents({
    moveend: () => report(),
  })
  const report = () => {
    const center = map.getCenter()
    const corner = map.getBounds().getNorthEast()
    const radiusKm = distanceMeters({ lat: center.lat, lng: center.lng }, { lat: corner.lat, lng: corner.lng }) / 1000
    onChange({ lat: center.lat, lng: center.lng }, radiusKm)
  }
  // Report the initial viewport once the map has a size.
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

/** Flies to `target` whenever `version` changes (e.g. after "Najbliže meni"). */
function FlyTo({ target, version }: { target: GeoPoint; version: string }) {
  const map = useMap()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    map.flyTo([target.lat, target.lng], 13, { duration: 0.8 })
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
  locations: MapLocation[]
  initialCenter: GeoPoint
  user: GeoPoint | null
  flyTo: { target: GeoPoint; version: string }
  selectedId?: string
  onSelect: (businessId: string | undefined) => void
  onViewportChange: (center: GeoPoint, radiusKm: number) => void
}) {
  const icons = useMemo(() => new Map(locations.map((l) => [l.businessId, pinIcon(l, l.businessId === selectedId)])), [locations, selectedId])

  return (
    <MapContainer
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={13}
      className="size-full"
      zoomControl={false}
      attributionControl
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ViewportWatcher onChange={onViewportChange} />
      <FlyTo target={flyTo.target} version={flyTo.version} />
      {user && <Marker position={[user.lat, user.lng]} icon={userIcon} zIndexOffset={1000} interactive={false} />}
      {locations.map((l) => (
        <Marker
          key={l.businessId}
          position={[l.location.lat, l.location.lng]}
          icon={icons.get(l.businessId)!}
          zIndexOffset={l.businessId === selectedId ? 500 : 0}
          eventHandlers={{ click: () => onSelect(l.businessId) }}
          keyboard
          title={l.name}
        />
      ))}
    </MapContainer>
  )
}
