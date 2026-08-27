import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Catch and suppress background Firebase installation permission notices if telemetry tries to run
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = (typeof reason === 'string' ? reason : reason?.message || '') + '';
    if (msg.includes('installations') || msg.includes('Create Installation request failed')) {
      event.preventDefault();
      console.warn('[Firebase] Handled background installations notice gracefully.');
    }
  });
}

// Safely resolve Firebase configuration from Vite environment variables or fallback JSON
const env = (import.meta as any).env || {};

const apiKey = (env.VITE_FIREBASE_API_KEY || env.VITE_FIREBASE_APIKEY || (firebaseConfig as any)?.apiKey || '').trim();
const authDomain = (env.VITE_FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTHDOMAIN || (firebaseConfig as any)?.authDomain || '').trim();
const projectId = (env.VITE_FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECTID || (firebaseConfig as any)?.projectId || '').trim();
const storageBucket = (env.VITE_FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGEBUCKET || (firebaseConfig as any)?.storageBucket || '').trim();
const databaseId = (env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any)?.firestoreDatabaseId || '').trim();
const appId = (env.VITE_FIREBASE_APP_ID || (firebaseConfig as any)?.appId || '').trim();
const messagingSenderId = (env.VITE_FIREBASE_MESSAGING_SENDER_ID || (firebaseConfig as any)?.messagingSenderId || '').trim();

export const runtimeFirebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  appId,
  messagingSenderId,
};

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let firebaseAuth: Auth | null = null;

if (apiKey && projectId) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(runtimeFirebaseConfig) : getApp();
    firestore = databaseId && databaseId !== '(default)'
      ? getFirestore(firebaseApp, databaseId)
      : getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);
  } catch (error) {
    console.warn('[Firebase] Initialization notice:', error);
  }
} else {
  console.info('[Firebase] API key or Project ID not provided; operating in standalone mode.');
}

export const app = firebaseApp;
export const db = firestore as Firestore;
export const auth = firebaseAuth as Auth;
export const isFirebaseConfigured = Boolean(firebaseApp && firebaseAuth);
