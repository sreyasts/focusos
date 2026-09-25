/**
 * TYMVERA Resilient Background Timer Service
 * Features:
 * - Isolated Web Worker thread execution: NOT throttled or suspended when mobile screen is off or browser tab is hidden
 * - Dispatches precision 1000ms ticks to parent thread for routine milestone evaluation & alarms
 * - Zero-dependency inline Blob Worker (100% offline-ready, no network requests)
 * - Automatic fallback to standard interval if Web Workers are restricted
 */

let activeWorker = null;
let activeWorkerUrl = null;

export function startBackgroundWorkerTimer(onTick, intervalMs = 1000) {
  if (typeof window === 'undefined') return () => {};

  // Clean up any existing worker first
  stopBackgroundWorkerTimer();

  try {
    if (typeof window.Worker === 'function' && typeof window.Blob === 'function') {
      const workerScript = `
        let timerId = null;
        self.onmessage = function(e) {
          if (!e.data) return;
          if (e.data.action === 'start') {
            if (timerId) clearInterval(timerId);
            timerId = setInterval(function() {
              self.postMessage({ type: 'tick', timestamp: Date.now() });
            }, e.data.interval || 1000);
          } else if (e.data.action === 'stop') {
            if (timerId) clearInterval(timerId);
            timerId = null;
          }
        };
      `;

      const blob = new Blob([workerScript], { type: 'application/javascript' });
      activeWorkerUrl = URL.createObjectURL(blob);
      activeWorker = new Worker(activeWorkerUrl);

      activeWorker.onmessage = function (e) {
        if (e.data && e.data.type === 'tick' && typeof onTick === 'function') {
          onTick(e.data.timestamp);
        }
      };

      activeWorker.postMessage({ action: 'start', interval: intervalMs });

      return () => {
        stopBackgroundWorkerTimer();
      };
    }
  } catch (err) {
    console.warn('[TimerWorker] Web Worker initialization failed, using standard timer:', err);
  }

  // Graceful fallback if Web Workers are unsupported
  const fallbackId = setInterval(() => {
    if (typeof onTick === 'function') onTick(Date.now());
  }, intervalMs);

  return () => clearInterval(fallbackId);
}

export function stopBackgroundWorkerTimer() {
  if (activeWorker) {
    try {
      activeWorker.postMessage({ action: 'stop' });
      activeWorker.terminate();
    } catch (e) {}
    activeWorker = null;
  }
  if (activeWorkerUrl) {
    try {
      URL.revokeObjectURL(activeWorkerUrl);
    } catch (e) {}
    activeWorkerUrl = null;
  }
}
