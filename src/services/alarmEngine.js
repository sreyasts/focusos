/**
 * TYMVERA System Alarm & Acoustic Engine
 * Features:
 * - Signature "TYMVERA Obsidian Resonance" audio synthesizer (deep ambient sub-harmonic FM chime)
 * - Persistent AudioContext singleton with automatic gesture unlocker (resolves mobile/browser autoplay blocks)
 * - Zero external MP3 dependencies — 100% offline Web Audio API synthesis
 * - Screen Wake Lock support during ringing
 * - Synchronized tactile vibration cadence
 * - Auto-sync calculation of wake-up and sleep milestones
 * - Loop management with Snooze (+5m) and Dismiss
 */

let activeAudioCtx = null;
let activeAlarmInterval = null;
let activeWakeLock = null;
let activeOscillators = [];

// Available Alarm Tones (flagship Obsidian theme is default)
export const ALARM_SOUND_TYPES = [
  { id: 'tymvera_obsidian', name: 'Obsidian Resonance 🌌 (TYMVERA Signature)' },
  { id: 'gentle_marimba', name: 'Gentle Focus Marimba 🎵' },
  { id: 'clock_chime', name: 'Harmonic Pulse Bell 🔔' },
  { id: 'system_digital', name: 'Digital Precision ⏰' },
  { id: 'android_siren', name: 'Urgent Wake-Up Siren 🚨' },
];

/**
 * Returns or creates the persistent AudioContext singleton.
 * Keeping one alive avoids browser autoplay blocks from timer intervals.
 */
export function getAudioContext() {
  try {
    if (typeof window === 'undefined') return null;
    if (!activeAudioCtx || activeAudioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        activeAudioCtx = new AudioContextClass();
      }
    }
    return activeAudioCtx;
  } catch (err) {
    console.warn('[AlarmEngine] Failed to create AudioContext:', err);
    return null;
  }
}

/**
 * Global unlocker attached to user interactions (touch, click, keydown).
 * Ensures the AudioContext is warm and running so scheduled alarms / notifications
 * can emit sound without being muted by browser autoplay policies.
 */
export function initAudioContextUnlocker() {
  if (typeof window === 'undefined') return;

  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };

  const events = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'];
  events.forEach((evt) => {
    window.addEventListener(evt, unlockAudio, { passive: true, capture: true });
  });
}

/**
 * Screen Wake Lock during active ringing so phone screens stay awake
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
 * Stop active sound synthesis and clear interval
 */
export function stopAlarmSound() {
  if (activeAlarmInterval) {
    clearInterval(activeAlarmInterval);
    activeAlarmInterval = null;
  }

  // Gracefully stop all current running oscillators
  activeOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  });
  activeOscillators = [];

  // Do NOT close activeAudioCtx completely to preserve user gesture authorization!
  releaseWakeLock();

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0);
  }
}

/**
 * Plays the signature TYMVERA Obsidian sound or selected tone in a loop
 */
