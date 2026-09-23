# Contributing to TYMVERA

Thank you for your interest in contributing to **TYMVERA**! We welcome contributions from developers, students, designers, and productivity enthusiasts worldwide.

---

## 🚀 Quick Start for Contributors

1. **Fork the Repository**:
   Click the **Fork** button at the top right of this repository.

2. **Clone your Fork**:
   `ash
   git clone https://github.com/<your-username>/TYMVERA.git
   cd TYMVERA
   `

3. **Install Dependencies**:
   `ash
   npm install --legacy-peer-deps
   `

4. **Start the Local Development Server**:
   `ash
   npm run dev
   `
   Open http://localhost:5173 in your browser.

5. **Build for Production**:
   `ash
   npm run build
   `

---

## 🛠️ Code Architecture

TYMVERA is designed with an **offline-first, zero-runtime-dependency** philosophy:
- **src/App.jsx**: Main application code (React 19, Tailwind CSS, Material Symbols).
- **src/services/alarmEngine.js**: Precision Web Audio synth engine for offline alarms.
- **src/services/notificationEngine.js**: Web Notification & in-app toast scheduler.
- **src/services/storageRecovery.js**: Dual IndexedDB + LocalStorage persistence & deep scanner.
- **src/services/firebaseAuth.js**: Google Sign-In & Firestore cloud sync.
- **src/App.js**: Standalone self-contained single-file bundle distribution (generated via `node scratch/bundle_app.js`).

---

## 📋 Guidelines

- **Keep It Distraction-Free**: TYMVERA is built to help users execute routines without friction. Features should be fast, minimal, and mobile-friendly.
- **Offline First**: All core functionality (tracking, alarms, analytics, milestones) must work 100% offline without requiring internet or sign-in.
- **Touch Ergonomics**: All interactive elements must have minimum 40px touch targets for fat-finger mobile use.

---

## 🐛 Reporting Bugs & Suggesting Features

- Use our [Issue Templates](https://github.com/sreyasts/TYMVERA/issues/new/choose) to report bugs or submit feature proposals.
- Include browser/device details and screenshots where applicable.

Thank you for making TYMVERA better!
