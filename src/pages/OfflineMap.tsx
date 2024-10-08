import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import initSqlJs from 'sql.js';

const OfflineMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null); // Track the map instance
  const [db, setDb] = useState<any>(null); // Store SQLite DB instance

  const loadMbtilesFile = async () => {
    try {
      const response = await fetch('/mbtiles/Gibson_ Desert.mbtiles');
      const arrayBuffer = await response.arrayBuffer();

      // Load SQL.js with the correct WebAssembly path
      const SQL = await initSqlJs();

      const uInt8Array = new Uint8Array(arrayBuffer);
      const database = new SQL.Database(uInt8Array);
      setDb(database); // Set database after loading
      console.log('Successfully loaded the MBTiles file.');
    } catch (err) {
      console.error('Failed to load MBTiles file:', err);
    }
  };

  const loadMbtilesFiles = async () => {
    try {
      const filePaths = ['Kimberley.mbtiles'];
      // Initialize the SQL.js library
      const SQL = await initSqlJs();  //{locateFile: (file: string) => `/sql/sql-wasm.wasm`,}
  
      // Create a master database to merge all mbtiles data
      const masterDatabase = new SQL.Database();

      masterDatabase.run(`
        CREATE TABLE IF NOT EXISTS tiles (
          zoom_level INTEGER,
          tile_column INTEGER,
          tile_row INTEGER,
          tile_data BLOB
        );
      `);
  
      // Iterate through each mbtiles file and merge data
      for (const filePath of filePaths) {
        const response = await fetch(`/mbtiles/${filePath}`);
        const arrayBuffer = await response.arrayBuffer();
        const uInt8Array = new Uint8Array(arrayBuffer);
        const database = new SQL.Database(uInt8Array);
        
        // Fetch data from the current MBTiles file
        const tilesData = database.exec("SELECT * FROM tiles"); // Assuming 'tiles' table exists
        const stmt = database.prepare('SELECT * FROM tiles');
        
        while (stmt.step()) {
          const row = stmt.getAsObject();
          //console.log('row', row);
          // masterDatabase.run(
          //   `INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)`,
          //   row
          // );

          masterDatabase.run(
            `INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)`,
            [
              row.zoom_level,     // Extract zoom_level from the row object
              row.tile_column,    // Extract tile_column from the row object
              row.tile_row,       // Extract tile_row from the row object
              row.tile_data       // Extract tile_data from the row object
            ]
          );
        }
        // Insert data into the master database
        // for (const row of tilesData[0].values) {
        //   // Assuming the columns in the master database are the same as the current mbtiles file
        //   masterDatabase.run(
        //     `INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)`,
        //     row
        //   );
        // }

        console.log(`Successfully loaded and merged: ${filePath}`);
      }
  
      const stmt = masterDatabase.prepare('SELECT * FROM tiles LIMIT 1');
      while (stmt.step()) {
        const row = stmt.getAsObject();
        console.log('row', row);
      }

      setDb(masterDatabase); // Set master database after loading and merging
      console.log('Successfully merged all MBTiles files.');
    } catch (err) {
      console.error('Failed to load and merge MBTiles files:', err);
    }
  };
  

  useEffect(() => {
    loadMbtilesFiles();
  }, []);

  const checkTileData = () => {
    const stmt = db.prepare('SELECT * FROM tiles LIMIT 10');
    console.log('checkTileData', stmt);
    let result: any;
    while (stmt.step()) {
      console.log('first cordinate', stmt.getAsObject());
    }
    stmt.free();
    return result;
  };

  const fetchTile1 = async () => {
    if (!db) return '';
  
    const z = 14;
    const x = 9289;
    const y = 12287;

    console.log(`Fetching tile for Z: ${z}, X: ${x}, Y: ${y}`);
  
    // SQL query to fetch the tile
    // const stmt = db.prepare(
    //   'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
    // );

    const stmt = db.prepare(
        'SELECT tile_data FROM tiles LIMIT 1'
      );
    
    const flippedY = Math.pow(2, z) - 1 - y;  // Flip Y axis
    console.log(`Transformed Y: ${flippedY}`);
  
    const result = stmt.getAsObject(); //await checkTileData(); /
    console.log('SQL Query Result:', result);
  
    stmt.free();
  
    if (result && result.tile_data) {
      const blob = new Blob([result.tile_data], { type: 'image/png' });
      console.log('blob', blob)
      return URL.createObjectURL(blob);
    }
  
    return '';  // Return an empty string if no tile is found
  };
  

  // Function to fetch tiles from the MBTiles file
  const fetchTile = (z: number, x: number, y: number) => {
    if (!db) {
      console.log('Database is not yet loaded');
      return '';
    }

    //fetchTile1()
    checkTileData();

    console.log(`Fetching tile for Z: ${z}, X: ${x}, Y: ${y}`);

    // SQL query to fetch the tile data
    const stmt = db.prepare(
      'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
    );

    const result = stmt.getAsObject([z, x, y]); // checkTileData(); //
    console.log('result', result);
    stmt.free();

    if (result && result.tile_data) {
      const blob = new Blob([result.tile_data], { type: 'image/png' });
      console.log('blob', blob);
      return URL.createObjectURL(blob);
    }

    return ''; // Return an empty string if no tile is found
  };

  useEffect(() => {
    if (db && mapContainer.current && !mapInstance.current) {
      // Initialize the map only once and only after the database is loaded
      mapInstance.current = L.map(mapContainer.current).setView([0, 0], 1);

      const tileLayer = L.tileLayer('', {
        minZoom: 0,
        maxZoom: 18,
        tileSize: 256,
        noWrap: true,
      });

      // Define a custom tile URL function to load tiles from the mbtiles file
      tileLayer.getTileUrl = (coords) => {
        const { z, x, y } = coords;
        return fetchTile(z, x, y) || ''; // Ensure it always returns a string
      };

      tileLayer.addTo(mapInstance.current);
    }
  }, [db]); // Run this effect only when `db` changes

  return <div ref={mapContainer} style={{ height: '100vh', width: '100%' }} />;
};

export default OfflineMap;
