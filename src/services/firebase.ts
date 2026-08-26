import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import firebaseConfig from '../../firebase-applet-config.json';

const runtimeFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId || '',
};
const configuredApiKey = String(runtimeFirebaseConfig.apiKey).trim();

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let firebaseAuth: Auth | null = null;
let firebaseAnalytics: Analytics | null = null;

if (configuredApiKey) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(runtimeFirebaseConfig) : getApp();
    firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);
    if (typeof window !== 'undefined') {
      try {
        firebaseAnalytics = getAnalytics(firebaseApp);
      } catch (error) {
        console.info('[Firebase] Analytics unavailable; continuing without analytics.', error);
      }
    }
  } catch (error) {
    console.warn('[Firebase] Initialization unavailable; continuing without Firebase services.', error);
  }
} else {
  console.info('[Firebase] Firebase API key is not configured; Firebase features are disabled.');
}

export const app = firebaseApp;
export const db = firestore as Firestore;
export const auth = firebaseAuth as Auth;
export const analytics = firebaseAnalytics;

