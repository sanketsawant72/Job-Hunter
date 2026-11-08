# AI Job Application Manager

A full-stack MERN app that automates job application emails without sacrificing control. Generate role- and technology-specific email bodies for recruiters, review them, and send through Gmail — all from one dashboard.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [How the Email System Works](#how-the-email-system-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Using the App](#using-the-app)
- [Project Structure](#project-structure)
- [CSV / Excel Import Format](#csv--excel-import-format)
- [AI Provider Options](#ai-provider-options)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

---

## Features

- **Per-Application AI Emails** — a separate AI call tailors every draft to the recruiter's role, job description, and requirements using evidence from your resume
- **Smart Resume Hashing** — SHA-256 detects when you replace your resume and prompts regeneration of your master template
- **Recruiter Import** — bulk upload from CSV or Excel
- **Email Verification** — filters undeliverable addresses before sending
- **Gmail Integration** — send via Google OAuth2, no password stored
- **Gmail Draft Mode** — push to Gmail Drafts and review before sending
- **Bulk Send** — dispatch all approved drafts in one click
- **Application Tracking** — full history with status timeline
- **Analytics Dashboard** — send rate, reply rate, and trends
- **Failed Emails Queue** — re-verify and retry bounced addresses
- **Dark / Light Mode**
- **Export** applications as CSV or Excel
- **JWT Auth** with email-based password reset

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT, bcrypt (12 rounds) |
| AI | OpenAI GPT-4o-mini · Groq · Gemini |
| Email | Gmail API, Google OAuth2 |
| PDF Parsing | pdf-parse |
| Charts | Chart.js, react-chartjs-2 |
| Validation | express-validator |
| Logging | Winston |

---

## How the Email System Works

```
Read recruiter job description and requirements
      │
      ▼
Read the candidate's active resume
      │
Generate a unique AI email for this recruiter
              │
              ▼
Add social links from Settings and the resume to the signature
              │
              ▼
Review draft and attach the active resume through Gmail
```

Each recruiter gets an independent AI generation. The model is instructed to match resume-backed qualifications to the specific job description and not invent experience. Upload a readable PDF/DOCX resume and configure an AI provider key before generating. The single saved master template provides guidance while each draft is customized for its recruiter's role.

---

## Prerequisites

- Node.js 18+
- MongoDB (local) or MongoDB Atlas
- OpenAI API key — or Groq / Gemini (see [AI Provider Options](#ai-provider-options))
- Google Cloud project with Gmail API enabled

---

## Installation

### 1. Clone

```bash
git clone https://github.com/Sankya72/ai-job-manager.git
cd ai-job-manager
```

### 2. Install MongoDB locally

**Windows** — download from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community), run the installer, select "Run MongoDB as a Service".

**macOS**
```bash
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu)**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongod && sudo systemctl enable mongod
```

Verify:
```bash
mongosh --eval "db.version()"
```

### 3. Backend

```bash
cd server
cp .env.example .env   # then fill in the values
npm install
```

### 4. Frontend

```bash
cd client
npm install
```

Vite automatically proxies `/api` and `/uploads` to `http://localhost:5000` — no extra config needed locally.

### 5. OpenAI key

1. Create a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Add `OPENAI_API_KEY=sk-...` to `server/.env`

You can also paste it per-account inside **Settings → AI Configuration** — that value always takes priority.

### 6. Google OAuth (Gmail)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Gmail API** — APIs & Services → Library
3. Configure the OAuth consent screen (External; add your email as a test user)
4. Create an OAuth 2.0 Client ID (Web application)
5. Add redirect URI: `http://localhost:5000/api/gmail/callback`
6. Copy **Client ID** and **Client Secret** into `server/.env`

---

## Environment Variables

All variables go in `server/.env`. Start from `server/.env.example`.

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port — defaults to `5000`; Render sets this automatically |
| `NODE_ENV` | Yes | `development` or `production` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long random string for signing tokens |
| `JWT_EXPIRE` | No | Token lifetime — default `7d` |
| `OPENAI_API_KEY` | Only for OpenAI | OpenAI secret key (`sk-...`) |
| `AI_PROVIDER` | No | `openai` (code default), `groq`, or `gemini`; the Render blueprint selects `groq` |
| `OPENAI_MODEL` | No | Model override — default `gpt-4o-mini` |
| `GROQ_API_KEY` | No | Required when `AI_PROVIDER=groq` (default in `.env.example` and Render) |
| `GEMINI_API_KEY` | No | Required when `AI_PROVIDER=gemini` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | Must match the URI set in Google Cloud Console |
| `CLIENT_URL` | Yes | Frontend origin, e.g. `http://localhost:5173` |
| `SMTP_HOST` | No | SMTP server for password-reset emails |
| `SMTP_PORT` | No | Default `587` |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password or app password |
| `MAX_FILE_SIZE` | No | Max resume size in bytes — default `5242880` (5 MB) |

*Can also be set per-user in Settings (takes priority over `.env`).

---

## Running the App

Install the root development dependency and each app's dependencies once:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

From the repository root, start both the backend and frontend together:

```bash
npm run dev
```

The frontend is at `http://localhost:5173` and the backend is at `http://localhost:5000`. To start only one, run `npm run dev:server` or `npm run dev:client` from the root.

---

## Deploying to Render and Netlify or Vercel

Deploy the backend and frontend as separate services. The root `render.yaml` configures Render to install and start the API from `server/`; `netlify.toml` configures Netlify builds and client-side routes. The existing `client/vercel.json` supports Vercel deployments.

### 1. Deploy the API to Render

1. Push this repository to GitHub and create a Render Blueprint from it. Render will discover the root `render.yaml`.
2. Set the Blueprint's secret environment variables:
   - `MONGODB_URI`: a MongoDB Atlas connection string. Allow Render's outbound IPs or enable Atlas network access as appropriate.
   - `JWT_SECRET`: a unique, long random secret.
   - `CLIENT_URL`: the exact deployed frontend origin, such as `https://your-site.netlify.app` or `https://your-project.vercel.app`. This is required in production. Separate additional allowed origins with commas; trailing slashes and paths are normalized.
   - `GROQ_API_KEY`: required because the blueprint selects `AI_PROVIDER=groq`. To use another provider, change `AI_PROVIDER` and set its corresponding API key.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` if Gmail integration is needed. The redirect URI must be `https://<your-render-service>.onrender.com/api/gmail/callback` and must also be added to the Google OAuth client's authorized redirect URIs.
3. Wait for the deploy to finish and verify `https://<your-render-service>.onrender.com/health` returns JSON with `"success": true`.

### 2. Deploy the frontend to Netlify

1. Import the same GitHub repository into Netlify or deploy `client/` through Vercel. Netlify uses the root `netlify.toml`; Vercel uses the existing `client/vercel.json`.
2. Set the frontend build variable `VITE_API_URL=https://<your-render-service>.onrender.com/api` in the hosting provider's site settings. Set it for every deploy context you use; it is read at build time. The client also adds `/api` if only the Render host is configured.
3. Set the Render service's `CLIENT_URL` to the exact production frontend origin (without a trailing slash). Add any additional frontend origins as a comma-separated list, then redeploy/restart the API so its CORS setting takes effect.
4. If using Gmail, confirm the Google OAuth redirect URI matches the deployed Render API URL exactly.

The Render blueprint provisions a 1 GB persistent disk at `/var/data` and stores uploads under `/var/data/uploads` (`UPLOADS_DIR`). Persistent disks require a paid Render web service. If you already have resume records from before enabling the disk, upload the resume again so the file is written to persistent storage.

---

## Using the App

Follow these steps in order the first time.

**1. Register** at `http://localhost:5173/register`

**2. Complete Settings** — add your name, phone, LinkedIn, GitHub, portfolio, and any other social links, plus your skills and experience. For the default Groq provider, add `GROQ_API_KEY` to the backend host's environment; the OpenAI key field is only used when `AI_PROVIDER=openai`.

**3. Upload Resume** — go to **Resume**, upload a PDF or DOCX (max 5 MB).

**4. (Optional) Manage the master template** — the Email Template page can generate or save one adaptable template that guides recruiter-specific drafts.

**5. Connect Gmail** — go to **Gmail**, click **Connect Gmail**, authorise via Google.

**6. Import recruiters** — go to **Upload Recruiters**, upload your CSV or Excel file. Email addresses are verified automatically.

**7. Add job details** — provide a role and paste its job description/requirements in the recruiter form, or include a `Job Description` column in the CSV import.

**8. Create drafts** — each selected recruiter receives a separate AI-generated email based on the job details and your resume. Go to **Bulk Send** or open the individual review page to read and edit drafts.

**9. Review and send** — the active resume is selected for attachment by default. Verify each message and attachment, then **Send** or **Save to Gmail Drafts**. Use **Bulk Send** to dispatch reviewed drafts.

---

## Project Structure

```
ai-job-manager/
├── server/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── aiController.js              # Generates role- and technology-specific draft bodies
│   │   ├── applicationController.js
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   ├── draftController.js
│   │   ├── emailTemplateController.js   # Master template and recruiter-specific generation
│   │   ├── failedEmailController.js
│   │   ├── gmailController.js
│   │   ├── recruiterController.js
│   │   ├── resumeController.js          # Upload + marks template stale on change
│   │   └── settingsController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── upload.js
│   │   └── validate.js
│   ├── models/
│   │   ├── Application.js
│   │   ├── Draft.js
│   │   ├── EmailTemplate.js             # One reusable master template per user
│   │   ├── FailedEmail.js
│   │   ├── GmailLog.js
│   │   ├── Recruiter.js
│   │   ├── Resume.js
│   │   ├── Settings.js
│   │   └── User.js
│   ├── routes/
│   │   ├── aiRoutes.js
│   │   ├── applicationRoutes.js
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── draftRoutes.js
│   │   ├── emailTemplateRoutes.js
│   │   ├── failedEmailRoutes.js
│   │   ├── gmailRoutes.js
│   │   ├── recruiterRoutes.js
│   │   ├── resumeRoutes.js
│   │   └── settingsRoutes.js
│   ├── services/
│   │   ├── gmailService.js
│   │   └── openaiService.js             # OpenAI / Groq / Gemini
│   ├── utils/
│   │   ├── helpers.js
│   │   └── logger.js
│   ├── uploads/                         # gitignored
│   ├── logs/                            # gitignored
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
└── client/
    ├── src/
    │   ├── components/
    │   │   ├── layout/                  # DashboardLayout, Sidebar, ProtectedRoute
    │   │   └── ui/                      # Badge, Modal, Pagination, etc.
    │   ├── context/                     # AuthContext, ThemeContext
    │   ├── hooks/                       # useDrafts, useRecruiters, useLocalStorage
    │   ├── pages/
    │   │   ├── auth/                    # Login, Register, ForgotPassword, ResetPassword
    │   │   ├── ApplicationDetail.jsx
    │   │   ├── Applications.jsx
    │   │   ├── BulkSend.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── EmailReview.jsx
    │   │   ├── EmailTemplate.jsx        # Saved reference templates (generate + edit)
    │   │   ├── FailedEmails.jsx
    │   │   ├── GmailPage.jsx
    │   │   ├── Profile.jsx
    │   │   ├── Recruiters.jsx
    │   │   ├── ResumePage.jsx
    │   │   ├── Settings.jsx
    │   │   └── UploadRecruiters.jsx
    │   ├── services/
    │   │   └── api.js
    │   └── utils/
    │       ├── formatters.js
    │       └── validators.js
    ├── .env
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## CSV / Excel Import Format

```csv
Recruiter Name,Company,Email,Role,LinkedIn,Location,Notes
Jane Smith,Google,jane@google.com,Software Engineer,https://linkedin.com/in/jane,Mountain View CA,
John Doe,Meta,john@meta.com,Frontend Developer,,New York NY,
,Stripe,careers@stripe.com,Backend Engineer,,,
```

**Required:** `Company`, `Email`
**Optional:** `Recruiter Name`, `Role`, `Job Description`, `LinkedIn`, `Location`, `Notes`

Column names are matched case-insensitively. Duplicate emails per user are skipped automatically.

---

## AI Provider Options

Set `AI_PROVIDER` in `server/.env` or the backend deployment environment. The Render blueprint and `.env.example` use Groq by default:

| Provider | `.env` value | Free tier | Key |
|---|---|---|---|
| OpenAI | `openai` | Pay per token | `OPENAI_API_KEY` |
| Groq | `groq` | 30 RPM free | `GROQ_API_KEY` — [console.groq.com](https://console.groq.com) |
| Google Gemini | `gemini` | 1 500 req/day free | `GEMINI_API_KEY` — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

Per-application email generation makes a separate AI call for every recruiter. Add the configured provider key to the backend deployment environment; the API does not silently substitute a generic email when AI generation fails.

---

## MongoDB Atlas

1. Free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a user, whitelist IPs (`0.0.0.0/0` for Render)
3. Connection string: `mongodb+srv://<user>:<pass>@cluster.mongodb.net/ai-job-mailer`

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED` on MongoDB | Start MongoDB — `net start MongoDB` (Windows) or `brew services start mongodb-community` (Mac) |
| `AI API key not configured` | Add the key matching `AI_PROVIDER` to the backend environment (`GROQ_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY`) |
| AI provider rejects its key | Verify the configured provider key hasn't been rotated or deleted |
| Gmail won't connect | Check Client ID, Client Secret, and redirect URI match exactly |
| `invalid_grant` on send | Token expired — disconnect and reconnect Gmail |
| Resume upload 400 error | File must be `.pdf`, `.docx`, or `.doc`, max 5 MB |
| "Resume has changed" warning | A new resume was uploaded — regenerate the master template |
| No drafts in Bulk Send | Import recruiters, then create drafts from the recruiter list |
| Port 5000 in use | Change `PORT` in `.env` and update the proxy target in `vite.config.js` |
| Build fails | Delete `node_modules` + `package-lock.json`, re-run `npm install` |

---

## Security

- bcrypt password hashing (12 rounds)
- JWT on all protected routes
- Rate limiting — 200 req / 15 min globally, 20 / 15 min on auth endpoints
- Helmet HTTP security headers
- `express-mongo-sanitize` against NoSQL injection
- CORS locked to `CLIENT_URL`
- File uploads validated by extension and size
- Google OAuth tokens stored server-side, never sent to the client
- All inputs sanitised via `express-validator`

---

## License

MIT
