import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const configuredApiKey = String(import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '').trim();
const runtimeFirebaseConfig = {
  ...firebaseConfig,
  apiKey: configuredApiKey,
};

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let firebaseAuth: Auth | null = null;

if (configuredApiKey) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(runtimeFirebaseConfig) : getApp();
    firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);
  } catch (error) {
    console.warn('[Firebase] Initialization unavailable; continuing without Firebase services.', error);
  }
} else {
  console.warn('[Firebase] VITE_FIREBASE_API_KEY is missing; continuing without Firebase services.');
}

export const app = firebaseApp;
export const db = firestore as Firestore;
export const auth = firebaseAuth as Auth;