export function playAlarmSound(volume = 0.85, soundType = 'tymvera_obsidian') {
  stopAlarmSound();
  acquireWakeLock();

  try {
    const ctx = getAudioContext();
    if (!ctx) return () => {};

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const playCycle = () => {
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // ─── 1. SIGNATURE TYMVERA OBSIDIAN RESONANCE ───────────────────────────
      if (soundType === 'tymvera_obsidian') {
        // Multi-layered deep ambient harmonic synthesizer:
        // Warm fundamental bass (110Hz A2) + shimmering harmonic triad (A3, E4, C#5) + overtone shimmer
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        masterGain.gain.setValueAtTime(volume * 0.9, now);

        // 3-step rhythmic pulse in each cycle (t=0.0s, 0.4s, 0.85s)
        const pulseTimes = [0, 0.4, 0.85];
        const chordFrequencies = [
          [110.0, 220.0, 329.63, 554.37], // Step 1: Deep A Major warm swell
          [110.0, 220.0, 329.63, 659.25], // Step 2: Rising E5 high resonance
          [110.0, 220.0, 440.0, 880.0],   // Step 3: Pure octaval resolve
        ];

        pulseTimes.forEach((delay, stepIdx) => {
          const t = now + delay;
          const freqs = chordFrequencies[stepIdx];

          // Filter for dark obsidian acoustic warmth
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, t);
          filter.frequency.exponentialRampToValueAtTime(2400, t + 0.15);
          filter.frequency.exponentialRampToValueAtTime(700, t + 0.38);
          filter.connect(masterGain);

          freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Blend triangle and sine for organic bell-synth timbre
            osc.type = i === 0 ? 'sine' : (i % 2 === 0 ? 'triangle' : 'sine');
            osc.frequency.setValueAtTime(freq, t);

            // Subtle FM shimmer modulation
            if (i > 1) {
              const mod = ctx.createOscillator();
              const modGain = ctx.createGain();
              mod.frequency.value = 6; // 6Hz gentle vibrato
              modGain.gain.value = 4;
              mod.connect(osc.frequency);
              mod.start(t);
              mod.stop(t + 0.4);
              activeOscillators.push(mod);
            }

            // Envelope: Crisp smooth attack with lush resonant decay
            const noteVol = (i === 0 ? 0.4 : 0.2) / freqs.length;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(noteVol, t + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

            osc.connect(gain);
            gain.connect(filter);

            osc.start(t);
            osc.stop(t + 0.39);
            activeOscillators.push(osc);
          });
        });

        // Obsidian synchronized vibration rhythm: [pulse, pause, pulse, pause, long pulse]
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([120, 80, 120, 80, 280, 500]);
        }
      }

      // ─── 2. GENTLE MORNING MARIMBA ─────────────────────────────────────────
      else if (soundType === 'gentle_marimba') {
        const chord = [523.25, 659.25, 783.99, 1046.5];
        chord.forEach((freq, idx) => {
          const t = now + idx * 0.1;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(volume * 0.35, t + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.48);
          activeOscillators.push(osc);
        });

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([250, 150, 250, 400]);
        }
      }

      // ─── 3. HARMONIC PULSE BELL ────────────────────────────────────────────
      else if (soundType === 'clock_chime') {
        [783.99, 1046.5, 1318.51].forEach((freq, idx) => {
          const t = now + idx * 0.12;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(volume * 0.45, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.38);
          activeOscillators.push(osc);
        });

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([150, 80, 150, 80, 200, 300]);
        }
      }

      // ─── 4. EMERGENCY URRENT SIREN ─────────────────────────────────────────
      else if (soundType === 'android_siren') {
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
        activeOscillators.push(osc);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([350, 100, 350, 100]);
        }
      }

      // ─── 5. SYSTEM DIGITAL PRECISION ───────────────────────────────────────
      else {
        const beepTimes = [0, 0.12, 0.24, 0.36];
        const primaryFreq = 1046.5;

        beepTimes.forEach((delay) => {
          const t = now + delay;
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = 'square';
          osc.frequency.setValueAtTime(primaryFreq, t);

          gainNode.gain.setValueAtTime(0.0001, t);
          gainNode.gain.linearRampToValueAtTime(volume * 0.7, t + 0.008);
          gainNode.gain.setValueAtTime(volume * 0.7, t + 0.065);
          gainNode.gain.linearRampToValueAtTime(0.0001, t + 0.075);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(t);
          osc.stop(t + 0.08);
          activeOscillators.push(osc);
        });

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([80, 40, 80, 40, 80, 40, 80, 450]);
        }
      }
    };

    // Cycle intervals for distinct rhythms
    const intervalMap = {
      tymvera_obsidian: 1450,
      gentle_marimba: 1200,
      clock_chime: 1300,
      android_siren: 1100,
      system_digital: 950,
    };
    const cycleInterval = intervalMap[soundType] || 1450;

    playCycle();
    activeAlarmInterval = setInterval(playCycle, cycleInterval);

    return stopAlarmSound;
  } catch (err) {
    console.warn('[AlarmEngine] Alarm audio playback error:', err);
    return () => {};
  }
}

/**
 * TYMVERA Signature Notification Chime
 * Crystalline 4-tone harmonic arpeggio with obsidian bell shimmer.
 * Distinctive, elegant, and instantly recognizable.
 */
export function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // TYMVERA Signature Shimmer Chime: F#5 (739.99Hz), A#5 (932.33Hz), C#6 (1108.73Hz), F#6 (1479.98Hz)
    const tones = [
      { freq: 739.99, delay: 0.0, gain: 0.22, decay: 0.6 },
      { freq: 932.33, delay: 0.07, gain: 0.20, decay: 0.65 },
      { freq: 1108.73, delay: 0.14, gain: 0.18, decay: 0.7 },
      { freq: 1479.98, delay: 0.21, gain: 0.16, decay: 0.75 },
    ];

    // Subtle warm sub-harmonic fundamental to anchor the chime
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(369.99, now); // F#4
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.6);

    tones.forEach((tone) => {
      const t = now + tone.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Triangle wave delivers pure crystal bell resonance without harsh square edges
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(tone.freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(tone.gain, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.decay);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + tone.decay + 0.05);
    });

    // Tactile notification pulse
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([60, 40, 80]);
    }
  } catch (e) {
    console.warn('[AlarmEngine] Notification chime playback error:', e);
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
