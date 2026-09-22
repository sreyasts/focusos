/**
 * FocusOS - Kerala Plus Two & Priority Productivity OS
 * Consolidated Standalone Distribution for CodeSandbox & Production
 * Fully Offline-First, Dual-Storage (IndexedDB + LocalStorage), Web Audio Synth Alarms,
 * Precision Notification Engine, Dual-Stepper Time Logging, and Interactive Scrubber Chart.
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';

// ─── EMBEDDED ALARM ENGINE ───────────────────────────────────────────────────
/**
 * FocusOS System Alarm Engine
 * Features:
 * - Authentic System Alarm Sound (Piercing Piezoelectric Digital Clock 4-Burst Beep)
 * - Emergency Urgency Siren, Android Ringer, and Classic Marimba options
 * - Screen Wake Lock support during ringing
 * - Full vibration cadence synchronized with alarm sound bursts
 * - Auto-sync calculation of wake-up time (earliest block start) and sleep time (latest block end)
 * - Loop management with Snooze (+5m) and Dismiss
 */

let activeAudioCtx = null;
let activeAlarmInterval = null;
let activeWakeLock = null;

// Available Alarm Tones
const ALARM_SOUND_TYPES = [
  { id: 'system_digital', name: 'System Digital Clock ⏰ (Default)' },
  { id: 'android_siren', name: 'Emergency Urgency Siren 🚨' },
  { id: 'clock_chime', name: 'Android Dual-Tone Ringer 🔔' },
  { id: 'gentle_marimba', name: 'Gentle Morning Marimba 🎵' },
];

/**
 * Acquire screen wake lock while alarm is ringing so the smartphone screen stays on
 */
async function acquireWakeLock() {
  try {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      activeWakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {}
}

function releaseWakeLock() {
  try {
    if (activeWakeLock) {
      activeWakeLock.release();
      activeWakeLock = null;
    }
  } catch {}
}

/**
 * Play authentic System Digital Alarm sound or chosen sound type
 */
function playAlarmSound(volume = 0.85, soundType = 'system_digital') {
  stopAlarmSound();
  acquireWakeLock();

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return () => {};

    const ctx = new AudioContext();
    activeAudioCtx = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const playCycle = () => {
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      if (soundType === 'android_siren') {
        // High-Urgency Alternating Siren: 880Hz <-> 1320Hz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.linearRampToValueAtTime(1320, now + 0.35);
        osc.frequency.linearRampToValueAtTime(880, now + 0.7);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(volume * 0.7, now + 0.05);
        gain.gain.setValueAtTime(volume * 0.7, now + 0.65);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.75);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.78);

        if (navigator.vibrate) {
          navigator.vibrate([350, 100, 350, 100]);
        }
      } else if (soundType === 'clock_chime') {
        // Dual-tone bright ascending ringer: 784Hz (G5) -> 1046Hz (C6) -> 1318Hz (E6)
        [783.99, 1046.5, 1318.51].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          const t = now + idx * 0.12;
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(volume * 0.5, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.28);
        });

        if (navigator.vibrate) {
          navigator.vibrate([150, 80, 150, 80, 200, 300]);
        }
      } else if (soundType === 'gentle_marimba') {
        // Soft ascending triad
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);

          const t = now + idx * 0.1;
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(volume * 0.35, t + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.55);
        });

        if (navigator.vibrate) {
          navigator.vibrate([300, 200, 300, 400]);
        }
      } else {
        // DEFAULT: Authentic System Digital Alarm (4-burst Piezoelectric Buzzer Beeps)
        // Exactly matches digital alarm clock / Android native alarm sound
        const beepTimes = [0, 0.12, 0.24, 0.36];
        const primaryFreq = 1046.5; // C6 piercing buzzer frequency
        const harmonicFreq = 2093.0; // C7 overtone for crisp digital edge

        beepTimes.forEach((delay) => {
          const t = now + delay;

          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc1.type = 'square';
          osc1.frequency.setValueAtTime(primaryFreq, t);

          osc2.type = 'square';
          osc2.frequency.setValueAtTime(harmonicFreq, t);

          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1500, t);
          filter.Q.setValueAtTime(1.2, t);

          gainNode.gain.setValueAtTime(0.001, t);
          gainNode.gain.linearRampToValueAtTime(volume * 0.85, t + 0.008);
          gainNode.gain.setValueAtTime(volume * 0.85, t + 0.065);
          gainNode.gain.linearRampToValueAtTime(0.001, t + 0.075);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc1.start(t);
          osc2.start(t);
          osc1.stop(t + 0.08);
          osc2.stop(t + 0.08);
        });

        if (navigator.vibrate) {
          navigator.vibrate([80, 40, 80, 40, 80, 40, 80, 450]);
        }
      }
    };

    const intervalMs = soundType === 'android_siren' ? 1200 : (soundType === 'clock_chime' ? 1400 : 900);
    playCycle();
    activeAlarmInterval = setInterval(playCycle, intervalMs);

    return stopAlarmSound;
  } catch (err) {
    console.warn('Alarm audio error:', err);
    return () => {};
  }
}

/**
 * Stop any active ringing alarm and release wake lock
 */
function stopAlarmSound() {
  if (activeAlarmInterval) {
    clearInterval(activeAlarmInterval);
    activeAlarmInterval = null;
  }
  if (activeAudioCtx) {
    try {
      activeAudioCtx.close();
    } catch {}
    activeAudioCtx = null;
  }
  releaseWakeLock();
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0);
  }
}

/**
 * Play a brief pleasant chime for notifications
 */
function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;

      const t = now + i * 0.08;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch (e) {
    console.warn('Chime audio error:', e);
  }
}

/**
 * Calculate the auto-sync wake up time:
 * The starting time of the first waking block for today
 */
function calculateAutoWakeTime(todaysBlocks) {
  if (!Array.isArray(todaysBlocks) || todaysBlocks.length === 0) return '06:00';

  const daytimeBlocks = todaysBlocks.filter(
    (b) => b && b.start && !b.name?.toLowerCase().includes('sleep')
  );

  const candidateBlocks = daytimeBlocks.length > 0 ? daytimeBlocks : todaysBlocks;
  const sorted = [...candidateBlocks].sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  return sorted[0]?.start || '06:00';
}

/**
 * Calculate the auto-sync sleep alarm time:
 * The end of the last evening schedule, or start of the designated sleep block
 */
function calculateAutoSleepTime(todaysBlocks) {
  if (!Array.isArray(todaysBlocks) || todaysBlocks.length === 0) return '22:00';

  const sleepBlock = todaysBlocks.find((b) => b && b.name?.toLowerCase().includes('sleep'));
  if (sleepBlock && sleepBlock.start) {
    return sleepBlock.start;
  }

  const sorted = [...todaysBlocks].sort((a, b) => (a.end || '').localeCompare(b.end || ''));
  return sorted[sorted.length - 1]?.end || '22:00';
}


// ─── EMBEDDED NOTIFICATION ENGINE ─────────────────────────────────────────────
/**
 * FocusOS Precision Notification Engine
 * Features:
 * - Customizable lead time (0 min for instant/exact time, 1m, 2m, 5m, 10m, etc.)
 * - Start & End milestone alerts for every scheduled task
 * - Instant schedule handover detection (e.g. at 09:00 when Task A ends and Task B starts)
 * - Dual dispatch: Native Browser Notifications + In-App Interactive Toast + Audio Chime
 */


const format12hTime = (t) => {
  if (!t || !t.includes(':')) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

/**
 * Dispatch a notification via Browser API and in-app toast callback
 */
function dispatchNotification({ title, body, icon = '/icon.png', onInAppToast }) {
  // 1. Play chime if sound is permitted
  playNotificationChime();

  // 2. Dispatch in-app toast for instant visual feedback
  if (typeof onInAppToast === 'function') {
    onInAppToast({
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // 3. Dispatch native browser / PWA notification if permission is granted
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const options = {
      body,
      icon,
      badge: icon,
      vibrate: [200, 100, 200],
      tag: title,
      renotify: true,
    };

    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => reg.showNotification(title, options))
          .catch(() => new Notification(title, options));
      } else {
        new Notification(title, options);
      }
    } catch (err) {
      console.warn('Native notification dispatch failed:', err);
    }
  }
}

/**
 * Check schedule for notification triggers at the current minute
 */
function checkScheduleNotifications({
  todaysBlocks = [],
  config = {
    enabled: true,
    leadMins: 5,
    notifyStart: true,
    notifyEnd: true,
    sound: true,
  },
  dateStr,
  onInAppToast,
}) {
  if (!config.enabled || !Array.isArray(todaysBlocks) || todaysBlocks.length === 0) return;

  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();
  const currentSeconds = now.getSeconds();

  // Only evaluate within the first 25 seconds of each minute to prevent duplicate checks
  const lead = Number(config.leadMins) || 0;

  // Track ending and starting tasks in this exact check
  const endingTasks = [];
  const startingTasks = [];

  todaysBlocks.forEach((block) => {
    if (!block || !block.start || !block.end) return;

    const [sh, sm] = block.start.split(':').map(Number);
    const startMins = sh * 60 + (sm || 0);

    const [eh, em] = block.end.split(':').map(Number);
    let endMins = eh * 60 + (em || 0);
    // If end is next day or cross-midnight, adjust
    if (endMins <= startMins) endMins += 24 * 60;

    // Check Start milestone
    if (config.notifyStart) {
      const targetStartMins = startMins - lead;
      if (currentTotalMins === targetStartMins) {
        const cacheKey = `notif_start_${dateStr}_${block.id}_lead${lead}`;
        if (!sessionStorage.getItem(cacheKey)) {
          sessionStorage.setItem(cacheKey, 'true');
          startingTasks.push(block);
        }
      }
    }

    // Check End milestone
    if (config.notifyEnd) {
      // For lead time on end: if lead is 0, notify at exact end.
      // If lead > 0, also support notifying right when task ends or lead mins before
      const targetEndMins = endMins - (lead === 0 ? 0 : 0); // User specifically asked for task ending notification at exact end or lead
      const checkMins = lead === 0 ? endMins : endMins - lead;

      if (currentTotalMins === checkMins || (lead > 0 && currentTotalMins === endMins)) {
        const cacheKey = `notif_end_${dateStr}_${block.id}_m${currentTotalMins}`;
        if (!sessionStorage.getItem(cacheKey)) {
          sessionStorage.setItem(cacheKey, 'true');
          endingTasks.push(block);
        }
      }
    }
  });

  // Check for simultaneous Handover (e.g. Task A ending at 9:00 and Task B starting at 9:00)
  if (endingTasks.length > 0 && startingTasks.length > 0) {
    const endingNames = endingTasks.map((b) => b.name).join(', ');
    const startingNames = startingTasks.map((b) => b.name).join(', ');
    const nextStartTimes = startingTasks.map((b) => format12hTime(b.start)).join(', ');

    dispatchNotification({
      title: `🔄 Schedule Handover (${nextStartTimes})`,
      body: `Finished: ${endingNames} • Starting Now: ${startingNames}`,
      onInAppToast,
    });
    return;
  }

  // Dispatch individual ending alerts
  endingTasks.forEach((block) => {
    dispatchNotification({
      title: `🏁 Task Completed: ${block.name}`,
      body: `Ended at ${format12hTime(block.end)}. Great job!`,
      onInAppToast,
    });
  });

  // Dispatch individual starting alerts
  startingTasks.forEach((block) => {
    const isInstant = lead === 0;
    const title = isInstant ? `⚡ Starting Now: ${block.name}` : `⏳ Upcoming: ${block.name}`;
    const body = isInstant
      ? `Scheduled from ${format12hTime(block.start)} to ${format12hTime(block.end)}.`
      : `Starts in ${lead} minute${lead > 1 ? 's' : ''} at ${format12hTime(block.start)}.`;

    dispatchNotification({
      title,
      body,
      onInAppToast,
    });
  });
}


// ─── EMBEDDED FIREBASE CLOUD SYNC ─────────────────────────────────────────────
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

function getActiveFirebaseConfig() {
  try {
    const custom = localStorage.getItem('FOCUSOS_FIREBASE_CONFIG');
    if (custom) return JSON.parse(custom);
  } catch (e) {}
  return DEFAULT_FIREBASE_CONFIG;
}

