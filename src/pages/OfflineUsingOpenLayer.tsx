import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import initSqlJs from 'sql.js';

const OfflineOLMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null); // Track the OpenLayers map instance
  const [db, setDb] = useState<any>(null); // Store SQLite DB instance

  const loadMbtilesFiles = async () => {
    try {
      const filePaths = ['world_countries.mbtiles'];
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

          console.log({z: row.zoom_level, c:row.tile_column, r:row.tile_row, d:row.tile_data})

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

  const fetchTile = (z: number, x: number, y: number) => {
    if (!db) {
      console.log('Database is not yet loaded');
      return '';
    }

    const flippedY = Math.pow(2, z) - 1 - y;

    console.log({x,flippedY,z})
    const stmt = db.prepare(
      'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
    );
    const result = stmt.getAsObject([z, x, flippedY]);
    stmt.free();

    if (result && result.tile_data) {
      const blob = new Blob([result.tile_data], { type: 'image/jpeg' });
      console.log('url', URL.createObjectURL(blob));
      return URL.createObjectURL(blob);
    }

    return ''; // Return an empty string if no tile is found
  };

  useEffect(() => {
    loadMbtilesFiles();
  }, []);

  useEffect(() => {
    if (db && mapContainer.current && !mapInstance.current) {
      // Initialize the OpenLayers map
      mapInstance.current = new Map({
        target: mapContainer.current,
        layers: [
          new TileLayer({
            source: new XYZ({
              tileUrlFunction: (tileCoord) => {
                const [z, x, y] = tileCoord;
                return fetchTile(z, x, y);
              },
            }),
          }),
        ],
        view: new View({
          center: [0, 0],
          zoom: 4,
          projection: 'EPSG:3857', // Web Mercator projection
        }),
      });
    }
  }, [db]);

  return <div ref={mapContainer} style={{ height: '100vh', width: '100%' }} />;
};

export default OfflineOLMap;
