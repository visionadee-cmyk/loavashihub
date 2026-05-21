import { collection, deleteDoc as firestoreDeleteDoc, doc, getDocs, setDoc, type DocumentData } from 'firebase/firestore';
import { db, hasFirebaseConfig } from './firebase';

export async function loadCollection<T>(collectionName: string, fallback: T[] = []): Promise<T[]> {
  if (!hasFirebaseConfig || !db) {
    return fallback;
  }

  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((record) => ({ id: record.id, ...(record.data() as DocumentData) } as T));
}

export async function saveDocument(collectionName: string, id: string, data: unknown): Promise<void> {
  if (!hasFirebaseConfig || !db) {
    return;
  }

  await setDoc(doc(db, collectionName, id), data);
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  if (!hasFirebaseConfig || !db) {
    return;
  }

  await firestoreDeleteDoc(doc(db, collectionName, id));
}
