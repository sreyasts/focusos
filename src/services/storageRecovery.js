/**
 * TYMVERA Universal Storage & Data Recovery Engine
 * Exhaustively scans all available client storage:
 * - window.localStorage (TYMVERA history, PlusTwo mission state, backups, raw date keys)
 * - All IndexedDB databases & stores (TYMVERA_PWA_DB, TYMVERA_DB, Firestore cache, keyval, localforage)
 * - Deep multi-schema parser: TYMVERA history format, Kerala Plus Two study planner plans,
 *   Firestore offline caches, raw arrays of logs, double-stringified JSON, and date-keyed entries.
 * - Non-destructive merge preserving every logged checkmark, actual minutes, and score.
 */

export function isDateString(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// Helper to check if an object looks like a date-keyed TYMVERA history collection
export function isHistoryRecord(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  // Check if any keys match YYYY-MM-DD
  const dateKeyMatches = keys.filter(k => isDateString(k));
  if (dateKeyMatches.length > 0) return true;
  // Or check if obj has { date: "...", blocks: ... } (single day record)
  if (obj.date && isDateString(obj.date) && (obj.blocks || obj.blocksList || typeof obj.dailyScore === 'number')) {
    return true;
  }
  return false;
}

// Helper to check if an array looks like TYMVERA presets
export function isPresetArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.some(item => item && typeof item === 'object' && item.id && item.name && item.start && item.end);
}

/**
 * Parses and converts Kerala Plus Two Study Planner format (plusTwoMissionState_v2 / plusTwoPlanState)
 * into native TYMVERA daily history records and recurring presets.
 */
export function extractFromPlusTwoPlan(planData) {
  const recoveredDays = {};
  const recoveredPresets = [];

  if (!planData) return { recoveredDays, recoveredPresets };

  // Locate the plan array
  let plan = null;
  if (Array.isArray(planData)) {
    plan = planData;
  } else if (planData && Array.isArray(planData.plan)) {
    plan = planData.plan;
  }

  if (!plan || plan.length === 0) return { recoveredDays, recoveredPresets };

  const uniqueTaskNames = new Map();

  plan.forEach((day, dayIdx) => {
    if (!day) return;
    let ds = null;
    if (isDateString(day.date)) {
      ds = day.date;
    } else if (day.dayNumber) {
      // If date is missing, calculate reasonable date offset
      const d = new Date();
      d.setDate(d.getDate() - (plan.length - day.dayNumber));
      ds = d.toISOString().slice(0, 10);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - (plan.length - dayIdx));
      ds = d.toISOString().slice(0, 10);
    }

    const tasks = Array.isArray(day.tasks) ? day.tasks : [];
    const blocks = {};
    const blocksList = [];
    let completedWeight = 0;
    let totalWeight = 0;
    const baseHour = 6; // Morning start

    tasks.forEach((t, tIdx) => {
      if (!t) return;
      const bId = String(t.id || `mpt_${dayIdx}_${tIdx}`);
      const duration = t.estimatedMinutes || 60;
      const startMin = (baseHour * 60) + (tIdx * 90);
      const sh = String(Math.floor(startMin / 60) % 24).padStart(2, '0');
      const sm = String(startMin % 60).padStart(2, '0');
      const endMin = startMin + duration;
      const eh = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
      const em = String(endMin % 60).padStart(2, '0');

      const taskName = (t.subject ? `${t.subject}: ` : '') + (t.topicTitle || t.chapterName || t.name || 'Study Block');
      const weight = t.weight || (t.grade === '+2' ? 3 : 2);
      totalWeight += weight;

      if (t.completed) {
        completedWeight += weight;
        blocks[bId] = {
          status: 'completed',
          actualMins: duration,
          completedAt: `${eh}:${em}`,
          logMethod: 'plus_two_migrated',
        };
      } else {
        blocks[bId] = {
          status: 'pending',
        };
      }

      const blockDef = {
        id: bId,
        name: taskName,
        start: `${sh}:${sm}`,
        end: `${eh}:${em}`,
        weight,
        tag: t.subject || 'Study',
      };
      blocksList.push(blockDef);

      if (!uniqueTaskNames.has(taskName)) {
        uniqueTaskNames.set(taskName, {
          id: `preset_${bId}`,
          name: taskName,
          start: `${sh}:${sm}`,
          end: `${eh}:${em}`,
          days: [0, 1, 2, 3, 4, 5, 6],
          weight,
          tag: t.subject || 'Study',
        });
      }
    });

    const dailyScore = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    recoveredDays[ds] = {
      date: ds,
      dailyScore,
      blocks,
      blocksList,
    };
  });

  return {
    recoveredDays,
    recoveredPresets: Array.from(uniqueTaskNames.values()).slice(0, 15),
  };
}

