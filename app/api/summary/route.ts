import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, summary, topQueries, topPages, byDevice, byCountry, dateFrom, dateTo } = body;

  const prompt = `SEO analyst for Advant AI luxury hotel agency. Write a period summary for ${clientName} (${dateFrom} to ${dateTo}).

DATA:
Clicks: ${summary.clicks} (${summary.change.clicks > 0 ? "+" : ""}${summary.change.clicks}% vs prev)
Impressions: ${summary.impressions} (${summary.change.impressions > 0 ? "+" : ""}${summary.change.impressions}% vs prev)
CTR: ${summary.ctr}% | Avg Position: #${summary.position} (${summary.change.position > 0 ? "+" : ""}${summary.change.position}%)
Top queries: ${(topQueries || []).slice(0, 5).map((q: any) => `"${q.query}" #${q.position} ${q.clicks}clicks`).join(", ")}
Top pages: ${(topPages || []).slice(0, 4).map((p: any) => `${p.page?.replace(/^https?:\/\/[^/]+/, "") || "/"} #${p.position}`).join(", ")}
Devices: ${(byDevice || []).map((d: any) => `${d.device} ${d.clicks}clicks CTR${d.ctr}%`).join(", ")}
Top country: ${(byCountry || [])[0]?.country || "N/A"} ${(byCountry || [])[0]?.clicks || 0} clicks

Respond ONLY with a raw JSON object, no markdown:
{
  "headline": "2-3 sentence plain English overview of this period",
  "working": ["specific win with data", "specific win with data", "specific win with data"],
  "watchout": ["specific concern with data", "specific concern with data", "specific concern with data"],
  "priority": "One focused action with quantified impact estimate"
}

Rules: Use real numbers. Keep each item under 15 words. Be specific not generic.`;

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
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return NextResponse.json(JSON.parse(clean));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
