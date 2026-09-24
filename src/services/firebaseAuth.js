/**
 * TYMVERA Firebase Authentication & Cloud Sync Service
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
    const custom = localStorage.getItem('TYMVERA_FIREBASE_CONFIG');
    if (custom) return JSON.parse(custom);
  } catch (e) {}
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveCustomFirebaseConfig(config) {
  try {
    localStorage.setItem('TYMVERA_FIREBASE_CONFIG', JSON.stringify(config));
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
 * Scalable subcollection architecture:
 * - users/{userId}: Root profile, metadata, and sync timestamps
 * - users/{userId}/settings/current: Presets, smart alarms, and notification configurations
 * - users/{userId}/days/{date}: Discrete daily routine logs and metrics (bypasses 1MB doc limit)
 */
export async function syncUserDataToCloud(userId, data) {
  if (!userId || !data) return;
  try {
    const { db } = await getFirebaseInstances();
    if (!db) return;

    const cleanHistory = JSON.parse(JSON.stringify(data.history || {}));
    const cleanPresets = JSON.parse(JSON.stringify(data.presets || []));
    const cleanAlarms = JSON.parse(JSON.stringify(data.alarms || {}));
    const cleanNotif = JSON.parse(JSON.stringify(data.notificationConfig || {}));
    const timestamp = new Date().toISOString();

    const userRef = db.collection('users').doc(userId);

    // 1. Root Document: Metadata & high-level state
    await userRef.set(
      {
        themeMode: data.themeMode || 'system',
        chartViewMode: data.chartViewMode || 'line',
        lastSyncedAt: timestamp,
        updatedAt: timestamp,
        daysLoggedCount: Object.keys(cleanHistory).length,
        // Legacy compatibility mirror for older client versions
        TYMVERA_theme: data.themeMode || 'system',
        TYMVERA_chart_mode: data.chartViewMode || 'line',
      },
      { merge: true }
    );

    // 2. Settings Subcollection: Presets, alarms, notifications
    await userRef.collection('settings').doc('current').set(
      {
        presets: cleanPresets,
        alarms: cleanAlarms,
        notificationConfig: cleanNotif,
        updatedAt: timestamp,
      },
      { merge: true }
    );

    // 3. Days Subcollection: Individual records for each date (prevents monolithic 1MB bloat)
    const batch = db.batch ? db.batch() : null;
    const dateKeys = Object.keys(cleanHistory);
    // Write up to 100 days per batch if batching supported
    if (batch && dateKeys.length <= 400) {
      dateKeys.forEach((dateStr) => {
        const dayRef = userRef.collection('days').doc(dateStr);
        batch.set(dayRef, { ...cleanHistory[dateStr], date: dateStr, updatedAt: timestamp }, { merge: true });
      });
      await batch.commit();
    } else {
      // Async parallel chunked writes
      await Promise.all(
        dateKeys.map((dateStr) =>
          userRef.collection('days').doc(dateStr).set(
            { ...cleanHistory[dateStr], date: dateStr, updatedAt: timestamp },
            { merge: true }
          )
        )
      );
    }

    return { success: true, timestamp };
  } catch (err) {
    console.error('Error syncing TYMVERA data to Firestore:', err);
    throw err;
  }
}

/**
 * Load user data from Cloud Firestore
 * Dual-reads: checks subcollections first; falls back cleanly to legacy root document
 */
export async function loadUserDataFromCloud(userId) {
  if (!userId) return null;
  try {
    const { db } = await getFirebaseInstances();
    if (!db) return null;

    const userRef = db.collection('users').doc(userId);
    const rootSnap = await userRef.get();
    if (!rootSnap.exists) return null;

    const rootData = rootSnap.data();
    let history = {};
    let presets = [];
    let alarms = null;
    let notificationConfig = null;

    // 1. Try loading settings subcollection
    try {
      const settingsSnap = await userRef.collection('settings').doc('current').get();
      if (settingsSnap.exists) {
        const sData = settingsSnap.data();
        presets = sData.presets || [];
        alarms = sData.alarms || null;
        notificationConfig = sData.notificationConfig || null;
      }
    } catch (e) {
      console.warn('Subcollection settings read fallback:', e);
    }

    // 2. Try loading days subcollection
    try {
      const daysSnap = await userRef.collection('days').get();
      if (daysSnap && !daysSnap.empty) {
        daysSnap.forEach((doc) => {
          history[doc.id] = doc.data();
        });
      }
    } catch (e) {
      console.warn('Subcollection days read fallback:', e);
    }

    // 3. Fallback to legacy single document if subcollections were empty
    if (Object.keys(history).length === 0) {
      history = rootData.TYMVERA_history || rootData.history || {};
    }
    if (presets.length === 0) {
      presets = rootData.TYMVERA_presets || rootData.presets || [];
    }
    if (!alarms) {
      alarms = rootData.TYMVERA_alarms || rootData.alarms || null;
    }
    if (!notificationConfig) {
      notificationConfig = rootData.TYMVERA_notif_config || rootData.TYMVERA_notif || rootData.notificationConfig || null;
    }

    return {
      history,
      presets,
      alarms,
      notificationConfig,
      themeMode: rootData.themeMode || rootData.TYMVERA_theme || rootData.theme || null,
      chartViewMode: rootData.chartViewMode || rootData.TYMVERA_chart_mode || null,
      lastSyncedAt: rootData.lastSyncedAt || rootData.updatedAt || null,
      rawPlan: rootData.plan || null,
    };
  } catch (err) {
    console.error('Error loading TYMVERA data from Firestore:', err);
  }
  return null;
}
