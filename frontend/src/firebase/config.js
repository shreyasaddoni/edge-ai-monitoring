import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Standard Firebase configuration
// In zero-cost development, fallback mode works even if these are dummy values!
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyDevApiKeyForZeroCostDevelopment123",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "epilepsy-edge-ai.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "epilepsy-edge-ai",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "epilepsy-edge-ai.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890"
};

let app = null;
let auth = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase client initialization using fallback:", e);
}

export { app, auth };
