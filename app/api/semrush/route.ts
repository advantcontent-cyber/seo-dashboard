import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, topQueries, topPages } = body;

  const queryData = (topQueries || []).map((q: any) =>
    `"${q.query}": ${q.clicks} clicks, ${q.impressions} impressions, CTR ${q.ctr}%, pos #${q.position}`
  ).join("\n");

  const prompt = `You are an expert SEO and GEO (Generative Engine Optimization) analyst for Advant AI, a luxury hotel digital marketing agency.

Analyze this Google Search Console keyword data for ${clientName} and predict AI Overview (AIO) presence and opportunities.

CONTEXT: Google's AI Overviews appear for ~15% of searches, mostly informational, question-based, and research queries. Hotels see AIO on destination, amenity, comparison, and "best X" queries.

TOP QUERIES FROM GSC:
${queryData}

For each query, analyze:
1. Is this query likely to trigger a Google AI Overview? (informational intent, question-based, research queries = YES. Brand/navigation queries = NO)
2. If AIO likely exists, is the client likely cited in it? (positions 1-5 = likely cited, 6-15 = maybe, 16+ = unlikely)
3. What's the opportunity?

Then provide:
- Queries likely IN AI Overview already (positions 1-5, informational intent)
- Queries where AIO exists but client is likely MISSING (positions 6-20, informational intent)  
- Queries unlikely to have AIO (brand, navigational, transactional)
- Content recommendations to improve AIO inclusion
- An overall AIO readiness score out of 100

Respond ONLY with a JSON object, no markdown, no extra text:
{
  "aioScore": 65,
  "aioScoreLabel": "Moderate",
  "summary": "One paragraph summary of AIO situation for this client",
  "likelyInAIO": [
    {"query": "query text", "position": 3, "impressions": 500, "reason": "why likely cited"}
  ],
  "likelyMissing": [
    {"query": "query text", "position": 12, "impressions": 300, "reason": "why missing", "action": "what to do"}
  ],
  "notAIO": [
    {"query": "query text", "reason": "brand/navigational/transactional"}
  ],
  "contentRecommendations": [
    {"title": "specific content piece", "type": "FAQ|Guide|Comparison|Landing", "targetQuery": "query it targets", "rationale": "why this helps AIO"}
  ],
  "quickWins": [
    {"action": "specific action", "impact": "high|medium|low", "effort": "high|medium|low"}
  ]
}`;

  try {
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
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
