/**
 * TYMVERA Robust Storage Layer
 * Local-first storage with primary IndexedDB and resilient LocalStorage fallback.
 * Correctly manages Promise lifecycles with full resolve & reject handlers,
 * transaction abort boundaries, and graceful error recovery.
 */

export const DB_NAME = "TYMVERA_PWA_DB";
export const DB_VERSION = 1;
export const STORE_NAME = "app_data";

export function initDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet(key, fallback = null) {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result !== undefined ? request.result : fallback);
      };

      request.onerror = () => {
        console.warn(`[IDB] Read failed for key "${key}", falling back:`, request.error);
        resolve(fallback);
      };

      tx.onerror = () => resolve(fallback);
    });
  } catch (err) {
    console.warn(`[IDB] Database initialization failed for get("${key}"):`, err);
    return fallback;
  }
}

export async function idbSet(key, val) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(val, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);

      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("IDB Transaction aborted"));
    });
  } catch (e) {
    console.error(`[IDB] Write Error for key "${key}":`, e);
    // LocalStorage fallback for unhandled exceptions or private browsing mode
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      }
    } catch (lsErr) {
      console.error(`[IDB Fallback] LocalStorage write also failed for "${key}":`, lsErr);
    }
    throw e;
  }
}

export async function idbDelete(key) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn(`[IDB] Delete error for key "${key}":`, e);
  }
}

/**
 * Universal dual-read: Checks IndexedDB first, falls back to LocalStorage
 */
export async function safeStorageGet(key, fallback = null) {
  const idbValue = await idbGet(key, null);
  if (idbValue !== null && idbValue !== undefined) {
    return idbValue;
  }

  // Fallback to LocalStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
    } catch (e) {
      console.warn(`[StorageFallback] LocalStorage read failed for "${key}":`, e);
    }
  }

  return fallback;
}

/**
 * Universal dual-write: Persists to both IndexedDB and LocalStorage for zero-data-loss redundancy
 */
export async function safeStorageSet(key, val) {
  try {
    await idbSet(key, val);
  } catch (e) {
    console.warn(`[StorageFallback] Primary IDB set failed, relying on LocalStorage for "${key}"`);
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const serialized = typeof val === 'string' ? val : JSON.stringify(val);
      localStorage.setItem(key, serialized);
    } catch (e) {
      console.warn(`[StorageFallback] LocalStorage secondary set failed for "${key}":`, e);
    }
  }
}
