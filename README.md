# PowerTrack — Setup & Deployment Guide

## What you need
- A [GitHub](https://github.com) account (free)
- A [Supabase](https://supabase.com) project with the schema set up
- [Git](https://git-scm.com/downloads) installed on your machine
- [Node.js](https://nodejs.org) (LTS) installed on your machine

---

## Step 1 — Run the Supabase SQL

1. Go to your Supabase project → **SQL Editor**
2. Paste and run the SQL from the app's setup screen (or from the App.jsx file near the top under `SETUP_SQL`)

---

## Step 2 — Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **+** icon (top right) → **New repository**
3. Name it exactly: `powertrack`
4. Set it to **Public** (required for free GitHub Pages)
5. Leave everything else unchecked — do NOT add a README or .gitignore
6. Click **Create repository**

---

## Step 3 — Push the project to GitHub

Open a terminal, navigate to the `powertrack` folder you downloaded, then run:

```bash
# Initialise git
git init

# Stage all files
git add .

# First commit
git commit -m "Initial commit"

# Point to your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/powertrack.git

# Push
git push -u origin main
```

> If asked to log in, use your GitHub username and a **Personal Access Token**
> (not your password). Generate one at GitHub → Settings → Developer Settings →
> Personal Access Tokens → Tokens (classic) → Generate new token.
> Tick the `repo` scope and copy the token — use it as your password.

---

## Step 4 — Add your secrets to GitHub

Your Supabase credentials are stored as GitHub Secrets so they never appear
in your code.

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these three, one at a time:

| Name | Value |
|---|---|
| `VITE_ACCESS_KEY` | Your chosen access key (e.g. `power2024`) |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |

---

## Step 5 — Enable GitHub Pages

1. In your repository go to **Settings** → **Pages** (left sidebar)
2. Under **Source** select **GitHub Actions**
3. Save

---

## Step 6 — Trigger a deployment

The deployment runs automatically every time you push to `main`. Since you
already pushed in Step 3, check if it ran:

1. Go to your repository → **Actions** tab
2. You should see a workflow called **Deploy to GitHub Pages** running or completed
3. If it failed, click it to read the error — most likely a secret is missing or misnamed

Once it shows a green tick, your app is live at:

```
https://YOUR_USERNAME.github.io/powertrack/
```

---

## Making changes in future

Whenever you update `src/App.jsx`:

```bash
git add .
git commit -m "Describe your change"
git push
```

GitHub Actions will rebuild and redeploy automatically in about 60 seconds.

---

## Local development (optional)

If you want to run the app locally before pushing:

```bash
# Install dependencies (once)
npm install

# Copy the example env file and fill in your values
cp .env.example .env

# Start local dev server
npm run dev
```

The app will be available at `http://localhost:5173`.
