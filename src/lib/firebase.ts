import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator
} from "firebase/firestore";

const env = import.meta.env;
const useEmulators = env.VITE_USE_EMULATORS === "1" || !env.VITE_FIREBASE_PROJECT_ID;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "demo-disciply.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "demo-disciply",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};
export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
auth.languageCode = "fr";

// Cache hors ligne : le pointage du dimanche fonctionne sans réseau et part dès que la connexion revient.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

if (useEmulators) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
export const usingEmulators = useEmulators;
