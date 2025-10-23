
# C Concepts Assessment (Functions • Arrays • Pointers)

A minimal, shareable assessment web app that shows one question per page, grades on the server (answers hidden from users), and emails full results to the admin.

## ✨ Features
- 30 MCQs (10 per topic)
- One question per page (Next / Previous)
- Server-side grading and explanations
- Email notification to admin for every submission
- Clean, responsive UI

## 🗂 Structure
```
c-assessment/
├── index.html
├── style.css
├── script.js
├── questions.json        # server-side only (contains answers)
├── server.js             # Node/Express + Nodemailer
└── package.json
```

## 🚀 Deploy (No local Node required)

### Option A: Render.com (recommended)
1. Create a new **Web Service** on Render.
2. Use this repo/zip as the source.
3. Set environment:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Add **Environment Variables**:
   - `ADMIN_EMAIL=vdhingra@yahoo.com`
   - `GMAIL_USER=<your_gmail>`
   - `GMAIL_PASS=<gmail_app_password>`
5. Deploy. Share the Render URL with test-takers.

> Create a Gmail App Password at https://myaccount.google.com/apppasswords

### Option B: Railway.app
- Similar steps; set the same env vars and start command.

## 🔌 Endpoints
- `GET /api/questions` → sanitized questions (no answers)
- `POST /api/submit` → `{ answers: number[][] }` returns `{ score, total, percent, detail }`
- `GET /api/health` → simple health check

## 🔒 Notes
- Do **not** expose `questions.json` publicly other than via this server (the server only sends sanitized data).
- The front-end uses fetch to call `/api/*`, so host both front-end and backend from the same service for simplicity.

## 🧪 Local (if you have Node)
```
npm install
npm start
# open http://localhost:3000
```