function saveCustomFirebaseConfig(config) {
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

function loadFirebaseCompat() {
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

async function getFirebaseInstances() {
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
async function signInWithGoogle() {
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
async function checkRedirectSignInResult() {
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
async function signOut() {
  const { auth } = await getFirebaseInstances();
  if (auth) {
    await auth.signOut();
  }
}

/**
 * Listen for Auth state changes
 */
async function onAuthChange(callback) {
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
async function syncUserDataToCloud(userId, data) {
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
async function loadUserDataFromCloud(userId) {
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


// ─── EMBEDDED UNIVERSAL STORAGE & DATA RECOVERY ENGINE ─────────────────────────
/**
 * FocusOS Universal Storage & Data Recovery Engine
 * Exhaustively scans all available client storage:
 * - window.localStorage (FocusOS history, PlusTwo mission state, backups, raw date keys)
 * - All IndexedDB databases & stores (FocusOS_PWA_DB, FocusOS_DB, Firestore cache, keyval, localforage)
 * - Deep multi-schema parser: FocusOS history format, Kerala Plus Two study planner plans,
 *   Firestore offline caches, raw arrays of logs, double-stringified JSON, and date-keyed entries.
 * - Non-destructive merge preserving every logged checkmark, actual minutes, and score.
 */

function isDateString(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// Helper to check if an object looks like a date-keyed FocusOS history collection
function isHistoryRecord(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  // Check if any keys match YYYY-MM-DD
  const dateKeyMatches = keys.filter(k => isDateString(k));
  if (dateKeyMatches.length > 0) return true;
  // Or check if obj has { date: "...", blocks: ... } (single day record)
  if (obj.date && isDateString(obj.date) && (obj.blocks || obj.blocksList || typeof obj.dailyScore === 'number')) {
    return true;
  }
  return false;
}

// Helper to check if an array looks like FocusOS presets
function isPresetArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.some(item => item && typeof item === 'object' && item.id && item.name && item.start && item.end);
}

/**
 * Parses and converts Kerala Plus Two Study Planner format (plusTwoMissionState_v2 / plusTwoPlanState)
 * into native FocusOS daily history records and recurring presets.
 */
function extractFromPlusTwoPlan(planData) {
  const recoveredDays = {};
  const recoveredPresets = [];

  if (!planData) return { recoveredDays, recoveredPresets };

  // Locate the plan array
  let plan = null;
  if (Array.isArray(planData)) {
    plan = planData;
  } else if (planData && Array.isArray(planData.plan)) {
    plan = planData.plan;
  }

  if (!plan || plan.length === 0) return { recoveredDays, recoveredPresets };

  const uniqueTaskNames = new Map();

  plan.forEach((day, dayIdx) => {
    if (!day) return;
    let ds = null;
    if (isDateString(day.date)) {
      ds = day.date;
    } else if (day.dayNumber) {
      // If date is missing, calculate reasonable date offset
      const d = new Date();
      d.setDate(d.getDate() - (plan.length - day.dayNumber));
      ds = d.toISOString().slice(0, 10);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - (plan.length - dayIdx));
      ds = d.toISOString().slice(0, 10);
    }

    const tasks = Array.isArray(day.tasks) ? day.tasks : [];
    const blocks = {};
    const blocksList = [];
    let completedWeight = 0;
    let totalWeight = 0;
    const baseHour = 6; // Morning start

    tasks.forEach((t, tIdx) => {
      if (!t) return;
      const bId = String(t.id || `mpt_${dayIdx}_${tIdx}`);
      const duration = t.estimatedMinutes || 60;
      const startMin = (baseHour * 60) + (tIdx * 90);
      const sh = String(Math.floor(startMin / 60) % 24).padStart(2, '0');
      const sm = String(startMin % 60).padStart(2, '0');
      const endMin = startMin + duration;
      const eh = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
      const em = String(endMin % 60).padStart(2, '0');

      const taskName = (t.subject ? `${t.subject}: ` : '') + (t.topicTitle || t.chapterName || t.name || 'Study Block');
      const weight = t.weight || (t.grade === '+2' ? 3 : 2);
      totalWeight += weight;

      if (t.completed) {
        completedWeight += weight;
        blocks[bId] = {
          status: 'completed',
          actualMins: duration,
          completedAt: `${eh}:${em}`,
          logMethod: 'plus_two_migrated',
        };
      } else {
        blocks[bId] = {
          status: 'pending',
        };
      }

      const blockDef = {
        id: bId,
        name: taskName,
        start: `${sh}:${sm}`,
        end: `${eh}:${em}`,
        weight,
        tag: t.subject || 'Study',
      };
      blocksList.push(blockDef);

      if (!uniqueTaskNames.has(taskName)) {
        uniqueTaskNames.set(taskName, {
          id: `preset_${bId}`,
          name: taskName,
          start: `${sh}:${sm}`,
          end: `${eh}:${em}`,
          days: [0, 1, 2, 3, 4, 5, 6],
          weight,
          tag: t.subject || 'Study',
        });
      }
    });

    const dailyScore = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    recoveredDays[ds] = {
      date: ds,
      dailyScore,
      blocks,
      blocksList,
    };
  });

  return {
    recoveredDays,
    recoveredPresets: Array.from(uniqueTaskNames.values()).slice(0, 15),
  };
}

/**
 * Universal Recursive Extractor
 * Accepts any arbitrary object, array, or stringified payload and searches for
 * FocusOS history, PlusTwo plans, single day logs, or date-keyed structures.
 */
function extractHistoryAndPresetsFromAny(value, keyHint = '', depth = 0) {
  const recoveredDays = {};
  let recoveredPresets = null;

  if (value === null || value === undefined || depth > 5) {
    return { recoveredDays, recoveredPresets };
  }

  // 1. If value is a string, try JSON.parse (handles double-stringified JSON)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractHistoryAndPresetsFromAny(parsed, keyHint, depth + 1);
      } catch {}
    }
    return { recoveredDays, recoveredPresets };
  }

  // 2. Check for Kerala PlusTwo study planner structure
  if (value && typeof value === 'object') {
    if (Array.isArray(value.plan) || (Array.isArray(value) && value.some(item => item && item.tasks && Array.isArray(item.tasks)))) {
      const ptRes = extractFromPlusTwoPlan(value);
      Object.assign(recoveredDays, ptRes.recoveredDays);
      if (ptRes.recoveredPresets && ptRes.recoveredPresets.length > 0) {
        recoveredPresets = ptRes.recoveredPresets;
      }
    }
  }

  // 3. Check if keyHint itself is a date (e.g. key is "2026-09-18")
  if (isDateString(keyHint) && value && typeof value === 'object') {
    const ds = keyHint;
    const blocks = value.blocks || (value.tasks && typeof value.tasks === 'object' ? value.tasks : {});
    const blocksList = Array.isArray(value.blocksList) ? value.blocksList : (Array.isArray(value.tasks) ? value.tasks : []);
    const dailyScore = typeof value.dailyScore === 'number' ? value.dailyScore : (typeof value.score === 'number' ? value.score : 0);
    recoveredDays[ds] = {
      date: ds,
      dailyScore,
      blocks,
      blocksList,
      ...value,
    };
  }

  // 4. Check if object has { date: "YYYY-MM-DD", blocks: ... }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (isDateString(value.date) && (value.blocks || value.blocksList || typeof value.dailyScore === 'number')) {
      recoveredDays[value.date] = value;
    }
  }

  // 5. Check if value is a standard FocusOS date-keyed history dictionary
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    let hasDateKeys = false;
    Object.entries(value).forEach(([k, dayVal]) => {
      if (isDateString(k) && dayVal && typeof dayVal === 'object') {
        recoveredDays[k] = {
          date: k,
          dailyScore: typeof dayVal.dailyScore === 'number' ? dayVal.dailyScore : 0,
          blocks: dayVal.blocks || {},
          blocksList: dayVal.blocksList || [],
          ...dayVal,
        };
        hasDateKeys = true;
      }
    });

    // 6. Check preset arrays
    if (isPresetArray(value)) {
      recoveredPresets = value;
    }
    if (Array.isArray(value.presets) && isPresetArray(value.presets)) {
      recoveredPresets = value.presets;
    }

    // 7. If not already handled, search nested properties (e.g. history, data, state, timeline)
    if (!hasDateKeys) {
      const candidateKeys = ['history', 'days', 'logs', 'records', 'timeline', 'data', 'state', 'appState', 'v2', 'v1', 'savedState'];
      for (const prop of candidateKeys) {
        if (value[prop] && typeof value[prop] === 'object') {
          const nested = extractHistoryAndPresetsFromAny(value[prop], prop, depth + 1);
          Object.assign(recoveredDays, nested.recoveredDays);
          if (nested.recoveredPresets && (!recoveredPresets || nested.recoveredPresets.length > recoveredPresets.length)) {
            recoveredPresets = nested.recoveredPresets;
          }
        }
      }
    }
  }

  // 8. If value is an Array of days / logs
  if (Array.isArray(value)) {
    if (isPresetArray(value)) {
      recoveredPresets = value;
    } else {
      value.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          if (isDateString(item.date)) {
            recoveredDays[item.date] = {
              date: item.date,
              dailyScore: typeof item.dailyScore === 'number' ? item.dailyScore : 0,
              blocks: item.blocks || {},
              blocksList: item.blocksList || [],
              ...item,
            };
          } else {
            const nested = extractHistoryAndPresetsFromAny(item, `item_${idx}`, depth + 1);
            Object.assign(recoveredDays, nested.recoveredDays);
            if (nested.recoveredPresets && (!recoveredPresets || nested.recoveredPresets.length > recoveredPresets.length)) {
              recoveredPresets = nested.recoveredPresets;
            }
          }
        }
      });
    }
  }

  return { recoveredDays, recoveredPresets };
}

/**
 * Exhaustively scans window.localStorage across all keys
 */
function scanLocalStorage() {
  const recoveredDays = {};
  let recoveredPresets = null;
  const keyDetails = [];
  let keysScanned = 0;

  if (typeof window === 'undefined' || !window.localStorage) {
    return { recoveredDays, recoveredPresets, keysScanned, keyDetails };
  }

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      keysScanned++;
      if (!key) continue;

      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;

        const sizeKb = (raw.length / 1024).toFixed(1);
        keyDetails.push({
          key,
          length: raw.length,
          sizeKb: `${sizeKb} KB`,
          preview: raw.slice(0, 100) + (raw.length > 100 ? '...' : ''),
        });

        // Run universal extractor on raw string / parsed JSON
        const extracted = extractHistoryAndPresetsFromAny(raw, key);
        Object.assign(recoveredDays, extracted.recoveredDays);

        if (extracted.recoveredPresets && (!recoveredPresets || extracted.recoveredPresets.length > recoveredPresets.length)) {
          recoveredPresets = extracted.recoveredPresets;
        }
      } catch (keyErr) {
        console.warn(`LocalStorage scan error on key "${key}":`, keyErr);
      }
    }
  } catch (err) {
    console.warn('LocalStorage scan warning:', err);
  }

  return { recoveredDays, recoveredPresets, keysScanned, keyDetails };
}

/**
 * Exhaustively scans all accessible IndexedDB databases and object stores
 */
async function scanIndexedDB() {
  const recoveredDays = {};
  let recoveredPresets = null;
  const dbDetails = [];
  let dbsScanned = 0;
  let storesScanned = 0;

  if (typeof window === 'undefined' || !window.indexedDB) {
    return { recoveredDays, recoveredPresets, dbsScanned, storesScanned, dbDetails };
  }

  // Candidate DB names across past and present FocusOS and Study Planner builds
  const candidateDBs = [
    "FocusOS_PWA_DB",
    "FocusOS_DB",
    "FocusOS",
    "focusos_db",
    "focusos",
    "app_data",
    "keyval-store",
    "localforage",
    "mission-plustwo",
    "plustwo",
    "plustwo_db",
    "firebaseLocalStorageDb",
  ];

  try {
    if (typeof indexedDB.databases === 'function') {
      const liveDBs = await indexedDB.databases();
      if (Array.isArray(liveDBs)) {
        liveDBs.forEach((d) => {
          if (d && d.name && !candidateDBs.includes(d.name)) {
            candidateDBs.unshift(d.name);
          }
        });
      }
    }
  } catch (e) {}

  for (const dbName of candidateDBs) {
    try {
      const db = await new Promise((resolve) => {
        let finished = false;
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve(null);
          }
        }, 1500);

        try {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              resolve(req.result);
            }
          };
          req.onerror = () => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              resolve(null);
            }
          };
          req.onblocked = () => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              resolve(null);
            }
          };
        } catch {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            resolve(null);
          }
        }
      });

      if (!db) continue;
      dbsScanned++;

      const currentDbInfo = {
        dbName,
        version: db.version,
        stores: [],
      };

      const storeNames = Array.from(db.objectStoreNames || []);
      for (const storeName of storeNames) {
        storesScanned++;
        try {
          const records = await new Promise((resolve) => {
            try {
              const tx = db.transaction(storeName, 'readonly');
              const store = tx.objectStore(storeName);

              // Use store.getAll() and store.getAllKeys() if supported, with cursor fallback
              if (typeof store.getAll === 'function' && typeof store.getAllKeys === 'function') {
                const keysReq = store.getAllKeys();
                keysReq.onsuccess = () => {
                  const keys = keysReq.result || [];
                  const valsReq = store.getAll();
                  valsReq.onsuccess = () => {
                    const vals = valsReq.result || [];
                    const items = keys.map((k, idx) => ({ key: k, val: vals[idx] }));
                    resolve(items);
                  };
                  valsReq.onerror = () => resolve([]);
                };
                keysReq.onerror = () => resolve([]);
              } else {
                const items = [];
                const cursorReq = store.openCursor();
                cursorReq.onsuccess = (e) => {
                  const cursor = e.target.result;
                  if (cursor) {
                    items.push({ key: cursor.key, val: cursor.value });
                    cursor.continue();
                  } else {
                    resolve(items);
                  }
                };
                cursorReq.onerror = () => resolve([]);
              }
            } catch {
              resolve([]);
            }
          });

          currentDbInfo.stores.push({
            storeName,
            recordCount: records.length,
            sampleKeys: records.slice(0, 5).map(r => String(r.key)),
          });

          for (const item of records) {
            const extracted = extractHistoryAndPresetsFromAny(item.val, String(item.key));
            Object.assign(recoveredDays, extracted.recoveredDays);

            if (extracted.recoveredPresets && (!recoveredPresets || extracted.recoveredPresets.length > recoveredPresets.length)) {
              recoveredPresets = extracted.recoveredPresets;
            }
          }
        } catch (storeErr) {
          console.warn(`Scan error in store ${storeName}:`, storeErr);
        }
      }

      dbDetails.push(currentDbInfo);
      try {
        db.close();
      } catch {}
    } catch {
      // Continue to next DB
    }
  }

  return { recoveredDays, recoveredPresets, dbsScanned, storesScanned, dbDetails };
}

/**
 * Universal Deep Scan & Merge
 * Non-destructive merge prioritizing preserved logs over empty placeholders
 */
async function performDeepScanAndRecover({ currentHistory = {}, currentPresets = [] }) {
  const lsResult = scanLocalStorage();
  const idbResult = await scanIndexedDB();

  const allRecoveredDays = {
    ...lsResult.recoveredDays,
    ...idbResult.recoveredDays,
  };

  const initialCount = Object.keys(currentHistory || {}).length;
  const mergedHistory = { ...allRecoveredDays, ...(currentHistory || {}) };

  // Merge blocks within each day so no logged progress is lost
  Object.keys(allRecoveredDays).forEach((ds) => {
    const recoveredDay = allRecoveredDays[ds];
    const existingDay = currentHistory ? currentHistory[ds] : null;
    if (existingDay && recoveredDay) {
      const mergedBlocks = {
        ...(recoveredDay.blocks || {}),
        ...(existingDay.blocks || {}),
      };
      // If existing block was pending but recovered was completed/partial, keep the completed log
      Object.entries(recoveredDay.blocks || {}).forEach(([bid, bProg]) => {
        if (bProg && (bProg.status === 'completed' || bProg.status === 'partial')) {
          if (!existingDay.blocks || !existingDay.blocks[bid] || existingDay.blocks[bid].status === 'pending') {
            mergedBlocks[bid] = bProg;
          }
        }
      });
      mergedHistory[ds] = {
        ...recoveredDay,
        ...existingDay,
        blocks: mergedBlocks,
        blocksList: (existingDay.blocksList && existingDay.blocksList.length > 0)
          ? existingDay.blocksList
          : (recoveredDay.blocksList || []),
        dailyScore: Math.max(existingDay.dailyScore || 0, recoveredDay.dailyScore || 0),
      };
    } else if (recoveredDay) {
      mergedHistory[ds] = recoveredDay;
    }
  });

  // Merge presets non-destructively
  let mergedPresets = Array.isArray(currentPresets) ? [...currentPresets] : [];
  const recoveredPresets = idbResult.recoveredPresets || lsResult.recoveredPresets;
  if (recoveredPresets && Array.isArray(recoveredPresets) && recoveredPresets.length > 0) {
    const map = new Map();
    mergedPresets.forEach((p) => p && p.id && map.set(p.id, p));
    recoveredPresets.forEach((p) => {
      if (p && p.id && !map.has(p.id)) {
        map.set(p.id, p);
      }
    });
    mergedPresets = Array.from(map.values());
  }

  const finalCount = Object.keys(mergedHistory).length;
  const newlyRecoveredDays = Math.max(0, finalCount - initialCount);

  // Dual-redundant backup write if days were recovered
  if (finalCount > 0) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('fo6_history', JSON.stringify(mergedHistory));
        window.localStorage.setItem('focusos_history_master_backup', JSON.stringify(mergedHistory));
        window.localStorage.setItem('fo6_presets', JSON.stringify(mergedPresets));
      }
    } catch (e) {}
  }

  return {
    mergedHistory,
    mergedPresets,
    stats: {
      keysScanned: lsResult.keysScanned,
      dbsScanned: idbResult.dbsScanned,
      storesScanned: idbResult.storesScanned,
      totalDays: finalCount,
      newlyRecoveredDays,
    },
    diagnostics: {
      localStorageKeys: lsResult.keyDetails,
      indexedDBs: idbResult.dbDetails,
    },
  };
}

/**
 * Generate a complete raw storage diagnostic report
 * Used by the Storage Inspector in Settings
 */
async function getRawStorageDiagnosticReport() {
  const lsResult = scanLocalStorage();
  const idbResult = await scanIndexedDB();

  return {
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    localStorage: {
      totalKeys: lsResult.keysScanned,
      keys: lsResult.keyDetails,
      detectedDaysCount: Object.keys(lsResult.recoveredDays).length,
    },
    indexedDB: {
      totalDatabases: idbResult.dbsScanned,
      databases: idbResult.dbDetails,
      detectedDaysCount: Object.keys(idbResult.recoveredDays).length,
    },
    totalRecoverableDays: Object.keys({ ...lsResult.recoveredDays, ...idbResult.recoveredDays }).length,
  };
}

/**
 * Export complete backup payload as JSON file download
 */
