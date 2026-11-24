import { DayLockState } from '../types';
import { blankState, normalizeState } from './domain';

const LS_V2 = 'daylock.v2';
const LS_V1 = 'daylock.v1';
const IDB_NAME = 'daylock_memory_db';
const IDB_STORE = 'workspace';
const IDB_KEY = 'state';

function openMemoryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function readIndexedDB(): Promise<DayLockState | null> {
  try {
    const db = await openMemoryDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        db.close();
        if (req.result) resolve(normalizeState(req.result));
        else resolve(null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function writeIndexedDB(state: DayLockState): Promise<void> {
  try {
    const db = await openMemoryDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(state, IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // localStorage remains active as secondary local memory
  }
}

export function loadSyncLocalMemory(): DayLockState {
  try {
    const v2 = localStorage.getItem(LS_V2);
    if (v2) return normalizeState(JSON.parse(v2));
    const v1 = localStorage.getItem(LS_V1);
    if (v1) return normalizeState(JSON.parse(v1));
  } catch {
    // ignore corrupted storage
  }
  return blankState();
}

export async function loadBestLocalMemory(): Promise<DayLockState> {
  const lsState = loadSyncLocalMemory();
  const idbState = await readIndexedDB();
  if (idbState && idbState.updatedAt >= lsState.updatedAt) {
    try {
      localStorage.setItem(LS_V2, JSON.stringify(idbState));
    } catch {
      // ignore quota error
    }
    return idbState;
  }
  if (lsState.trades.length || lsState.lifeGoals.length || Object.keys(lsState.days).length) {
    await writeIndexedDB(lsState);
  }
  return lsState;
}

export async function persistLocalMemory(state: DayLockState): Promise<void> {
  try {
    localStorage.setItem(LS_V2, JSON.stringify(state));
  } catch {
    // ignore quota error
  }
  await writeIndexedDB(state);
}
