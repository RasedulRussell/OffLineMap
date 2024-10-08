import React, { useEffect, useRef } from 'react';
import L from 'leaflet';



const Map: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null); // Store map instance here


  useEffect(() => {
    if (mapContainer.current && !mapInstance.current) {
      // Initialize the map only if it hasn't been initialized yet
      mapInstance.current = L.map(mapContainer.current).setView([51.505, -0.09], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstance.current);

      L.marker([51.5, -0.09])
        .addTo(mapInstance.current)
        .bindPopup('A pretty CSS3 popup.<br> Easily customizable.')
        .openPopup();
    }

    return () => {
      // Cleanup map on unmount
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null; // Set map instance to null after removal
      }
    };
  }, []);

  return <div ref={mapContainer} style={{ height: '100vh', width: '100%' }} />;
};

export default Map;
