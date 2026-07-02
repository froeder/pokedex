import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from 'firebase/functions';

declare global {
  interface Window {
    __POKEDEX_FIREBASE_EMULATORS_CONNECTED__?: boolean;
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const functionsRegion =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'southamerica-east1';
const useFirebaseEmulators =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

export const app: FirebaseApp | null = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
export const functions: Functions | null = app
  ? getFunctions(app, functionsRegion)
  : null;

if (
  auth &&
  db &&
  functions &&
  useFirebaseEmulators &&
  typeof window !== 'undefined' &&
  !window.__POKEDEX_FIREBASE_EMULATORS_CONNECTED__
) {
  connectAuthEmulator(auth, 'http://localhost:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  window.__POKEDEX_FIREBASE_EMULATORS_CONNECTED__ = true;
}