/**
 * Universal Recursive Extractor
 * Accepts any arbitrary object, array, or stringified payload and searches for
 * TYMVERA history, PlusTwo plans, single day logs, or date-keyed structures.
 */
export function extractHistoryAndPresetsFromAny(value, keyHint = '', depth = 0) {
  const recoveredDays = {};
  let recoveredPresets = null;

  if (value === null || value === undefined || depth > 5) {
    return { recoveredDays, recoveredPresets };
  }

  // 1. If value is a string, try JSON.parse (handles double-stringified JSON)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractHistoryAndPresetsFromAny(parsed, keyHint, depth + 1);
      } catch {}
    }
    return { recoveredDays, recoveredPresets };
  }

  // 2. Check for Kerala PlusTwo study planner structure
  if (value && typeof value === 'object') {
    if (Array.isArray(value.plan) || (Array.isArray(value) && value.some(item => item && item.tasks && Array.isArray(item.tasks)))) {
      const ptRes = extractFromPlusTwoPlan(value);
      Object.assign(recoveredDays, ptRes.recoveredDays);
      if (ptRes.recoveredPresets && ptRes.recoveredPresets.length > 0) {
        recoveredPresets = ptRes.recoveredPresets;
      }
    }
  }

  // 3. Check if keyHint itself is a date (e.g. key is "2026-09-18")
  if (isDateString(keyHint) && value && typeof value === 'object') {
    const ds = keyHint;
    const blocks = value.blocks || (value.tasks && typeof value.tasks === 'object' ? value.tasks : {});
    const blocksList = Array.isArray(value.blocksList) ? value.blocksList : (Array.isArray(value.tasks) ? value.tasks : []);
    const dailyScore = typeof value.dailyScore === 'number' ? value.dailyScore : (typeof value.score === 'number' ? value.score : 0);
    recoveredDays[ds] = {
      date: ds,
      dailyScore,
      blocks,
      blocksList,
      ...value,
    };
  }

  // 4. Check if object has { date: "YYYY-MM-DD", blocks: ... }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (isDateString(value.date) && (value.blocks || value.blocksList || typeof value.dailyScore === 'number')) {
      recoveredDays[value.date] = value;
    }
  }

  // 5. Check if value is a standard TYMVERA date-keyed history dictionary
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    let hasDateKeys = false;
    Object.entries(value).forEach(([k, dayVal]) => {
      if (isDateString(k) && dayVal && typeof dayVal === 'object') {
        recoveredDays[k] = {
          date: k,
          dailyScore: typeof dayVal.dailyScore === 'number' ? dayVal.dailyScore : 0,
          blocks: dayVal.blocks || {},
          blocksList: dayVal.blocksList || [],
          ...dayVal,
        };
        hasDateKeys = true;
      }
    });

    // 6. Check preset arrays
    if (isPresetArray(value)) {
      recoveredPresets = value;
    }
    if (Array.isArray(value.presets) && isPresetArray(value.presets)) {
      recoveredPresets = value.presets;
    }

    // 7. If not already handled, search nested properties (e.g. history, data, state, timeline)
    if (!hasDateKeys) {
      const candidateKeys = ['history', 'days', 'logs', 'records', 'timeline', 'data', 'state', 'appState', 'v2', 'v1', 'savedState'];
      for (const prop of candidateKeys) {
        if (value[prop] && typeof value[prop] === 'object') {
          const nested = extractHistoryAndPresetsFromAny(value[prop], prop, depth + 1);
          Object.assign(recoveredDays, nested.recoveredDays);
          if (nested.recoveredPresets && (!recoveredPresets || nested.recoveredPresets.length > recoveredPresets.length)) {
            recoveredPresets = nested.recoveredPresets;
          }
        }
      }
    }
  }

  // 8. If value is an Array of days / logs
  if (Array.isArray(value)) {
    if (isPresetArray(value)) {
      recoveredPresets = value;
    } else {
      value.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          if (isDateString(item.date)) {
            recoveredDays[item.date] = {
              date: item.date,
              dailyScore: typeof item.dailyScore === 'number' ? item.dailyScore : 0,
              blocks: item.blocks || {},
              blocksList: item.blocksList || [],
              ...item,
            };
          } else {
            const nested = extractHistoryAndPresetsFromAny(item, `item_${idx}`, depth + 1);
            Object.assign(recoveredDays, nested.recoveredDays);
            if (nested.recoveredPresets && (!recoveredPresets || nested.recoveredPresets.length > recoveredPresets.length)) {
              recoveredPresets = nested.recoveredPresets;
            }
          }
        }
      });
    }
  }

  return { recoveredDays, recoveredPresets };
}

