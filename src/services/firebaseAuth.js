/**
 * FocusOS Firebase Authentication & Cloud Sync Service
 * Features:
 * - Google Sign-In via Firebase Auth
 * - Dynamic lazy loading of Firebase SDK (no render blocking)
 * - Automatic cloud synchronization of routines, timeline progress, alarms, and settings
 * - Configurable Firebase project credentials with instant local fallback
 */

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPcQQkOABPaZAv1lc9-u4Xm5UvMcI0g1A",
  authDomain: "mission-plustwo.firebaseapp.com",
  projectId: "mission-plustwo",
  storageBucket: "mission-plustwo.appspot.com",
  messagingSenderId: "376961059569",
  appId: "1:376961059569:web:77d0a7c7-ae77-471b-a1b2-37e4c8b4fb83"
};

export function getActiveFirebaseConfig() {
  try {
    const custom = localStorage.getItem('FOCUSOS_FIREBASE_CONFIG');
    if (custom) return JSON.parse(custom);
  } catch (e) {}
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveCustomFirebaseConfig(config) {
  try {
    localStorage.setItem('FOCUSOS_FIREBASE_CONFIG', JSON.stringify(config));
    window.location.reload();
  } catch (e) {
    console.error('Failed to save Firebase config:', e);
  }
}

let firebaseLoadedPromise = null;
let firebaseInitialized = false;
let authInstance = null;
let firestoreInstance = null;

export function loadFirebaseCompat() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.firebase && window.firebase.auth && window.firebase.firestore) {
    return Promise.resolve(window.firebase);
  }
  if (firebaseLoadedPromise) return firebaseLoadedPromise;

  firebaseLoadedPromise = new Promise((resolve, reject) => {
    const loadScript = (src) =>
      new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) return res();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });

    loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
      .then(() =>
        Promise.all([
          loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js'),
          loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'),
        ])
      )
      .then(() => resolve(window.firebase))
      .catch((err) => {
        console.error('Failed to load Firebase SDK:', err);
        firebaseLoadedPromise = null;
        reject(err);
      });
  });

  return firebaseLoadedPromise;
}

export async function getFirebaseInstances() {
  await loadFirebaseCompat();
  if (!firebaseInitialized && window.firebase) {
    const config = getActiveFirebaseConfig();
    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      window.firebase.initializeApp(config);
    }
    authInstance = window.firebase.auth();
    firestoreInstance = window.firebase.firestore();
    firebaseInitialized = true;
  }
  return { auth: authInstance, db: firestoreInstance };
}

/**
 * Trigger Google Sign-In Popup
 */
export async function signInWithGoogle() {
  const { auth } = await getFirebaseInstances();
  if (!auth) throw new Error('Firebase Auth not available');
  const provider = new window.firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await auth.signInWithPopup(provider);
  return result.user;
}

/**
 * Sign out user
 */
export async function signOut() {
  const { auth } = await getFirebaseInstances();
  if (auth) {
    await auth.signOut();
  }
}

/**
 * Listen for Auth state changes
 */
export async function onAuthChange(callback) {
  try {
    const { auth } = await getFirebaseInstances();
    if (auth) {
      return auth.onAuthStateChanged(callback);
    }
  } catch (e) {
    console.warn('Auth state subscription failed:', e);
  }
  return () => {};
}

/**
 * Sync user profile and app data to Cloud Firestore
 */
export async function syncUserDataToCloud(userId, data) {
  if (!userId || !data) return;
  try {
    const { db } = await getFirebaseInstances();
    if (!db) return;
    await db.collection('focusos_users').doc(userId).set(
      {
        ...data,
        lastSyncedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error syncing FocusOS data to Firestore:', err);
  }
}

/**
 * Load user data from Cloud Firestore
 */
export async function loadUserDataFromCloud(userId) {
  if (!userId) return null;
  try {
    const { db } = await getFirebaseInstances();
    if (!db) return null;
    const doc = await db.collection('focusos_users').doc(userId).get();
    if (doc.exists) {
      return doc.data();
    }
  } catch (err) {
    console.error('Error loading FocusOS data from Firestore:', err);
  }
  return null;
}
