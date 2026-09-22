/**
 * FocusOS Universal Storage & Data Recovery Engine
 * Scans all available client storage (localStorage, all IndexedDB databases and object stores)
 * to locate and recover any lost analysis, history, presets, or timeline progress from current
 * and prior versions.
 */

// Helper to check if an object looks like a date-keyed FocusOS history collection
export function isHistoryRecord(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  // Check if keys match YYYY-MM-DD
  const dateKeyMatches = keys.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
  if (dateKeyMatches.length > 0) return true;
  // Or check if obj has { date: "...", blocks: ... } (single day record)
  if (obj.date && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) && (obj.blocks || obj.blocksList || typeof obj.dailyScore === 'number')) {
    return true;
  }
  return false;
}

// Helper to check if an array looks like FocusOS presets
export function isPresetArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.some(item => item && typeof item === 'object' && item.id && item.name && item.start && item.end);
}

/**
 * Exhaustively scans window.localStorage across all keys
 */
export function scanLocalStorage() {
  const recoveredDays = {};
  let recoveredPresets = null;
  let keysScanned = 0;

  if (typeof window === 'undefined' || !window.localStorage) {
    return { recoveredDays, recoveredPresets, keysScanned };
  }

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      keysScanned++;
      if (!key) continue;

      try {
        const raw = window.localStorage.getItem(key);
        if (!raw || raw.length < 2) continue;
        const data = JSON.parse(raw);

        // Check if data is history dictionary
        if (isHistoryRecord(data)) {
          if (data.date && (data.blocks || data.blocksList)) {
            recoveredDays[data.date] = data;
          } else {
            Object.entries(data).forEach(([ds, dayVal]) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(ds) && dayVal && typeof dayVal === 'object') {
                recoveredDays[ds] = dayVal;
              }
            });
          }
        }

        // Check if data has nested history (e.g. data.history)
        if (data && typeof data === 'object' && data.history && isHistoryRecord(data.history)) {
          Object.entries(data.history).forEach(([ds, dayVal]) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(ds) && dayVal && typeof dayVal === 'object') {
              recoveredDays[ds] = dayVal;
            }
          });
        }

        // Check if presets
        if (isPresetArray(data)) {
          if (!recoveredPresets || data.length > recoveredPresets.length) {
            recoveredPresets = data;
          }
        }
        if (data && Array.isArray(data.presets) && isPresetArray(data.presets)) {
          if (!recoveredPresets || data.presets.length > recoveredPresets.length) {
            recoveredPresets = data.presets;
          }
        }
      } catch {
        // Non-JSON key, skip
      }
    }
  } catch (err) {
    console.warn('LocalStorage scan warning:', err);
  }

  return { recoveredDays, recoveredPresets, keysScanned };
}

/**
 * Exhaustively scans all accessible IndexedDB databases and object stores
 */
export async function scanIndexedDB() {
  const recoveredDays = {};
  let recoveredPresets = null;
  let dbsScanned = 0;
  let storesScanned = 0;

  if (typeof window === 'undefined' || !window.indexedDB) {
    return { recoveredDays, recoveredPresets, dbsScanned, storesScanned };
  }

  // Candidate DB names across past and present FocusOS builds
  const candidateDBs = [
    "FocusOS_PWA_DB",
    "FocusOS_DB",
    "FocusOS",
    "focusos_db",
    "focusos",
    "app_data",
    "keyval-store",
    "localforage",
  ];

  try {
    if (typeof indexedDB.databases === 'function') {
      const liveDBs = await indexedDB.databases();
      if (Array.isArray(liveDBs)) {
        liveDBs.forEach((d) => {
          if (d && d.name && !candidateDBs.includes(d.name)) {
            candidateDBs.unshift(d.name);
          }
        });
      }
    }
  } catch (e) {}

  for (const dbName of candidateDBs) {
    try {
      const db = await new Promise((resolve) => {
        try {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (!db) continue;
      dbsScanned++;

      const storeNames = Array.from(db.objectStoreNames || []);
      for (const storeName of storeNames) {
        storesScanned++;
        try {
          const records = await new Promise((resolve) => {
            try {
              const tx = db.transaction(storeName, 'readonly');
              const store = tx.objectStore(storeName);
              const items = [];
              const cursorReq = store.openCursor();
              cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                  items.push({ key: cursor.key, val: cursor.value });
                  cursor.continue();
                } else {
                  resolve(items);
                }
              };
              cursorReq.onerror = () => resolve([]);
            } catch {
              resolve([]);
            }
          });

          for (const item of records) {
            const val = item.val;
            if (isHistoryRecord(val)) {
              if (val.date && (val.blocks || val.blocksList)) {
                recoveredDays[val.date] = val;
              } else {
                Object.entries(val).forEach(([ds, dayVal]) => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(ds) && dayVal && typeof dayVal === 'object') {
                    recoveredDays[ds] = dayVal;
                  }
                });
              }
            }
            if (val && typeof val === 'object' && val.history && isHistoryRecord(val.history)) {
              Object.entries(val.history).forEach(([ds, dayVal]) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(ds) && dayVal && typeof dayVal === 'object') {
                  recoveredDays[ds] = dayVal;
                }
              });
            }
            if (isPresetArray(val)) {
              if (!recoveredPresets || val.length > recoveredPresets.length) {
                recoveredPresets = val;
              }
            }
          }
        } catch (storeErr) {
          console.warn(`Scan error in store ${storeName}:`, storeErr);
        }
      }
      db.close();
    } catch {
      // Continue to next DB
    }
  }

  return { recoveredDays, recoveredPresets, dbsScanned, storesScanned };
}

