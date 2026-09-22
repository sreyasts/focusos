/**
 * FocusOS Firebase Authentication & Cloud Sync Service
 * Features:
 * - Google Sign-In via Firebase Auth (Desktop popup + Mobile PWA redirect fallback)
 * - Automatic background cloud sync of routines, timeline logs, hours, smart alarms, and settings
 * - Offline Firestore persistence support
 * - Collection '/users/{userId}' fully compliant with Firebase security rules
 * - Configurable Firebase credentials with instant local fallback
 */

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPcQQkOABPaZAv1lc9-u4Xm5UvMcI0g1A",
  authDomain: "mission-plustwo.firebaseapp.com",
  projectId: "mission-plustwo",
  storageBucket: "mission-plustwo.appspot.com",
  messagingSenderId: "376961059569",
  appId: "1:376961059569:web:77d0a7c7-ae77-471b-a1b2-37e4c8b4fb83",
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

    // Enable offline Firestore cache if available
    try {
      if (typeof firestoreInstance.enablePersistence === 'function') {
        firestoreInstance.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      }
    } catch {}

    firebaseInitialized = true;
  }
  return { auth: authInstance, db: firestoreInstance };
}

/**
 * Trigger Google Sign-In with automatic Mobile PWA redirect fallback
 */
export async function signInWithGoogle() {
  const { auth } = await getFirebaseInstances();
  if (!auth) throw new Error('Firebase Auth not available');
  const provider = new window.firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (err) {
    if (
      err.code === 'auth/popup-blocked' ||
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request' ||
      err.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      console.log('Popup not available or blocked, falling back to redirect...');
      await auth.signInWithRedirect(provider);
      return null;
    }
    throw err;
  }
}

/**
 * Check if the user is returning from a Google redirect sign-in
 */
export async function checkRedirectSignInResult() {
  try {
    const { auth } = await getFirebaseInstances();
    if (auth && typeof auth.getRedirectResult === 'function') {
      const result = await auth.getRedirectResult();
      if (result && result.user) {
        return result.user;
      }
    }
  } catch (err) {
    console.warn('Redirect result check warning:', err);
  }
  return null;
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
 * Stores data in collection 'users/{userId}' complying with Firestore security rules.
 */
export async function syncUserDataToCloud(userId, data) {
  if (!userId || !data) return;
  try {
    const { db } = await getFirebaseInstances();
    if (!db) return;

    // Clean payload for Firestore (remove undefined / functions)
    const cleanHistory = JSON.parse(JSON.stringify(data.history || {}));
    const cleanPresets = JSON.parse(JSON.stringify(data.presets || []));
    const cleanAlarms = JSON.parse(JSON.stringify(data.alarms || {}));
    const cleanNotif = JSON.parse(JSON.stringify(data.notificationConfig || {}));

    const payload = {
      focusos_history: cleanHistory,
      focusos_presets: cleanPresets,
      focusos_alarms: cleanAlarms,
      focusos_notif_config: cleanNotif,
      focusos_theme: data.themeMode || 'system',
      focusos_chart_mode: data.chartViewMode || 'line',
      // Dual-compatibility mirror
      history: cleanHistory,
      presets: cleanPresets,
      alarms: cleanAlarms,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(userId).set(payload, { merge: true });
    return { success: true, timestamp: payload.lastSyncedAt };
  } catch (err) {
    console.error('Error syncing FocusOS data to Firestore:', err);
    throw err;
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
    const docSnap = await db.collection('users').doc(userId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return {
        history: data.focusos_history || data.history || {},
        presets: data.focusos_presets || data.presets || [],
        alarms: data.focusos_alarms || data.alarms || null,
        notificationConfig: data.focusos_notif_config || data.focusos_notif || data.notificationConfig || null,
        themeMode: data.focusos_theme || data.theme || null,
        chartViewMode: data.focusos_chart_mode || null,
        lastSyncedAt: data.lastSyncedAt || data.updatedAt || null,
        rawPlan: data.plan || null,
      };
    }
  } catch (err) {
    console.error('Error loading FocusOS data from Firestore:', err);
  }
  return null;
}
