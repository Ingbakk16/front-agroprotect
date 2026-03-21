# GitHub Actions + Vercel Deployment - Setup Complete ✅

## What's Been Created

### 1. **GitHub Actions Workflow** (`.github/workflows/deploy.yml`)
- Automatically builds on push to `main`/`develop`
- Runs linting checks
- Deploys to Vercel on successful build
- Displays build status badges

### 2. **Vercel Configuration** (`vercel.json`)
- Next.js framework detection
- Node 20 runtime
- Environment variable setup
- API route duration limit (30s for BigQuery queries)

### 3. **Dependabot Config** (`.github/dependabot.yml`)
- Weekly dependency update checks
- Pull requests for npm & GitHub Actions updates
- Smart ignore rules for major versions

### 4. **Documentation**
- `DEPLOYMENT.md` - Detailed setup instructions
- `DEPLOYMENT-CHECKLIST.md` - Step-by-step checklist
- `.env.example` - Environment variable reference

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Your Laptop                           │
│  npm run dev  →  localhost:3000  (Local Development)    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   GitHub Repository                      │
│  (git push main) → Trigger GitHub Actions             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions (CI/CD Pipeline)             │
│  1. Install dependencies                                │
│  2. Run npm lint                                        │
│  3. Run npm build                                       │
│  4. Deploy to Vercel                                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Vercel (Hosting)                       │
│  Production: https://agroprotect.vercel.app            │
│  Preview PRs: https://agroprotect-pr-1.vercel.app      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              External Services (APIs)                    │
│  • Google Gemini API (AI Chat)                          │
│  • Google Cloud BigQuery (Data)                         │
│  • Leaflet Maps (Visualization)                         │
└─────────────────────────────────────────────────────────┘
```

## Quick Start (30 minutes)

### Step 1: Prepare Secrets
```bash
# You need:
- VERCEL_TOKEN (from vercel.com/account/tokens)
- GOOGLE_GENERATIVE_AI_API_KEY (from ai.google.com/api)
- GCP_PROJECT_ID (from gcp console)
```

### Step 2: Add GitHub Secrets
```
GitHub Repo → Settings → Secrets and variables → Actions
```

Add all 5 secrets from Step 1

### Step 3: Push to GitHub
```bash
git push origin main
```

### Step 4: Monitor Deployment
- GitHub Actions: https://github.com/YOUR_USER/front-agroprotect/actions
- Vercel: https://vercel.com/dashboard

## Deployment Flow

```
Local Development
  ↓
git push origin main
  ↓
GitHub Actions Triggered
  ├─ Install deps
  ├─ Lint code
  ├─ Build (npm run build)
  └─ Pass secrets to Vercel
  ↓
Vercel Deployment
  ├─ Build Next.js app
  ├─ Optimize assets
  ├─ Set environment variables
  └─ Deploy to CDN
  ↓
Live at: agroprotect.vercel.app
```

## Environment Variables Explained

| Variable | Where Used | Purpose |
|----------|-----------|---------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | `/app/api/chat/route.ts` | Authenticate with Google Gemini |
| `GCP_PROJECT_ID` | BigQuery queries | Identify your GCP project |

### Security Notes:
✅ Never commit `.env.local` to GitHub  
✅ Store secrets in GitHub Actions secrets  
✅ Vercel auto-injects secrets from dashboard  
✅ `.gitignore` already configured  

## Next Steps

1. **Follow DEPLOYMENT-CHECKLIST.md** (15 min)
2. **Test locally**: `npm run dev`
3. **Push to GitHub**: `git push origin main`
4. **Monitor build**: Check GitHub Actions tab
5. **Verify deployment**: Open Vercel URL
6. **Test features**: Try Gemini chat with BigQuery data

## Vercel Preview URLs

For pull requests, Vercel automatically creates preview URLs:
```
Example: https://front-agroprotect-pr-42.vercel.app
```

Perfect for testing before merging to main!

## Performance Monitoring

After deployment, check:

1. **Vercel Analytics**
   - Dashboard → Analytics
   - View Core Web Vitals

2. **Google PageSpeed Insights**
   - https://pagespeed.web.dev/
   - Paste your Vercel URL

3. **Lighthouse CI** (Optional)
   - Add GitHub Actions workflow
   - Automated performance regression testing

## Troubleshooting

### Build fails with "Cannot find module"
```bash
npm install
npm run build
```

### "API Key not found" error
Check GitHub secrets are set correctly:
```
Settings → Secrets → Verify GOOGLE_GENERATIVE_AI_API_KEY
```

### Vercel deployment stuck
- Check GitHub Actions logs
- Verify `VERCEL_TOKEN` is valid
- Re-link project: `vercel link`

## Files Modified/Created

```
Files Created:
✅ .github/workflows/deploy.yml      (25 lines - CI/CD)
✅ .github/dependabot.yml             (29 lines - Auto updates)
✅ vercel.json                         (21 lines - Config)
✅ DEPLOYMENT.md                       (200+ lines - Guide)
✅ DEPLOYMENT-CHECKLIST.md             (120+ lines - Checklist)
✅ .env.example                        (15 lines - Reference)

No existing files were modified.
```

## Support

- **GitHub Actions Docs**: https://docs.github.com/actions
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Google Gemini API**: https://ai.google.dev

---

**Status**: ✅ Ready to deploy!

Run through DEPLOYMENT-CHECKLIST.md and you'll be live in minutes.
