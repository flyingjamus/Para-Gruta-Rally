// src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

function readEnv(key) {
    // In Vitest/Node, `import.meta.env` may be present but not include the values.
    // Prefer `import.meta.env` when defined, otherwise fall back to `process.env`.
    const importMetaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : undefined;
    return (importMetaEnv && importMetaEnv[key] != null) ? importMetaEnv[key] : process.env[key];
}

// Firebase configuration using Vite environment variables (with test-friendly fallback)
const firebaseConfig = {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID')
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);


if (readEnv('VITE_USE_FIREBASE_EMULATORS') === 'true') {
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export {db, auth, storage};
