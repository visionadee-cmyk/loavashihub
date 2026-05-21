import { collection, deleteDoc as firestoreDeleteDoc, doc, getDocs, setDoc, type DocumentData } from 'firebase/firestore';
import { db, hasFirebaseConfig } from './firebase';

export async function loadCollection<T>(collectionName: string, fallback: T[] = []): Promise<T[]> {
  if (!hasFirebaseConfig || !db) {
    console.warn(
      `Firebase is not configured. Cannot load collection "${collectionName}". ` +
        'Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_APP_ID.',
    );
    return fallback;
  }

  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((record) => ({ id: record.id, ...(record.data() as DocumentData) } as T));
  } catch (error) {
    throw new Error(
      `Failed to load Firestore collection "${collectionName}". Check Firebase authentication and Firestore security rules. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function saveDocument(collectionName: string, id: string, data: unknown): Promise<void> {
  if (!hasFirebaseConfig || !db) {
    console.warn(
      `Firebase is not configured. Cannot save document "${id}" to collection "${collectionName}". ` +
        'Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_APP_ID.',
    );
    return;
  }

  try {
    await setDoc(doc(db, collectionName, id), data);
  } catch (error) {
    throw new Error(
      `Failed to save Firestore document "${id}". Check Firebase authentication and Firestore security rules. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  if (!hasFirebaseConfig || !db) {
    console.warn(
      `Firebase is not configured. Cannot delete document "${id}" from collection "${collectionName}". ` +
        'Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_APP_ID.',
    );
    return;
  }

  try {
    await firestoreDeleteDoc(doc(db, collectionName, id));
  } catch (error) {
    throw new Error(
      `Failed to delete Firestore document "${id}". Check Firebase authentication and Firestore security rules. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
