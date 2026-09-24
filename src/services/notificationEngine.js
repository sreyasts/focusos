/**
 * TYMVERA Precision Notification & Section Milestone Engine
 * Features:
 * - Robust dual-mode permission request (supports Promise & Callback APIs on iOS/Android/Desktop)
 * - Section start, completion, and handover milestone alerts with official TYMVERA logo & theme
 * - Exact section relevance details: start/end times, session duration, and task name
 * - Resilient grace window to survive device sleep / background tab throttling
 * - ServiceWorker showNotification dispatch with icon, badge, haptics & interactive toast
 */

import { playNotificationChime } from './alarmEngine';

const format12hTime = (t) => {
  if (!t || !t.includes(':')) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

const calcDurationMins = (start, end) => {
  if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
};

/**
 * Safely request native notification permissions across all browsers (Desktop, Android TWA/PWA, iOS)
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  try {
    let perm;
    // Handle both modern Promise and legacy callback signatures
    const req = Notification.requestPermission((result) => {
      perm = result;
    });
    if (req && typeof req.then === 'function') {
      perm = await req;
    }
    return perm === 'granted' || Notification.permission === 'granted';
  } catch (err) {
    console.warn('[NotificationEngine] Permission request error:', err);
    return Notification.permission === 'granted';
  }
}

/**
 * High-urgency native lock-screen alert for Wake and Sleep alarms
 */
export function dispatchAlarmNativeNotification({ title, subtitle }) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const options = {
    body: subtitle,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [350, 120, 350, 120, 600],
    tag: 'tymvera-system-alarm',
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
 * Dispatch section milestone notification with official app logo and theme details
 */
export function dispatchNotification({
  title,
  body,
  icon = '/icon-192.png',
  badge = '/icon-192.png',
  tag = `tymvera_notif_${Date.now()}`,
  onInAppToast,
}) {
  // 1. Play loud signature TYMVERA focus chime
  playNotificationChime(1.0);

  // 2. Dispatch in-app interactive toast for instant visual feedback
  if (typeof onInAppToast === 'function') {
    onInAppToast({
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      icon,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // 3. Dispatch native Android PWA / Desktop notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const options = {
      body,
      icon,
      badge,
      vibrate: [180, 80, 180, 80, 240],
      tag,
      renotify: true,
      requireInteraction: false,
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
}

/**
 * Check schedule for section start & finish triggers with grace-window tolerance
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
  if (!Array.isArray(todaysBlocks) || todaysBlocks.length === 0) return;

  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();
  const lead = Number(config.leadMins) || 0;

  const endingTasks = [];
  const startingTasks = [];

  todaysBlocks.forEach((block) => {
    if (!block || !block.start || !block.end) return;

    const blockKeyId = block.id || block.name || `${block.start}_${block.end}`;
    const [sh, sm] = block.start.split(':').map(Number);
    const startMins = sh * 60 + (sm || 0);

    const [eh, em] = block.end.split(':').map(Number);
    let endMins = eh * 60 + (em || 0);
    if (endMins <= startMins) endMins += 24 * 60;

    // ─── SECTION START EVALUATION (with 3-minute grace window) ─────────────
    if (config.notifyStart !== false) {
      const targetStartMins = startMins - lead;
      const startDiff = currentTotalMins - targetStartMins;

      if (startDiff >= 0 && startDiff <= 3) {
        const cacheKey = `notif_start_${dateStr}_${blockKeyId}_${targetStartMins}`;
        if (!sessionStorage.getItem(cacheKey)) {
          sessionStorage.setItem(cacheKey, 'true');
          startingTasks.push(block);
        }
      }
    }

    // ─── SECTION END EVALUATION (with 3-minute grace window) ───────────────
    if (config.notifyEnd !== false) {
      const targetEndMins = endMins;
      const endDiff = currentTotalMins - targetEndMins;

      if (endDiff >= 0 && endDiff <= 3) {
        const cacheKey = `notif_end_${dateStr}_${blockKeyId}_${targetEndMins}`;
        if (!sessionStorage.getItem(cacheKey)) {
          sessionStorage.setItem(cacheKey, 'true');
          endingTasks.push(block);
        }
      }
    }
  });

  // 1. Handover Milestone: one section finishes right as the next begins
  if (endingTasks.length > 0 && startingTasks.length > 0) {
    const endingNames = endingTasks.map((b) => b.name).join(', ');
    const startingBlock = startingTasks[0];
    const duration = calcDurationMins(startingBlock.start, startingBlock.end);

    dispatchNotification({
      title: `🔄 Routine Handover • ${startingBlock.name}`,
      body: `Completed: ${endingNames}. Starting now: ${format12hTime(startingBlock.start)} – ${format12hTime(startingBlock.end)} (${duration}m).`,
      tag: `tymvera_handover_${dateStr}_${startingBlock.id || startingBlock.name}`,
      onInAppToast,
    });
    return;
  }

  // 2. Individual Section Completion Milestone
  endingTasks.forEach((block) => {
    const duration = calcDurationMins(block.start, block.end);
    dispatchNotification({
      title: `🏁 ${block.name} • Completed`,
      body: `Finished at ${format12hTime(block.end)} (${duration}m focus logged). Great work!`,
      tag: `tymvera_end_${dateStr}_${block.id || block.name}`,
      onInAppToast,
    });
  });

  // 3. Individual Section Starting Milestone
  startingTasks.forEach((block) => {
    const isInstant = lead === 0;
    const duration = calcDurationMins(block.start, block.end);
    const title = isInstant ? `⚡ ${block.name} • Starting Now` : `⏳ Upcoming: ${block.name}`;
    const body = isInstant
      ? `${format12hTime(block.start)} – ${format12hTime(block.end)} (${duration}m session)`
      : `Starts in ${lead}m at ${format12hTime(block.start)} (${duration}m session)`;

    dispatchNotification({
      title,
      body,
      tag: `tymvera_start_${dateStr}_${block.id || block.name}`,
      onInAppToast,
    });
  });
}
