import { getApps, initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDxAQ1cQD7mxyQ_4qBb04mJZNeNXhD_6Ec',
  authDomain: 'loavashihubcafe.firebaseapp.com',
  projectId: 'loavashihubcafe',
  storageBucket: 'loavashihubcafe.firebasestorage.app',
  messagingSenderId: '997803453794',
  appId: '1:997803453794:web:5ab8b39c7e17917929d03b',
  measurementId: 'G-GTFWHSZ9PX',
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.appId,
);

export const firebaseApp = hasFirebaseConfig
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const analytics = hasFirebaseConfig && firebaseApp ? getAnalytics(firebaseApp) : null;
export const auth = hasFirebaseConfig && firebaseApp ? getAuth(firebaseApp) : null;
export const db = hasFirebaseConfig && firebaseApp ? getFirestore(firebaseApp) : null;