/**
 * Exhaustively scans window.localStorage across all keys
 */
export function scanLocalStorage() {
  const recoveredDays = {};
  let recoveredPresets = null;
  const keyDetails = [];
  let keysScanned = 0;

  if (typeof window === 'undefined' || !window.localStorage) {
    return { recoveredDays, recoveredPresets, keysScanned, keyDetails };
  }

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      keysScanned++;
      if (!key) continue;

      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;

        const sizeKb = (raw.length / 1024).toFixed(1);
        keyDetails.push({
          key,
          length: raw.length,
          sizeKb: `${sizeKb} KB`,
          preview: raw.slice(0, 100) + (raw.length > 100 ? '...' : ''),
        });

        // Run universal extractor on raw string / parsed JSON
        const extracted = extractHistoryAndPresetsFromAny(raw, key);
        Object.assign(recoveredDays, extracted.recoveredDays);

        if (extracted.recoveredPresets && (!recoveredPresets || extracted.recoveredPresets.length > recoveredPresets.length)) {
          recoveredPresets = extracted.recoveredPresets;
        }
      } catch (keyErr) {
        console.warn(`LocalStorage scan error on key "${key}":`, keyErr);
      }
    }
  } catch (err) {
    console.warn('LocalStorage scan warning:', err);
  }

  return { recoveredDays, recoveredPresets, keysScanned, keyDetails };
}

/**
 * Exhaustively scans all accessible IndexedDB databases and object stores
 */
