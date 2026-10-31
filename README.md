<div align="center">
<img width="1200" height="475" alt="AmiBuzz Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AmiBuzz — AI Anime Stickers & GIFs

Transform your ideas and photos into vibrant AI anime stickers and high-quality animated GIFs in seconds.

Built with **pure JavaScript and standard React modules**:
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Motion. (100% JS/JSX, no TypeScript)
- **Backend**: Firebase Cloud Functions v2 (Node.js 20, CommonJS)
- **Database & Security**: Cloud Firestore with atomic quota tracking and security rules
- **Authentication**: Firebase Authentication (Google, Apple, Microsoft, Email OTP, SMS OTP via MSG91)
- **Billing & Subscriptions**: Dual-gateway integration — Razorpay (UPI, Netbanking, Cards) and Stripe (International Cards)
- **AI Generation**: Google Gemini models via `@google/genai` (with server-side key protection & quota enforcement)

---

## Project Structure

```
amibuzz/
├── dist/                    # Compiled production build
├── functions/               # Cloud Functions backend (Node.js)
│   ├── .env.example         # Server-side environment variables template
│   ├── index.js             # Function exports
│   └── src/
│       ├── auth/            # OTP dispatch and verification (Email & SMS)
│       ├── generation/      # Gemini sticker generation & prompt enhancement
│       ├── payments/        # Razorpay & Stripe order creation, verify & webhooks
│       ├── usage/           # Atomic quota consumption & usage reporting
│       └── lib/             # Shared helpers (Firestore, Gemini, Stripe, Razorpay, etc.)
├── src/                     # Pure React JSX frontend
│   ├── components/          # Reusable UI, layout & checkout components
│   ├── context/             # AuthContext (real-time auth & Firestore profile sync)
│   ├── pages/               # Landing, Auth, Dashboard, Generator, GifLab, Pricing, Settings, Support
│   ├── services/            # Client services (auth, gemini, payment, usage)
│   ├── firebase.js          # Firebase client SDK initialization & emulator detection
│   ├── index.css            # Tailwind styles
│   └── main.jsx             # React entry point
├── .env.example             # Frontend public environment template
├── .env.local               # Local development configuration (emulator setup)
├── firebase.json            # Firebase emulators, functions & hosting configuration
├── firestore.rules          # Firestore security rules
└── vite.config.js           # Pure JavaScript Vite configuration
```

---

## Getting Started

### Prerequisites
- Node.js (v20 or newer recommended)
- npm

### 1. Install Dependencies

In the root of the app:
```bash
npm install
```

In the functions directory:
```bash
cd functions
npm install
cd ..
```

---

## Running Locally

### Option A: Local Development with Firebase Emulators (Zero Setup Required)

The app is pre-configured to run with local Firebase Emulators in `.env.local` (`VITE_USE_FIREBASE_EMULATORS=true`).

1. Start the Firebase Emulator Suite:
```bash
npx firebase emulators:start
```
This boots Auth (port 9099), Firestore (port 8080), Functions (port 5001), and the Emulator UI (port 4000).

2. In another terminal, start the Vite dev server:
```bash
npm run dev
```

3. Open your browser at `http://localhost:3000`.
   - You can test email and SMS OTP sign-in immediately. In emulator mode, generated OTP codes are logged directly to the terminal console!
   - You can inspect Firestore documents and Auth users in real time at `http://localhost:4000`.

### Option B: Connecting to a Real Firebase Project

1. Copy `.env.example` to `.env.local` and add your Firebase Web App credentials:
```bash
VITE_USE_FIREBASE_EMULATORS=false
VITE_FIREBASE_API_KEY="AIza..."
VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-app"
VITE_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:..."
```

2. Copy `functions/.env.example` to `functions/.env` and supply:
   - `GEMINI_API_KEY` (from Google AI Studio)
   - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`
   - `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`
   - `SENDGRID_API_KEY` & `SENDGRID_FROM_EMAIL` (for production email OTP)
   - `MSG91_AUTH_KEY` & `MSG91_TEMPLATE_ID` (for production SMS OTP)

3. Start the dev server:
```bash
npm run dev
```

---

## Building for Production

Compile the pure JavaScript frontend:
```bash
npm run build
```

Preview the production build locally:
```bash
npm run preview
```

Deploying Cloud Functions and Hosting to Firebase:
```bash
# Deploy firestore rules and indexes
npx firebase deploy --only firestore

# Deploy backend functions
npx firebase deploy --only functions

# Deploy frontend hosting
npx firebase deploy --only hosting
```

---

## Security & Architecture Principles

- **Zero Secret Leakage**: The Gemini AI key, Razorpay secret, Stripe secret, and OTP generation keys are restricted exclusively to Cloud Functions. Only public `VITE_` variables are bundled into client assets.
- **Server-Authoritative Billing**: Plan prices and quotas are calculated and verified server-side. Clients cannot forge prices or bypass quotas.
- **Atomic Quotas**: Quotas are tracked in Firestore transactions before invoking image models, preventing race conditions. If generation fails due to provider errors, quotas are automatically refunded.
- **Pure JavaScript**: The frontend code and toolchains run cleanly on standard JavaScript (`.js`, `.jsx`, `vite.config.js`) with pure React modules.
