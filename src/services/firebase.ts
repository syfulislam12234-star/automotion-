import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const runtimeFirebaseConfig = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
};

// Initialize Firebase App instance safely
export const app = getApps().length === 0 ? initializeApp(runtimeFirebaseConfig) : getApp();

// Export Firestore database instance using specified firestoreDatabaseId if provided
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Export Firebase Authentication instance
export const auth = getAuth(app);
