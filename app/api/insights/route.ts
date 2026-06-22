import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, summary, topQueries, topPages, byDevice, analysisType } = body;

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
1. Identify queries with strong impressions but low rankings (pos #11-30) — quick win opportunities
2. Highlight queries where ranking is close to page 1 (pos #8-15) — low-hanging fruit
3. Group queries into topic clusters relevant to luxury hospitality
4. Identify missed opportunities (high impressions, low CTR or weak page)
5. Suggest a content strategy (pages to create or update, content type: guide/landing page/blog/comparison)
6. Focus only on meaningful patterns, ignore random fluctuations

Respond ONLY with a JSON object, no markdown:
{
  "quickWins": [
    {"query": "query text", "position": 12, "impressions": 500, "action": "specific action to take"}
  ],
  "clusters": [
    {"topic": "cluster name", "queries": ["q1", "q2"], "opportunity": "what to do"}
  ],
  "contentGaps": [
    {"title": "page/content to create", "type": "guide|landing|blog|comparison", "rationale": "why this matters"}
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

Now challenge these recommendations and:
1. Identify weak assumptions or gaps in the analysis
2. Highlight any missed opportunities
3. Based on these queries, what are top-ranking competitor pages likely doing better?
4. Re-prioritize for maximum impact
5. Simplify into a focused, high-ROI action plan

Respond ONLY with a JSON object, no markdown:
{
  "actionPlan": [
    {"priority": 1, "action": "specific executable action", "impact": "high|medium|low", "effort": "high|medium|low", "rationale": "why this over others"}
  ],
  "missedOpportunities": [
    {"opportunity": "what was missed", "recommendation": "what to do instead"}
  ],
  "competitorEdge": "What top-ranking pages are likely doing better in one paragraph",
  "focusStatement": "The single most important thing to do right now in one sentence"
}`;

  try {
    // First pass — opportunity analysis
    const res1 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt1 }],
      }),
    });
    const data1 = await res1.json();
    const text1 = data1.content?.[0]?.text || "{}";
    const clean1 = text1.replace(/```json|```/g, "").trim();
    const parsed1 = JSON.parse(clean1);

    // Second pass — strategic refinement
    const res2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt2(JSON.stringify(parsed1)) }],
      }),
    });
    const data2 = await res2.json();
    const text2 = data2.content?.[0]?.text || "{}";
    const clean2 = text2.replace(/```json|```/g, "").trim();
    const parsed2 = JSON.parse(clean2);

    return NextResponse.json({ ...parsed1, ...parsed2 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}