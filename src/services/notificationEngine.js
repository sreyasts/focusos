/**
 * TYMVERA Precision Notification Engine
 * Features:
 * - Robust Android PWA & Desktop Notification Dispatch via ServiceWorkerRegistration.showNotification
 * - Resilient Grace-Window Triggering (eliminates dropped alerts caused by phone sleep / timer throttling)
 * - Alarm Native Notification dispatch (rings visual notification on lock screen alongside audio synthesizer)
 * - High-Impact TYMVERA Focus Chime + Tactile Vibration
 */

import { playNotificationChime } from './alarmEngine';

const format12hTime = (t) => {
  if (!t || !t.includes(':')) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

/**
 * Safely request native notification permissions across desktop & mobile
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch (err) {
    console.warn('[NotificationEngine] Permission request failed:', err);
    return false;
  }
}

/**
 * Dispatch high-urgency native notification for ringing wake / sleep alarms
 */
export function dispatchAlarmNativeNotification({ title, subtitle }) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const options = {
    body: subtitle,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [300, 100, 300, 100, 500],
    tag: 'tymvera-active-alarm',
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: { url: '/' },
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, options))
      .catch(() => {
        try {
          new Notification(title, options);
        } catch (e) {}
      });
  } else {
    try {
      new Notification(title, options);
    } catch (e) {}
  }
}

/**
 * Dispatch milestone notifications via Service Worker / Browser API, in-app toast, and signature chime
 */
export function dispatchNotification({
  title,
  body,
  icon = '/icon-192.png',
  badge = '/icon-192.png',
  onInAppToast,
}) {
  // 1. Play loud, crisp TYMVERA focus chime
  playNotificationChime(0.95);

  // 2. Dispatch in-app interactive toast
  if (typeof onInAppToast === 'function') {
    onInAppToast({
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // 3. Dispatch native browser / Android PWA notification if permission is granted
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const options = {
      body,
      icon,
      badge,
      vibrate: [180, 80, 180, 80, 250],
      tag: `tymvera_notif_${Date.now()}`,
      renotify: true,
      requireInteraction: false,
      silent: false,
      data: { url: '/' },
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, options))
        .catch((err) => {
          try {
            new Notification(title, options);
          } catch (e) {}
        });
    } else {
      try {
        new Notification(title, options);
      } catch (e) {}
    }
  }
}

/**
 * Check schedule for notification triggers with grace-window tolerance for background tab sleep
 */
export function checkScheduleNotifications({
  todaysBlocks = [],
  config = {
    enabled: true,
    leadMins: 0,
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
  const lead = Number(config.leadMins) || 0;

  const endingTasks = [];
  const startingTasks = [];

  todaysBlocks.forEach((block) => {
    if (!block || !block.start || !block.end) return;

    const [sh, sm] = block.start.split(':').map(Number);
    const startMins = sh * 60 + (sm || 0);

    const [eh, em] = block.end.split(':').map(Number);
    let endMins = eh * 60 + (em || 0);
    // If block spans midnight
    if (endMins <= startMins) endMins += 24 * 60;

    // ─── START MILESTONE EVALUATION (with 3-minute grace window) ───────────
    if (config.notifyStart) {
      const targetStartMins = startMins - lead;
      const startDiff = currentTotalMins - targetStartMins;

      // Fires if current time is within [0, 3] minutes of target time
      if (startDiff >= 0 && startDiff <= 3) {
        const cacheKey = `notif_start_${dateStr}_${block.id}_${targetStartMins}`;
        if (!sessionStorage.getItem(cacheKey)) {
          sessionStorage.setItem(cacheKey, 'true');
          startingTasks.push(block);
        }
      }
    }

    // ─── END MILESTONE EVALUATION (with 3-minute grace window) ─────────────
    if (config.notifyEnd) {
      const targetEndMins = endMins;
      const endDiff = currentTotalMins - targetEndMins;

      if (endDiff >= 0 && endDiff <= 3) {
        const cacheKey = `notif_end_${dateStr}_${block.id}_${targetEndMins}`;
        if (!sessionStorage.getItem(cacheKey)) {
          sessionStorage.setItem(cacheKey, 'true');
          endingTasks.push(block);
        }
      }
    }
  });

  // Handover: when one task ends right as another starts
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
