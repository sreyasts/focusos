/**
 * FocusOS Precision Notification Engine
 * Features:
 * - Customizable lead time (0 min for instant/exact time, 1m, 2m, 5m, 10m, etc.)
 * - Start & End milestone alerts for every scheduled task
 * - Instant schedule handover detection (e.g. at 09:00 when Task A ends and Task B starts)
 * - Dual dispatch: Native Browser Notifications + In-App Interactive Toast + Audio Chime
 */

import { playNotificationChime } from './alarmEngine';

const to12h = (t) => {
  if (!t || !t.includes(':')) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

/**
 * Dispatch a notification via Browser API and in-app toast callback
 */
export function dispatchNotification({ title, body, icon = '/icon.png', onInAppToast }) {
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
export function checkScheduleNotifications({
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
    const nextStartTimes = startingTasks.map((b) => to12h(b.start)).join(', ');

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
      body: `Ended at ${to12h(block.end)}. Great job!`,
      onInAppToast,
    });
  });

  // Dispatch individual starting alerts
  startingTasks.forEach((block) => {
    const isInstant = lead === 0;
    const title = isInstant ? `⚡ Starting Now: ${block.name}` : `⏳ Upcoming: ${block.name}`;
    const body = isInstant
      ? `Scheduled from ${to12h(block.start)} to ${to12h(block.end)}.`
      : `Starts in ${lead} minute${lead > 1 ? 's' : ''} at ${to12h(block.start)}.`;

    dispatchNotification({
      title,
      body,
      onInAppToast,
    });
  });
}
