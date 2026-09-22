/**
 * FocusOS Alarm Engine
 * Features:
 * - Web Audio API synthesized alarm sounds (zero external assets needed)
 * - Auto-sync calculation of wake-up time (earliest block start) and sleep time (latest block end/sleep block)
 * - Alarm loop management with Snooze and Dismiss capabilities
 */

let activeAudioCtx = null;
let activeAlarmInterval = null;

/**
 * Play a synthesized multi-harmonic alarm tone loop using Web Audio API
 */
export function playAlarmSound(volume = 0.8) {
  stopAlarmSound();

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return () => {};

    const ctx = new AudioContext();
    activeAudioCtx = ctx;

    const playChord = () => {
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      // Gentle ascending triad: E5 (659.25Hz), G#5 (830.61Hz), B5 (987.77Hz), E6 (1318.51Hz)
      const freqs = [659.25, 830.61, 987.77, 1318.51];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        // Envelope
        const start = now + idx * 0.12;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume * 0.25, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.65);
      });
    };

    // Play immediately and repeat every 1.5 seconds
    playChord();
    activeAlarmInterval = setInterval(playChord, 1500);

    // Vibration pattern if supported
    if (navigator.vibrate) {
      navigator.vibrate([400, 200, 400, 200, 800]);
    }

    return stopAlarmSound;
  } catch (err) {
    console.warn('Alarm audio error:', err);
    return () => {};
  }
}

/**
 * Stop any active ringing alarm
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
  if (navigator.vibrate) {
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

  // Exclude overnight sleep blocks if they are active in the early morning
  // Find non-sleep blocks, or the earliest daytime block
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

  // If there is an explicit Sleep block, its start time is bedtime
  const sleepBlock = todaysBlocks.find((b) => b && b.name?.toLowerCase().includes('sleep'));
  if (sleepBlock && sleepBlock.start) {
    return sleepBlock.start;
  }

  // Otherwise, find the latest end time among today's blocks
  const sorted = [...todaysBlocks].sort((a, b) => (a.end || '').localeCompare(b.end || ''));
  return sorted[sorted.length - 1]?.end || '22:00';
}