/**
 * Universal Deep Scan & Merge
 * Non-destructive merge prioritizing preserved logs over empty placeholders
 */
export async function performDeepScanAndRecover({ currentHistory = {}, currentPresets = [] }) {
  const lsResult = scanLocalStorage();
  const idbResult = await scanIndexedDB();

  const allRecoveredDays = {
    ...lsResult.recoveredDays,
    ...idbResult.recoveredDays,
  };

  const initialCount = Object.keys(currentHistory || {}).length;
  const mergedHistory = { ...allRecoveredDays, ...(currentHistory || {}) };

  // Merge blocks within each day so no logged progress is lost
  Object.keys(allRecoveredDays).forEach((ds) => {
    const recoveredDay = allRecoveredDays[ds];
    const existingDay = currentHistory ? currentHistory[ds] : null;
    if (existingDay && recoveredDay) {
      const mergedBlocks = {
        ...(recoveredDay.blocks || {}),
        ...(existingDay.blocks || {}),
      };
      // If existing block was pending but recovered was completed/partial, keep the completed log
      Object.entries(recoveredDay.blocks || {}).forEach(([bid, bProg]) => {
        if (bProg && (bProg.status === 'completed' || bProg.status === 'partial')) {
          if (!existingDay.blocks || !existingDay.blocks[bid] || existingDay.blocks[bid].status === 'pending') {
            mergedBlocks[bid] = bProg;
          }
        }
      });
      mergedHistory[ds] = {
        ...recoveredDay,
        ...existingDay,
        blocks: mergedBlocks,
        blocksList: (existingDay.blocksList && existingDay.blocksList.length > 0)
          ? existingDay.blocksList
          : (recoveredDay.blocksList || []),
        dailyScore: Math.max(existingDay.dailyScore || 0, recoveredDay.dailyScore || 0),
      };
    } else if (recoveredDay) {
      mergedHistory[ds] = recoveredDay;
    }
  });

  // Merge presets non-destructively
  let mergedPresets = Array.isArray(currentPresets) ? [...currentPresets] : [];
  const recoveredPresets = idbResult.recoveredPresets || lsResult.recoveredPresets;
  if (recoveredPresets && Array.isArray(recoveredPresets) && recoveredPresets.length > 0) {
    const map = new Map();
    mergedPresets.forEach((p) => p && p.id && map.set(p.id, p));
    recoveredPresets.forEach((p) => {
      if (p && p.id && !map.has(p.id)) {
        map.set(p.id, p);
      }
    });
    mergedPresets = Array.from(map.values());
  }

  const finalCount = Object.keys(mergedHistory).length;
  const newlyRecoveredDays = Math.max(0, finalCount - initialCount);

  // Dual-redundant backup write
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('fo6_history', JSON.stringify(mergedHistory));
      window.localStorage.setItem('focusos_history_master_backup', JSON.stringify(mergedHistory));
      window.localStorage.setItem('fo6_presets', JSON.stringify(mergedPresets));
    }
  } catch (e) {}

  return {
    mergedHistory,
    mergedPresets,
    stats: {
      keysScanned: lsResult.keysScanned,
      dbsScanned: idbResult.dbsScanned,
      storesScanned: idbResult.storesScanned,
      totalDays: finalCount,
      newlyRecoveredDays,
    },
  };
}

/**
 * Export complete backup payload as JSON file download
 */
export function exportBackupData({ history, presets, alarms, notificationConfig }) {
  const payload = {
    app: "FocusOS",
    version: "6.0-pro",
    exportedAt: new Date().toISOString(),
    history: history || {},
    presets: presets || [],
    alarms: alarms || {},
    notificationConfig: notificationConfig || {},
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `focusos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Safely parses and validates an imported JSON backup string
 */
export function parseImportBackup(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') throw new Error("Invalid JSON structure");

    let history = {};
    let presets = null;

    if (data.history && isHistoryRecord(data.history)) {
      history = data.history;
    } else if (isHistoryRecord(data)) {
      history = data;
    }

    if (data.presets && isPresetArray(data.presets)) {
      presets = data.presets;
    }

    return {
      success: true,
      history,
      presets,
      alarms: data.alarms || null,
      notificationConfig: data.notificationConfig || null,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
