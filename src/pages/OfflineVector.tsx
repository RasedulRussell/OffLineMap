import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import Overlay from 'ol/Overlay';
import initSqlJs from 'sql.js';
import 'ol/ol.css';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import L, { map } from 'leaflet';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT'; // for Mapbox Vector Tile format
import { createXYZ } from 'ol/tilegrid';
import Graticule from 'ol/layer/Graticule';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import Style from 'ol/style/Style';
import GeoJSON from 'ol/format/GeoJSON';
import TopoJSON from 'ol/format/TopoJSON';




const OfflineVector: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null); // Track the OpenLayers map instance
  const [db, setDb] = useState<any>(null); // Store SQLite DB instance

  const loadMbtilesFiles = async () => {
    try {
      const filePaths = ['Gibson_ Desert.mbtiles'];
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sql/sql-wasm.wasm`,
      });
  
      const masterDatabase = new SQL.Database();

      masterDatabase.run(`
        CREATE TABLE IF NOT EXISTS tiles (
          zoom_level INTEGER,
          tile_column INTEGER,
          tile_row INTEGER,
          tile_data BLOB
        );
      `);
  
      for (const filePath of filePaths) {
        const response = await fetch(`/mbtiles/${filePath}`);
        const arrayBuffer = await response.arrayBuffer();
        const uInt8Array = new Uint8Array(arrayBuffer);
        const database = new SQL.Database(uInt8Array);
        
        const stmt = database.prepare('SELECT * FROM tiles');
        let abc = 1;
        while (stmt.step()) {
          const row = stmt.getAsObject();
         // console.log({z: row.zoom_level, c:row.tile_column, r:row.tile_row, d:row.tile_data})
          masterDatabase.run(
            `INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)`,
            [row.zoom_level, row.tile_column, row.tile_row, row.tile_data]
          );
        }

      }

      setDb(masterDatabase);
      console.log('Successfully merged all MBTiles files.');
    } catch (err) {
      console.error('Failed to load and merge MBTiles files:', err);
    }
  };

  const zoomLevelTileData = (z: number) => {
    console.log('---------------------')
    const stmt = db.prepare(
      'SELECT tile_column, tile_row FROM tiles WHERE zoom_level = ?'
    );
    const result = stmt.getAsObject([z]);
    stmt.free();
    console.log(result)
  }

  const fetchTile = (z: number, x: number, y: number) => {
    try {
      if (!db) {
        console.log('Database is not yet loaded');
        return '';
      }
  
      //zoomLevelTileData(2)
      const flippedY = Math.pow(2, z) - 1 - y;
  
      const stmt = db.prepare(
        'SELECT tile_data, tile_column, tile_row FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
      );
      const result = stmt.getAsObject([z, flippedY, x]);
      
  
       console.log(result)
  
      if (result && result.tile_data) {
  
        // MVT
        const blob = new Blob([result.tile_data], { type: 'image/jpeg' });
        console.log('url', URL.createObjectURL(blob));
        const url = URL.createObjectURL(blob);
  
        // If GeoJson
        //  const geoJsonData = JSON.parse(result.tile_data); // Parse GeoJSON from string
  
        //   // Create a Blob from GeoJSON
        //   const blob = new Blob([JSON.stringify(geoJsonData)], { type: 'application/json' });
        //   const url = URL.createObjectURL(blob);
        //   console.log('GeoJSON URL:', url);


        // 
        // const topoJsonData = JSON.parse(result.tile_data); // Parse TopoJSON from string

        // // Create a Blob from TopoJSON
        // const blob = new Blob([JSON.stringify(topoJsonData)], { type: 'application/json' });
        // const url = URL.createObjectURL(blob);
        // console.log('TopoJSON URL:', url);

          return url; 
      }
  
      stmt.free();
  
      return 'favicon.png' // Return an empty string if no tile is found      
    } catch (error) {
      console.log('error', error)
    }
  };

  useEffect(() => {
    loadMbtilesFiles();
  }, []);

  const graticule = new Graticule({
    strokeStyle: new Stroke({
      color: 'rgba(255, 120, 0, 0.8)', // Grid line color
      width: 1.5, // Grid line width
    }),
    showLabels: true,
    wrapX: false,
    // Formatters for longitude and latitude labels
    lonLabelFormatter: (lon) => lon.toFixed(2),
    latLabelFormatter: (lat) => lat.toFixed(2),
    latLabelStyle: new Text({
        font: '12px Arial',
        // fill: new Stroke({ color: '#000' }), // Label text color
        // backgroundFill: new Stroke({ color: '#FFF' }), // Background color
        padding: [2, 2, 2, 2],
      }),
  });
  useEffect(() => {
    if (db && mapContainer.current && !mapInstance.current) {
      // Initialize the OpenLayers map
      mapInstance.current = new Map({
        target: mapContainer.current,
        layers: [
          new VectorTileLayer({
            source: new VectorTileSource({
              format: new MVT(), // MVT format for Mapbox Vector Tiles
              tileUrlFunction: (tileCoord) => {
                const [z, x, y] = tileCoord;
                return fetchTile(z, x, y); // Ensure this function returns URLs for vector tiles
              },
              tileGrid: createXYZ({ 
                maxZoom: 13, 
                minZoom: 0,
              }),
              projection: 'EPSG:3857', // Web Mercator projection
            }),
          }),
        ],
        view: new View({
          center: [0, 0],
          zoom: 0,
          projection: 'EPSG:3857',
        }),
      });
    }
  }, [db]);

  return <div ref={mapContainer} style={{ height: '100vh', width: '100%' }} />;
};

export default OfflineVector;
