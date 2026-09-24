import { describe, it, expect, beforeEach, vi } from 'vitest';
import { idbGet, idbSet, idbDelete, safeStorageGet, safeStorageSet, STORE_NAME } from '../src/storage/indexedDb.js';

describe('TYMVERA Storage Layer & IndexedDB Engine', () => {
  let mockStore;
  let mockDB;

  beforeEach(() => {
    mockStore = new Map();

    const mockTx = {
      objectStore: vi.fn(() => ({
        get: (key) => {
          const req = { result: mockStore.get(key), onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
        put: (val, key) => {
          mockStore.set(key, val);
          const req = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess && req.onsuccess(), 0);
          return req;
        },
        delete: (key) => {
          mockStore.delete(key);
          const req = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess && req.onsuccess(), 0);
          return req;
        },
      })),
      oncomplete: null,
      onerror: null,
      onabort: null,
    };

    mockDB = {
      objectStoreNames: { contains: () => true },
      transaction: vi.fn(() => mockTx),
    };

    globalThis.indexedDB = {
      open: vi.fn(() => {
        const req = {
          result: mockDB,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
        return req;
      }),
    };

    const localData = new Map();
    globalThis.localStorage = {
      getItem: (k) => (localData.has(k) ? localData.get(k) : null),
      setItem: (k, v) => localData.set(k, String(v)),
      removeItem: (k) => localData.delete(k),
      clear: () => localData.clear(),
    };
  });

  it('correctly persists and retrieves values through IndexedDB', async () => {
    await idbSet('test_key', { foo: 'bar' });
    const result = await idbGet('test_key', null);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns default fallback when key is not present in IndexedDB', async () => {
    const result = await idbGet('non_existent', 'default_val');
    expect(result).toBe('default_val');
  });

  it('deletes keys correctly from IndexedDB', async () => {
    await idbSet('temp_key', 'temp_val');
    await idbDelete('temp_key');
    const result = await idbGet('temp_key', null);
    expect(result).toBeNull();
  });

  it('regression: idbSet properly rejects when request encounters an error', async () => {
    // Simulate an IDB write error
    const expectedError = new Error('QuotaExceededError');
    const failTx = {
      objectStore: vi.fn(() => ({
        put: () => {
          const req = { error: expectedError, onsuccess: null, onerror: null };
          setTimeout(() => req.onerror && req.onerror(), 0);
          return req;
        },
      })),
      onerror: null,
      onabort: null,
    };

    mockDB.transaction = vi.fn(() => failTx);

    await expect(idbSet('fail_key', 'val')).rejects.toThrow('QuotaExceededError');
  });

  it('dual-read safeStorageGet falls back to LocalStorage when IDB returns null', async () => {
    globalThis.localStorage.setItem('ls_only_key', JSON.stringify({ source: 'localStorage' }));

    const val = await safeStorageGet('ls_only_key', null);
    expect(val).toEqual({ source: 'localStorage' });
  });

  it('dual-write safeStorageSet writes to both IndexedDB and LocalStorage', async () => {
    await safeStorageSet('dual_key', { synchronized: true });

    // Verify IDB store
    expect(mockStore.get('dual_key')).toEqual({ synchronized: true });

    // Verify LocalStorage
    const rawLS = globalThis.localStorage.getItem('dual_key');
    expect(JSON.parse(rawLS)).toEqual({ synchronized: true });
  });
});
