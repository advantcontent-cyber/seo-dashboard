import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, summary, topQueries, topPages, byDevice } = body;

  const queryData = (topQueries || []).map((q: any) =>
    `"${q.query}": ${q.clicks} clicks, ${q.impressions} impressions, CTR ${q.ctr}%, pos #${q.position}`
  ).join("\n");

  const pageData = (topPages || []).map((p: any) =>
    `${p.page}: ${p.clicks} clicks, ${p.impressions} impressions, CTR ${p.ctr}%, pos #${p.position}`
  ).join("\n");

  const prompt1 = `You are an expert SEO analyst for Advant AI, a luxury hotel digital marketing agency.

Analyze this Google Search Console data for ${clientName}:

SUMMARY (vs prev period):
- Clicks: ${summary.clicks} (${summary.change.clicks > 0 ? "+" : ""}${summary.change.clicks}%)
- Impressions: ${summary.impressions} (${summary.change.impressions > 0 ? "+" : ""}${summary.change.impressions}%)
- CTR: ${summary.ctr}% (${summary.change.ctr > 0 ? "+" : ""}${summary.change.ctr}%)
- Avg Position: #${summary.position}

TOP QUERIES:
${queryData}

TOP PAGES:
${pageData}

DEVICE SPLIT:
${(byDevice || []).map((d: any) => `${d.device}: ${d.clicks} clicks, CTR ${d.ctr}%`).join("\n")}

Analyze this data and:
1. Identify queries with strong impressions but low rankings (pos 11-30) — quick win opportunities
2. Highlight queries where ranking is close to page 1 (pos 8-15) — low-hanging fruit
3. Group queries into topic clusters relevant to luxury hospitality
4. Identify missed opportunities (high impressions, low CTR or weak page)
5. Suggest content strategy (pages to create or update, type: guide/landing/blog/comparison)
6. Focus only on meaningful patterns, ignore random fluctuations

Respond ONLY with a JSON object, no markdown, no extra text:
{
  "quickWins": [
    {"query": "query text", "position": 12, "impressions": 500, "action": "specific action"}
  ],
  "clusters": [
    {"topic": "cluster name", "queries": ["q1", "q2"], "opportunity": "what to do"}
  ],
  "contentGaps": [
    {"title": "page to create", "type": "guide", "rationale": "why this matters"}
  ],
  "brightspots": [
    {"title": "short title", "detail": "one specific insight with data"}
  ],
  "criticalIssues": [
    {"title": "short title", "detail": "one specific issue with data"}
  ],
  "headline": "One sentence summary of SEO situation"
}`;

  const prompt2 = (firstOutput: string) => `Act like an experienced SEO strategist for a luxury hotel brand.

Here is the initial SEO analysis for ${clientName}:
${firstOutput}

Challenge these recommendations and:
1. Identify weak assumptions or gaps in the analysis
2. Highlight any missed opportunities
3. What are top-ranking competitor pages likely doing better?
4. Re-prioritize for maximum impact
5. Simplify into a focused, high-ROI action plan

Respond ONLY with a JSON object, no markdown, no extra text:
{
  "actionPlan": [
    {"priority": 1, "action": "specific executable action", "impact": "high", "effort": "low", "rationale": "why this over others"}
  ],
  "missedOpportunities": [
    {"opportunity": "what was missed", "recommendation": "what to do instead"}
  ],
  "competitorEdge": "What top-ranking pages are likely doing better in one paragraph",
  "focusStatement": "The single most important thing to do right now in one sentence"
}`;

  async function callClaude(prompt: string) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
        "HTTP-Referer": "https://adv-seo-dashboard.vercel.app",
        "X-Title": "Advant SEO Portal",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  }

  try {
    const pass1 = await callClaude(prompt1);
    const pass2 = await callClaude(prompt2(JSON.stringify(pass1)));
    return NextResponse.json({ ...pass1, ...pass2 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