export async function scanIndexedDB() {
  const recoveredDays = {};
  let recoveredPresets = null;
  const dbDetails = [];
  let dbsScanned = 0;
  let storesScanned = 0;

  if (typeof window === 'undefined' || !window.indexedDB) {
    return { recoveredDays, recoveredPresets, dbsScanned, storesScanned, dbDetails };
  }

  // Candidate DB names across past and present TYMVERA and Study Planner builds
  const candidateDBs = [
    "TYMVERA_PWA_DB",
    "TYMVERA_DB",
    "TYMVERA",
    "TYMVERA_db",
    "TYMVERA",
    "app_data",
    "keyval-store",
    "localforage",
    "mission-plustwo",
    "plustwo",
    "plustwo_db",
    "firebaseLocalStorageDb",
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
        let finished = false;
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve(null);
          }
        }, 1500);

        try {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              resolve(req.result);
            }
          };
          req.onerror = () => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              resolve(null);
            }
          };
          req.onblocked = () => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              resolve(null);
            }
          };
        } catch {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            resolve(null);
          }
        }
      });

      if (!db) continue;
      dbsScanned++;

      const currentDbInfo = {
        dbName,
        version: db.version,
        stores: [],
      };

      const storeNames = Array.from(db.objectStoreNames || []);
      for (const storeName of storeNames) {
        storesScanned++;
        try {
          const records = await new Promise((resolve) => {
            try {
              const tx = db.transaction(storeName, 'readonly');
              const store = tx.objectStore(storeName);

              // Use store.getAll() and store.getAllKeys() if supported, with cursor fallback
              if (typeof store.getAll === 'function' && typeof store.getAllKeys === 'function') {
                const keysReq = store.getAllKeys();
                keysReq.onsuccess = () => {
                  const keys = keysReq.result || [];
                  const valsReq = store.getAll();
                  valsReq.onsuccess = () => {
                    const vals = valsReq.result || [];
                    const items = keys.map((k, idx) => ({ key: k, val: vals[idx] }));
                    resolve(items);
                  };
                  valsReq.onerror = () => resolve([]);
                };
                keysReq.onerror = () => resolve([]);
              } else {
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
              }
            } catch {
              resolve([]);
            }
          });

          currentDbInfo.stores.push({
            storeName,
            recordCount: records.length,
            sampleKeys: records.slice(0, 5).map(r => String(r.key)),
          });

          for (const item of records) {
            const extracted = extractHistoryAndPresetsFromAny(item.val, String(item.key));
            Object.assign(recoveredDays, extracted.recoveredDays);

            if (extracted.recoveredPresets && (!recoveredPresets || extracted.recoveredPresets.length > recoveredPresets.length)) {
              recoveredPresets = extracted.recoveredPresets;
            }
          }
        } catch (storeErr) {
          console.warn(`Scan error in store ${storeName}:`, storeErr);
        }
      }

      dbDetails.push(currentDbInfo);
      try {
        db.close();
      } catch {}
    } catch {
      // Continue to next DB
    }
  }

  return { recoveredDays, recoveredPresets, dbsScanned, storesScanned, dbDetails };
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

  // Dual-redundant backup write if days were recovered
  if (finalCount > 0) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('fo6_history', JSON.stringify(mergedHistory));
        window.localStorage.setItem('TYMVERA_history_master_backup', JSON.stringify(mergedHistory));
        window.localStorage.setItem('fo6_presets', JSON.stringify(mergedPresets));
      }
    } catch (e) {}
  }

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
    diagnostics: {
      localStorageKeys: lsResult.keyDetails,
      indexedDBs: idbResult.dbDetails,
    },
  };
}

/**
 * Generate a complete raw storage diagnostic report
 * Used by the Storage Inspector in Settings
 */
export async function getRawStorageDiagnosticReport() {
  const lsResult = scanLocalStorage();
  const idbResult = await scanIndexedDB();

  return {
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    localStorage: {
      totalKeys: lsResult.keysScanned,
      keys: lsResult.keyDetails,
      detectedDaysCount: Object.keys(lsResult.recoveredDays).length,
    },
    indexedDB: {
      totalDatabases: idbResult.dbsScanned,
      databases: idbResult.dbDetails,
      detectedDaysCount: Object.keys(idbResult.recoveredDays).length,
    },
    totalRecoverableDays: Object.keys({ ...lsResult.recoveredDays, ...idbResult.recoveredDays }).length,
  };
}

/**
 * Export complete backup payload as JSON file download
 */
export function exportBackupData({ history, presets, alarms, notificationConfig }) {
  const payload = {
    app: "TYMVERA",
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
  a.download = `TYMVERA-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
    const extracted = extractHistoryAndPresetsFromAny(jsonString, 'imported_backup');
    const dayCount = Object.keys(extracted.recoveredDays).length;

    let alarms = null;
    let notificationConfig = null;
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        alarms = parsed.alarms || null;
        notificationConfig = parsed.notificationConfig || null;
      }
    } catch {}

    if (dayCount === 0 && (!extracted.recoveredPresets || extracted.recoveredPresets.length === 0)) {
      throw new Error("No activity days or schedules found in the imported file");
    }

    return {
      success: true,
      history: extracted.recoveredDays,
      presets: extracted.recoveredPresets,
      alarms,
      notificationConfig,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
