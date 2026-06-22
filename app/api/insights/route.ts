import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, summary, topQueries, topPages, byDevice } = body;

  const prompt = `You are an expert SEO analyst for Advant AI, a luxury hotel digital marketing agency.

Analyze this Google Search Console data for ${clientName} and provide concise, actionable SEO insights.

SUMMARY (vs prev period):
- Clicks: ${summary.clicks} (${summary.change.clicks > 0 ? "+" : ""}${summary.change.clicks}%)
- Impressions: ${summary.impressions} (${summary.change.impressions > 0 ? "+" : ""}${summary.change.impressions}%)
- CTR: ${summary.ctr}% (${summary.change.ctr > 0 ? "+" : ""}${summary.change.ctr}%)
- Avg Position: #${summary.position} (${summary.change.position > 0 ? "+" : ""}${summary.change.position}%)

TOP 5 QUERIES:
${(topQueries || []).slice(0, 5).map((q: any) => `- "${q.query}": ${q.clicks} clicks, pos #${q.position}, CTR ${q.ctr}%`).join("\n")}

TOP 5 PAGES:
${(topPages || []).slice(0, 5).map((p: any) => `- ${p.page}: ${p.clicks} clicks, pos #${p.position}`).join("\n")}

DEVICE SPLIT:
${(byDevice || []).map((d: any) => `- ${d.device}: ${d.clicks} clicks, CTR ${d.ctr}%`).join("\n")}

Respond ONLY with a JSON object in this exact format, no markdown, no extra text:
{
  "brightspots": [
    {"title": "short title", "detail": "one specific actionable sentence with data"},
    {"title": "short title", "detail": "one specific actionable sentence with data"}
  ],
  "criticalIssues": [
    {"title": "short title", "detail": "one specific actionable sentence with data"},
    {"title": "short title", "detail": "one specific actionable sentence with data"}
  ],
  "recommendations": [
    "Specific action #1 with context from the data",
    "Specific action #2 with context from the data",
    "Specific action #3 with context from the data"
  ],
  "headline": "One sentence summary of the site current SEO situation"
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}