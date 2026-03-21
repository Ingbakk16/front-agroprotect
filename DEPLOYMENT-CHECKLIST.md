# GitHub & Vercel Setup Checklist

## Phase 1: Prepare Your Secrets (5 mins)

- [ ] Get `VERCEL_TOKEN` from https://vercel.com/account/tokens
- [ ] Get `GOOGLE_GENERATIVE_AI_API_KEY` from https://aistudio.google.com/app/apikey
- [ ] Note your `GCP_PROJECT_ID` from GCP Console
- [ ] Verify Vercel account is created and working

## Phase 2: Link to Vercel (10 mins)

- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] In project root, run: `vercel link`
- [ ] Choose existing/new project
- [ ] Get `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from `.vercel/project.json`

## Phase 3: GitHub Secrets (5 mins)

Go to: `https://github.com/YOUR_USER/front-agroprotect/settings/secrets/actions`

Add these secrets:
- [ ] `VERCEL_TOKEN` ← from Phase 1
- [ ] `VERCEL_ORG_ID` ← from Phase 2
- [ ] `VERCEL_PROJECT_ID` ← from Phase 2
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` ← from Phase 1
- [ ] `GCP_PROJECT_ID` ← from Phase 1
- [ ] `GITHUB_TOKEN` (auto-created, no action needed)

## Phase 4: Vercel Environment Variables (5 mins)

Go to: `vercel.com → Project Settings → Environment Variables`

Add for **Production** environment:
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` = [your API key]
- [ ] `GCP_PROJECT_ID` = [your project ID]

## Phase 5: Push & Deploy (2 mins)

```bash
git add .
git commit -m "Add GitHub Actions and Vercel deployment config"
git push origin main
```

Check deployment:
- [ ] GitHub Actions running: https://github.com/YOUR_USER/front-agroprotect/actions
- [ ] Vercel building: https://vercel.com/dashboard
- [ ] Production URL live after ~2-3 minutes

## Phase 6: Verify Deployment

- [ ] Open Vercel production URL
- [ ] Test Gemini AI chat feature
- [ ] Check browser console for errors
- [ ] Verify BigQuery connection if implemented

## Files Created/Modified

```
✅ Created: .github/workflows/deploy.yml          (CI/CD pipeline)
✅ Created: vercel.json                            (Vercel config)
✅ Created: DEPLOYMENT.md                          (Setup guide)
✅ Created: DEPLOYMENT-CHECKLIST.md                (This file)
✅ Modified: .env.local                            (Local secrets)
```

## Troubleshooting Commands

```bash
# Check build locally
npm run build

# Validate workflow syntax
# (GitHub checks automatically on push)

# View Vercel logs locally
vercel logs [DEPLOYMENT_URL]

# Pull latest env vars from Vercel
vercel pull

# Redeploy last successful build
vercel deploy --prod
```

## Quick Links

- GitHub Repo: `https://github.com/YOUR_USER/front-agroprotect`
- Vercel Dashboard: `https://vercel.com/dashboard`
- GitHub Actions: `https://github.com/YOUR_USER/front-agroprotect/actions`
- Google API Keys: `https://aistudio.google.com/app/apikey`
- GCP Console: `https://console.cloud.google.com`

## Status Badges (Optional)

Add to your README.md:

```markdown
[![Build Status](https://github.com/YOUR_USER/front-agroprotect/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USER/front-agroprotect/actions)
[![Vercel Status](https://vercel-status-YOUR_USER-agroprotect.vercel.app/api/badge)](https://vercel.com/dashboard)
```

---

**Total Setup Time**: ~30 minutes

**Questions?** Check `DEPLOYMENT.md` for detailed instructions.
