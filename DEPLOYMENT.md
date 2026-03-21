# Deployment Setup Guide - GitHub Actions + Vercel

## Prerequisites

- GitHub repository created ([Instructions](https://docs.github.com/en/get-started/quickstart/create-a-repo))
- Vercel account ([Sign up](https://vercel.com/signup))
- Google Cloud credentials ready

## Step 1: Set Up GitHub Secrets

Go to: `Settings → Secrets and variables → Actions`

Add these secrets:

### Required Secrets:

| Secret | Value | Where to Find |
|--------|-------|---------------|
| `VERCEL_TOKEN` | Vercel access token | [Vercel Settings](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Your Vercel Organization ID | Vercel Team Settings |
| `VERCEL_PROJECT_ID` | Your Vercel Project ID | `vercel.json` after first deploy, or Vercel Dashboard |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Your Google API key | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GCP_PROJECT_ID` | Your GCP project ID | [GCP Console](https://console.cloud.google.com) |

### How to Get Each:

**VERCEL_TOKEN:**
```
vercel.com → Settings → Tokens → Create
```

**VERCEL_ORG_ID & VERCEL_PROJECT_ID:**
```
After linking repo to Vercel, run: vercel env pull
```

**GOOGLE_GENERATIVE_AI_API_KEY:**
```
aistudio.google.com → Get API Key
```

## Step 2: Link Repo to Vercel

```bash
# Install Vercel CLI if not already
npm i -g vercel

# Login and link project
vercel link
```

This creates a `.vercel` folder with your project configuration.

## Step 3: Configure Environment Variables in Vercel

Go to: `Vercel Dashboard → Project Settings → Environment Variables`

Add:
- `GOOGLE_GENERATIVE_AI_API_KEY` (from secrets)
- `GCP_PROJECT_ID` (your project ID)

## Step 4: Optional - BigQuery Service Account Access

For direct BigQuery queries from Vercel:

### Option A: Use Workload Identity (Recommended)
This allows Vercel to access GCP resources without storing credentials.

Setup:
1. [Enable Workload Identity Federation](https://cloud.google.com/docs/authentication/workload-identity-federation/create-aws)
2. Configure trust relationship between Vercel and GCP
3. No credentials file needed in Vercel

### Option B: Service Account JSON (Less Secure)
If you need to store credentials:

1. GCP Console → Service Accounts → Create key (JSON)
2. Encode as base64: `base64 -w0 < service-account.json`
3. Add as GitHub secret: `GCP_SERVICE_ACCOUNT_B64`
4. In workflow, decode and use

⚠️ **Warning**: Never commit credentials to GitHub

## Step 5: Push Code & Deploy

```bash
git add .
git commit -m "Add GitHub Actions and Vercel config"
git push origin main
```

GitHub Actions will:
1. ✅ Install dependencies
2. ✅ Run linting
3. ✅ Build app
4. ✅ Deploy to Vercel

Check progress in: `GitHub → Actions tab`

## Monitoring & Troubleshooting

### View Deployment Logs:
- **GitHub Actions**: Repo → Actions → Click workflow run
- **Vercel Logs**: Vercel Dashboard → Deployments → Click deployment

### Common Issues:

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm ci` locally and check `package.json` |
| Build fails | Check logs in GitHub Actions tab |
| `GOOGLE_GENERATIVE_AI_API_KEY` not found | Verify secret is added correctly |
| Vercel API errors | Check `VERCEL_TOKEN` and org/project IDs |

## Deployment Workflow

### Main Branch (Production)
```
Push → GitHub Actions → Build → Test → Deploy to Vercel Production
```

### Pull Requests
```
PR opened → GitHub Actions → Build → Test → ✅ Status check
```

Preview URLs auto-generated for each PR.

## Next Steps

1. Push code to GitHub
2. Check Actions tab for build status
3. Visit Vercel dashboard to see live deployment
4. Test Gemini AI chat with BigQuery access

## Useful Commands

```bash
# Test build locally
npm run build

# Run dev server
npm run dev

# Pull Vercel env vars locally
vercel pull

# Deploy manually
vercel deploy
```

## Performance Optimization Tips

See [.agents/skills/vercel-react-best-practices/SKILL.md]() for Vercel's performance guidelines.

Key priorities:
- ✅ Bundle size optimization (using next/dynamic)
- ✅ Server-side caching with React.cache()
- ✅ Parallel data fetching
