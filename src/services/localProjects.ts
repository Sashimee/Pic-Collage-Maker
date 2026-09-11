import { openDB, type IDBPDatabase } from 'idb';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: any; // serialized editor snapshot
}

const DB_NAME = 'pic-collage-db';
const STORE_NAME = 'projects';
let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export async function initDB() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('indexedDB not available')
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function saveProject(project: Project) {
  const db = await initDB();
  await db.put(STORE_NAME, project);
}

export async function loadProject(id: string) {
  const db = await initDB();
  return (await db.get(STORE_NAME, id)) as Project | undefined;
}

export async function listProjects() {
  const db = await initDB();
  return (await db.getAllKeys(STORE_NAME)) as string[];
}

export async function deleteProject(id: string) {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
}
