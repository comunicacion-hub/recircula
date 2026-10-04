// ============================================================
// RECIRCULA 360 — firebase-init.js  (MÓDULO)
// Inicializa Firebase y expone window.fb para los scripts clásicos
// (app.js, dashboard.js, etc. siguen siendo scripts normales)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  setPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore,
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyApr5rH2FzuINhO26VgeYJWJAr1jznP6WI",
  authDomain: "recircula360.firebaseapp.com",
  projectId: "recircula360",
  storageBucket: "recircula360.firebasestorage.app",
  messagingSenderId: "871869415100",
  appId: "1:871869415100:web:6fe89ec7d5f632eb7a5ab9"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Firestore con caché offline (IndexedDB) — lecturas funcionan sin conexión
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("Persistencia offline no disponible:", e);
  db = getFirestore(app);
}

// Exponer todo lo que necesitan los scripts clásicos
window.fb = {
  app, auth, db,
  onAuthStateChanged, signOut,
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where
};

// Igualar la persistencia a la del Hub (sessionStorage) para heredar la sesión
window.fbReady = setPersistence(auth, browserSessionPersistence).catch(function(e) {
  console.warn("setPersistence:", e);
});