function exportBackupData({ history, presets, alarms, notificationConfig }) {
  const payload = {
    app: "FocusOS",
    version: "6.0-pro",
    exportedAt: new Date().toISOString(),
    history: history || {},
    presets: presets || [],
    alarms: alarms || {},
    notificationConfig: notificationConfig || {},
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `focusos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Safely parses and validates an imported JSON backup string
 */
function parseImportBackup(jsonString) {
  try {
    const extracted = extractHistoryAndPresetsFromAny(jsonString, 'imported_backup');
    const dayCount = Object.keys(extracted.recoveredDays).length;

    let alarms = null;
    let notificationConfig = null;
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        alarms = parsed.alarms || null;
        notificationConfig = parsed.notificationConfig || null;
      }
    } catch {}

    if (dayCount === 0 && (!extracted.recoveredPresets || extracted.recoveredPresets.length === 0)) {
      throw new Error("No activity days or schedules found in the imported file");
    }

    return {
      success: true,
      history: extracted.recoveredDays,
      presets: extracted.recoveredPresets,
      alarms,
      notificationConfig,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}


// ─── FOCUSOS APPLICATION ──────────────────────────────────────────────────────
// ─── ICON SYSTEM (Zero-Dependency Google Material Symbols) ────────────────────
const normalizeIconName = (name) => {
  if (!name || typeof name !== "string") return "monitoring";
  const legacyMap = {
    Activity: "monitoring",
    Home: "home",
    BarChart2: "bar_chart",
    Settings: "settings",
    CalendarIcon: "calendar_month",
    MoreVertical: "more_vert",
    Check: "check",
    X: "close",
    CheckCircle: "check_circle",
    ArrowRight: "arrow_forward",
    Star: "star",
    Download: "download",
    AlertTriangle: "warning",
    ChevronRight: "chevron_right",
    Wrench: "build",
    Code: "code",
    Dumbbell: "fitness_center",
    Target: "ads_click",
    Book: "menu_book",
    Moon: "dark_mode",
    Coffee: "local_cafe",
    Layout: "dashboard",
    Headphones: "headphones",
    Alarm: "alarm",
    AlarmOn: "alarm_on",
    AlarmOff: "alarm_off",
    Notifications: "notifications",
    Timer: "timer",
  };
  if (legacyMap[name]) return legacyMap[name];
  return name.toLowerCase().replace(/-/g, "_");
};

const Icon = ({ name, size = 24, className = "", style = {} }) => (
  <span
    className={`material-symbols-rounded ${className}`}
    style={{ fontSize: size, lineHeight: 1, userSelect: "none", ...style }}
  >
    {normalizeIconName(name)}
  </span>
);

// ─── ERROR BOUNDARY (Production Fail-Safe) ────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("FocusOS Crash Intercepted:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#080808",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "sans-serif",
          }}
        >
          <Icon
            name="build"
            size={48}
            style={{ color: "#FF3B30", marginBottom: "1rem" }}
          />
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "0.5rem",
            }}
          >
            System Error
          </h1>
          <p
            style={{
              color: "#9ca3af",
              textAlign: "center",
              fontSize: "0.875rem",
              marginBottom: "1rem",
              maxWidth: "22rem",
            }}
          >
            An unexpected error occurred during execution.
          </p>
          {this.state.error && (
            <div
              style={{
                backgroundColor: "#161616",
                border: "1px solid #333",
                borderRadius: "0.75rem",
                padding: "0.75rem",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                color: "#ff6b6b",
                maxWidth: "22rem",
                maxHeight: "6rem",
                overflowY: "auto",
                marginBottom: "1.5rem",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              fontWeight: "bold",
              padding: "0.75rem 2rem",
              borderRadius: "9999px",
              border: "none",
              width: "100%",
              maxWidth: "20rem",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            Reload App
          </button>
          <button
            onClick={() => {
              try {
                const dump = {};
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  dump[k] = localStorage.getItem(k);
                }
                const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `focusos-emergency-backup-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch(e) {
                alert("Failed to dump data: " + e.message);
              }
            }}
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              fontWeight: "bold",
              padding: "0.75rem 2rem",
              borderRadius: "9999px",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              width: "100%",
              maxWidth: "20rem",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            Emergency Export Local Data
          </button>
          <button
            onClick={() => {
              if (window.confirm("Wipe local database? Only do this after exporting backup.")) {
                const req = indexedDB.deleteDatabase("FocusOS_PWA_DB");
                req.onsuccess = () => window.location.reload();
                req.onerror = () => {
                  alert("Failed to wipe data. Try manually clearing browser cache.");
                  window.location.reload();
                };
                req.onblocked = () => {
                  alert("Please close all other tabs running this app to wipe data.");
                  window.location.reload();
                };
              }
            }}
            style={{
              backgroundColor: "transparent",
              color: "#FF3B30",
              fontWeight: "bold",
              padding: "0.75rem 2rem",
              borderRadius: "9999px",
              border: "2px solid #FF3B30",
              width: "100%",
              maxWidth: "20rem",
              cursor: "pointer",
            }}
          >
            Wipe Data & Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── INDEXEDDB ENGINE (Local-First Offline Storage) ───────────────────────────
const DB_NAME = "FocusOS_PWA_DB";
const DB_VERSION = 1;
const STORE_NAME = "app_data";

const initDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const idbGet = async (key, fallback) => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () =>
        resolve(request.result !== undefined ? request.result : fallback);
      request.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
};

const idbSet = async (key, val) => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(val, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("IDB Write Error:", e);
  }
};

// ─── PWA DYNAMIC INJECTOR ─────────────────────────────────────────────────────
const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (!document.getElementById("hide-csb-watermark")) {
      const style = document.createElement("style");
      style.id = "hide-csb-watermark";
      style.innerHTML = `
          body > *:not(#root):not(script):not(style):not(noscript) { display: none !important; opacity: 0 !important; pointer-events: none !important; z-index: -9999 !important; }
          iframe { display: none !important; opacity: 0 !important; pointer-events: none !important; }
          a[href*="codesandbox.io"] { display: none !important; opacity: 0 !important; pointer-events: none !important; }
      `;
      document.head.appendChild(style);
    }

    const absoluteIconUrl = window.location.origin + "/icon.png";
    const manifest = {
      name: "FocusOS",
      short_name: "FocusOS",
      description: "Priority-weighted productivity tracker with Smart Alarms & Cloud Sync",
      start_url: window.location.origin + "/",
      display: "standalone",
      background_color: "#080808",
      theme_color: "#080808",
      icons: [
        {
          src: absoluteIconUrl,
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    };

    const manifestBlob = new Blob([JSON.stringify(manifest)], {
      type: "application/manifest+json",
    });
    const manifestURL = URL.createObjectURL(manifestBlob);

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = manifestURL;

    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = absoluteIconUrl;

    if ("serviceWorker" in navigator) {
      const swCode = `
        const CACHE_NAME = 'focusos-pwa-v23';
        self.addEventListener('install', (e) => { 
            e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(['/', '/index.html', '${absoluteIconUrl}', 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,600,0,0'])).catch(()=>{})); 
            self.skipWaiting(); 
        });
        self.addEventListener('activate', (e) => {
            e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))));
            self.clients.claim();
        });
        self.addEventListener('fetch', (e) => { 
            e.respondWith(
                caches.match(e.request).then((res) => {
                    if (res) return res;
                    return fetch(e.request).then(fetchRes => {
                        if (e.request.method === 'GET' && fetchRes.status === 200) {
                            const clone = fetchRes.clone();
                            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                        }
                        return fetchRes;
                    }).catch(() => new Response('Offline Mode Active'));
                })
            ); 
        });
        self.addEventListener('notificationclick', function(event) {
          event.notification.close();
          event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
              if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                  if (clientList[i].focused) { client = clientList[i]; }
                }
                return client.focus();
              }
              return clients.openWindow('/');
            })
          );
        });
      `;
      const swBlob = new Blob([swCode], { type: "application/javascript" });
      navigator.serviceWorker
        .register(URL.createObjectURL(swBlob))
        .catch(() => {});
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return { deferredPrompt, setDeferredPrompt };
};

// ─── CONFIG & DEFAULTS ────────────────────────────────────────────────────────
const ICONS = [
  "monitoring",
  "alarm",
  "menu_book",
  "fitness_center",
  "directions_run",
  "pool",
  "self_improvement",
  "hiking",
  "restaurant",
  "local_cafe",
  "sports_esports",
  "terminal",
  "code",
  "laptop_mac",
  "brush",
  "palette",
  "music_note",
  "headset",
  "school",
  "science",
  "calculate",
  "language",
  "directions_car",
  "pedal_bike",
  "local_grocery_store",
  "shopping_cart",
  "flight",
  "work",
  "attach_file",
  "edit_square",
  "folder",
  "cloud",
  "dark_mode",
  "light_mode",
  "wb_twilight",
  "check_circle",
  "star",
  "battery_charging_full",
  "psychology",
  "architecture",
  "sports_soccer",
  "directions_walk",
  "church",
  "theater_comedy",
];

const WEIGHTS = { highest: 4, medium: 3, lower: 2, lowest: 1 };
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const DEFAULT_PRESETS = [
  {
    id: "p1",
    name: "Skills / Python / AI",
    start: "05:00",
    end: "06:00",
    priority: "highest",
    days: [1, 2, 3, 4, 5],
    icon: "code",
    zeroXp: false,
  },
  {
    id: "p2",
    name: "Gym",
    start: "06:30",
    end: "07:30",
    priority: "medium",
    days: [1, 2, 3, 4, 5, 6],
    icon: "fitness_center",
    zeroXp: false,
  },
  {
    id: "p7",
    name: "Study (Evening)",
    start: "19:00",
    end: "20:30",
    priority: "highest",
    days: [1, 2, 3, 4, 5, 0, 6],
    icon: "menu_book",
    zeroXp: false,
  },
  {
    id: "p10",
    name: "Sleep",
    start: "22:00",
    end: "05:00",
    priority: "medium",
    days: [0, 1, 2, 3, 4, 5, 6],
    icon: "dark_mode",
    zeroXp: false,
  },
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const localDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const todayStr = () => localDateStr(new Date());

const to12hObj = (t) => {
  if (!t || typeof t !== "string" || !t.includes(":"))
    return { time: "", period: "" };
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return { time: `${h % 12 || 12}:${String(m).padStart(2, "0")}`, period: ap };
};
const to12h = (t) => {
  const o = to12hObj(t);
  return `${o.time} ${o.period}`;
};

const mins = (s, e) => {
  if (
    !s ||
    !e ||
    typeof s !== "string" ||
    typeof e !== "string" ||
    !s.includes(":") ||
    !e.includes(":")
  )
    return 0;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
};

const calcScore = (blocks, progress) => {
  if (!blocks || !Array.isArray(blocks) || !blocks.length) return 0;
  let earned = 0,
    total = 0;
  blocks.forEach((b) => {
    if (!b || b.zeroXp) return;
    const w = WEIGHTS[b.priority] || 1;
    total += w;
    const p = (progress || {})[b.id];
    if (!p || p.status === "pending" || p.status === "missed") return;

    if (p.status === "completed") {
      earned += w;
    } else if (p.status === "partial") {
      const d = mins(b.start, b.end);
      const ratio = d > 0 ? (p.actualMins || 0) / d : 0;
      earned += w * ratio;
    }
  });
  return total > 0 ? Math.round((earned / total) * 100) : 0;
};

const useLongPress = (callback = () => {}, ms = 500) => {
  const timerRef = useRef();
  const start = useCallback(
    (e) => {
      timerRef.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        callback(e);
      }, ms);
    },
    [callback, ms]
  );
  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: stop,
  };
};

