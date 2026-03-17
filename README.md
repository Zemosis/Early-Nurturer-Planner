# Early Nurturer Planner

AI-powered curriculum planning for infant and toddler classrooms (ages 0–36 months). Built with React + Vite + TailwindCSS frontend and FastAPI + LangGraph backend.

## Features

- **AI Theme Generation:** Gemini 2.5 Flash generates personalized weekly themes based on enrolled students
- **Multi-Agent Pipeline:** Architect → Auditor → Personalizer workflow ensures safety-audited, developmentally appropriate curriculum
- **Calendar View:** Manage multiple weeks with drag-and-drop reordering and delete functionality
- **Timeline Synchronization:** Curriculum weeks automatically map to chronological calendar weeks
- **YouTube Integration:** Real greeting/goodbye songs and yoga videos enriched via YouTube Data API
- **Vector Search:** Yoga poses selected from curated catalog using semantic similarity (pgvector)
- **PDF Generation:** Download professional curriculum PDFs with cover images

---

## Quick Start (Frontend Development)

```bash
npm install
npm run dev
```

Access the app at `http://localhost:5173`. The frontend uses the production backend by default — no local backend setup needed.

---

## Environment Setup (Optional)

If you need to customize the API endpoint:

1. Copy `.env.example` → `.env`
2. Leave `VITE_API_BASE_URL` empty to use the production backend
3. Or set it to `http://localhost:8000` if running the backend locally

**For backend credentials:** Contact **Tur-Erdene**

---

## Deployment (Firebase Hosting)

### ⚠️ Deployment Access Required

You cannot deploy directly to Firebase Hosting without permission. If you try to run `firebase deploy --only hosting`, Firebase will check your logged-in Google account and reject the upload with an "Unauthorized" error.

### To Get Deployment Access:

1. Contact **Tur-Erdene** with your Gmail address
2. You will be added to the Firebase project as a collaborator
3. Once added, you can deploy:

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy --only hosting
```

**Production URL:** `https://early-nurturer-planner.web.app`

---

## Backend Setup (Optional — Advanced)

Only needed if you're modifying backend code. See `backend/.env.example` for required environment variables.

**Contact Tur-Erdene for:**
- Database credentials
- GCP service account key
- YouTube API key