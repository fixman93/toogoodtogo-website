/**
 * Map for placing a location's pin: drag the pin, or tap the map to move it there.
 * Changes of `value` from outside (address search, GPS) move the pin and the map.
 * Lazy-loaded like the offers map.
 */
import { useEffect, useRef, useState } from 'react'
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl'
import type { GeoPoint } from '@/api/types'
import { t } from '@/i18n'
import { collapseAttribution, dropPinElement, loadEngine, localizeLabels, type Gl } from './engine'

const PIN_ZOOM = 16
const CITY_ZOOM = 13

const round = (n: number) => Math.round(n * 1e6) / 1e6
const same = (a: GeoPoint | null, b: GeoPoint | null) => a?.lat === b?.lat && a?.lng === b?.lng

export default function LocationPickerMap({ value, fallbackCenter, onChange }: { value: GeoPoint | null; fallbackCenter: GeoPoint; onChange: (point: GeoPoint) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const glRef = useRef<Gl | null>(null)
  const pin = useRef<MlMarker | null>(null)
  /** Last point this map reported — its echo through `value` must not re-centre the map. */
  const emitted = useRef<GeoPoint | null>(value)
  const onChangeRef = useRef(onChange)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  const placePin = (point: GeoPoint) => {
    const map = mapRef.current
    const gl = glRef.current
    if (!map || !gl) return
    if (!pin.current) {
      pin.current = new gl.Marker({ element: dropPinElement(t('partner.field.location')), anchor: 'bottom', draggable: true }).setLngLat([point.lng, point.lat]).addTo(map)
      pin.current.on('dragend', () => {
        const { lat, lng } = pin.current!.getLngLat()
        emit({ lat: round(lat), lng: round(lng) })
      })
    } else pin.current.setLngLat([point.lng, point.lat])
  }

  const emit = (point: GeoPoint) => {
    emitted.current = point
    onChangeRef.current(point)
  }

  // Create the map once (after the engine has loaded).
  useEffect(() => {
    let cancelled = false
    void loadEngine().then(({ gl, style, kind }) => {
      if (cancelled || !container.current) return
      glRef.current = gl
      const start = value ?? fallbackCenter
      const map = new gl.Map({
        container: container.current,
        style,
        center: [start.lng, start.lat],
        zoom: value ? PIN_ZOOM : CITY_ZOOM,
        minZoom: 5,
        maxZoom: 19,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        // Inside a form: page scroll / one-finger swipe scroll the page, not the map.
        cooperativeGestures: true,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right')
      map.on('load', () => {
        localizeLabels(map, kind)
        if (container.current) collapseAttribution(container.current)
        setReady(true)
      })
      map.on('click', (e) => {
        const point = { lat: round(e.lngLat.lat), lng: round(e.lngLat.lng) }
        placePin(point)
        emit(point)
      })
      mapRef.current = map
      if (value) placePin(value)
    })
    return () => {
      cancelled = true
      pin.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A point from outside (address search, GPS): move the pin and fly there.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !value || same(value, emitted.current)) return
    emitted.current = value
    placePin(value)
    map.flyTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), PIN_ZOOM), duration: 800 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, value?.lat, value?.lng])

  // No pin yet and another city/country was chosen: show that city.
  useEffect(() => {
    if (!ready || value) return
    mapRef.current?.jumpTo({ center: [fallbackCenter.lng, fallbackCenter.lat], zoom: CITY_ZOOM })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fallbackCenter.lat, fallbackCenter.lng])

  // A cleared point (e.g. the country changed) removes the pin.
  useEffect(() => {
    if (value) return
    pin.current?.remove()
    pin.current = null
    emitted.current = null
  }, [value])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
      {!value && ready && (
        <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold shadow">
          {t('partner.field.tapToPlace')}
        </p>
      )}
    </div>
  )
}
