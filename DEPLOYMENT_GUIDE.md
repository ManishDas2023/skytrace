# 🚀 SkyTrace — Deployment Guide
### Go live on Cloudflare Pages (FREE, Unlimited, Commercial OK)

---

## What You'll Need
- A computer (Windows / Mac)
- Internet connection
- 20 minutes

## What You'll Get
- ✅ Live website — e.g. skytrace.pages.dev
- ✅ Free forever with no limits
- ✅ Commercial use allowed (run ads, earn money)
- ✅ Unlimited bandwidth — no surprise bills
- ✅ Auto-updates every time you change code

---

## STEP A — Install Node.js (one time only)

1. Go to 👉 https://nodejs.org
2. Click the big green **"LTS"** button to download
3. Install it — click Next → Next → Next → Install → Finish
4. Open **Command Prompt** (Windows key → type `cmd` → Enter)
5. Type this and press Enter:
   ```
   node --version
   ```
   You should see: `v20.x.x` or higher ✅

---

## STEP B — Set Up Project Files

Create this folder structure on your Desktop:

```
skytrace/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
└── src/
    ├── App.jsx
    └── main.jsx
```

Save all files Claude gave you into the right places as shown above.

---

## STEP C — Test Locally First

In Command Prompt, navigate to your project:

**Windows (OneDrive Desktop):**
```
cd "C:\Users\YOUR_NAME\OneDrive - COMPANY\Desktop\skytrace"
```

**Windows (Regular Desktop):**
```
cd Desktop\skytrace
```

**Mac:**
```
cd ~/Desktop/skytrace
```

Then install and run:
```
npm install
npm run dev
```

Open your browser → go to **http://localhost:5173**

You should see your SkyTrace app running! ✅

To stop: press `Ctrl + C`

---

## STEP D — Create a GitHub Account

Cloudflare reads your code from GitHub to deploy.

1. Go to 👉 https://github.com
2. Click **Sign up**
3. Enter email, password, username
4. Verify your email ✅

---

## STEP E — Install Git

Git is a tool that uploads your code to GitHub.

**Windows:**
1. Go to 👉 https://git-scm.com
2. Click **Download for Windows**
3. Install it — click Next all the way through
4. Close and reopen Command Prompt
5. Check it works:
   ```
   git --version
   ```
   You should see: `git version 2.x.x` ✅

**Mac:**
Git comes pre-installed. Just type `git --version` to confirm.

---

## STEP F — Upload Code to GitHub

1. Go to 👉 https://github.com
2. Click **+** (top right) → **New repository**
3. Name it: `skytrace`
4. Keep it **Public**
5. Click **Create repository**

Now go to Command Prompt (inside your skytrace folder) and run these ONE BY ONE:

```
git init
```
```
git add .
```
```
git commit -m "SkyTrace first commit"
```
```
git branch -M main
```
```
git remote add origin https://github.com/YOUR_USERNAME/skytrace.git
```
```
git push -u origin main
```

⚠️ Replace `YOUR_USERNAME` with your actual GitHub username.

When it asks for username & password:
- Username: your GitHub username
- Password: use a **Personal Access Token** (see note below)

> 💡 **GitHub Password Note:**
> GitHub no longer accepts your account password here.
> You need a token. Go to:
> GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → Generate New Token
> Tick "repo" → Generate → Copy that token → paste it as your password

Refresh GitHub — you should see your files there ✅

---

## STEP G — Deploy on Cloudflare Pages ⚡

This is the easiest part!

1. Go to 👉 https://pages.cloudflare.com
2. Click **Sign Up** — it's free, no credit card needed
3. After signing in, click **Create a project**
4. Click **Connect to Git**
5. Click **Connect GitHub** → Allow access
6. Select your `skytrace` repository
7. Click **Begin setup**
8. Fill in these settings:

   | Setting | Value |
   |---|---|
   | Project name | skytrace |
   | Production branch | main |
   | Framework preset | **Vite** |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

9. Click **Save and Deploy**
10. Wait 1-2 minutes ⏳

You'll see **"Success"** and your live URL! 🎉

```
https://skytrace.pages.dev
```

Share this with anyone in the world! 🌍

---

## STEP H — Update Your App Anytime

Whenever you make changes to your code, just run:

```
git add .
git commit -m "Updated app"
git push
```

Cloudflare automatically re-deploys in about 1 minute! ✅

---

## STEP I — Add a Custom Domain (Optional, Free!)

Want `www.skytrace.in` instead of `skytrace.pages.dev`?

1. Buy a domain on 👉 https://namecheap.com (~₹800/year for .in)
2. In Cloudflare Pages → your project → **Custom Domains**
3. Add your domain → follow the steps
4. Done! Professional URL in 10 minutes ✅

---

## 💰 Making Money — Add Google AdSense

Once your app is live and getting visitors:

1. Go to 👉 https://adsense.google.com
2. Sign up with your Google account
3. Add your Cloudflare Pages URL
4. Google reviews it (1-3 days)
5. Copy-paste the ad code into your App.jsx
6. Google pays you every month via bank transfer 💵

### Estimated Monthly Earnings (India traffic)
| Daily Users | Monthly Estimate |
|---|---|
| 100 | ₹500 – ₹2,000 |
| 500 | ₹2,500 – ₹8,000 |
| 1,000 | ₹5,000 – ₹15,000 |
| 10,000 | ₹50,000+ |

---

## STEP J — Convert to Android App (Step 5)

After your web app is live, we'll wrap it into an Android APK using **Capacitor** (free tool). Then publish on Google Play for a one-time $25 fee (~₹2,100).

I (Claude) will guide you through every click of this too!

---

## Full Summary

| Step | What | Cost | Time |
|---|---|---|---|
| A | Install Node.js | ₹0 | 5 min |
| B | Set up files | ₹0 | 5 min |
| C | Test locally | ₹0 | 2 min |
| D | GitHub account | ₹0 | 3 min |
| E | Install Git | ₹0 | 3 min |
| F | Upload to GitHub | ₹0 | 5 min |
| G | Deploy Cloudflare | ₹0 | 3 min |
| **Total** | **App is LIVE!** | **₹0** | **~26 min** |

---

## ❓ Common Problems & Fixes

**"npm: command not found"**
→ Node.js not installed properly. Redo Step A and restart Command Prompt.

**"git: command not found"**
→ Git not installed. Do Step E first, then restart Command Prompt.

**"remote: Invalid username or password"**
→ Use a Personal Access Token, not your GitHub password. See Step F note.

**"Build failed" on Cloudflare**
→ Make sure Framework preset is set to **Vite** and output directory is **dist**.

**App loads but flights don't show**
→ OpenSky API has rate limits. Wait 1 minute and refresh. Totally normal.

**"The system cannot find the path specified"**
→ Your Desktop might be in OneDrive. Use the full path:
`cd "C:\Users\YOUR_NAME\OneDrive - COMPANY\Desktop\skytrace"`

---

*Built with Claude AI · SkyTrace v1.0 · Hosted FREE on Cloudflare Pages*
