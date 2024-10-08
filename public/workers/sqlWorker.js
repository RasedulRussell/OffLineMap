// src/assets/workers/sqlWorker.js

import initSqlJs from 'sql.js';

// Declare a variable for the database
let db;

self.onmessage = async (event) => {
  switch (event.data.action) {
    case 'init':
      try {
        const SQL = await initSqlJs({ locateFile: (file) => `/sql/sql-wasm.wasm` });
        db = new SQL.Database(); // Create a new database instance
        self.postMessage({ action: 'init', success: true });
      } catch (error) {
        self.postMessage({ action: 'error', message: error.message });
      }
      break;

    case 'execute':
      if (db) {
        try {
          const stmt = db.prepare(event.data.query);
          const results = [];

          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }

          stmt.free(); // Free the statement
          self.postMessage({ action: 'execute', results });
        } catch (error) {
          self.postMessage({ action: 'error', message: error.message });
        }
      } else {
        self.postMessage({ action: 'error', message: 'Database not initialized' });
      }
      break;

    case 'close':
      if (db) {
        db.close();
        db = null;
        self.postMessage({ action: 'close', success: true });
      }
      break;

    default:
      self.postMessage({ action: 'error', message: 'Unknown action' });
      break;
  }
};
