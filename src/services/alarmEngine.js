/**
 * TYMVERA System Alarm Engine
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
export const ALARM_SOUND_TYPES = [
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
export function playAlarmSound(volume = 0.85, soundType = 'system_digital') {
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
export function stopAlarmSound() {
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
export function playNotificationChime() {
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
export function calculateAutoWakeTime(todaysBlocks) {
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
export function calculateAutoSleepTime(todaysBlocks) {
  if (!Array.isArray(todaysBlocks) || todaysBlocks.length === 0) return '22:00';

  const sleepBlock = todaysBlocks.find((b) => b && b.name?.toLowerCase().includes('sleep'));
  if (sleepBlock && sleepBlock.start) {
    return sleepBlock.start;
  }

  const sorted = [...todaysBlocks].sort((a, b) => (a.end || '').localeCompare(b.end || ''));
  return sorted[sorted.length - 1]?.end || '22:00';
}