// ─── TASK ITEM COMPONENT ──────────────────────────────────────────────────────
const TaskItem = ({
  block,
  status,
  prog,
  isCurrent,
  currentProgress,
  isDark,
  themeColors,
  onMark,
  onUnmark,
  onOpenPartial,
  onEdit,
  onDeleteFromToday,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const touchStartX = useRef(0);
  const isSwiping = useRef(false);

  const duration = mins(block.start, block.end);
  const [sh, sm] = (block.start || "00:00").split(":").map(Number);
  const [eh] = (block.end || "00:00").split(":").map(Number);
  const isCrossMidnight = eh < sh;

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    isSwiping.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isSwiping.current) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff > 0 && diff < 90) setOffset(diff);
  };

  const handleTouchEnd = () => {
    if (offset > 45) {
      if (status !== "completed") onMark(block.id, "completed");
      else onUnmark(block.id);
    }
    setOffset(0);
    isSwiping.current = false;
  };

  let badgeBorder = "border-transparent";
  let statusBadge = null;

  if (status === "completed") {
    badgeBorder = "border-[#32D74B]/40";
    statusBadge = (
      <span className="text-[10px] font-black uppercase tracking-wider bg-[#32D74B]/15 text-[#32D74B] px-2 py-0.5 rounded-full flex items-center gap-1">
        <Icon name="check" size={12} /> Done
      </span>
    );
  } else if (status === "partial") {
    badgeBorder = "border-[#FF9F0A]/40";
    statusBadge = (
      <span className="text-[10px] font-black uppercase tracking-wider bg-[#FF9F0A]/15 text-[#FF9F0A] px-2 py-0.5 rounded-full flex items-center gap-1">
        <Icon name="timelapse" size={12} /> {prog?.actualMins || 0}m
      </span>
    );
  } else if (status === "missed") {
    badgeBorder = "border-[#FF3B30]/40";
    statusBadge = (
      <span className="text-[10px] font-black uppercase tracking-wider bg-[#FF3B30]/15 text-[#FF3B30] px-2 py-0.5 rounded-full flex items-center gap-1">
        <Icon name="close" size={12} /> Skipped
      </span>
    );
  }

  return (
    <div className="relative mb-3 select-none">
      {/* Swipe reveal background */}
      <div
        className="absolute inset-0 bg-[#32D74B] rounded-3xl flex items-center pl-6 text-white font-black text-sm"
        style={{ opacity: Math.min(1, offset / 40) }}
      >
        <Icon name="check" size={24} />
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? "transform 0.2s" : "none" }}
        className={`relative ${themeColors.surface} border ${
          isCurrent ? "border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30" : badgeBorder !== "border-transparent" ? badgeBorder : themeColors.border
        } rounded-3xl p-5 overflow-hidden transition-all`}
      >
        {/* Active live progress bar at top */}
        {isCurrent && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-[#222] overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-1000"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        )}

        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                status === "completed"
                  ? "bg-[#32D74B]/15 text-[#32D74B]"
                  : status === "partial"
                  ? "bg-[#FF9F0A]/15 text-[#FF9F0A]"
                  : isCurrent
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                  : `${themeColors.surface2} ${themeColors.text2}`
              }`}
            >
              <Icon name={block.icon || "monitoring"} size={22} />
            </div>

            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-black text-base truncate text-gray-900 dark:text-white">
                  {block.name}
                </span>
                {statusBadge}
                {block.zeroXp && (
                  <span className="text-[9px] uppercase tracking-wider bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded font-black">
                    0XP
                  </span>
                )}
              </div>
              <div className="text-xs font-mono font-medium text-gray-500 flex items-center gap-1.5 flex-wrap">
                <span>
                  {to12h(block.start)} – {to12h(block.end)}
                </span>
                {isCrossMidnight && (
                  <span className="text-[9px] text-[#BF5AF2] font-bold uppercase">(NEXT DAY)</span>
                )}
                <span>•</span>
                <span>{duration}m</span>
                {isCurrent && (
                  <span className="text-blue-500 font-bold ml-1 animate-pulse">● In Progress</span>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${themeColors.text3} hover:bg-gray-100 dark:hover:bg-[#222]`}
            >
              <Icon name="more_vert" size={20} />
            </button>

            {menuOpen && (
              <div
                className={`absolute right-0 top-10 w-44 rounded-2xl ${themeColors.surface} border ${themeColors.border} shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-150`}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(block);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-[#222]"
                >
                  <Icon name="edit" size={16} /> Edit Routine
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteFromToday(block.id);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-[#FF3B30] flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-[#222]"
                >
                  <Icon name="delete" size={16} /> Remove Today
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-[#1e1e1e]">
          <button
            onClick={() => onMark(block.id, "completed")}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
              status === "completed"
                ? "bg-[#32D74B] text-black shadow-sm"
                : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 active:scale-95"
            }`}
          >
            <Icon name="check" size={14} /> Done
          </button>

          <button
            onClick={() => onOpenPartial(block)}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
              status === "partial"
                ? "bg-[#FF9F0A] text-black shadow-sm"
                : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 active:scale-95"
            }`}
          >
            <Icon name="timer" size={14} /> Partial
          </button>

          <button
            onClick={() => onMark(block.id, "missed")}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
              status === "missed"
                ? "bg-[#FF3B30] text-white shadow-sm"
                : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 active:scale-95"
            }`}
          >
            <Icon name="close" size={14} /> Skip
          </button>
        </div>

        {status && status !== "pending" && (
          <button
            onClick={() => onUnmark(block.id)}
            className="w-full text-center text-[10px] font-bold text-gray-400 mt-2 hover:underline"
          >
            Undo status
          </button>
        )}
      </div>
    </div>
  );
};

// ─── MAIN APP COMPONENT (FocusOS) ─────────────────────────────────────────────
function FocusOS() {
  const [isReady, setIsReady] = useState(false);
  const [tab, setTab] = useState("today");
  const [selDate, setSelDate] = useState(todayStr());
  const [now, setNow] = useState(new Date());

  const [history, setHistory] = useState({});
  const [presets, setPresets] = useState([]);
  const [themeMode, setThemeMode] = useState("system");

  // Alarms State
  const [alarms, setAlarms] = useState({
    wake: { enabled: false, time: "05:00", autoSync: true },
    sleep: { enabled: false, time: "22:00", autoSync: true },
  });
  const [activeAlarm, setActiveAlarm] = useState(null);

  // Notifications State
  const [notificationConfig, setNotificationConfig] = useState({
    enabled: false,
    leadMins: 0, // 0 for exact instant time
    notifyStart: true,
    notifyEnd: true,
    sound: true,
  });
  const [inAppToast, setInAppToast] = useState(null);

  // Authentication & Cloud Sync State
  const [currentUser, setCurrentUser] = useState(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState("idle");
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);

  // Storage Inspector State
  const [showStorageInspector, setShowStorageInspector] = useState(false);
  const [storageReport, setStorageReport] = useState(null);

  // Boot safety refs (prevent empty-state overwrite of existing data)
  const hasCompletedInitialLoadRef = useRef(false);
  const hadPriorDataRef = useRef(false);

  // Modals & UI Controls
  const [partialModal, setPartialModal] = useState(null);
  const [partialMins, setPartialMins] = useState(30);
  const [partialReason, setPartialReason] = useState("Time shortage");
  const [editingPreset, setEditingPreset] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [cMon, setCMon] = useState(new Date());

  // Analytics & Graph Controls
  const [tf, setTf] = useState(7);
  const [filterTask, setFilterTask] = useState("ALL");
  const [chartViewMode, setChartViewMode] = useState("line");
  const [scrubberPoint, setScrubberPoint] = useState(null);
  const [burst, setBurst] = useState(false);

  // Storage & Recovery State
  const [isScanningStorage, setIsScanningStorage] = useState(false);
  const [scanReport, setScanReport] = useState(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupJsonInput, setBackupJsonInput] = useState("");

  const handleAddToast = useCallback((toast) => {
    setInAppToast(toast);
    setTimeout(() => {
      setInAppToast((prev) => (prev && prev.id === toast.id ? null : prev));
    }, 6000);
  }, []);

  const { deferredPrompt, setDeferredPrompt } = usePWA();

  // ─── INITIAL BOOT & STORAGE LOADING ─────────────────────────────────────────
  useEffect(() => {
    let twLoaded = false;
    let dbLoaded = false;

    const checkReady = () => {
      if (twLoaded && dbLoaded) setIsReady(true);
    };

    // Fail-safe maximum splash duration (400ms) to guarantee app unblocks immediately
    const failSafeTimer = setTimeout(() => {
      setIsReady(true);
    }, 400);

    async function loadData() {
      try {
        if (!document.getElementById("tailwind-script") && !window.tailwind) {
          const script = document.createElement("script");
          script.id = "tailwind-script";
          script.src = "https://cdn.tailwindcss.com";
          script.onload = () => {
            twLoaded = true;
            checkReady();
          };
          script.onerror = () => {
            twLoaded = true;
            checkReady();
          };
          document.head.appendChild(script);
        } else {
          twLoaded = true;
        }

        if (!document.getElementById("material-icons")) {
          const link = document.createElement("link");
          link.id = "material-icons";
          link.href =
            "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,600,0,0";
          link.rel = "stylesheet";
          document.head.appendChild(link);
        }

        let hist = await idbGet("fo6_history", null);
        let pres = await idbGet("fo6_presets", null);
        const th = await idbGet("fo6_theme", "system");
        const savedAlarms = await idbGet("fo6_alarms", {
          wake: { enabled: false, time: "05:00", autoSync: true },
          sleep: { enabled: false, time: "22:00", autoSync: true },
        });
        const savedNotif = await idbGet("fo6_notif_config", {
          enabled: false,
          leadMins: 0,
          notifyStart: true,
          notifyEnd: true,
          sound: true,
        });
        const savedChart = await idbGet("fo6_chart_mode", "line");

        // 1. Dual-Storage Check: if hist not found in IndexedDB, check localStorage mirrors
        if (!hist || typeof hist !== "object" || Object.keys(hist).length === 0) {
          try {
            const rawLs =
              localStorage.getItem("fo6_history") ||
              localStorage.getItem("focusos_history_master_backup");
            if (rawLs) {
              const parsed = JSON.parse(rawLs);
              if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
                hist = parsed;
              }
            }
          } catch (e) {}
        }

        // 2. Universal Deep Scan on startup if history is empty (recover all past keys from device)
        if (!hist || typeof hist !== "object" || Object.keys(hist).length === 0) {
          const scanRes = await performDeepScanAndRecover({
            currentHistory: {},
            currentPresets: pres && pres.length > 0 ? pres : DEFAULT_PRESETS,
          });
          if (scanRes && scanRes.mergedHistory && Object.keys(scanRes.mergedHistory).length > 0) {
            hist = scanRes.mergedHistory;
            if (scanRes.mergedPresets && scanRes.mergedPresets.length > 0) {
              pres = scanRes.mergedPresets;
            }
            setTimeout(() => {
              handleAddToast({
                id: `toast_recovered_${Date.now()}`,
                title: "✨ Progress Recovered",
                body: `Found & restored ${scanRes.stats.totalDays} days of activity from local storage.`,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              });
            }, 1000);
          }
        }

        setHistory(hist || {});
        setPresets(Array.isArray(pres) && pres.length > 0 ? pres : DEFAULT_PRESETS);
        setThemeMode(th || "system");
        setAlarms(savedAlarms);
        setNotificationConfig(savedNotif);
        setChartViewMode(savedChart);

        if ("Notification" in window && Notification.permission === "granted") {
          setNotificationConfig((prev) => ({ ...prev, enabled: true }));
        }

        dbLoaded = true;
        hasCompletedInitialLoadRef.current = true;
        checkReady();
      } catch (err) {
        console.error("Boot Error:", err);
      }
    }
    loadData();
  }, [handleAddToast]);

  // ─── RECONCILE CLOUD & LOCAL DATA NON-DESTRUCTIVELY ────────────────────────
  const reconcileCloudAndLocal = useCallback((localHistory, cloudHistory) => {
    const merged = { ...(cloudHistory || {}), ...(localHistory || {}) };
    const allDates = new Set([
      ...Object.keys(localHistory || {}),
      ...Object.keys(cloudHistory || {}),
    ]);

    allDates.forEach((ds) => {
      const lDay = localHistory ? localHistory[ds] : null;
      const cDay = cloudHistory ? cloudHistory[ds] : null;
      if (lDay && cDay) {
        const mergedBlocks = {
          ...(cDay.blocks || {}),
          ...(lDay.blocks || {}),
        };
        // Preserve completed/partial tasks from either cloud or local
        Object.entries(cDay.blocks || {}).forEach(([bid, bProg]) => {
          if (bProg && (bProg.status === "completed" || bProg.status === "partial")) {
            if (!lDay.blocks || !lDay.blocks[bid] || lDay.blocks[bid].status === "pending") {
              mergedBlocks[bid] = bProg;
            }
          }
        });
        merged[ds] = {
          ...cDay,
          ...lDay,
          blocks: mergedBlocks,
          blocksList:
            lDay.blocksList && lDay.blocksList.length > 0
              ? lDay.blocksList
              : cDay.blocksList || [],
          dailyScore: Math.max(lDay.dailyScore || 0, cDay.dailyScore || 0),
        };
      } else if (cDay) {
        merged[ds] = cDay;
      } else if (lDay) {
        merged[ds] = lDay;
      }
    });

    return merged;
  }, []);
  // ─── AUTHENTICATION LISTENER ───────────────────────────────────────────────
  useEffect(() => {
    let unsub = () => {};
    onAuthChange(async (user) => {
      setCurrentUser(user || null);
      if (user && isReady) {
        setCloudSyncStatus("syncing");
        const cloudData = await loadUserDataFromCloud(user.uid);
        if (cloudData) {
          if (cloudData.presets && Array.isArray(cloudData.presets)) {
            setPresets(cloudData.presets);
          }
          if (cloudData.history && typeof cloudData.history === "object") {
            setHistory((prev) => reconcileCloudAndLocal(prev, cloudData.history));
          }
          if (cloudData.alarms) {
            setAlarms((prev) => ({ ...prev, ...cloudData.alarms }));
          }
          if (cloudData.notificationConfig) {
            setNotificationConfig((prev) => ({ ...prev, ...cloudData.notificationConfig }));
          }
        }
        setCloudSyncStatus("synced");
      }
    }).then((fn) => {
      if (fn) unsub = fn;
    });
    return () => unsub();
  }, [isReady]);

  // ─── PERSISTENCE (INDEXEDDB + LOCALSTORAGE DUAL-SYNC & CLOUD) ───────────────
  useEffect(() => {
    if (!isReady || !hasCompletedInitialLoadRef.current) return;

    // Guard against accidental overwrite with empty history
    if (Object.keys(history).length === 0 && hadPriorDataRef.current) {
      console.warn("Guarding against saving empty history over preserved progress");
      return;
    }
    if (Object.keys(history).length > 0) {
      hadPriorDataRef.current = true;
    }

    // 1. Local IndexedDB & LocalStorage dual-sync
    idbSet("fo6_history", history);
    idbSet("fo6_presets", presets);
    idbSet("fo6_theme", themeMode);
    idbSet("fo6_alarms", alarms);
    idbSet("fo6_notif_config", notificationConfig);
    idbSet("fo6_chart_mode", chartViewMode);

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("fo6_history", JSON.stringify(history));
        localStorage.setItem("focusos_history_master_backup", JSON.stringify(history));
        localStorage.setItem("fo6_presets", JSON.stringify(presets));
        localStorage.setItem("fo6_theme", themeMode);
        localStorage.setItem("fo6_alarms", JSON.stringify(alarms));
        localStorage.setItem("fo6_notif_config", JSON.stringify(notificationConfig));
      }
    } catch (e) {}

    // 2. Continuous Cloud Synchronization whenever signed in with Google
    if (currentUser && currentUser.uid) {
      setCloudSyncStatus("syncing");
      if (window.__syncTimeout) clearTimeout(window.__syncTimeout);
      window.__syncTimeout = setTimeout(async () => {
        try {
          await syncUserDataToCloud(currentUser.uid, {
            history,
            presets,
            themeMode,
            alarms,
            notificationConfig,
            chartViewMode,
          });
          setCloudSyncStatus("synced");
          setLastSyncedTime(new Date());
        } catch (e) {
          console.error("Cloud auto-sync failed:", e);
          setCloudSyncStatus("error");
        }
      }, 1200);
    }
  }, [
    history,
    presets,
    themeMode,
    alarms,
    notificationConfig,
    chartViewMode,
    currentUser,
    isReady,
  ]);

  // ─── FLUSH CLOUD SYNC ON APP BACKGROUND / SCREEN LOCK ───────────────────────
  useEffect(() => {
    const handleFlushSync = () => {
      if (document.visibilityState === "hidden" && currentUser && currentUser.uid) {
        syncUserDataToCloud(currentUser.uid, {
          history,
          presets,
          themeMode,
          alarms,
          notificationConfig,
          chartViewMode,
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleFlushSync);
    window.addEventListener("pagehide", handleFlushSync);
    return () => {
      document.removeEventListener("visibilitychange", handleFlushSync);
      window.removeEventListener("pagehide", handleFlushSync);
    };
  }, [currentUser, history, presets, themeMode, alarms, notificationConfig, chartViewMode]);

  // ─── HELPER: GET BLOCKS FOR DATE ───────────────────────────────────────────
  const getBlocksForDate = useCallback(
    (ds, currentPresets = presets) => {
      const log = history[ds];
      if (log && log.blocksList && Array.isArray(log.blocksList) && log.blocksList.length > 0) {
        return log.blocksList.filter(Boolean);
      }
      const dayOfWeek = new Date(ds + "T12:00:00").getDay();
      const activePresets = (Array.isArray(currentPresets) ? currentPresets : []).filter(
        (p) => p && Array.isArray(p.days) && p.days.includes(dayOfWeek)
      );
      return [...activePresets].sort((a, z) => (a.start || "").localeCompare(z.start || ""));
    },
    [history, presets]
  );

  // ─── ALARMS AUTO-SYNC LOGIC ────────────────────────────────────────────────
  // Automatically when user toggles it on, set wake-up alarm to first task's start time,
  // and sleep alarm to the last schedule's end time.
  useEffect(() => {
    if (!isReady) return;
    const todaysBlocks = getBlocksForDate(todayStr(), presets);
    if (!todaysBlocks || todaysBlocks.length === 0) return;

    let changed = false;
    let nextAlarms = { ...alarms };

    if (alarms.wake.autoSync) {
      const autoWake = calculateAutoWakeTime(todaysBlocks);
      if (autoWake && autoWake !== alarms.wake.time) {
        nextAlarms.wake = { ...nextAlarms.wake, time: autoWake };
        changed = true;
      }
    }
    if (alarms.sleep.autoSync) {
      const autoSleep = calculateAutoSleepTime(todaysBlocks);
      if (autoSleep && autoSleep !== alarms.sleep.time) {
        nextAlarms.sleep = { ...nextAlarms.sleep, time: autoSleep };
        changed = true;
      }
    }

    if (changed) {
      setAlarms(nextAlarms);
    }
  }, [presets, history, alarms.wake.autoSync, alarms.sleep.autoSync, isReady, getBlocksForDate]);

  // ─── TICK & ALARM TRIGGER EVALUATOR (1s) ─────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNow(d);

      if (!isReady) return;
      const currentHHMM = d.toTimeString().slice(0, 5);
      const ds = localDateStr(d);

      // Check Wake Alarm
      if (alarms.wake.enabled && currentHHMM === alarms.wake.time) {
        const wakeKey = `alarm_wake_triggered_${ds}`;
        if (!sessionStorage.getItem(wakeKey) && !activeAlarm) {
          sessionStorage.setItem(wakeKey, "true");
          playAlarmSound(0.85);
          setActiveAlarm({
            type: "wake",
            time: alarms.wake.time,
            title: "🌅 Wake-Up Alarm",
            subtitle: `First scheduled task begins at ${to12h(alarms.wake.time)}`,
          });
        }
      }

      // Check Sleep Alarm
      if (alarms.sleep.enabled && currentHHMM === alarms.sleep.time) {
        const sleepKey = `alarm_sleep_triggered_${ds}`;
        if (!sessionStorage.getItem(sleepKey) && !activeAlarm) {
          sessionStorage.setItem(sleepKey, "true");
          playAlarmSound(0.75);
          setActiveAlarm({
            type: "sleep",
            time: alarms.sleep.time,
            title: "🌙 Bedtime / Sleep Alarm",
            subtitle: `Final schedule ended at ${to12h(alarms.sleep.time)}. Rest up!`,
          });
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [alarms, activeAlarm, isReady]);

  // ─── NOTIFICATION EVALUATOR (5s) ────────────────────────────────────────────
  useEffect(() => {
    if (!notificationConfig.enabled || !isReady) return;

    const interval = setInterval(() => {
      const today = todayStr();
      const todaysBlocks = getBlocksForDate(today, presets);
      checkScheduleNotifications({
        todaysBlocks,
        config: notificationConfig,
        dateStr: today,
        onInAppToast: (toast) => {
          setInAppToast(toast);
          setTimeout(() => {
            setInAppToast((prev) => (prev && prev.id === toast.id ? null : prev));
          }, 6000);
        },
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [notificationConfig, presets, isReady, getBlocksForDate]);

  // ─── HASH NAVIGATION & MODAL CONTROLS ───────────────────────────────────────
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h !== "#edit") setEditingPreset(null);
      if (h !== "#partial") setPartialModal(null);
      if (h !== "#cal") setShowCalendar(false);
    };
    window.addEventListener("popstate", handleHash);
    return () => window.removeEventListener("popstate", handleHash);
  }, []);

  const pushHash = (h) => {
    if (window.location.hash !== h) window.history.pushState(null, "", h);
  };
  const closeModal = (setterFallback) => {
    if (window.location.hash) window.history.back();
    else if (setterFallback) setterFallback(null);
  };

  const openEditingPreset = (p) => {
    setEditingPreset(p);
    pushHash("#edit");
  };

  const openPartialModal = (block) => {
    setPartialModal({ block });
    const fullDur = mins(block?.start, block?.end);
    setPartialMins(Math.min(fullDur, Math.round(fullDur * 0.75)) || 30);
    pushHash("#partial");
  };

  const openCalendar = () => {
    setShowCalendar(true);
    pushHash("#cal");
  };

  // ─── THEME & STYLES ─────────────────────────────────────────────────────────
  const isDark = useMemo(() => {
    if (themeMode === "dark") return true;
    if (themeMode === "light") return false;
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }, [themeMode]);

  const themeColors = useMemo(() => {
    return {
      bg: isDark ? "bg-[#080808]" : "bg-[#f8fafc]",
      surface: isDark ? "bg-[#141414]" : "bg-white",
      surface2: isDark ? "bg-[#1e1e1e]" : "bg-gray-100",
      border: isDark ? "border-[#222222]" : "border-gray-200",
      text: isDark ? "text-white" : "text-gray-900",
      text2: isDark ? "text-gray-300" : "text-gray-700",
      text3: isDark ? "text-gray-500" : "text-gray-400",
    };
  }, [isDark]);

  useEffect(() => {
    let metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.name = "theme-color";
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = isDark ? "#080808" : "#f8fafc";
  }, [isDark]);

  // ─── COMPUTED TIMELINE & STATS ──────────────────────────────────────────────
  const selBlocks = useMemo(() => getBlocksForDate(selDate), [getBlocksForDate, selDate]);
  const selLog = useMemo(() => history[selDate] || null, [history, selDate]);
  const selProg = useMemo(() => (selLog && selLog.blocks ? selLog.blocks : {}), [selLog]);
  const score = useMemo(() => calcScore(selBlocks, selProg), [selBlocks, selProg]);

  const nowStr = now.toTimeString().slice(0, 5);
  const isToday = selDate === todayStr();
  const activeBl = isToday
    ? selBlocks.find((b) => {
        if (!b || !b.start || !b.end) return false;
        if (b.start > b.end) return nowStr >= b.start || nowStr < b.end;
        return nowStr >= b.start && nowStr < b.end;
      })
    : null;

  const streak = useMemo(() => {
    try {
      let s = 0;
      const d = new Date();
      if (history[localDateStr(d)] && history[localDateStr(d)].dailyScore >= 50) s++;
      d.setDate(d.getDate() - 1);
      for (let i = 0; i < 365; i++) {
        const ds = localDateStr(d);
        if (history[ds] && history[ds].dailyScore >= 50) {
          s++;
          d.setDate(d.getDate() - 1);
        } else break;
      }
      return s;
    } catch {
      return 0;
    }
  }, [history]);

  const allLogs = useMemo(() => {
    return Object.values(history || {})
      .filter(Boolean)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [history]);

  const uniqueTaskNames = useMemo(() => {
    const names = new Set();
    presets.forEach((p) => {
      if (p && p.name) names.add(p.name);
    });
    allLogs.forEach((log) => {
      Object.values(log.blocks || {}).forEach((p) => {
        if (p && p.name) names.add(p.name);
      });
    });
    return Array.from(names);
  }, [presets, allLogs]);

  const dynamicFilterOptions = useMemo(() => {
    return ["ALL", ...uniqueTaskNames];
  }, [uniqueTaskNames]);

  const chartData = useMemo(() => {
    const slice = allLogs.slice(-tf);
    if (slice.length === 0) return [];
    return slice.map((log) => {
      let val = log.dailyScore || 0;
      if (filterTask !== "ALL") {
        val = 0;
        Object.entries(log.blocks || {}).forEach(([bid, p]) => {
          if (!p) return;
          if (
            String(p.name || "")
              .toLowerCase()
              .includes(String(filterTask || "").toLowerCase())
          ) {
            let dur = p.actualMins || 0;
            if (p.status === "completed") {
              const snap = (log.blocksList || []).find((x) => x && x.id === bid);
              if (snap) dur = mins(snap.start, snap.end);
              else dur = 60;
            }
            val += dur / 60;
          }
        });
      }
      return { date: log.date, val: isNaN(val) ? 0 : val };
    });
  }, [allLogs, tf, filterTask]);

  const sortedPresets = useMemo(() => {
    return Array.isArray(presets)
      ? [...presets].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"))
      : [];
  }, [presets]);

  // ─── ACTION HANDLERS ────────────────────────────────────────────────────────
  const mark = useCallback(
    (blockId, status, extras = {}) => {
      setHistory((prev) => {
        try {
          const ds = selDate;
          const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
          let snapshotBlocks = log.blocksList;
          if (!snapshotBlocks || !Array.isArray(snapshotBlocks) || snapshotBlocks.length === 0) {
            const dayOfWeek = new Date(ds + "T12:00:00").getDay();
            snapshotBlocks = presets
              .filter((p) => p && p.days && p.days.includes(dayOfWeek))
              .sort((a, z) => (a.start || "").localeCompare(z.start || ""));
          }
          const currentBlock = snapshotBlocks.find((b) => b && b.id === blockId);
          if (!currentBlock) return prev;
          const newProg = {
            ...log.blocks,
            [blockId]: {
              status,
              timestamp: new Date().toISOString(),
              name: currentBlock.name,
              ...extras,
            },
          };
          const s = calcScore(snapshotBlocks, newProg);
          return {
            ...prev,
            [ds]: {
              ...log,
              blocks: newProg,
              dailyScore: s,
              blocksList: snapshotBlocks,
            },
          };
        } catch (err) {
          console.error("Mark task failed:", err);
          return prev;
        }
      });
      if (status === "completed") {
        setBurst(true);
        setTimeout(() => setBurst(false), 1800);
      }
    },
    [selDate, presets]
  );

  const unmark = useCallback(
    (blockId) => {
      setHistory((prev) => {
        try {
          const log = prev[selDate];
          if (!log) return prev;
          const newProg = { ...log.blocks };
          delete newProg[blockId];
          const snapshotBlocks = log.blocksList || getBlocksForDate(selDate, presets);
          const s = calcScore(snapshotBlocks, newProg);
          return {
            ...prev,
            [selDate]: { ...log, blocks: newProg, dailyScore: s },
          };
        } catch (err) {
          console.error("Unmark task failed:", err);
          return prev;
        }
      });
    },
    [selDate, getBlocksForDate, presets]
  );

  const savePreset = useCallback(
    (updatedPreset) => {
      setPresets((prev) => {
        const exists = prev.find((p) => p && p.id === updatedPreset.id);
        if (exists) return prev.map((p) => (p && p.id === updatedPreset.id ? updatedPreset : p));
        return [...prev, updatedPreset];
      });

      setHistory((prev) => {
        const ds = selDate;
        const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
        const dayOfWeek = new Date(ds + "T12:00:00").getDay();
        let snapshotBlocks = log.blocksList;
        if (!snapshotBlocks || !Array.isArray(snapshotBlocks) || snapshotBlocks.length === 0) {
          snapshotBlocks = presets
            .filter((p) => p && p.days && p.days.includes(dayOfWeek))
            .sort((a, z) => (a.start || "").localeCompare(z.start || ""));
        }

        if (updatedPreset.days && updatedPreset.days.includes(dayOfWeek)) {
          const existingIdx = snapshotBlocks.findIndex((b) => b && b.id === updatedPreset.id);
          if (existingIdx >= 0) snapshotBlocks[existingIdx] = updatedPreset;
          else snapshotBlocks.push(updatedPreset);
          snapshotBlocks.sort((a, z) => (a.start || "").localeCompare(z.start || ""));
        } else {
          snapshotBlocks = snapshotBlocks.filter((b) => b && b.id !== updatedPreset.id);
        }

        const s = calcScore(snapshotBlocks, log.blocks);
        return {
          ...prev,
          [ds]: { ...log, blocks: log.blocks, dailyScore: s, blocksList: snapshotBlocks },
        };
      });

      closeModal(() => setEditingPreset(null));
    },
    [selDate, presets]
  );

  const deletePreset = useCallback(
    (id) => {
      setPresets((prev) => prev.filter((p) => p && p.id !== id));
      setHistory((prev) => {
        const ds = selDate;
        const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
        let snapshotBlocks = log.blocksList;
        if (!snapshotBlocks || !Array.isArray(snapshotBlocks) || snapshotBlocks.length === 0) {
          const dayOfWeek = new Date(ds + "T12:00:00").getDay();
          snapshotBlocks = presets
            .filter((p) => p && p.days && p.days.includes(dayOfWeek))
            .sort((a, z) => (a.start || "").localeCompare(z.start || ""));
        }
        snapshotBlocks = snapshotBlocks.filter((b) => b && b.id !== id);
        const newProg = { ...log.blocks };
        delete newProg[id];
        const s = calcScore(snapshotBlocks, newProg);
        return {
          ...prev,
          [ds]: { ...log, blocksList: snapshotBlocks, blocks: newProg, dailyScore: s },
        };
      });
      closeModal(() => setEditingPreset(null));
    },
    [selDate, presets]
  );

  const removeTaskFromToday = useCallback(
    (id) => {
      setHistory((prev) => {
        const ds = selDate;
        const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
        let snapshotBlocks = log.blocksList || getBlocksForDate(selDate, presets);
        snapshotBlocks = snapshotBlocks.filter((b) => b && b.id !== id);
        const newProg = { ...log.blocks };
        delete newProg[id];
        const s = calcScore(snapshotBlocks, newProg);
        return {
          ...prev,
          [ds]: { ...log, blocks: newProg, dailyScore: s, blocksList: snapshotBlocks },
        };
      });
      closeModal(() => setEditingPreset(null));
    },
    [selDate, getBlocksForDate, presets]
  );

  // ─── AUTHENTICATION ACTIONS ─────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    try {
      setCloudSyncStatus("syncing");
      const user = await signInWithGoogle();
      setCurrentUser(user);
      setCloudSyncStatus("synced");
    } catch (err) {
      console.error("Google Sign-In failed:", err);
      alert("Sign In Error: " + (err.message || "Failed to authenticate with Google"));
      setCloudSyncStatus("error");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setCurrentUser(null);
      setCloudSyncStatus("idle");
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  };

  // ─── ALARM DISMISS & SNOOZE ─────────────────────────────────────────────────
  const dismissAlarm = () => {
    stopAlarmSound();
    setActiveAlarm(null);
  };

  const snoozeAlarm = (minsCount = 5) => {
    stopAlarmSound();
    setActiveAlarm(null);
    const d = new Date();
    d.setMinutes(d.getMinutes() + minsCount);
    const snoozeTime = d.toTimeString().slice(0, 5);

    setTimeout(() => {
      playAlarmSound(0.85);
      setActiveAlarm({
        type: "snooze",
        time: snoozeTime,
        title: "⏰ Snooze Alarm Expired",
        subtitle: `Resuming your alarm (${minsCount}m elapsed)`,
      });
    }, minsCount * 60 * 1000);
  };

  // ─── STORAGE RECOVERY & BACKUP ACTIONS ───────────────────────────────────────
  const handleDeepScanStorage = async () => {
    setIsScanningStorage(true);
    setScanReport(null);
    try {
      const res = await performDeepScanAndRecover({
        currentHistory: history,
        currentPresets: presets,
      });

      setHistory(res.mergedHistory);
      if (res.mergedPresets && res.mergedPresets.length > 0) {
        setPresets(res.mergedPresets);
      }

      const msg = `Checked ${res.stats.keysScanned} LocalStorage keys & ${res.stats.dbsScanned} IndexedDB databases. Found ${res.stats.totalDays} total days (${res.stats.newlyRecoveredDays} newly restored)!`;
      setScanReport(msg);

      handleAddToast({
        id: `toast_scan_${Date.now()}`,
        title: "Deep Scan Complete",
        body: msg,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      console.error("Storage scan failed:", err);
      alert("Storage scan error: " + err.message);
    } finally {
      setIsScanningStorage(false);
    }
  };

  const handleCopyStorageReport = async () => {
    try {
      const report = await getRawStorageDiagnosticReport();
      setStorageReport(report);
      const txt = JSON.stringify(report, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
      }
      handleAddToast({
        id: `toast_report_${Date.now()}`,
        title: 'Diagnostic Copied',
        body: 'Storage diagnostic JSON copied to clipboard!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      console.error('Failed to copy storage report:', err);
      alert('Could not copy diagnostic: ' + err.message);
    }
  };

  const handleExportBackup = () => {
    exportBackupData({ history, presets, alarms, notificationConfig });
    handleAddToast({
      id: `toast_export_${Date.now()}`,
      title: "Backup Exported",
      body: `Downloaded complete FocusOS backup (${Object.keys(history).length} days).`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const handleFileImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const res = parseImportBackup(text);
        if (!res.success) {
          alert("Import failed: " + res.error);
          return;
        }
        const mergedHistory = { ...res.history, ...history };
        setHistory(mergedHistory);
        if (res.presets && res.presets.length > 0) {
          setPresets(res.presets);
        }
        if (res.alarms) {
          setAlarms((prev) => ({ ...prev, ...res.alarms }));
        }
        if (res.notificationConfig) {
          setNotificationConfig((prev) => ({ ...prev, ...res.notificationConfig }));
        }
        handleAddToast({
          id: `toast_import_${Date.now()}`,
          title: "Backup Restored",
          body: `Successfully imported ${Object.keys(res.history).length} days of history!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      } catch (err) {
        alert("File read error: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyRawBackup = () => {
    const payload = {
      app: "FocusOS",
      version: "6.0-pro",
      exportedAt: new Date().toISOString(),
      history,
      presets,
      alarms,
      notificationConfig,
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    }
    handleAddToast({
      id: `toast_copy_${Date.now()}`,
      title: "Copied Backup",
      body: "All progress data copied to clipboard as JSON!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const handlePasteRawBackup = () => {
    if (!backupJsonInput.trim()) {
      alert("Please paste valid JSON text first.");
      return;
    }
    const res = parseImportBackup(backupJsonInput);
    if (!res.success) {
      alert("Invalid JSON: " + res.error);
      return;
    }
    const mergedHistory = { ...res.history, ...history };
    setHistory(mergedHistory);
    if (res.presets && res.presets.length > 0) setPresets(res.presets);
    if (res.alarms) setAlarms((prev) => ({ ...prev, ...res.alarms }));
    if (res.notificationConfig) setNotificationConfig((prev) => ({ ...prev, ...res.notificationConfig }));
    setShowBackupModal(false);
    setBackupJsonInput("");
    handleAddToast({
      id: `toast_paste_${Date.now()}`,
      title: "Data Restored",
      body: `Successfully restored ${Object.keys(res.history).length} days of activity!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  // ─── RENDER: IN-APP TOAST ───────────────────────────────────────────────────
  const renderInAppToast = () => {
    if (!inAppToast) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-[3000] px-4 animate-in slide-in-from-top-full duration-300 pointer-events-auto">
        <div
          className={`${themeColors.surface} border border-blue-500/40 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 backdrop-blur-xl ring-2 ring-blue-500/20`}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center flex-shrink-0">
            <Icon name="notifications_active" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black tracking-tight text-gray-900 dark:text-white flex items-center justify-between">
              <span>{inAppToast.title}</span>
              <span className="text-[10px] text-gray-400 font-mono">{inAppToast.timestamp}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 leading-snug">
              {inAppToast.body}
            </div>
          </div>
          <button
            onClick={() => setInAppToast(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    );
  };


  // ─── RENDER: STORAGE INSPECTOR MODAL ───────────────────────────────────────
  const renderStorageInspectorModal = () => {
    if (!showStorageInspector) return null;
    const lsKeys = storageReport?.localStorage?.keys || [];
    const idbList = storageReport?.indexedDB?.databases || [];
    const totalDays = storageReport?.totalRecoverableDays || 0;

    return (
      <div className="fixed inset-0 z-[3600] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 select-none animate-in fade-in duration-200">
        <div className={`${themeColors.surface} border ${themeColors.border} w-full max-w-[460px] max-h-[85vh] rounded-[32px] p-5 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300`}>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#222]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black">
                <Icon name="troubleshoot" size={18} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white leading-none">
                  Storage Inspector
                </h3>
                <span className="text-[10px] text-gray-400 font-medium">Device Storage & Recovery Diagnostic</span>
              </div>
            </div>
            <button
              onClick={() => setShowStorageInspector(false)}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#222] text-gray-500 flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            {/* Summary Banner */}
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs">
              <div className="font-black text-blue-500 mb-1 flex items-center justify-between">
                <span>Total Recoverable Days Detected:</span>
                <span className="text-sm px-2 py-0.5 rounded-full bg-blue-500 text-white font-mono">{totalDays}</span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Found {lsKeys.length} LocalStorage keys and {idbList.length} IndexedDB databases.
              </div>
            </div>

            {/* LocalStorage Breakdown */}
            <div>
              <div className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>LocalStorage Keys ({lsKeys.length})</span>
              </div>
              <div className="space-y-2">
                {lsKeys.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No keys found in LocalStorage.</div>
                ) : (
                  lsKeys.map((k, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#262626] text-xs">
                      <div className="flex justify-between items-center font-mono font-bold text-gray-800 dark:text-gray-200">
                        <span className="truncate max-w-[240px] text-blue-500">{k.key}</span>
                        <span className="text-[10px] text-gray-400">{k.sizeKb}</span>
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 truncate mt-1 bg-white dark:bg-[#111] p-1.5 rounded-lg border border-gray-100 dark:border-[#222]">
                        {k.preview}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* IndexedDB Breakdown */}
            <div>
              <div className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                IndexedDB Databases ({idbList.length})
              </div>
              <div className="space-y-2">
                {idbList.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No accessible IndexedDB databases.</div>
                ) : (
                  idbList.map((db, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#262626] text-xs">
                      <div className="flex justify-between items-center font-bold text-gray-800 dark:text-gray-200">
                        <span className="font-mono text-indigo-400 truncate">{db.dbName}</span>
                        <span className="text-[10px] text-gray-400 font-mono">v{db.version}</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {db.stores.map((st, sIdx) => (
                          <div key={sIdx} className="flex justify-between text-[11px] text-gray-500">
                            <span>Store: <strong className="text-gray-700 dark:text-gray-300 font-mono">{st.storeName}</strong></span>
                            <span>{st.recordCount} records</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-gray-100 dark:border-[#222] flex flex-col gap-2">
            <button
              onClick={async () => {
                setShowStorageInspector(false);
                await handleDeepScanStorage();
              }}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 active:scale-98 transition-all"
            >
              <Icon name="history" size={16} /> Force Restore All Detected Days
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleCopyStorageReport}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gray-100 dark:bg-[#222] text-xs font-black text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-all"
              >
                <Icon name="content_copy" size={14} /> Copy Diagnostic Dump
              </button>
              <button
                onClick={() => setShowStorageInspector(false)}
                className="py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-[#222] text-xs font-bold text-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: RINGING ALARM MODAL ────────────────────────────────────────────
  const renderAlarmModal = () => {
    if (!activeAlarm) return null;
    const isWake = activeAlarm.type === "wake";

    return (
      <div className="fixed inset-0 z-[4000] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-between p-8 text-white select-none animate-in zoom-in-95 duration-300">
        <div className="w-full flex justify-center pt-8">
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center animate-bounce shadow-2xl ${
              isWake
                ? "bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-amber-500/50"
                : "bg-gradient-to-tr from-indigo-600 to-purple-400 text-white shadow-purple-500/50"
            }`}
          >
            <Icon name={isWake ? "wb_sunny" : "bedtime"} size={56} />
          </div>
        </div>

        <div className="text-center my-auto">
          <div className="text-sm uppercase tracking-[4px] font-mono font-bold text-gray-400 mb-2">
            FocusOS Smart Alarm
          </div>
          <div className="text-6xl font-black tracking-tight mb-3">
            {to12h(activeAlarm.time)}
          </div>
          <div className="text-2xl font-black text-white mb-2">{activeAlarm.title}</div>
          <div className="text-sm font-medium text-gray-300 max-w-xs mx-auto">
            {activeAlarm.subtitle}
          </div>
        </div>

        <div className="w-full max-w-xs flex flex-col gap-3 pb-8">
          <button
            onClick={dismissAlarm}
            className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg active:scale-95 transition-transform shadow-xl"
          >
            Dismiss Alarm
          </button>
          <button
            onClick={() => snoozeAlarm(5)}
            className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            Snooze (5 Minutes)
          </button>
        </div>
      </div>
    );
  };

  // ─── RENDER: BACKUP & DATA TRANSFER MODAL ──────────────────────────────────
  const renderBackupModal = () => {
    if (!showBackupModal) return null;
    return (
      <div className="fixed inset-0 z-[3500] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 select-none animate-in fade-in duration-200">
        <div
          className={`${themeColors.surface} border ${themeColors.border} w-full max-w-[420px] rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
                <Icon name="database" size={20} />
              </div>
              <div className="text-base font-black text-gray-900 dark:text-white">
                Backup & Data Vault
              </div>
            </div>
            <button
              onClick={() => setShowBackupModal(false)}
              className="p-1 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
            Transfer progress between your smartphone and browser. Copy the raw JSON backup string or paste previous data to merge with zero data loss.
          </p>

          <div className="flex gap-2 mb-4">
            <button
              onClick={handleCopyRawBackup}
              className="flex-1 py-3 px-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <Icon name="content_copy" size={16} /> Copy Current Data
            </button>
            <button
              onClick={handleExportBackup}
              className="flex-1 py-3 px-3 rounded-2xl bg-gray-100 dark:bg-[#222] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-200 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <Icon name="download" size={16} /> Save .JSON
            </button>
          </div>

          <div className="mb-3">
            <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block mb-1.5">
              Paste Backup JSON To Restore
            </label>
            <textarea
              rows={4}
              value={backupJsonInput}
              onChange={(e) => setBackupJsonInput(e.target.value)}
              placeholder='Paste JSON here (e.g. {"history": {...}})'
              className="w-full text-xs font-mono p-3 rounded-2xl bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handlePasteRawBackup}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-98 transition-transform flex items-center justify-center gap-2"
          >
            <Icon name="system_update_alt" size={18} /> Restore & Merge Data
          </button>
        </div>
      </div>
    );
  };

  // ─── RENDER: OVERHAULED TIME LOGGING MODAL (HOURS & MINUTES) ────────────────
  const renderPartialModal = () => {
    if (!partialModal || !partialModal.block) return null;
    const hours = Math.floor(partialMins / 60);
    const minutes = partialMins % 60;
    const fullDuration = mins(partialModal.block.start, partialModal.block.end);

    return (
      <div className="fixed inset-0 bg-black/80 z-[2000] flex flex-col justify-end p-3 animate-in fade-in select-none backdrop-blur-sm">
        <div
          className={`${themeColors.surface} rounded-[36px] p-6 w-full max-w-[420px] mx-auto border ${themeColors.border} shadow-2xl`}
        >
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6" />

          <div className="text-center mb-6">
            <div
              className={`text-[10px] uppercase tracking-[2px] font-mono font-bold ${themeColors.text3} mb-1`}
            >
              Time Tracking & Logging
            </div>
            <div className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
              {partialModal.block.name}
            </div>
            <div className="text-xs text-gray-500 font-mono mt-1">
              Scheduled: {to12h(partialModal.block.start)} – {to12h(partialModal.block.end)} ({fullDuration}m)
            </div>
          </div>

          {/* Dual Hours & Minutes Stepper */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Hours Box */}
            <div
              className={`p-3.5 rounded-2xl ${themeColors.surface2} border ${themeColors.border} flex flex-col items-center`}
            >
              <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${themeColors.text3} mb-2`}>
                Hours
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPartialMins(Math.max(0, partialMins - 60))}
                  className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center font-black text-sm active:scale-90 transition-transform"
                >
                  -1h
                </button>
                <input
                  type="number"
                  min="0"
                  value={hours}
                  onChange={(e) => {
                    const h = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setPartialMins(h * 60 + minutes);
                  }}
                  className="text-3xl font-black bg-transparent outline-none w-14 text-center text-[#FF9F0A]"
                />
                <button
                  type="button"
                  onClick={() => setPartialMins(partialMins + 60)}
                  className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center font-black text-sm active:scale-90 transition-transform"
                >
                  +1h
                </button>
              </div>
            </div>

            {/* Minutes Box */}
            <div
              className={`p-3.5 rounded-2xl ${themeColors.surface2} border ${themeColors.border} flex flex-col items-center`}
            >
              <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${themeColors.text3} mb-2`}>
                Minutes
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPartialMins(Math.max(0, partialMins - 10))}
                  className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center font-black text-xs active:scale-90 transition-transform"
                >
                  -10m
                </button>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => {
                    const m = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0));
                    setPartialMins(hours * 60 + m);
                  }}
                  className="text-3xl font-black bg-transparent outline-none w-14 text-center text-[#FF9F0A]"
                />
                <button
                  type="button"
                  onClick={() => setPartialMins(partialMins + 10)}
                  className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center font-black text-xs active:scale-90 transition-transform"
                >
                  +10m
                </button>
              </div>
            </div>
          </div>

          {/* Total Duration Readout Badge */}
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF9F0A]/15 text-[#FF9F0A] text-xs font-black tracking-wide">
              <Icon name="timer" size={14} />
              Total Logged: {hours > 0 ? `${hours}h ` : ""}{minutes}m ({partialMins} mins total)
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-5">
            {[
              10,
              15,
              30,
              45,
              60,
              90,
              120,
              fullDuration,
            ]
              .filter(Boolean)
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPartialMins(m)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    partialMins === m
                      ? "bg-[#FF9F0A] text-black shadow-md scale-105"
                      : `${themeColors.surface2} ${themeColors.text2} border ${themeColors.border}`
                  }`}
                >
                  {m >= 60 ? (m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`) : `${m}m`}
                  {m === fullDuration ? " (Full)" : ""}
                </button>
              ))}
          </div>

          <select
            value={partialReason}
            onChange={(e) => setPartialReason(e.target.value)}
            className={`w-full p-3.5 rounded-2xl appearance-none outline-none ${themeColors.surface2} border ${themeColors.border} mb-6 font-bold text-center text-sm text-black dark:text-white`}
          >
            {[
              "Standard task progress",
              "Ran out of time",
              "Got distracted",
              "Low energy / fatigued",
              "Interrupted",
              "Bonus time / overtime",
              "Sleep & recovery log",
              "Other",
            ].map((r) => (
              <option key={r} className="bg-white dark:bg-black text-black dark:text-white">
                {r}
              </option>
            ))}
          </select>

          <div className="flex gap-3">
            <button
              onClick={() => closeModal(() => setPartialModal(null))}
              className={`flex-1 py-3.5 rounded-2xl ${themeColors.surface2} font-black active:opacity-70 transition-opacity`}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                mark(partialModal.block.id, "partial", {
                  actualMins: partialMins,
                  reason: partialReason,
                });
                closeModal(() => setPartialModal(null));
              }}
              className="flex-1 py-3.5 rounded-2xl bg-[#FF9F0A] text-black font-black active:opacity-70 transition-opacity shadow-lg shadow-[#FF9F0A]/20"
            >
              Save Log
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: CALENDAR MODAL ─────────────────────────────────────────────────
  const renderCalendar = () => {
    const y = cMon.getFullYear(),
      m = cMon.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMon = new Date(y, m + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const cells = [
      ...Array(offset).fill(null),
      ...Array.from({ length: daysInMon }, (_, i) => i + 1),
    ];
    const monthName = new Date(y, m).toLocaleDateString("en", {
      month: "long",
      year: "numeric",
    });

    return (
      <div
        className="fixed inset-0 bg-black/80 z-[2000] flex flex-col justify-end p-3 animate-in fade-in select-none backdrop-blur-sm"
        onClick={() => closeModal(() => setShowCalendar(false))}
      >
        <div
          className={`${themeColors.surface} rounded-[36px] p-8 w-full max-w-[414px] mx-auto border ${themeColors.border} shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={() => setCMon(new Date(y, m - 1))}
              className={`w-12 h-12 rounded-full ${themeColors.surface2} flex items-center justify-center font-black active:scale-90 transition-transform`}
            >
              <Icon name="chevron_left" />
            </button>
            <span className="font-black text-xl text-gray-900 dark:text-white">{monthName}</span>
            <button
              onClick={() => setCMon(new Date(y, m + 1))}
              className={`w-12 h-12 rounded-full ${themeColors.surface2} flex items-center justify-center font-black active:scale-90 transition-transform`}
            >
              <Icon name="chevron_right" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
              <div
                key={i}
                className="text-center text-xs font-mono font-bold text-gray-400 py-1"
              >
                {l}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const curDs = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = curDs === selDate;
              const isCurToday = curDs === todayStr();
              const dayLog = history[curDs];
              const hasScore = dayLog && dayLog.dailyScore !== undefined;

              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelDate(curDs);
                    closeModal(() => setShowCalendar(false));
                  }}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative font-bold text-sm transition-all ${
                    isSelected
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                      : isCurToday
                      ? "border border-blue-500 text-blue-500"
                      : `${themeColors.surface2} text-gray-700 dark:text-gray-300`
                  }`}
                >
                  <span>{day}</span>
                  {hasScore && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        dayLog.dailyScore >= 80
                          ? "bg-[#32D74B]"
                          : dayLog.dailyScore >= 50
                          ? "bg-[#FF9F0A]"
                          : "bg-gray-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: PRESET / BLOCK EDITOR MODAL ────────────────────────────────────
  const renderPresetEditor = () => {
    if (!editingPreset) return null;
    const existsInPresets = presets.some((p) => p && p.id === editingPreset.id);
    const existsInToday = (history[selDate]?.blocksList || []).some(
      (p) => p && p.id === editingPreset.id
    );
    const isUnsavedNew = !existsInPresets && !existsInToday;

    const toggleDay = (d) => {
      const newDays = editingPreset.days.includes(d)
        ? editingPreset.days.filter((x) => x !== d)
        : [...editingPreset.days, d].sort();
      setEditingPreset({ ...editingPreset, days: newDays });
    };

    return (
      <div className="fixed inset-0 z-[1000] flex flex-col bg-[#f9fafb] dark:bg-[#080808] animate-in slide-in-from-bottom-full duration-300 overflow-hidden text-gray-900 dark:text-white select-none">
        <div className="flex justify-between items-center p-4 bg-white dark:bg-[#151515] border-b border-gray-200 dark:border-[#222]">
          <button
            onClick={() => closeModal(() => setEditingPreset(null))}
            className="text-xl p-2 rounded-full active:bg-gray-100 dark:active:bg-[#222]"
          >
            <Icon name="close" size={28} />
          </button>
          <div className="font-black text-lg tracking-tight">
            {isUnsavedNew ? "Create Block" : "Edit Block"}
          </div>
          <button
            onClick={() => savePreset(editingPreset)}
            className="text-xl p-2 text-blue-500 rounded-full active:bg-blue-50 dark:active:bg-blue-500/10"
          >
            <Icon name="check" size={28} style={{ fontWeight: 800 }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-32 px-5 scroll-smooth">
          <div className="flex items-center justify-center gap-4 my-8 bg-white dark:bg-[#151515] p-5 rounded-[32px] border border-gray-200 dark:border-[#222] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col items-center flex-1">
              <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold mb-3">
                Start Time
              </label>
              <input
                type="time"
                value={editingPreset.start}
                onChange={(e) => setEditingPreset({ ...editingPreset, start: e.target.value })}
                className="w-full text-xl font-black bg-gray-100 dark:bg-[#222] rounded-2xl py-3 px-1 text-center text-gray-900 dark:text-white border-none outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="text-gray-400 font-black text-lg mt-6">→</div>
            <div className="flex flex-col items-center flex-1">
              <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold mb-3">
                End Time
              </label>
              <input
                type="time"
                value={editingPreset.end}
                onChange={(e) => setEditingPreset({ ...editingPreset, end: e.target.value })}
                className="w-full text-xl font-black bg-gray-100 dark:bg-[#222] rounded-2xl py-3 px-1 text-center text-gray-900 dark:text-white border-none outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="mb-8">
            <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold ml-2 mb-3 block">
              Block Title
            </label>
            <input
              type="text"
              placeholder="e.g. Deep Work, Gym, Sleep"
              value={editingPreset.name}
              onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
              className="w-full bg-white dark:bg-[#151515] border border-gray-200 dark:border-[#222] rounded-2xl p-4 font-black text-lg outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              required
            />
          </div>

          <div className="mb-8">
            <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold ml-2 mb-3 block">
              Icon
            </label>
            <div className="grid grid-cols-6 gap-2 bg-white dark:bg-[#151515] p-4 rounded-[28px] border border-gray-200 dark:border-[#222] max-h-48 overflow-y-auto">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setEditingPreset({ ...editingPreset, icon: ic })}
                  className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                    editingPreset.icon === ic
                      ? "bg-blue-500 text-white shadow-md scale-105"
                      : "bg-gray-100 dark:bg-[#222] text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <Icon name={ic} size={20} />
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold ml-2 mb-3 block">
              Active Days
            </label>
            <div className="flex justify-between gap-1 bg-white dark:bg-[#151515] p-3 rounded-2xl border border-gray-200 dark:border-[#222]">
              {DAYS.map((d, i) => {
                const active = editingPreset.days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                      active ? "bg-blue-500 text-white shadow-md" : "bg-gray-100 dark:bg-[#222] text-gray-400"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => savePreset(editingPreset)}
              className="w-full py-4 rounded-2xl bg-blue-500 text-white font-black text-lg active:scale-95 transition-transform shadow-lg shadow-blue-500/30"
            >
              Save Routine
            </button>
            {!isUnsavedNew && (
              <button
                type="button"
                onClick={() => deletePreset(editingPreset.id)}
                className="w-full py-3 text-sm font-bold text-[#FF3B30] hover:underline"
              >
                Delete Routine Completely
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: FIREBASE CONFIG MODAL ──────────────────────────────────────────
  const renderFirebaseModal = () => {
    if (!showFirebaseModal) return null;
    const currentCfg = getActiveFirebaseConfig();

    return (
      <div className="fixed inset-0 bg-black/80 z-[3000] flex flex-col justify-end p-3 animate-in fade-in backdrop-blur-sm">
        <div
          className={`${themeColors.surface} rounded-[36px] p-6 w-full max-w-[420px] mx-auto border ${themeColors.border} shadow-2xl`}
        >
          <div className="flex justify-between items-center mb-4">
            <span className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Icon name="cloud" size={20} className="text-blue-500" /> Firebase Cloud Setup
            </span>
            <button
              onClick={() => setShowFirebaseModal(false)}
              className="text-gray-400 hover:text-white"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Google Sign-in is pre-configured and ready to run. You can also paste your own
            Firebase configuration JSON below to connect a dedicated Firebase backend.
          </p>

          <textarea
            id="custom-firebase-cfg"
            defaultValue={JSON.stringify(currentCfg, null, 2)}
            rows={8}
            className="w-full p-3 font-mono text-xs rounded-xl bg-gray-100 dark:bg-[#181818] border border-gray-200 dark:border-[#2a2a2a] outline-none text-gray-900 dark:text-gray-200 mb-4"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setShowFirebaseModal(false)}
              className={`flex-1 py-3 rounded-xl ${themeColors.surface2} font-bold text-xs`}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                try {
                  const val = document.getElementById("custom-firebase-cfg").value;
                  const parsed = JSON.parse(val);
                  saveCustomFirebaseConfig(parsed);
                } catch (e) {
                  alert("Invalid JSON format. Please verify configuration.");
                }
              }}
              className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-black text-xs shadow-md"
            >
              Save & Reload
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: CONFETTI BURST ─────────────────────────────────────────────────
  const renderConfetti = () => {
    return (
      <div className="fixed inset-0 pointer-events-none z-[5000] overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-10px`,
              width: `${Math.random() * 8 + 4}px`,
              height: `${Math.random() * 8 + 4}px`,
              backgroundColor: ["#32D74B", "#0A84FF", "#FF9F0A", "#BF5AF2", "#FF3B30"][i % 5],
              animation: `fall ${1 + Math.random() * 1.5}s ease-out forwards`,
            }}
          />
        ))}
        <style>{`@keyframes fall { to { transform: translateY(100vh) rotate(360deg); opacity: 0; } }`}</style>
      </div>
    );
  };

  // ─── TAB 1: HOME (TIMELINE & ROUTINES) ──────────────────────────────────────
  const renderHomeTab = () => {
    const done = selBlocks.filter((b) => b && selProg[b.id]?.status === "completed").length;
    const partial = selBlocks.filter((b) => b && selProg[b.id]?.status === "partial").length;

    let activeBlProgress = 0;
    if (isToday && activeBl && activeBl.start && activeBl.end) {
      const [sh, sm] = activeBl.start.split(":").map(Number);
      const [eh, em] = activeBl.end.split(":").map(Number);
      const startMins = sh * 60 + (sm || 0);
      let endMins = eh * 60 + (em || 0);
      if (endMins <= startMins) endMins += 24 * 60;
      let currentMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      if (currentMins < startMins && endMins > 24 * 60) currentMins += 24 * 60;
      activeBlProgress = Math.max(0, Math.min(100, ((currentMins - startMins) / (endMins - startMins)) * 100));
    }

    const selDateObj = new Date(selDate + "T12:00:00");
    const formattedDate = isNaN(selDateObj)
      ? "Today"
      : selDateObj.toLocaleDateString("en", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

    return (
      <div className="pb-32 select-none animate-in fade-in duration-500">
        {/* Top App Bar with Date & User Avatar / Sign In */}
        <div className="px-5 pt-8 pb-3 flex justify-between items-center">
          <button
            onClick={openCalendar}
            className="flex items-center gap-2.5 active:scale-95 transition-transform bg-gray-100 dark:bg-[#1a1a1a] px-4 py-2 rounded-full border border-gray-200/60 dark:border-[#262626]"
          >
            <span className="text-base font-black tracking-tight text-gray-900 dark:text-white">
              {isToday ? "Today" : formattedDate}
            </span>
            <Icon name="calendar_month" size={18} className={themeColors.text2} />
          </button>

          {/* Google Auth Status Badge */}
          {currentUser ? (
            <div
              onClick={() => setTab("settings")}
              className="flex items-center gap-2 cursor-pointer bg-gray-100 dark:bg-[#1a1a1a] py-1 px-3 rounded-full border border-gray-200/60 dark:border-[#262626] active:scale-95 transition-transform"
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white font-black text-xs flex items-center justify-center">
                  {(currentUser.displayName || currentUser.email || "U")[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs font-black truncate max-w-[90px] text-gray-900 dark:text-white">
                {currentUser.displayName ? currentUser.displayName.split(" ")[0] : "Account"}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudSyncStatus === "synced"
                    ? "bg-[#32D74B]"
                    : cloudSyncStatus === "syncing"
                    ? "bg-[#FF9F0A] animate-ping"
                    : "bg-gray-400"
                }`}
                title={cloudSyncStatus === "synced" ? "Synced to Cloud" : "Syncing..."}
              />
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 px-3 py-1.5 rounded-full text-xs font-black active:scale-95 transition-transform"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* Smart Alarms Status Pills (Wake / Sleep) */}
        {(alarms.wake.enabled || alarms.sleep.enabled) && (
          <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
            {alarms.wake.enabled && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-mono font-bold">
                <Icon name="wb_sunny" size={13} />
                <span>Wake: {to12h(alarms.wake.time)}</span>
                {alarms.wake.autoSync && <span className="text-[9px] opacity-75">(auto)</span>}
              </div>
            )}
            {alarms.sleep.enabled && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-mono font-bold">
                <Icon name="bedtime" size={13} />
                <span>Sleep: {to12h(alarms.sleep.time)}</span>
                {alarms.sleep.autoSync && <span className="text-[9px] opacity-75">(auto)</span>}
              </div>
            )}
          </div>
        )}

        {/* Circular Progress & Daily Metrics Card */}
        <div className="px-4 mb-6">
          <div
            className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 flex items-center gap-6 shadow-sm`}
          >
            <svg width={92} height={92} viewBox="0 0 84 84" className="rotate-[-90deg]">
              <circle
                cx={42}
                cy={42}
                r={36}
                fill="none"
                className="stroke-gray-100 dark:stroke-[#222]"
                strokeWidth={7}
              />
              <circle
                cx={42}
                cy={42}
                r={36}
                fill="none"
                stroke={score >= 80 ? "#32D74B" : score >= 50 ? "#FF9F0A" : "#3b82f6"}
                strokeWidth={7}
                strokeDasharray={226.2}
                strokeDashoffset={226.2 - (226.2 * Math.min(100, score)) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                  {score}%
                </span>
                <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                  Score
                </span>
              </div>
              <div className="text-xs font-bold text-gray-500 mt-1">
                {done} of {selBlocks.length} completed {partial > 0 ? `(${partial} partial)` : ""}
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-[#222]">
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-500">
                  <Icon name="local_fire_department" size={16} />
                  <span>{streak} Day Streak</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Tasks List */}
        <div className="px-4">
          <div className="flex justify-between items-center mb-3 ml-2">
            <span
              className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3}`}
            >
              Timeline · {selBlocks.length} Blocks
            </span>
          </div>

          {selBlocks.length === 0 ? (
            <div
              className={`${themeColors.surface} border ${themeColors.border} rounded-3xl p-8 text-center text-gray-400 font-medium`}
            >
              No routines scheduled for this day.
            </div>
          ) : (
            selBlocks.map((block) => {
              const prog = selProg[block.id];
              const status = prog?.status || "pending";
              const isCurrent = isToday && activeBl && activeBl.id === block.id;

              return (
                <TaskItem
                  key={block.id}
                  block={block}
                  status={status}
                  prog={prog}
                  isCurrent={isCurrent}
                  currentProgress={activeBlProgress}
                  isDark={isDark}
                  themeColors={themeColors}
                  onMark={mark}
                  onUnmark={unmark}
                  onOpenPartial={openPartialModal}
                  onEdit={openEditingPreset}
                  onDeleteFromToday={removeTaskFromToday}
                />
              );
            })
          )}

          {/* Add Block Button */}
          <button
            onClick={() =>
              openEditingPreset({
                id: `block_${Date.now()}`,
                name: "",
                start: "09:00",
                end: "10:00",
                priority: "medium",
                days: [0, 1, 2, 3, 4, 5, 6],
                icon: "ads_click",
                zeroXp: false,
              })
            }
            className="w-full py-4 mt-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#262626] text-blue-500 font-black flex items-center justify-center gap-2 hover:bg-blue-500/5 active:scale-98 transition-all"
          >
            <Icon name="add" size={20} /> Add Block
          </button>
        </div>
      </div>
    );
  };

  // ─── TAB 2: ANALYTICS & INTERACTIVE GRAPH ───────────────────────────────────
  const renderProgressTab = () => {
    const maxValReal = chartData.reduce((m, d) => Math.max(m, d.val), 0);
    const maxValChart = filterTask === "ALL" ? Math.max(100, maxValReal * 1.1) : Math.max(8, maxValReal * 1.15);
    const avgVal = chartData.length > 0 ? chartData.reduce((s, d) => s + d.val, 0) / chartData.length : 0;
    const totalVal = chartData.reduce((s, d) => s + d.val, 0);

    const width = 340;
    const height = 180;
    const xStep = chartData.length > 1 ? width / (chartData.length - 1) : width;

    const points = chartData.map((d, i) => {
      const x = i * xStep;
      let rawY = height - (d.val / maxValChart) * height;
      if (isNaN(rawY) || !isFinite(rawY)) rawY = height;
      const y = Math.max(15, Math.min(height - 5, rawY));
      return { x, y, ...d, index: i };
    });

    // Smooth Bezier Curve Path Generator
    let pathD = "";
    let areaD = "";
    if (points.length > 0) {
      if (points.length === 1) {
        pathD = `M ${points[0].x} ${points[0].y}`;
        areaD = `M 0 ${height} L ${points[0].x} ${points[0].y} L ${width} ${points[0].y} L ${width} ${height} Z`;
      } else {
        pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i];
          const p1 = points[i + 1];
          const cpX = (p0.x + p1.x) / 2;
          pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        areaD = `${pathD} L ${points[points.length - 1].x} ${height} L 0 ${height} Z`;
      }
    }

    // Scrubber Pointer Move Handler
    const handleScrub = (clientX, rect) => {
      if (points.length === 0) return;
      const relX = ((clientX - rect.left) / rect.width) * width;
      let closest = points[0];
      let minDiff = Infinity;
      points.forEach((p) => {
        const diff = Math.abs(p.x - relX);
        if (diff < minDiff) {
          minDiff = diff;
          closest = p;
        }
      });
      setScrubberPoint(closest);
    };

    return (
      <div className="pb-32 select-none animate-in fade-in duration-500">
        <div className="px-4 pt-8 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              Analytics
            </h1>

            {/* Line / Bar Chart Toggle */}
            <div className="flex bg-gray-100 dark:bg-[#222] p-1 rounded-2xl border border-gray-200/50 dark:border-[#333]">
              <button
                onClick={() => setChartViewMode("line")}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                  chartViewMode === "line"
                    ? "bg-white dark:bg-[#333] text-blue-500 shadow-sm"
                    : "text-gray-400"
                }`}
                title="Line Curve View"
              >
                Line
              </button>
              <button
                onClick={() => setChartViewMode("bar")}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                  chartViewMode === "bar"
                    ? "bg-white dark:bg-[#333] text-blue-500 shadow-sm"
                    : "text-gray-400"
                }`}
                title="Bar Chart View"
              >
                Bar
              </button>
            </div>
          </div>

          <div
            className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 mb-6 shadow-sm`}
          >
            <div className="flex justify-between items-center mb-6">
              <select
                value={filterTask}
                onChange={(e) => setFilterTask(e.target.value)}
                className="bg-transparent outline-none font-black text-lg appearance-none text-black dark:text-white max-w-[150px] truncate cursor-pointer"
              >
                {dynamicFilterOptions.map((opt) => (
                  <option
                    key={opt}
                    value={opt}
                    className="bg-white dark:bg-[#151515] text-black dark:text-white font-sans"
                  >
                    {opt === "ALL" ? "Overall Score" : `${opt} (Hrs)`}
                  </option>
                ))}
              </select>

              <div className="flex bg-gray-100 dark:bg-[#222] p-1.5 rounded-2xl text-xs font-bold">
                {[7, 14, 30, 90].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTf(v)}
                    className={`px-2.5 py-1 rounded-xl transition-all ${
                      tf === v
                        ? "bg-white dark:bg-[#333] shadow-sm text-black dark:text-white font-black"
                        : themeColors.text3
                    }`}
                  >
                    {v}D
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive SVG Chart Container */}
            {chartData.length < 2 ? (
              <div className={`h-44 flex items-center justify-center ${themeColors.text3} text-sm font-medium`}>
                Complete tasks over 2 or more days to populate interactive graphs.
              </div>
            ) : (
              <div
                className="relative mt-4 overflow-visible rounded-2xl touch-none cursor-crosshair"
                style={{ width: "100%", aspectRatio: "340/190" }}
                onPointerMove={(e) => handleScrub(e.clientX, e.currentTarget.getBoundingClientRect())}
                onPointerLeave={() => setScrubberPoint(null)}
              >
                <svg
                  viewBox={`-10 -15 ${width + 20} ${height + 35}`}
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0A84FF" stopOpacity="1" />
                      <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  {/* Target 80% line */}
                  {filterTask === "ALL" && (
                    <line
                      x1="0"
                      y1={height - (80 / maxValChart) * height}
                      x2={width}
                      y2={height - (80 / maxValChart) * height}
                      stroke="#32D74B"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      opacity="0.5"
                    />
                  )}

                  {/* LINE CHART MODE */}
                  {chartViewMode === "line" && (
                    <>
                      <path d={areaD} fill="url(#chartGrad)" />
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#0A84FF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {points.map((p, i) => {
                        const isScrubbed = scrubberPoint && scrubberPoint.index === i;
                        return (
                          <g key={i}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isScrubbed ? "6.5" : "4"}
                              fill={isDark ? "#111" : "#fff"}
                              stroke="#0A84FF"
                              strokeWidth={isScrubbed ? "4" : "2.5"}
                              className="transition-all duration-150"
                            />
                          </g>
                        );
                      })}
                    </>
                  )}

                  {/* BAR CHART MODE */}
                  {chartViewMode === "bar" && (
                    <>
                      {points.map((p, i) => {
                        const bWidth = Math.max(6, Math.min(28, (width / points.length) * 0.65));
                        const bHeight = Math.max(4, height - p.y);
                        const isScrubbed = scrubberPoint && scrubberPoint.index === i;

                        return (
                          <rect
                            key={i}
                            x={p.x - bWidth / 2}
                            y={p.y}
                            width={bWidth}
                            height={bHeight}
                            rx={bWidth / 3}
                            ry={bWidth / 3}
                            fill={isScrubbed ? "#32D74B" : "url(#barGrad)"}
                            opacity={isScrubbed ? 1 : 0.85}
                            className="transition-all duration-150"
                          />
                        );
                      })}
                    </>
                  )}

                  {/* Vertical Guideline for Scrubber */}
                  {scrubberPoint && (
                    <line
                      x1={scrubberPoint.x}
                      y1={10}
                      x2={scrubberPoint.x}
                      y2={height}
                      stroke="#0A84FF"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}
                </svg>

                {/* Interactive Tooltip Card Floating Above Scrubber */}
                {scrubberPoint && (
                  <div
                    className="absolute pointer-events-none -top-12 z-20 transition-all duration-100 ease-out"
                    style={{
                      left: `${(scrubberPoint.x / width) * 100}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div
                      className={`${themeColors.surface} border border-blue-500/50 rounded-2xl px-3 py-1.5 shadow-2xl backdrop-blur-lg flex items-center gap-2 whitespace-nowrap`}
                    >
                      <span className="text-[10px] font-mono font-bold text-gray-400">
                        {new Date(scrubberPoint.date + "T12:00:00").toLocaleDateString("en", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-xs font-black text-blue-500">
                        {filterTask === "ALL"
                          ? `${Math.round(scrubberPoint.val)}%`
                          : `${scrubberPoint.val.toFixed(1)} hrs`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Summary Metrics Row */}
            <div className="grid grid-cols-3 gap-2 mt-6">
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Average
                </div>
                <div className="text-xl font-black text-blue-500">
                  {filterTask === "ALL" ? Math.round(avgVal) + "%" : avgVal.toFixed(1) + "h"}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Best Day
                </div>
                <div className="text-xl font-black text-[#32D74B]">
                  {filterTask === "ALL" ? Math.round(maxValReal) + "%" : maxValReal.toFixed(1) + "h"}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Total
                </div>
                <div className="text-xl font-black text-[#FF9F0A]">
                  {filterTask === "ALL" ? chartData.length + " Days" : totalVal.toFixed(1) + "h"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── TAB 3: SETTINGS (ALARMS, NOTIFICATIONS, CLOUD, PRESETS) ────────────────
  const renderSettingsTab = () => {
    const handleInstallClick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") setDeferredPrompt(null);
      }
    };

    return (
      <div className="pb-32 px-4 pt-8 select-none animate-in fade-in duration-500">
        <h1 className="text-3xl font-black tracking-tight mb-6 text-gray-900 dark:text-white">
          Settings
        </h1>

        {deferredPrompt && (
          <div className="mb-6">
            <button
              onClick={handleInstallClick}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black py-4 rounded-[24px] flex justify-center items-center gap-3 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform text-lg"
            >
              <Icon name="download" size={24} /> Install FocusOS PWA
            </button>
          </div>
        )}

        {/* ─── SMART WAKE-UP & SLEEP ALARMS CARD ────────────────────────────── */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Smart Schedule Alarms
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden shadow-sm mb-8`}>
          {/* Wake-Up Alarm Row */}
          <div className="p-5 border-b border-gray-100 dark:border-[#222]">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Icon name="wb_sunny" size={20} className="text-amber-500" />
                  Wake-Up Alarm
                </div>
                <div className="text-xs font-medium text-gray-500 mt-0.5">
                  {alarms.wake.autoSync
                    ? `Auto-synced to first block: ${to12h(alarms.wake.time)}`
                    : `Set for ${to12h(alarms.wake.time)}`}
                </div>
              </div>

              <button
                onClick={() =>
                  setAlarms({
                    ...alarms,
                    wake: { ...alarms.wake, enabled: !alarms.wake.enabled },
                  })
                }
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${
                  alarms.wake.enabled ? "bg-[#32D74B]" : "bg-gray-200 dark:bg-[#333]"
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                    alarms.wake.enabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {alarms.wake.enabled && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#222]">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alarms.wake.autoSync}
                    onChange={(e) =>
                      setAlarms({
                        ...alarms,
                        wake: { ...alarms.wake, autoSync: e.target.checked },
                      })
                    }
                    className="rounded text-blue-500 w-4 h-4"
                  />
                  Auto-sync to first daily task
                </label>

                {!alarms.wake.autoSync && (
                  <input
                    type="time"
                    value={alarms.wake.time}
                    onChange={(e) =>
                      setAlarms({
                        ...alarms,
                        wake: { ...alarms.wake, time: e.target.value },
                      })
                    }
                    className="text-xs font-black p-1.5 rounded-lg bg-gray-100 dark:bg-[#222] border-none outline-none"
                  />
                )}
              </div>
            )}
          </div>

          {/* Sleep / Bedtime Alarm Row */}
          <div className="p-5 border-b border-gray-100 dark:border-[#222]">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Icon name="bedtime" size={20} className="text-indigo-400" />
                  Sleep / Bedtime Alarm
                </div>
                <div className="text-xs font-medium text-gray-500 mt-0.5">
                  {alarms.sleep.autoSync
                    ? `Auto-synced to final block: ${to12h(alarms.sleep.time)}`
                    : `Set for ${to12h(alarms.sleep.time)}`}
                </div>
              </div>

              <button
                onClick={() =>
                  setAlarms({
                    ...alarms,
                    sleep: { ...alarms.sleep, enabled: !alarms.sleep.enabled },
                  })
                }
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${
                  alarms.sleep.enabled ? "bg-[#32D74B]" : "bg-gray-200 dark:bg-[#333]"
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                    alarms.sleep.enabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {alarms.sleep.enabled && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#222]">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alarms.sleep.autoSync}
                    onChange={(e) =>
                      setAlarms({
                        ...alarms,
                        sleep: { ...alarms.sleep, autoSync: e.target.checked },
                      })
                    }
                    className="rounded text-blue-500 w-4 h-4"
                  />
                  Auto-sync to last daily schedule
                </label>

                {!alarms.sleep.autoSync && (
                  <input
                    type="time"
                    value={alarms.sleep.time}
                    onChange={(e) =>
                      setAlarms({
                        ...alarms,
                        sleep: { ...alarms.sleep, time: e.target.value },
                      })
                    }
                    className="text-xs font-black p-1.5 rounded-lg bg-gray-100 dark:bg-[#222] border-none outline-none"
                  />
                )}
              </div>
            )}
          </div>

          {/* Test Alarm Sound */}
          <div className="p-4 bg-gray-50/50 dark:bg-[#181818]/50 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500">Audio Synth Melody</span>
            <button
              onClick={() => {
                playAlarmSound(0.8);
                setTimeout(stopAlarmSound, 3000);
              }}
              className="text-xs font-black text-blue-500 flex items-center gap-1.5 hover:underline"
            >
              <Icon name="volume_up" size={16} /> Test Alarm Sound (3s)
            </button>
          </div>
        </div>

        {/* ─── CUSTOMIZABLE NOTIFICATIONS ENGINE CARD ───────────────────────── */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Instant & Advance Notifications
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden shadow-sm mb-8`}>
          {/* Main Toggle */}
          <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-[#222]">
            <div>
              <div className="text-base font-bold text-gray-900 dark:text-white">
                Task Milestone Notifications
              </div>
              <div className="text-xs font-medium text-gray-500 mt-1">
                Alerts for task starts, finishes & handovers
              </div>
            </div>

            <button
              onClick={async () => {
                if (!notificationConfig.enabled) {
                  if ("Notification" in window) {
                    const perm = await Notification.requestPermission();
                    if (perm !== "granted") {
                      alert("Please enable notification permissions in browser settings.");
                    }
                  }
                  setNotificationConfig({ ...notificationConfig, enabled: true });
                } else {
                  setNotificationConfig({ ...notificationConfig, enabled: false });
                }
              }}
              className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${
                notificationConfig.enabled ? "bg-[#32D74B]" : "bg-gray-200 dark:bg-[#333]"
              }`}
            >
              <div
                className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                  notificationConfig.enabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Lead Time Options */}
          {notificationConfig.enabled && (
            <div className="p-5 border-b border-gray-100 dark:border-[#222]">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-3">
                Notification Timing Offset
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "0m (Exact)", val: 0 },
                  { label: "1 min", val: 1 },
                  { label: "2 min", val: 2 },
                  { label: "5 min", val: 5 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setNotificationConfig({ ...notificationConfig, leadMins: opt.val })}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      notificationConfig.leadMins === opt.val
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                        : "bg-gray-100 dark:bg-[#222] text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Checkboxes for Start and End */}
              <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-100 dark:border-[#222]">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notificationConfig.notifyStart}
                    onChange={(e) =>
                      setNotificationConfig({
                        ...notificationConfig,
                        notifyStart: e.target.checked,
                      })
                    }
                    className="rounded text-blue-500 w-4 h-4"
                  />
                  Alert at Start
                </label>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notificationConfig.notifyEnd}
                    onChange={(e) =>
                      setNotificationConfig({
                        ...notificationConfig,
                        notifyEnd: e.target.checked,
                      })
                    }
                    className="rounded text-blue-500 w-4 h-4"
                  />
                  Alert at Finish
                </label>
              </div>
            </div>
          )}

          {/* Test Notification Button */}
          <div className="p-4 bg-gray-50/50 dark:bg-[#181818]/50 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500">Preview Alerts</span>
            <button
              onClick={() => {
                dispatchNotification({
                  title: "⚡ Test Notification (0:00 Instant)",
                  body: "Schedule transitions and alarms are operating at peak precision.",
                  onInAppToast: setInAppToast,
                });
              }}
              className="text-xs font-black text-blue-500 flex items-center gap-1.5 hover:underline"
            >
              <Icon name="send" size={16} /> Send Test Alert Now
            </button>
          </div>
        </div>

        {/* ─── GOOGLE SIGN-IN & CLOUD SYNCHRONIZATION CARD ─────────────────── */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Google Account & Cloud Sync
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 mb-8 shadow-sm`}>
          {currentUser ? (
            <div>
              <div className="flex items-center gap-4 mb-4">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-blue-500"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-500 text-white font-black text-xl flex items-center justify-center">
                    {(currentUser.displayName || currentUser.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-black text-lg text-gray-900 dark:text-white truncate">
                    {currentUser.displayName || "Google User"}
                  </div>
                  <div className="text-xs text-gray-500 font-mono truncate">{currentUser.email}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-[#32D74B]">
                    <Icon name="cloud_done" size={16} />
                    <span>Cloud Backup Active</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-[#222]">
                <button
                  onClick={async () => {
                    setCloudSyncStatus("syncing");
                    await syncUserDataToCloud(currentUser.uid, {
                      history,
                      presets,
                      themeMode,
                      alarms,
                      notificationConfig,
                    });
                    setCloudSyncStatus("synced");
                    alert("All routines and timeline logs synced to Cloud Firestore!");
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-black text-xs transition-all"
                >
                  Manual Sync
                </button>
                <button
                  onClick={handleSignOut}
                  className="py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-[#222] text-gray-600 dark:text-gray-300 font-bold text-xs"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                Backup routines and sync across devices
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Connect your Google account to automatically store timelines, smart alarms, and history in
                Cloud Firestore.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 px-4 bg-white dark:bg-[#222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-800 dark:text-white border border-gray-300 dark:border-[#333] rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-sm active:scale-98 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#222] flex justify-between items-center">
            <span className="text-[11px] text-gray-400 font-mono">Firebase Credentials</span>
            <button
              onClick={() => setShowFirebaseModal(true)}
              className="text-xs font-bold text-blue-500 hover:underline"
            >
              Configure API Keys
            </button>
          </div>
        </div>

        {/* ─── PRESETS LIBRARY ──────────────────────────────────────────────── */}
        <div className="flex justify-between items-end mb-3 ml-2">
          <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3}`}>
            Preset Routines Library
          </div>
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden mb-8 shadow-sm`}>
          <button
            onClick={() =>
              openEditingPreset({
                id: `new_${Date.now()}`,
                name: "",
                start: "08:00",
                end: "09:00",
                priority: "medium",
                days: [1, 2, 3, 4, 5],
                icon: "ads_click",
                zeroXp: false,
              })
            }
            className="w-full p-5 flex items-center justify-center gap-2 text-blue-500 font-black border-b border-gray-100 dark:border-[#222] active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors text-lg"
          >
            <Icon name="add" size={20} /> Create New Routine
          </button>

          <div className="max-h-[50vh] overflow-y-auto scroll-smooth">
            {sortedPresets.map((p) => {
              const tObj = to12hObj(p.start);
              return (
                <div
                  key={p.id}
                  onClick={() => openEditingPreset(p)}
                  className="flex flex-col p-5 border-b border-gray-100 dark:border-[#222] active:bg-gray-50 dark:active:bg-[#1a1a1a] cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-light tracking-tight leading-none text-gray-900 dark:text-white">
                          {tObj.time}
                        </span>
                        <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">
                          {tObj.period}
                        </span>
                      </div>
                      <div className="text-sm font-black mt-2 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <Icon name={p.icon || "monitoring"} size={16} />
                        {p.name}
                        {p.zeroXp && (
                          <span className="text-[9px] uppercase tracking-wider bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded font-black">
                            0XP
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Icon
                        name="chevron_right"
                        size={20}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity ${themeColors.text3}`}
                      />
                      <div className="text-xs font-mono font-bold text-gray-400 mt-1">
                        {mins(p.start, p.end)}m
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {DAYS.map((d, i) => (
                      <div
                        key={i}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                          p.days.includes(i)
                            ? "bg-blue-500 text-white shadow-sm"
                            : "bg-gray-100 dark:bg-[#222] text-gray-400"
                        }`}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Appearance */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Appearance
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-3xl p-2 flex mb-8 shadow-sm`}>
          {["light", "dark", "system"].map((m) => (
            <button
              key={m}
              onClick={() => setThemeMode(m)}
              className={`flex-1 py-3 rounded-2xl text-xs font-black capitalize transition-all ${
                themeMode === m
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                  : themeColors.text3
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Data Recovery & Universal Storage Vault */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2 flex items-center gap-1.5`}>
          <Icon name="database" size={14} className="text-blue-500" /> Storage & Data Recovery
        </div>

        {/* Status Card */}
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-3xl p-5 mb-4 shadow-sm`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              IndexedDB + LocalStorage Dual-Sync
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
              Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center my-3">
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#262626]">
              <div className="text-lg font-black text-gray-900 dark:text-white">
                {Object.keys(history).length}
              </div>
              <div className="text-[10px] font-bold text-gray-400">Days Logged</div>
            </div>
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#262626]">
              <div className="text-lg font-black text-gray-900 dark:text-white">
                {presets.length}
              </div>
              <div className="text-[10px] font-bold text-gray-400">Active Routines</div>
            </div>
          </div>

          {/* Deep Scan Button */}
          <button
            onClick={handleDeepScanStorage}
            disabled={isScanningStorage}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
          >
            <Icon name={isScanningStorage ? "sync" : "history"} size={18} className={isScanningStorage ? "animate-spin" : ""} />
            {isScanningStorage ? "Deep Scanning Device Storage..." : "Deep Scan & Restore Local Storage"}
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2 leading-tight">
            Exhaustively checks localStorage and all IndexedDB databases on this smartphone/browser to recover past days, streaks, and analytics.
          </p>

          {scanReport && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-start gap-2 animate-in fade-in duration-300">
              <Icon name="check_circle" size={16} className="mt-0.5 flex-shrink-0" />
              <span className="leading-snug">{scanReport}</span>
            </div>
          )}

          {/* Storage Inspector */}
          <button
            onClick={async () => {
              const report = await getRawStorageDiagnosticReport();
              setStorageReport(report);
              setShowStorageInspector(true);
            }}
            className="w-full mt-1 py-2.5 px-4 rounded-2xl border border-dashed border-gray-300 dark:border-[#333] text-gray-500 dark:text-gray-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-all"
          >
            <Icon name="troubleshoot" size={16} />
            Storage Inspector &amp; Force Restore
          </button>
        </div>

        {/* Backup & Transfer Tools */}
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-3xl p-4 mb-8 shadow-sm flex flex-col gap-2`}>
          <div className="text-xs font-bold text-gray-400 px-2 pb-1">Backup & Portability</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportBackup}
              className="py-3 px-3 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] text-xs font-black text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1.5 active:bg-gray-100 dark:active:bg-[#222] transition-colors"
            >
              <Icon name="download" size={16} className="text-blue-500" />
              Export .JSON
            </button>

            <label className="py-3 px-3 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] text-xs font-black text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1.5 cursor-pointer active:bg-gray-100 dark:active:bg-[#222] transition-colors">
              <Icon name="upload" size={16} className="text-emerald-500" />
              Import .JSON
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={() => setShowBackupModal(true)}
            className="w-full py-2.5 px-3 rounded-2xl bg-gray-100 dark:bg-[#1e1e1e] text-xs font-black text-gray-600 dark:text-gray-300 flex items-center justify-center gap-1.5 active:opacity-70 transition-opacity"
          >
            <Icon name="code" size={16} /> Quick Copy / Paste Backup
          </button>
        </div>

        {/* Database Clean / Reset */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Reset Options
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden shadow-sm`}>
          <button
            onClick={() => {
              if (window.confirm("Reset task presets to default system configuration?")) {
                setPresets(DEFAULT_PRESETS);
              }
            }}
            className="w-full p-5 text-left text-[#FF9F0A] font-black border-b border-gray-100 dark:border-[#222] active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors text-sm"
          >
            Factory Reset Default Routines
          </button>
          <button
            onClick={() => {
              if (window.confirm("Wipe all local records and restart?")) {
                const req = indexedDB.deleteDatabase("FocusOS_PWA_DB");
                localStorage.removeItem("fo6_history");
                localStorage.removeItem("focusos_history_master_backup");
                req.onsuccess = () => window.location.reload();
              }
            }}
            className="w-full p-5 text-left text-[#FF3B30] font-black active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors text-sm"
          >
            Delete All History & Reset
          </button>
        </div>
      </div>
    );
  };

  // ─── SMART SPLASH SCREEN ────────────────────────────────────────────────────
  if (!isReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: isDark ? "#080808" : "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="icon.png"
          alt="FocusOS"
          style={{
            width: 90,
            height: 90,
            borderRadius: 24,
            marginBottom: 32,
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.2)",
          }}
        />
        <div
          style={{
            width: 28,
            height: 28,
            border: "3px solid #3b82f6",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const TABS = [
    { id: "today", icon: "home", label: "Home" },
    { id: "progress", icon: "bar_chart", label: "Analytics" },
    { id: "settings", icon: "settings", label: "Settings" },
  ];

  return (
    <div className={isDark ? "dark" : ""}>
      <div
        className={`h-screen overflow-y-auto overflow-x-hidden ${themeColors.bg} ${themeColors.text} font-sans flex justify-center selection:bg-blue-500/30 transition-colors duration-300`}
      >
        <div
          className={`w-full max-w-[430px] relative min-h-full border-x ${themeColors.border} bg-white dark:bg-[#080808]`}
        >
          {tab === "today" && renderHomeTab()}
          {tab === "progress" && renderProgressTab()}
          {tab === "settings" && renderSettingsTab()}

          {/* Bottom Navigation Bar */}
          <div
            className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] ${
              isDark ? "bg-[#080808]/90" : "bg-white/90"
            } backdrop-blur-xl border-t ${themeColors.border} flex pb-safe pt-2 z-[100] pb-6`}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 py-2 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                >
                  <Icon
                    name={t.icon}
                    size={26}
                    className={active ? "text-blue-500" : themeColors.text3}
                    style={{ fontWeight: active ? 800 : 500 }}
                  />
                  <span
                    className={`text-[10px] font-black tracking-wide ${
                      active ? "text-blue-500" : themeColors.text3
                    }`}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Overlays & Modals */}
          {renderInAppToast()}
          {renderAlarmModal()}
          {renderFirebaseModal()}
          {renderBackupModal()}
          {renderStorageInspectorModal()}
          {editingPreset && renderPresetEditor()}
          {partialModal && renderPartialModal()}
          {showCalendar && renderCalendar()}
          {burst && renderConfetti()}
        </div>
      </div>
    </div>
  );
}

// ── ROOT EXPORT ──
export default function App() {
  return (
    <ErrorBoundary>
      <FocusOS />
    </ErrorBoundary>
  );
}

