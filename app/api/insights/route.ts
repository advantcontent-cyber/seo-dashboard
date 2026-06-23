import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, summary, topQueries, topPages } = body;

  const queries = (topQueries || []).slice(0, 10).map((q: any) =>
    `"${q.query}" pos#${q.position} ${q.impressions}impr CTR${q.ctr}%`
  ).join(", ");

  const pages = (topPages || []).slice(0, 5).map((p: any) =>
    `${p.page?.replace(/^https?:\/\/[^/]+/, "") || "/"} pos#${p.position} ${p.clicks}clicks`
  ).join(", ");

  const prompt = `SEO analyst for Advant AI luxury hotel agency. Analyze GSC data for ${clientName} and return EXACTLY 8 action items as a JSON array.

DATA:
Clicks: ${summary.clicks} (${summary.change.clicks > 0 ? "+" : ""}${summary.change.clicks}%)
Impressions: ${summary.impressions} (${summary.change.impressions > 0 ? "+" : ""}${summary.change.impressions}%)
CTR: ${summary.ctr}% | Avg Position: #${summary.position}
Top queries: ${queries}
Top pages: ${pages}

Return ONLY a raw JSON array, no markdown, no explanation:
[{"action":"specific action","query":"target keyword","type":"GEO|CONTENT|ON-PAGE|TECHNICAL","impact":"High|Medium|Low","effort":"Low|Medium|High","category":"AI Overview|Quick Win|Content Gap|CTR|Rankings"}]

Rules: Keep action under 10 words. Mix GEO and CONTENT types. Prioritize high impact low effort first.`;

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
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json({ items: Array.isArray(parsed) ? parsed : [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
