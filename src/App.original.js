import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

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
    console.error("TYMVERA Crash Intercepted:", error, errorInfo);
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
              marginBottom: "2rem",
              maxWidth: "20rem",
            }}
          >
            An unexpected data conflict occurred. Your timeline may contain
            corrupted elements from a previous version.
          </p>
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
              marginBottom: "1rem",
            }}
          >
            Reload App
          </button>
          <button
            onClick={() => {
              const req = indexedDB.deleteDatabase("TYMVERA_PWA_DB");
              req.onsuccess = () => window.location.reload();
              req.onerror = () => {
                alert(
                  "Failed to wipe data. Try manually clearing browser cache."
                );
                window.location.reload();
              };
              req.onblocked = () => {
                alert(
                  "Please close all other tabs running this app to wipe data."
                );
                window.location.reload();
              };
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
            Wipe Data & Fix
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── INDEXEDDB ENGINE (Local-First Offline Storage) ───────────────────────────
const DB_NAME = "TYMVERA_PWA_DB";
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
    return new Promise((resolve, reject) => {
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

    // Now securely looking for icon.png
    const absoluteIconUrl = window.location.origin + "/icon.png";
    const manifest = {
      name: "TYMVERA",
      short_name: "TYMVERA",
      description: "Priority-weighted productivity tracker",
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
        const CACHE_NAME = 'TYMVERA-pwa-v22';
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
  if (diff <= 0) diff += 24 * 60; // Correctly computes cross-midnight time bridging
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

// ─── CUSTOM HOOKS ─────────────────────────────────────────────────────────────
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

// ─── THEME CLASSES ────────────────────────────────────────────────────────────
const themeColors = {
  bg: "bg-gray-50 dark:bg-[#080808]",
  surface: "bg-white dark:bg-[#151515]",
  surface2: "bg-gray-100 dark:bg-[#1e1e1e]",
  surface3: "bg-gray-200 dark:bg-[#282828]",
  border: "border-gray-200 dark:border-[#2a2a2a]",
  text: "text-gray-900 dark:text-white",
  text2: "text-gray-500 dark:text-white/60",
  text3: "text-gray-400 dark:text-white/40",
};

const pColor = (p) =>
  ({ highest: "#FF3B30", medium: "#0A84FF", lower: "#FF9F0A", lowest: "#888" }[
    p
  ] || "#888");
const sColor = (s) =>
  ({
    completed: "#32D74B",
    partial: "#FF9F0A",
    missed: "#FF3B30",
    pending: "#888",
  }[s] || "#888");

// ─── TASK CARD (Isolated Component) ───────────────────────────────────────────
const TaskCard = ({
  block,
  isToday,
  nowStr,
  prog,
  mark,
  unmark,
  openPartialModal,
  openEditingPreset,
}) => {
  if (!block) return null;
  const status = (prog && prog.status) || "pending";
  const dur = mins(block.start, block.end);
  const isActive =
    isToday &&
    block.start &&
    block.end &&
    nowStr >= block.start &&
    (block.end < block.start ? true : nowStr < block.end);
  const crossesMidnight = block.start && block.end && block.start > block.end;
  const sc = sColor(status);
  const pc = pColor(block.priority);

  const longPressProps = useLongPress(() => {
    openEditingPreset({
      ...block,
      days: block.days || [1, 2, 3, 4, 5],
      zeroXp: block.zeroXp || false,
      icon: normalizeIconName(block.icon),
    });
  }, 400);

  return (
    <div
      {...longPressProps}
      className={`${
        isActive ? themeColors.surface2 : themeColors.surface
      } border ${
        isActive ? "border-[#FF3B30]/50" : themeColors.border
      } rounded-3xl mb-3 overflow-hidden relative transition-all shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] active:scale-[0.98]`}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FF3B30]" />
      )}

      <div className="p-4 pl-5">
        <div className="flex items-start gap-4">
          <div
            className={`mt-0.5 ${
              status === "completed" ? themeColors.text3 : ""
            }`}
            style={{ color: status === "pending" ? pc : undefined }}
          >
            <Icon
              name={block.icon}
              size={24}
              style={{ fontWeight: isActive ? 600 : 400 }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <div
                className={`text-lg font-bold leading-tight truncate ${
                  status === "completed" ? "line-through opacity-50" : ""
                }`}
              >
                {block.name}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEditingPreset({
                    ...block,
                    days: block.days || [1, 2, 3, 4, 5],
                    zeroXp: block.zeroXp || false,
                    icon: normalizeIconName(block.icon),
                  });
                }}
                className={`p-1.5 -mt-1.5 -mr-2 ${themeColors.text3} active:bg-gray-200 dark:active:bg-[#333] rounded-full transition-colors`}
              >
                <Icon name="more_vert" size={20} />
              </button>
            </div>

            <div
              className={`text-[12px] font-medium tracking-wide mt-1.5 flex items-center flex-wrap gap-1 ${themeColors.text2}`}
            >
              {to12h(block.start)} – {to12h(block.end)}
              {crossesMidnight && (
                <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 rounded ml-1 uppercase">
                  (Next Day)
                </span>
              )}
              <span className="opacity-50 mx-1">•</span> {dur}m
              {block.zeroXp && (
                <span className="ml-1 text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded">
                  0XP
                </span>
              )}
            </div>

            {status !== "pending" && (
              <div
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{
                  background: sc + "15",
                  color: sc,
                  border: `1px solid ${sc}30`,
                }}
              >
                {status === "completed"
                  ? "✓ Completed"
                  : status === "partial"
                  ? `~ ${prog.actualMins}m logged`
                  : "✕ Missed"}
              </div>
            )}

            {status === "pending" && (
              <div
                className="flex gap-2 mt-4"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => mark(block.id, "completed")}
                  className="flex-2 bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] py-3 rounded-2xl text-sm font-bold w-full active:opacity-70 transition-opacity"
                >
                  Done
                </button>
                <button
                  onClick={() => openPartialModal(block)}
                  className="flex-1 bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 text-[#FF9F0A] py-3 rounded-2xl text-sm font-bold w-full active:opacity-70 transition-opacity"
                >
                  Partial
                </button>
                <button
                  onClick={() => mark(block.id, "missed")}
                  className="flex-1 bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] py-3 rounded-2xl text-sm font-bold w-full active:opacity-70 transition-opacity"
                >
                  Skip
                </button>
              </div>
            )}

            {status !== "pending" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  unmark(block.id);
                }}
                className={`mt-3 w-full py-2 text-xs font-bold border ${themeColors.border} rounded-xl ${themeColors.text3} active:opacity-70 transition-opacity`}
              >
                ↩ Undo Action
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP COMPONENT ───────────────────────────────────────────────────────
function TYMVERA() {
  const [isReady, setIsReady] = useState(false);
  const [tab, setTab] = useState("today");
  const [selDate, setSelDate] = useState(todayStr());
  const [now, setNow] = useState(new Date());

  const [history, setHistory] = useState({});
  const [presets, setPresets] = useState([]);
  const [themeMode, setThemeMode] = useState("system");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [partialModal, setPartialModal] = useState(null);
  const [partialMins, setPartialMins] = useState(30);
  const [partialReason, setPartialReason] = useState("Time shortage");
  const [editingPreset, setEditingPreset] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [cMon, setCMon] = useState(new Date());
  const [tf, setTf] = useState(7);
  const [filterTask, setFilterTask] = useState("ALL");
  const [burst, setBurst] = useState(false);

  const { deferredPrompt, setDeferredPrompt } = usePWA();

  useEffect(() => {
    let twLoaded = false;
    let dbLoaded = false;

    const checkReady = () => {
      if (twLoaded && dbLoaded) setIsReady(true);
    };

    async function loadData() {
      try {
        if (!document.getElementById("tailwind-script")) {
          const script = document.createElement("script");
          script.id = "tailwind-script";
          script.src = "https://cdn.tailwindcss.com";

          const waitForTailwindPaint = () => {
            if (document.getElementById("tailwindcss-stylesheet")) {
              setTimeout(() => {
                twLoaded = true;
                checkReady();
              }, 150);
            } else {
              setTimeout(waitForTailwindPaint, 50);
            }
          };
          script.onload = waitForTailwindPaint;
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

        const hist = await idbGet("fo6_history", {});
        const pres = await idbGet("fo6_presets", DEFAULT_PRESETS);
        const th = await idbGet("fo6_theme", "system");

        setHistory(hist || {});
        setPresets(Array.isArray(pres) ? pres : DEFAULT_PRESETS);
        setThemeMode(th || "system");

        if ("Notification" in window) {
          setNotificationsEnabled(Notification.permission === "granted");
        }

        dbLoaded = true;
        checkReady();
      } catch (err) {
        console.error("Boot Error:", err);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (isReady) {
      idbSet("fo6_history", history);
      idbSet("fo6_presets", presets);
      idbSet("fo6_theme", themeMode);
    }
  }, [history, presets, themeMode, isReady]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
    setPartialMins(Math.round(mins(block?.start, block?.end) * 0.5) || 15);
    pushHash("#partial");
  };

  const openCalendar = () => {
    setShowCalendar(true);
    pushHash("#cal");
  };

  // ─── PWA NOTIFICATION ENGINE ──────────────────────────────────────────────────
  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      alert("Your browser does not support notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotificationsEnabled(perm === "granted");
    if (perm !== "granted")
      alert("Please allow notifications in your phone settings.");
  };

  const getBlocksForDate = useCallback(
    (ds, currentPresets = presets) => {
      const log = history[ds];
      if (
        log &&
        log.blocksList &&
        Array.isArray(log.blocksList) &&
        log.blocksList.length > 0
      )
        return log.blocksList.filter(Boolean);
      const dayOfWeek = new Date(ds + "T12:00:00").getDay();
      const activePresets = (
        Array.isArray(currentPresets) ? currentPresets : []
      ).filter((p) => p && Array.isArray(p.days) && p.days.includes(dayOfWeek));
      return [...activePresets].sort((a, z) =>
        (a.start || "").localeCompare(z.start || "")
      );
    },
    [history, presets]
  );

  useEffect(() => {
    if (!notificationsEnabled) return;
    const interval = setInterval(() => {
      const d = new Date();
      const today = localDateStr(d);
      const currentTotalMins = d.getHours() * 60 + d.getMinutes();

      const todaysBlocks = getBlocksForDate(today, presets);

      todaysBlocks.forEach((b) => {
        if (!b || !b.start || typeof b.start !== "string") return;
        const [sh, sm] = b.start.split(":").map(Number);
        const startTotalMins = sh * 60 + (sm || 0);

        // Check if current time is exactly 5 minutes before the task starts
        if (currentTotalMins === startTotalMins - 5) {
          const notifKey = `notif_${today}_${b.id}`;
          // Check local storage to prevent duplicate notifications in the same minute
          if (!localStorage.getItem(notifKey)) {
            localStorage.setItem(notifKey, "true");

            const title = `Upcoming: ${b.name}`;
            const options = {
              body: `Starts in 5 minutes at ${to12h(b.start)}.`,
              icon: "/icon.png",
              badge: "/icon.png",
              vibrate: [200, 100, 200],
            };

            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
              navigator.serviceWorker.ready
                .then((reg) => {
                  reg.showNotification(title, options);
                })
                .catch(() => new Notification(title, options));
            } else {
              new Notification(title, options);
            }
          }
        }
      });
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [notificationsEnabled, presets, getBlocksForDate]);

  // ─── COMPUTED LOGIC ─────────────────────────────────────────────────────────
  const isDark = useMemo(() => {
    if (themeMode === "dark") return true;
    if (themeMode === "light") return false;
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }, [themeMode]);

  useEffect(() => {
    let metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.name = "theme-color";
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = isDark ? "#080808" : "#f9fafb";
  }, [isDark]);

  const selBlocks = useMemo(
    () => getBlocksForDate(selDate),
    [getBlocksForDate, selDate, presets]
  );
  const selLog = useMemo(() => history[selDate] || null, [history, selDate]);
  const selProg = useMemo(
    () => (selLog && selLog.blocks ? selLog.blocks : {}),
    [selLog]
  );

  const score = useMemo(
    () => calcScore(selBlocks, selProg),
    [selBlocks, selProg]
  );

  const nowStr = now.toTimeString().slice(0, 5);
  const isToday = selDate === todayStr();
  const activeBl = isToday
    ? selBlocks.find((b) => {
        if (
          !b ||
          !b.start ||
          !b.end ||
          typeof b.start !== "string" ||
          typeof b.end !== "string"
        )
          return false;
        if (b.start > b.end) return nowStr >= b.start || nowStr < b.end;
        return nowStr >= b.start && nowStr < b.end;
      })
    : null;

  const streak = useMemo(() => {
    try {
      let s = 0;
      const d = new Date();
      if (history[localDateStr(d)] && history[localDateStr(d)].dailyScore >= 50)
        s++;
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

  const allLogs = useMemo(
    () =>
      Object.values(history || {})
        .filter(Boolean)
        .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [history]
  );

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

  const dynamicAchievementsList = useMemo(() => {
    const achs = [];
    [3, 7, 14, 21, 30, 50, 100, 200, 365].forEach((d) =>
      achs.push({
        id: `streak_${d}`,
        name: `${d} Day Streak`,
        desc: `Maintain a streak for ${d} days`,
        type: "streak",
        threshold: d,
        hidden: d > 14,
      })
    );
    [1, 5, 20, 50].forEach((d) =>
      achs.push({
        id: `perfect_${d}`,
        name: `Flawless ${d}x`,
        desc: `Get a 100% score ${d} times`,
        type: "perfect",
        threshold: d,
        hidden: d > 5,
      })
    );
    achs.push({
      id: `night_owl`,
      name: `Night Owl`,
      desc: `Completed tasks between 10PM and 4AM`,
      type: "special",
      threshold: 5,
      hidden: true,
    });
    achs.push({
      id: `early_bird`,
      name: `Early Bird`,
      desc: `Crushed tasks between 4AM and 7AM`,
      type: "special",
      threshold: 5,
      hidden: true,
    });
    achs.push({
      id: `weekend_warrior`,
      name: `Weekend Warrior`,
      desc: `Stayed highly productive on Weekends`,
      type: "special",
      threshold: 10,
      hidden: true,
    });

    uniqueTaskNames.forEach((taskName) => {
      if (!taskName || typeof taskName !== "string" || !taskName.trim()) return;
      [10, 50, 100, 250, 500].forEach((h) =>
        achs.push({
          id: `task_${taskName.toLowerCase()}_${h}`,
          name: `${taskName} Master ${h}h`,
          desc: `Log ${h} hours of ${taskName}`,
          type: "task",
          target: taskName.toLowerCase(),
          threshold: h,
          hidden: h > 50,
        })
      );
    });
    return achs;
  }, [uniqueTaskNames]);

  const uIds = useMemo(() => {
    let currentStreak = 0;
    let perfects = 0;
    let weekendWarrior = 0;
    let nightOwl = 0;
    let earlyBird = 0;
    let tasksH = {};

    allLogs.forEach((log) => {
      if (!log) return;
      if (log.dailyScore >= 50) currentStreak++;
      else currentStreak = 0;
      if (log.dailyScore >= 100) perfects++;

      const logDate = new Date((log.date || "") + "T12:00:00");
      const isWeekend = isNaN(logDate)
        ? false
        : logDate.getDay() === 0 || logDate.getDay() === 6;

      Object.entries(log.blocks || {}).forEach(([bid, p]) => {
        if (!p) return;
        const bName = p.name ? String(p.name).toLowerCase() : "";
        let dur = p.actualMins || 0;
        let startHour = 12;

        if (p.status === "completed" || p.status === "partial") {
          const snap = (log.blocksList || []).find((x) => x && x.id === bid);
          if (snap) {
            if (p.status === "completed") dur = mins(snap.start, snap.end);
            startHour =
              snap.start && typeof snap.start === "string"
                ? parseInt(snap.start.split(":")[0], 10)
                : 12;
          } else {
            if (p.status === "completed") dur = 60;
          }
          if (isNaN(startHour)) startHour = 12;

          if (isWeekend) weekendWarrior++;
          if (startHour >= 22 || startHour < 4) nightOwl++;
          if (startHour >= 4 && startHour < 7) earlyBird++;

          if (bName) tasksH[bName] = (tasksH[bName] || 0) + dur / 60;
        }
      });
    });

    const ids = new Set();
    dynamicAchievementsList.forEach((a) => {
      if (a.type === "streak" && currentStreak >= a.threshold) ids.add(a.id);
      if (a.type === "perfect" && perfects >= a.threshold) ids.add(a.id);
      if (a.type === "special") {
        if (a.id === "weekend_warrior" && weekendWarrior >= a.threshold)
          ids.add(a.id);
        if (a.id === "night_owl" && nightOwl >= a.threshold) ids.add(a.id);
        if (a.id === "early_bird" && earlyBird >= a.threshold) ids.add(a.id);
      }
      if (a.type === "task" && (tasksH[a.target] || 0) >= a.threshold)
        ids.add(a.id);
    });
    return ids;
  }, [allLogs, dynamicAchievementsList]);

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
              const snap = (log.blocksList || []).find(
                (x) => x && x.id === bid
              );
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
      ? [...presets].sort((a, b) =>
          (a.start || "00:00").localeCompare(b.start || "00:00")
        )
      : [];
  }, [presets]);

  // ─── ACTION HANDLERS ─────────────────────────────────────────────────────────
  const mark = useCallback(
    (blockId, status, extras = {}) => {
      setHistory((prev) => {
        try {
          const ds = selDate;
          const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
          let snapshotBlocks = log.blocksList;
          if (
            !snapshotBlocks ||
            !Array.isArray(snapshotBlocks) ||
            snapshotBlocks.length === 0
          ) {
            const dayOfWeek = new Date(ds + "T12:00:00").getDay();
            snapshotBlocks = presets
              .filter((p) => p && p.days && p.days.includes(dayOfWeek))
              .sort((a, z) => (a.start || "").localeCompare(z.start || ""));
          }
          const currentBlock = snapshotBlocks.find(
            (b) => b && b.id === blockId
          );
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
          const snapshotBlocks =
            log.blocksList || getBlocksForDate(selDate, presets);
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
        if (exists)
          return prev.map((p) =>
            p && p.id === updatedPreset.id ? updatedPreset : p
          );
        return [...prev, updatedPreset];
      });

      setHistory((prev) => {
        const ds = selDate;
        const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
        const dayOfWeek = new Date(ds + "T12:00:00").getDay();

        let snapshotBlocks = log.blocksList;
        if (
          !snapshotBlocks ||
          !Array.isArray(snapshotBlocks) ||
          snapshotBlocks.length === 0
        ) {
          snapshotBlocks = presets
            .filter((p) => p && p.days && p.days.includes(dayOfWeek))
            .sort((a, z) => (a.start || "").localeCompare(z.start || ""));
        }

        if (updatedPreset.days && updatedPreset.days.includes(dayOfWeek)) {
          const existingIdx = snapshotBlocks.findIndex(
            (b) => b && b.id === updatedPreset.id
          );
          if (existingIdx >= 0) {
            snapshotBlocks[existingIdx] = updatedPreset;
          } else {
            snapshotBlocks.push(updatedPreset);
          }
          snapshotBlocks.sort((a, z) =>
            (a.start || "").localeCompare(z.start || "")
          );
        } else {
          snapshotBlocks = snapshotBlocks.filter(
            (b) => b && b.id !== updatedPreset.id
          );
        }

        const s = calcScore(snapshotBlocks, log.blocks);
        return {
          ...prev,
          [ds]: {
            ...log,
            blocks: log.blocks,
            dailyScore: s,
            blocksList: snapshotBlocks,
          },
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
        if (
          !snapshotBlocks ||
          !Array.isArray(snapshotBlocks) ||
          snapshotBlocks.length === 0
        ) {
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
          [ds]: {
            ...log,
            blocksList: snapshotBlocks,
            blocks: newProg,
            dailyScore: s,
          },
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
        let snapshotBlocks = log.blocksList;
        if (
          !snapshotBlocks ||
          !Array.isArray(snapshotBlocks) ||
          snapshotBlocks.length === 0
        ) {
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
          [ds]: {
            ...log,
            blocks: newProg,
            dailyScore: s,
            blocksList: snapshotBlocks,
          },
        };
      });
      closeModal(() => setEditingPreset(null));
    },
    [selDate, presets]
  );

  // ── RENDER FUNCTIONS ────────────────────────────────────────────────────────
  const renderHomeTab = () => {
    const done = selBlocks.filter(
      (b) => b && selProg[b.id]?.status === "completed"
    ).length;
    const partial = selBlocks.filter(
      (b) => b && selProg[b.id]?.status === "partial"
    ).length;
    const pending =
      selBlocks.length -
      done -
      partial -
      selBlocks.filter((b) => b && selProg[b.id]?.status === "missed").length;

    const scoreLabel =
      score > 100
        ? "🌟 Overachiever!"
        : score >= 90
        ? "🔥 Crushing It"
        : score >= 75
        ? "⚡ On Track"
        : score >= 50
        ? "🎯 Making Progress"
        : score > 0
        ? "📈 Started"
        : "🌅 New Day";

    let activeBlProgress = 0;
    if (
      isToday &&
      activeBl &&
      activeBl.start &&
      activeBl.end &&
      typeof activeBl.start === "string" &&
      typeof activeBl.end === "string"
    ) {
      const [sh, sm] = activeBl.start.split(":").map(Number);
      const [eh, em] = activeBl.end.split(":").map(Number);
      const startMins = sh * 60 + (sm || 0);
      let endMins = eh * 60 + (em || 0);
      if (endMins <= startMins) endMins += 24 * 60;
      let currentMins =
        now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      if (currentMins < startMins && endMins > 24 * 60) currentMins += 24 * 60;

      activeBlProgress = Math.max(
        0,
        Math.min(100, ((currentMins - startMins) / (endMins - startMins)) * 100)
      );
    }

    const selDateObj = new Date(selDate);
    const formattedDate = isNaN(selDateObj)
      ? "Today"
      : selDateObj.toLocaleDateString("en", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

    return (
      <div className="pb-32 select-none animate-in fade-in duration-500">
        <div className="px-5 pt-8 pb-4 flex justify-between items-end">
          <button
            onClick={openCalendar}
            className="flex items-center gap-3 active:scale-95 transition-transform bg-gray-100 dark:bg-[#1a1a1a] px-4 py-2 rounded-full"
          >
            <span className="text-xl font-black tracking-tight">
              {isToday ? "Today" : formattedDate}
            </span>
            <Icon
              name="calendar_month"
              size={20}
              className={themeColors.text2}
            />
          </button>
        </div>

        <div className="px-4 mb-6">
          <div
            className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 flex items-center gap-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]`}
          >
            <svg
              width={96}
              height={96}
              viewBox={`0 0 84 84`}
              className="rotate-[-90deg]"
            >
              <circle
                cx={42}
                cy={42}
                r={37}
                fill="none"
                className="stroke-gray-100 dark:stroke-[#222]"
                strokeWidth={6}
              />
              <circle
                cx={42}
                cy={42}
                r={37}
                fill="none"
                stroke={
                  score > 100
                    ? "#BF5AF2"
                    : score >= 80
                    ? "#32D74B"
                    : score >= 50
                    ? "#FF9F0A"
                    : score > 0
                    ? "#FF3B30"
                    : "transparent"
                }
                strokeWidth={6}
                strokeDasharray={`${
                  (Math.min(score, 100) / 100) * (2 * Math.PI * 37)
                } ${2 * Math.PI * 37}`}
                strokeLinecap="round"
                style={{
                  transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)",
                }}
              />
              <text
                x="50%"
                y="50%"
                dominantBaseline="middle"
                textAnchor="middle"
                transform={`rotate(90 42 42)`}
                fill={
                  score > 100
                    ? "#BF5AF2"
                    : score >= 80
                    ? "#32D74B"
                    : score >= 50
                    ? "#FF9F0A"
                    : score > 0
                    ? "#FF3B30"
                    : isDark
                    ? "#444"
                    : "#d1d5db"
                }
                fontSize={22}
                fontWeight="800"
                fontFamily="sans-serif"
              >
                {score}%
              </text>
            </svg>
            <div className="flex-1">
              <div
                className={`text-[10px] uppercase tracking-[0.2em] font-mono ${themeColors.text3} mb-1.5`}
              >
                Status
              </div>
              <div
                className={`text-2xl font-black leading-tight mb-2 tracking-tight ${
                  score > 100 ? "text-[#BF5AF2]" : ""
                }`}
              >
                {scoreLabel}
              </div>
              <div className="flex gap-3 text-sm font-bold">
                {done > 0 && <span className="text-[#32D74B]">✓ {done}</span>}
                {partial > 0 && (
                  <span className="text-[#FF9F0A]">~ {partial}</span>
                )}
                {pending > 0 && (
                  <span className={themeColors.text3}>◦ {pending} left</span>
                )}
              </div>
            </div>
            <div className="text-center min-w-[50px]">
              <div
                className={`text-3xl font-black font-mono ${
                  streak > 0 ? "text-[#FF9F0A]" : themeColors.text3
                } leading-none`}
              >
                {streak}
              </div>
              <div
                className={`text-[9px] uppercase tracking-widest ${themeColors.text3} mt-1.5 font-bold`}
              >
                Streak
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Widget */}
        {isToday && activeBl && (
          <div className="px-4 mb-6">
            <div
              className={`bg-gradient-to-br from-[#FF3B30]/10 to-transparent border border-[#FF3B30]/20 rounded-[32px] p-6 relative overflow-hidden shadow-sm`}
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-[#FF3B30]/10 transition-all duration-1000 ease-linear"
                style={{ width: `${activeBlProgress}%` }}
              />

              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF3B30] animate-pulse shadow-[0_0_12px_#FF3B30]" />
                    <div className="text-[11px] text-[#FF3B30] font-black tracking-[0.2em] font-mono uppercase">
                      Live Now
                    </div>
                  </div>
                  <div className="text-xl font-black tracking-tight leading-tight text-gray-900 dark:text-white">
                    {activeBl.name}
                  </div>
                  <div className="text-sm font-semibold opacity-70 mt-1 text-gray-900 dark:text-white">
                    {to12h(activeBl.start)} - {to12h(activeBl.end)}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="text-3xl font-light font-mono tracking-tighter text-[#FF3B30]">
                    {now.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </div>
                  <div className="text-[10px] font-mono text-[#FF3B30]/80 uppercase tracking-widest mt-1 font-bold">
                    {now.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>

              {(!selProg[activeBl.id] ||
                selProg[activeBl.id].status === "pending") && (
                <div className="relative z-10 mt-6">
                  <button
                    onClick={() => mark(activeBl.id, "completed")}
                    className="w-full bg-[#32D74B]/20 text-[#32D74B] border border-[#32D74B]/30 px-4 py-3.5 rounded-[20px] text-base font-black active:scale-[0.98] transition-transform flex justify-center items-center gap-2 shadow-sm"
                  >
                    <Icon name="check_circle" size={20} /> Mark as Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-4">
          <div className="flex justify-between items-center mb-4 mx-2">
            <div
              className={`text-[11px] font-mono tracking-[2px] uppercase font-bold ${themeColors.text3}`}
            >
              Timeline · {selBlocks.length} blocks
            </div>
          </div>

          {selBlocks.map((block, idx) => (
            <TaskCard
              key={block?.id || `fallback_${idx}`}
              block={block}
              prog={block ? selProg[block.id] : null}
              isToday={isToday}
              nowStr={nowStr}
              mark={mark}
              unmark={unmark}
              openPartialModal={openPartialModal}
              openEditingPreset={openEditingPreset}
            />
          ))}

          {/* Quick Add Button on Home Timeline */}
          <button
            onClick={() =>
              openEditingPreset({
                id: `new_${Date.now()}`,
                name: "",
                start: "12:00",
                end: "13:00",
                priority: "medium",
                days: [0, 1, 2, 3, 4, 5, 6],
                icon: "ads_click",
                zeroXp: false,
              })
            }
            className={`w-full mt-2 mb-8 py-4 flex items-center justify-center gap-2 text-blue-500 font-black border-2 border-dashed ${themeColors.border} rounded-3xl active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors text-base opacity-70 hover:opacity-100`}
          >
            <Icon name="add" size={20} /> Add Block
          </button>
        </div>
      </div>
    );
  };

  const renderProgressTab = () => {
    const maxValReal = Math.max(0, ...chartData.map((d) => d.val));
    const maxValChart =
      filterTask === "ALL"
        ? Math.max(100, maxValReal)
        : Math.max(1, maxValReal);

    const totalVal = chartData.reduce((acc, curr) => acc + curr.val, 0);
    const avgVal = chartData.length > 0 ? totalVal / chartData.length : 0;

    const width = 340;
    const height = 180;
    const xStep = chartData.length > 1 ? width / (chartData.length - 1) : width;

    const points = chartData.map((d, i) => {
      const x = i * xStep;
      let rawY = height - (d.val / maxValChart) * height;
      if (isNaN(rawY) || !isFinite(rawY)) rawY = height;
      const y = Math.max(15, rawY);
      return { x, y, ...d };
    });

    let areaD = "",
      pathD = "";
    if (points.length > 0) {
      pathD =
        `M ${points[0].x} ${points[0].y} ` +
        points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(" ");
      areaD = `${pathD} L ${
        points[points.length - 1].x
      } ${height} L 0 ${height} Z`;
    }

    return (
      <div className="pb-32 select-none animate-in fade-in duration-500">
        <div className="px-4 pt-8 mb-6">
          <h1 className="text-3xl font-black tracking-tight mb-6">Analytics</h1>
          <div
            className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 mb-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]`}
          >
            <div className="flex justify-between items-center mb-6">
              <select
                value={filterTask}
                onChange={(e) => setFilterTask(e.target.value)}
                className={`bg-transparent outline-none font-black text-xl appearance-none text-black dark:text-white max-w-[150px] truncate cursor-pointer`}
              >
                {dynamicFilterOptions.map((opt) => (
                  <option
                    key={opt}
                    value={opt}
                    className="bg-white dark:bg-[#151515] font-sans"
                  >
                    {opt === "ALL" ? "Overall Score" : `${opt} (Hrs)`}
                  </option>
                ))}
              </select>
              <div
                className={`flex bg-gray-100 dark:bg-[#222] p-1.5 rounded-2xl text-xs font-bold`}
              >
                {[7, 30, 180, 365].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTf(v)}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      tf === v
                        ? "bg-white dark:bg-[#333] shadow-sm text-black dark:text-white scale-105"
                        : themeColors.text3
                    }`}
                  >
                    {v === 365 ? "1Y" : v === 180 ? "6M" : `${v}D`}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length < 2 ? (
              <div
                className={`h-40 flex items-center justify-center ${themeColors.text3} text-sm font-medium`}
              >
                Need more data to generate chart.
              </div>
            ) : (
              <div
                className="relative mt-4 overflow-visible rounded-2xl"
                style={{ width: "100%", aspectRatio: "340/200" }}
              >
                <svg
                  viewBox={`-10 -20 ${width + 20} ${height + 40}`}
                  className="w-full h-full overflow-visible"
                >
                  {filterTask === "Sleep" && (
                    <rect
                      x="0"
                      y={height - (9 / maxValChart) * height}
                      width={width}
                      height={((9 - 7) / maxValChart) * height}
                      fill="#32D74B"
                      opacity="0.1"
                    />
                  )}
                  <path
                    d={areaD}
                    fill={
                      isDark
                        ? "rgba(10, 132, 255, 0.15)"
                        : "rgba(10, 132, 255, 0.1)"
                    }
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#0A84FF"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((p, i) => {
                    let dotCol = "#0A84FF";
                    if (filterTask === "Sleep")
                      dotCol = p.val >= 7 && p.val <= 9 ? "#32D74B" : "#FF3B30";
                    else if (filterTask === "ALL")
                      dotCol =
                        p.val > 100
                          ? "#BF5AF2"
                          : p.val >= 80
                          ? "#32D74B"
                          : p.val >= 50
                          ? "#FF9F0A"
                          : "#FF3B30";

                    let anchor = "middle";
                    if (i === 0) anchor = "start";
                    if (i === points.length - 1 && points.length > 1)
                      anchor = "end";

                    const dObj = new Date(p.date);
                    const dateStr = isNaN(dObj)
                      ? ""
                      : dObj.toLocaleDateString("en-US", { weekday: "short" });

                    return (
                      <g key={i}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="5"
                          fill={isDark ? "#111" : "#fff"}
                          stroke={dotCol}
                          strokeWidth="3"
                        />
                        <text
                          x={p.x}
                          y={p.y - 12}
                          fontSize="11"
                          fill={themeColors.text2}
                          textAnchor={anchor}
                          fontWeight="bold"
                          className="font-mono"
                        >
                          {filterTask === "ALL"
                            ? `${Math.round(p.val)}%`
                            : `${p.val.toFixed(1)}h`}
                        </text>
                        <text
                          x={p.x}
                          y={height + 20}
                          fontSize="9"
                          fill={themeColors.text3}
                          textAnchor={anchor}
                          fontWeight="bold"
                          className="font-mono uppercase tracking-wider"
                        >
                          {dateStr}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mt-8">
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Average
                </div>
                <div className="text-xl font-black text-blue-500">
                  {filterTask === "ALL"
                    ? Math.round(avgVal) + "%"
                    : avgVal.toFixed(1) + "h"}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Best
                </div>
                <div className="text-xl font-black text-[#32D74B]">
                  {filterTask === "ALL"
                    ? Math.round(maxValReal) + "%"
                    : maxValReal.toFixed(1) + "h"}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Total
                </div>
                <div className="text-xl font-black text-[#FF9F0A]">
                  {filterTask === "ALL"
                    ? chartData.length + " Days"
                    : totalVal.toFixed(1) + "h"}
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-[11px] font-mono tracking-[2px] uppercase font-bold mb-4 mt-10 ml-2 text-gray-500">
            Unlocked Milestones
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {dynamicAchievementsList
              .filter((a) => uIds.has(a.id) || !a.hidden)
              .map((a) => {
                const isUnl = uIds.has(a.id);
                return (
                  <div
                    key={a.id}
                    className={`${themeColors.surface} border ${
                      isUnl
                        ? "border-[#FF9F0A]/50 bg-gradient-to-br from-[#FF9F0A]/5 to-transparent"
                        : themeColors.border
                    } rounded-3xl p-5 relative overflow-hidden transition-all ${
                      !isUnl && "opacity-60 grayscale"
                    }`}
                  >
                    {isUnl && (
                      <div className="absolute top-0 right-0 w-10 h-10 bg-[#FF9F0A]/10 rounded-bl-3xl flex items-center justify-center">
                        <Icon
                          name="star"
                          size={16}
                          className="text-[#FF9F0A]"
                        />
                      </div>
                    )}
                    <div
                      className={`font-black text-base mb-1.5 leading-tight tracking-tight ${
                        isUnl ? "text-[#FF9F0A]" : themeColors.text3
                      }`}
                    >
                      {a.name}
                    </div>
                    <div
                      className={`text-[10px] leading-snug font-medium ${themeColors.text3}`}
                    >
                      {a.desc}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  };

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
        <h1 className="text-3xl font-black tracking-tight mb-8">Settings</h1>

        {deferredPrompt && (
          <div className="mb-8">
            <button
              onClick={handleInstallClick}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black py-4 rounded-[24px] flex justify-center items-center gap-3 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform text-lg"
            >
              <Icon name="download" size={24} /> Install TYMVERA App
            </button>
            <p className="text-xs text-center font-medium text-gray-500 mt-3 px-4">
              Installs a lightning-fast, offline-capable version directly to
              your device.
            </p>
          </div>
        )}

        <div
          className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}
        >
          Notifications
        </div>
        <div
          className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden shadow-sm mb-8`}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-[#222]">
            <div>
              <div className="text-base font-bold text-gray-900 dark:text-white">
                5-Minute Warnings
              </div>
              <div className="text-xs font-medium text-gray-500 mt-1">
                Get an alert before tasks start
              </div>
            </div>
            <button
              onClick={requestNotifications}
              className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${
                notificationsEnabled
                  ? "bg-[#32D74B]"
                  : "bg-gray-200 dark:bg-[#333]"
              }`}
            >
              <div
                className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                  notificationsEnabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-end mb-3 ml-2 mt-8">
          <div
            className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3}`}
          >
            Task Library & Presets
          </div>
        </div>

        <div
          className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden mb-8 shadow-sm`}
        >
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

          <div className="max-h-[60vh] overflow-y-auto scroll-smooth">
            {sortedPresets.map((p) => {
              const tObj = to12hObj(p.start);

              return (
                <div
                  key={p.id}
                  onClick={() => openEditingPreset(p)}
                  className="flex flex-col p-6 border-b border-gray-100 dark:border-[#222] active:bg-gray-50 dark:active:bg-[#1a1a1a] cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-light tracking-tight leading-none">
                          {tObj.time}
                        </span>
                        <span className="text-sm font-bold text-gray-500 tracking-wider uppercase">
                          {tObj.period}
                        </span>
                      </div>
                      <div className="text-sm font-black mt-3 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <Icon name={p.icon || "monitoring"} size={16} />
                        {p.name}
                        {p.zeroXp && (
                          <span className="text-[9px] uppercase tracking-wider bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded font-black">
                            0XP
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Icon
                        name="chevron_right"
                        size={24}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity ${themeColors.text3}`}
                      />
                      <div
                        className={`text-xs font-mono font-bold text-gray-400 mt-2`}
                      >
                        {mins(p.start, p.end)}m
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {DAYS.map((d, i) => (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black transition-colors ${
                          p.days.includes(i)
                            ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
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

        <div
          className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}
        >
          Appearance
        </div>
        <div
          className={`${themeColors.surface} border ${themeColors.border} rounded-3xl p-2.5 flex mb-8 shadow-sm`}
        >
          {["light", "dark", "system"].map((m) => (
            <button
              key={m}
              onClick={() => setThemeMode(m)}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-black capitalize transition-all ${
                themeMode === m
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                  : themeColors.text3
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div
          className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}
        >
          Data Engine (IndexedDB)
        </div>
        <div
          className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden shadow-sm`}
        >
          <button
            onClick={() => {
              const req = indexedDB.deleteDatabase("TYMVERA_PWA_DB");
              req.onsuccess = () => window.location.reload();
              req.onerror = () => {
                alert("Failed to wipe. Please try again.");
                window.location.reload();
              };
            }}
            className="w-full p-6 text-left text-[#FF3B30] font-black border-b border-gray-100 dark:border-[#222] active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors"
          >
            Delete All History
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Reset task presets to default system configuration?"
                )
              )
                setPresets(DEFAULT_PRESETS);
            }}
            className="w-full p-6 text-left text-[#FF9F0A] font-black active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors"
          >
            Factory Reset Presets
          </button>
        </div>
      </div>
    );
  };

  const renderPresetEditor = () => {
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
                Start
              </label>
              <input
                type="time"
                value={editingPreset.start}
                onChange={(e) =>
                  setEditingPreset({ ...editingPreset, start: e.target.value })
                }
                className="w-full text-xl sm:text-2xl font-black bg-gray-100 dark:bg-[#222] rounded-2xl py-3 px-1 text-center text-gray-900 dark:text-white border-none outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                required
              />
            </div>
            <Icon
              name="arrow_forward"
              size={24}
              className="text-gray-300 dark:text-gray-600 mt-6"
            />
            <div className="flex flex-col items-center flex-1">
              <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold mb-3">
                End
              </label>
              <input
                type="time"
                value={editingPreset.end}
                onChange={(e) =>
                  setEditingPreset({ ...editingPreset, end: e.target.value })
                }
                className="w-full text-xl sm:text-2xl font-black bg-gray-100 dark:bg-[#222] rounded-2xl py-3 px-1 text-center text-gray-900 dark:text-white border-none outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                required
              />
            </div>
          </div>

          <div className="flex justify-between mb-8 px-2">
            {DAYS.map((d, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-black transition-all
                  ${
                    editingPreset.days.includes(i)
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-110"
                      : "bg-white border border-gray-200 dark:bg-[#151515] dark:border-[#222] text-gray-400"
                  }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-[#151515] rounded-[32px] overflow-hidden border border-gray-200 dark:border-[#222] shadow-sm">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-[#222]">
              <span className="text-base font-bold">Task Name</span>
              <input
                value={editingPreset.name}
                onChange={(e) =>
                  setEditingPreset({ ...editingPreset, name: e.target.value })
                }
                placeholder="e.g. Deep Work"
                className="text-right bg-transparent outline-none text-gray-500 font-bold w-1/2"
              />
            </div>
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-[#222]">
              <span className="text-base font-bold">Icon</span>
              <div className="relative">
                <select
                  value={normalizeIconName(editingPreset.icon)}
                  onChange={(e) =>
                    setEditingPreset({ ...editingPreset, icon: e.target.value })
                  }
                  className="text-right bg-transparent outline-none text-blue-500 font-bold appearance-none pl-8 pr-4 py-2 relative z-10"
                  style={{ fontFamily: '"Material Symbols Rounded"' }}
                >
                  {ICONS.map((k) => (
                    <option
                      key={k}
                      value={k}
                      className="bg-white dark:bg-[#151515] text-black dark:text-white"
                      style={{ fontFamily: '"Material Symbols Rounded"' }}
                    >
                      {k}
                    </option>
                  ))}
                </select>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-0 text-blue-500 pointer-events-none flex items-center">
                  <Icon name={editingPreset.icon || "monitoring"} size={20} />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-[#222]">
              <span className="text-base font-bold">Priority Weight</span>
              <select
                value={editingPreset.priority}
                onChange={(e) =>
                  setEditingPreset({
                    ...editingPreset,
                    priority: e.target.value,
                  })
                }
                className="text-right bg-transparent outline-none font-bold appearance-none"
                style={{ color: pColor(editingPreset.priority) }}
              >
                <option
                  value="highest"
                  className="bg-white dark:bg-[#151515] text-black dark:text-white"
                >
                  Highest Weight
                </option>
                <option
                  value="medium"
                  className="bg-white dark:bg-[#151515] text-black dark:text-white"
                >
                  Medium Weight
                </option>
                <option
                  value="lower"
                  className="bg-white dark:bg-[#151515] text-black dark:text-white"
                >
                  Lower Weight
                </option>
                <option
                  value="lowest"
                  className="bg-white dark:bg-[#151515] text-black dark:text-white"
                >
                  Lowest Weight
                </option>
              </select>
            </div>
            <div className="flex justify-between items-center p-5">
              <div>
                <div className="text-base font-bold">0 XP Routine</div>
                <div className="text-xs font-medium text-gray-400 mt-1">
                  Excludes task from daily score %
                </div>
              </div>
              <button
                onClick={() =>
                  setEditingPreset({
                    ...editingPreset,
                    zeroXp: !editingPreset.zeroXp,
                  })
                }
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${
                  editingPreset.zeroXp
                    ? "bg-blue-500"
                    : "bg-gray-200 dark:bg-[#333]"
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                    editingPreset.zeroXp ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-8">
            {!isUnsavedNew && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const duplicated = {
                      ...editingPreset,
                      id: `new_${Date.now()}`,
                    };
                    savePreset(duplicated);
                  }}
                  className="flex-1 py-4 rounded-3xl bg-blue-500/10 text-blue-500 font-black active:opacity-70 transition-opacity flex items-center justify-center gap-2"
                >
                  <Icon name="content_copy" size={18} /> Duplicate
                </button>

                <button
                  onClick={() => removeTaskFromToday(editingPreset.id)}
                  className="flex-1 py-4 rounded-3xl bg-[#FF9F0A]/10 text-[#FF9F0A] font-black active:opacity-70 transition-opacity flex items-center justify-center gap-2"
                >
                  <Icon name="event_busy" size={18} /> Hide Today
                </button>
              </div>
            )}
            {!isUnsavedNew && (
              <button
                onClick={() => deletePreset(editingPreset.id)}
                className="w-full py-4 rounded-3xl bg-[#FF3B30]/10 text-[#FF3B30] font-black active:opacity-70 transition-opacity flex items-center justify-center gap-2"
              >
                <Icon name="delete_forever" size={18} /> Delete Globally
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPartialModal = () => {
    if (!partialModal || !partialModal.block) return null;
    return (
      <div className="fixed inset-0 bg-black/80 z-[2000] flex flex-col justify-end p-3 animate-in fade-in select-none backdrop-blur-sm">
        <div
          className={`${themeColors.surface} rounded-[36px] p-8 w-full max-w-[414px] mx-auto border ${themeColors.border} shadow-2xl`}
        >
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-8" />
          <div className="text-center mb-10">
            <div
              className={`text-xs uppercase tracking-[2px] font-mono font-bold ${themeColors.text3} mb-2`}
            >
              Partial Log
            </div>
            <div className="text-2xl font-black tracking-tight">
              {partialModal.block.name}
            </div>
          </div>
          <div className="flex justify-center items-center gap-6 mb-10">
            <button
              onClick={() => setPartialMins(Math.max(1, partialMins - 15))}
              className={`w-14 h-14 rounded-full ${themeColors.surface2} flex items-center justify-center font-black text-xl active:scale-90 transition-transform`}
            >
              -
            </button>
            <div className="flex flex-col items-center">
              <input
                type="number"
                value={partialMins}
                onChange={(e) =>
                  setPartialMins(Math.max(1, Number(e.target.value)))
                }
                className="text-6xl font-black bg-transparent outline-none w-32 text-center text-[#FF9F0A] appearance-none"
              />
              <span
                className={`text-sm font-bold tracking-widest uppercase ${themeColors.text3} mt-2`}
              >
                mins logged
              </span>
            </div>
            <button
              onClick={() => setPartialMins(partialMins + 15)}
              className={`w-14 h-14 rounded-full ${themeColors.surface2} flex items-center justify-center font-black text-xl active:scale-90 transition-transform`}
            >
              +
            </button>
          </div>
          <select
            value={partialReason}
            onChange={(e) => setPartialReason(e.target.value)}
            className={`w-full p-4 rounded-2xl appearance-none outline-none ${themeColors.surface2} border ${themeColors.border} mb-6 font-bold text-center text-lg text-black dark:text-white`}
          >
            {[
              "Ran out of time",
              "Got distracted",
              "Low energy",
              "Interrupted",
              "Over-logged (Bonus Time)",
              "Other",
            ].map((r) => (
              <option
                key={r}
                className="bg-white dark:bg-black text-black dark:text-white"
              >
                {r}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <button
              onClick={() => closeModal(() => setPartialModal(null))}
              className={`flex-1 py-4 rounded-2xl ${themeColors.surface2} font-black active:opacity-70 transition-opacity`}
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
              className="flex-1 py-4 rounded-2xl bg-[#FF9F0A] text-black font-black active:opacity-70 transition-opacity"
            >
              Save Log
            </button>
          </div>
        </div>
      </div>
    );
  };

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
            <span className="font-black text-xl">{monthName}</span>
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
                className={`text-center text-[10px] uppercase font-mono font-bold tracking-widest ${themeColors.text3}`}
              >
                {l}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(
                day
              ).padStart(2, "0")}`;
              const sc = history[ds] ? history[ds].dailyScore : -1;
              const isSel = ds === selDate;
              // Add purple dot for overachiever scores on calendar!
              const col =
                sc > 100
                  ? "#BF5AF2"
                  : sc >= 80
                  ? "#32D74B"
                  : sc >= 50
                  ? "#FF9F0A"
                  : sc >= 0
                  ? "#FF3B30"
                  : null;

              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelDate(ds);
                    closeModal(() => setShowCalendar(false));
                  }}
                  className={`aspect-square rounded-full flex flex-col items-center justify-center relative font-black text-sm transition-all
                  ${
                    isSel
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40 scale-110 z-10"
                      : col
                      ? `${themeColors.surface2}`
                      : "text-gray-400 dark:text-gray-600"
                  } active:scale-90`}
                >
                  {day}
                  {col && !isSel && (
                    <div
                      className="absolute bottom-2 w-1.5 h-1.5 rounded-full"
                      style={{ background: col }}
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

  const renderConfetti = () => {
    const particles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: 5 + Math.floor(Math.random() * 90),
      color: ["#FF3B30", "#32D74B", "#FF9F0A", "#0A84FF", "#BF5AF2"][i % 5],
      size: 4 + Math.random() * 8,
      circle: i % 2 === 0,
      dur: 0.8 + Math.random() * 0.6,
      delay: Math.random() * 0.1,
    }));
    return (
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: "25%",
              width: p.size,
              height: p.size,
              borderRadius: p.circle ? "50%" : 4,
              background: p.color,
              animation: `cfFall ${p.dur}s cubic-bezier(.25,.46,.45,.94) ${p.delay}s both`,
            }}
          />
        ))}
        <style>{`@keyframes cfFall { 0% { transform: translateY(-20px) rotate(0deg) scale(1); opacity: 1; } 100% { transform: translateY(300px) rotate(720deg) scale(0); opacity: 0; } }`}</style>
      </div>
    );
  };

  // ─── SMART POLLING SPLASH SCREEN ─────────────────────────────────────────────
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
          transition: "opacity 0.5s ease",
        }}
      >
        <img
          src="icon.png"
          alt="TYMVERA"
          style={{
            width: 100,
            height: 100,
            borderRadius: 28,
            marginBottom: 40,
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

          <div
            className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] ${
              isDark ? "bg-[#080808]/90" : "bg-white/90"
            } backdrop-blur-xl border-t ${
              themeColors.border
            } flex pb-safe pt-2 z-[100] pb-6`}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 py-2 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Icon
                    name={t.icon}
                    size={28}
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
      <TYMVERA />
    </ErrorBoundary>
  );
}
