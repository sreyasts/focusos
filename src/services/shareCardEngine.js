/**
 * TYMVERA - Daily Focus Story Card Generator
 * Zero-dependency HTML5 Canvas 2D engine that renders a high-res (1080x1920, 9:16)
 * story card optimized for Instagram Stories, WhatsApp Status, and Snapchat.
 * Only unlocks when the user has actually logged real focus time (30+ mins or completed sessions).
 */

export const MIN_FOCUS_MINS_TO_UNLOCK = 30;

/**
 * Checks if the user has studied enough today to unlock the daily card.
 */
export function isDailyCardUnlocked(focusMins, doneCount) {
  return (focusMins || 0) >= MIN_FOCUS_MINS_TO_UNLOCK || (doneCount || 0) >= 1;
}

/**
 * Formats minutes into human-readable hours and mins (e.g. 4h 30m).
 */
export function formatFocusDuration(totalMins) {
  const m = Math.max(0, Math.round(totalMins || 0));
  const hrs = Math.floor(m / 60);
  const minsRemaining = m % 60;
  if (hrs > 0 && minsRemaining > 0) return `${hrs}h ${minsRemaining}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${minsRemaining}m`;
}

/**
 * Renders a high-resolution 1080x1920 9:16 story image onto an offscreen canvas.
 * @returns {Promise<{ dataUrl: string, blob: Blob }>}
 */
export function renderDailyFocusCard(stats) {
  return new Promise((resolve, reject) => {
    try {
      const {
        dateStr = new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        focusMins = 0,
        score = 0,
        streak = 0,
        doneCount = 0,
        totalCount = 0,
        tier1Done = 0,
        tier1Total = 0,
      } = stats;

      const width = 1080;
      const height = 1920;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Unable to initialize Canvas 2D context");
      }

      // ─── 1. BACKGROUND (Deep Obsidian & Subtle Cyan/Violet Mesh) ───────────
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, "#05070a");
      bgGrad.addColorStop(0.5, "#090d14");
      bgGrad.addColorStop(1, "#030407");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric glow rings
      const glow1 = ctx.createRadialGradient(width * 0.5, height * 0.35, 50, width * 0.5, height * 0.35, 600);
      glow1.addColorStop(0, "rgba(59, 130, 246, 0.12)"); // Electric Blue
      glow1.addColorStop(0.5, "rgba(16, 185, 129, 0.06)"); // Emerald
      glow1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      const glow2 = ctx.createRadialGradient(width * 0.8, height * 0.85, 50, width * 0.8, height * 0.85, 500);
      glow2.addColorStop(0, "rgba(245, 158, 11, 0.08)"); // Amber Flame
      glow2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      // Subtle grid dot pattern
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      for (let x = 60; x < width; x += 60) {
        for (let y = 60; y < height; y += 60) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ─── 2. TOP HEADER (Branding & Verified Badge) ─────────────────────────
      // Outer border frame
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      roundRect(ctx, 60, 60, width - 120, height - 120, 48);
      ctx.stroke();

      // Top Header Pill
      const pillY = 140;
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, (width - 440) / 2, pillY, 440, 56, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚡ VERIFIED STUDY SESSION", width / 2, pillY + 28);

      // App Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 44px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "6px";
      ctx.fillText("TYMVERA", width / 2, 260);

      // Date subtitle
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 24px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "1px";
      ctx.fillText(String(dateStr).toUpperCase(), width / 2, 310);

      // ─── 3. HERO SECTION (Total Focus Time) ────────────────────────────────
      // Main Center Card
      const heroY = 400;
      const heroH = 430;
      const heroW = width - 200;
      const heroX = 100;

      // Card Background with glassmorphism border
      const heroGrad = ctx.createLinearGradient(heroX, heroY, heroX, heroY + heroH);
      heroGrad.addColorStop(0, "rgba(255, 255, 255, 0.05)");
      heroGrad.addColorStop(1, "rgba(255, 255, 255, 0.02)");
      ctx.fillStyle = heroGrad;
      roundRect(ctx, heroX, heroY, heroW, heroH, 36);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Big Focus Time
      const timeStr = formatFocusDuration(focusMins);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 110px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "-2px";
      ctx.fillText(timeStr, width / 2, heroY + 170);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "4px";
      ctx.fillText("TOTAL FOCUS LOGGED TODAY", width / 2, heroY + 245);

      // Divider inside hero card
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(heroX + 50, heroY + 290);
      ctx.lineTo(heroX + heroW - 50, heroY + 290);
      ctx.stroke();

      // Hero Card Bottom Stats (Score & Streak)
      const col1X = heroX + heroW * 0.28;
      const col2X = heroX + heroW * 0.72;
      const subStatY = heroY + 355;

      // Score Stat
      ctx.fillStyle = score >= 80 ? "#10b981" : "#f59e0b";
      ctx.font = "900 44px system-ui, -apple-system, sans-serif";
      ctx.fillText(`${score}%`, col1X, subStatY - 10);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 20px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "1px";
      ctx.fillText("COMPLETION SCORE", col1X, subStatY + 28);

      // Streak Stat
      ctx.fillStyle = "#f59e0b";
      ctx.font = "900 44px system-ui, -apple-system, sans-serif";
      ctx.fillText(`🔥 ${streak}`, col2X, subStatY - 10);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 20px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "1px";
      ctx.fillText("DAY STREAK", col2X, subStatY + 28);

      // ─── 4. METRIC ROWS (Priorities & Sessions) ────────────────────────────
      const statsY = 890;
      const statCardH = 120;
      const statW = width - 200;

      // Card 1: Completed Sessions
      drawMetricRow(
        ctx,
        100,
        statsY,
        statW,
        statCardH,
        "🎯 ROUTINE SESSIONS",
        `${doneCount} of ${totalCount} Sessions Finished`,
        doneCount > 0 && doneCount >= totalCount ? "100% COMPLETE" : "ON TRACK",
        "#10b981"
      );

      // Card 2: Tier 1 High Priority
      const tier1Text = tier1Total > 0 ? `${tier1Done} of ${tier1Total} Tier 1 Blocks Done` : "Priorities Mastered";
      drawMetricRow(
        ctx,
        100,
        statsY + 150,
        statW,
        statCardH,
        "⭐ HIGH-PRIORITY MASTERY",
        tier1Text,
        tier1Done === tier1Total && tier1Total > 0 ? "TIER 1 CLEARED" : "FOCUSED",
        "#38bdf8"
      );

      // Card 3: Status / Discipline Tier
      let rankTitle = "DISCIPLINED LEARNER";
      let rankColor = "#38bdf8";
      if (score >= 100) {
        rankTitle = "⚡ OVERACHIEVER ELITE";
        rankColor = "#10b981";
      } else if (score >= 80) {
        rankTitle = "🏆 MASTER PERFORMER";
        rankColor = "#3b82f6";
      } else if (score >= 50) {
        rankTitle = "🔥 CONSISTENT WARRIOR";
        rankColor = "#f59e0b";
      }

      drawMetricRow(
        ctx,
        100,
        statsY + 300,
        statW,
        statCardH,
        "🎖️ DAILY RANK",
        rankTitle,
        "VERIFIED",
        rankColor
      );

      // ─── 5. MOTIVATIONAL QUOTE / BANNER ───────────────────────────────────
      const quoteY = 1430;
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      roundRect(ctx, 100, quoteY, statW, 140, 24);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.stroke();

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "italic 500 24px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText('"Discipline turns ambition into reality."', width / 2, quoteY + 60);

      ctx.fillStyle = "#64748b";
      ctx.font = "600 18px system-ui, -apple-system, sans-serif";
      ctx.fillText("Logged offline with 0 distractions", width / 2, quoteY + 98);

      // ─── 6. FOOTER WATERMARK & LINK ───────────────────────────────────────
      const footerY = 1680;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "2px";
      ctx.fillText("TYMVERA", width / 2, footerY);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "1px";
      ctx.fillText("tymvera.web.app", width / 2, footerY + 45);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 18px system-ui, -apple-system, sans-serif";
      ctx.fillText("Distraction-Free Priority Routine OS for Students", width / 2, footerY + 80);

      // Export canvas to Blob & DataURL
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to export image blob"));
          return;
        }
        const dataUrl = canvas.toDataURL("image/png");
        resolve({ dataUrl, blob });
      }, "image/png");
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Triggers native OS share sheet or direct PNG download fallback.
 */
