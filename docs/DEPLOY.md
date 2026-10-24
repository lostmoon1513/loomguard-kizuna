# Deploy LoomGuard (one link for judges)

The backend also serves the web app (`backend/web/index.html`), so you deploy ONE service and get ONE URL.
If Pradeep's separate React frontend is ready, deploy it on Vercel and add its URL to `CORS_ORIGINS` on the backend.

## Render (free), about 10 minutes
1. Push the repo to GitHub (public, or add the organisers as collaborators). Never commit `.env`.
2. render.com -> New -> **Blueprint** -> pick the repo. It reads `render.yaml`. (Or New -> Web Service, Root Directory `backend`,
   Build `pip install -r requirements.txt`, Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.)
3. Set the secret env vars on the service: `GEMINI_API_KEY` (a NEW key from a NEW Google project), `MONGO_URI`.
4. Atlas -> Network Access -> allow `0.0.0.0/0` (Render IPs change).
5. Open `https://<your-service>.onrender.com/api/health`, then `/api/health/gemini`, then `/` (the app).
6. The demo kit loads automatically on first start (`AUTOLOAD_DEMO=true`).

## Before you submit
- Free services sleep after ~15 minutes. Open the link yourself 2 minutes before judges might, and mention a slow first load in the README.
- Test the whole journey in an incognito window (see README section 7).
- If Mongo or Gemini is down the app still works: drafts stay in memory and only rule-based checks run (a banner says so).
  Drafts held in memory disappear when a free service restarts, so run your demo right after a fresh start.

## Docker alternative
`cd backend && docker build -t loomguard . && docker run -p 8000:8000 --env-file .env loomguard`