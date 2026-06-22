# SEO Command Center — Windsor.ai Edition

Unified GSC + GA4 SEO dashboard powered by **Windsor.ai**. No Google OAuth, no complex setup — just one Windsor API key.

## Deploy to Vercel in 5 minutes

### 1. Get your Windsor.ai API key
1. Sign up (free) at https://onboard.windsor.ai
2. Connect your **Google Search Console** and **GA4** properties in Windsor
3. Go to **Settings → API Key** and copy it

### 2. Deploy
```bash
npm i -g vercel
vercel        # follow prompts
vercel env add WINDSOR_API_KEY   # paste your key
vercel --prod
```

Done. Visit your Vercel URL, paste your API key in the dashboard UI, and you're live.

### Local dev
```bash
# Edit .env.local and add WINDSOR_API_KEY=your_key
npm install
npm run dev
# Open http://localhost:3000
```

## What's inside

**3 tabs, 8 KPI cards, all from Windsor.ai:**

| Tab | Content |
|---|---|
| Overview | 8 KPIs + combined trend + channel bar chart + device pie + top queries + top pages |
| Search Console | Clicks, impressions, CTR, position + trend charts + full query/page tables |
| Analytics (GA4) | Sessions, users, bounce rate, duration + trend + channel table + GA4 pages + device split |

Every KPI shows **% change vs previous period** with green/red arrows. Position improvement shown correctly (lower = better).

## Architecture (simplified vs v1)

| v1 (direct Google APIs) | v2 (Windsor.ai) |
|---|---|
| googleapis + next-auth | Zero external dependencies |
| User OAuth per session | Single API key |
| 2 separate auth flows | 1 unified Windsor endpoint |
| Complex token management | Windsor handles caching & refresh |

**Single API route:** `/api/windsor` — calls Windsor's `searchconsole` and `googleanalytics4` connectors in parallel, aggregates the data, and returns it.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WINDSOR_API_KEY` | Optional | Server-side default — users can also paste it in the UI |

The API key is saved to `localStorage` on the client after first entry, so users only type it once.

## Tech Stack
Next.js 16 · Recharts · Lucide React · Tailwind CSS