export async function shareOrDownloadDailyCard({ blob, dataUrl, filename = "tymvera-daily-focus.png" }) {
  const title = "My Daily Study Focus on TYMVERA";
  const text = "Track your study routine distraction-free with weighted priorities at tymvera.web.app 🔥";

  // Check if Web Share API with File sharing is supported
  if (navigator.canShare && blob) {
    try {
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text,
        });
        return { shared: true, method: "native-share" };
      }
    } catch (err) {
      // User cancelled share or share failed; fallback to download
      if (err.name === "AbortError") {
        return { shared: false, method: "aborted" };
      }
    }
  }

  // Fallback: Trigger direct image download
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return { shared: true, method: "download" };
}

// ─── INTERNAL CANVAS DRAWING HELPERS ──────────────────────────────────────────
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawMetricRow(ctx, x, y, width, height, category, valueText, badgeText, badgeColor) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  roundRect(ctx, x, y, width, height, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Left category label
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(category, x + 36, y + 42);

  // Left value text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(valueText, x + 36, y + 84);

  // Right pill badge
  ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 36;
  const badgeX = x + width - badgeWidth - 36;
  const badgeY = y + (height - 44) / 2;

  ctx.fillStyle = `${badgeColor}22`;
  ctx.strokeStyle = `${badgeColor}55`;
  roundRect(ctx, badgeX, badgeY, badgeWidth, 44, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = badgeColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 22);
}
