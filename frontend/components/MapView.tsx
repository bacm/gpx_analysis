import { useEffect, useRef } from 'react'

interface MapViewProps {
  segments: Array<{
    latitude: number
    longitude: number
    warnings: string[]
  }>
  enabledWarningTypes: Set<string>
}

export default function MapView({ segments, enabledWarningTypes }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then((L) => {
        // Initialisation uniquement si la carte n'existe pas encore
        if (!mapRef.current) {
          mapRef.current = L.map('map').setView([46.2276, 2.2137], 6)

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(mapRef.current)
        }

        // Nettoyage des anciens marqueurs
        mapRef.current.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            mapRef.current?.removeLayer(layer)
          }
        })

        // Ajout des nouveaux marqueurs filtrés
        segments.forEach((segment) => {
          // Filtrer les avertissements en fonction des types activés
          const filteredWarnings = segment.warnings.filter(warning => {
            const warningType = warning.split(':')[0]
            return enabledWarningTypes.has(warningType)
          })

          // N'ajouter le marqueur que s'il y a des avertissements filtrés
          if (filteredWarnings.length > 0) {
            L.marker([segment.latitude, segment.longitude])
              .bindPopup(`Problèmes: ${filteredWarnings.join(', ')}`)
              .addTo(mapRef.current!)
          }
        })
      })
    }
  }, [segments, enabledWarningTypes])

  return (
    <div className="map-container">
      <h3>Carte des segments problématiques</h3>
      <div id="map" style={{ height: '400px', width: '100%' }}></div>
    </div>
  )
}