import type { EditorDoc } from '../state/editor';
import type { FaceKey } from '../constants/presets';

/**
 * Saved projects in the browser's IndexedDB. Artwork is stored as Blobs (object URLs don't
 * survive a reload) and turned back into object URLs on load.
 */

export interface StoredProject {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail: string;
  doc: Omit<EditorDoc, 'artwork'>;
  artwork: Partial<Record<FaceKey, Blob>>;
}

const DB_NAME = 'peak-haven-mockups';
const STORE = 'projects';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function listProjects(): Promise<StoredProject[]> {
  const all = await run<StoredProject[]>('readonly', (s) => s.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProject(project: StoredProject): Promise<IDBValidKey> {
  return run('readwrite', (s) => s.put(project));
}

export function deleteProject(id: string): Promise<undefined> {
  return run('readwrite', (s) => s.delete(id));
}

/** Snapshots the editor document, fetching each artwork object URL into a Blob. */
export async function toStoredProject(
  doc: EditorDoc,
  name: string,
  thumbnail: string,
  id: string = crypto.randomUUID(),
): Promise<StoredProject> {
  const { artwork, ...rest } = doc;
  const blobs: StoredProject['artwork'] = {};
  for (const [face, url] of Object.entries(artwork)) {
    if (url) blobs[face as FaceKey] = await (await fetch(url)).blob();
  }
  return { id, name, updatedAt: Date.now(), thumbnail, doc: rest, artwork: blobs };
}
