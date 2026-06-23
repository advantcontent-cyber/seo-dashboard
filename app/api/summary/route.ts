import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    clientName, dateFrom, dateTo,
    gsc, ga4,
  } = body;

  // Extract organic channel from GA4
  const organicChannel = (ga4?.channels || []).find((c: any) =>
    c.channel?.toLowerCase().includes("organic")
  );

  const prompt = `You are an SEO analyst for Advant AI, a luxury hotel digital marketing agency.
Write a period performance summary for ${clientName} covering ${dateFrom} to ${dateTo}.

GSC DATA (search visibility):
- Clicks: ${gsc?.summary?.clicks} (${gsc?.summary?.change?.clicks > 0 ? "+" : ""}${gsc?.summary?.change?.clicks}% vs prev period)
- Impressions: ${gsc?.summary?.impressions} (${gsc?.summary?.change?.impressions > 0 ? "+" : ""}${gsc?.summary?.change?.impressions}%)
- CTR: ${gsc?.summary?.ctr}% | Avg Position: #${gsc?.summary?.position} (${gsc?.summary?.change?.position > 0 ? "+" : ""}${gsc?.summary?.change?.position}%)
- Top queries: ${(gsc?.topQueries || []).slice(0, 5).map((q: any) => `"${q.query}" #${q.position} ${q.clicks}clicks`).join(", ")}
- Top pages: ${(gsc?.topPages || []).slice(0, 4).map((p: any) => `${p.page?.replace(/^https?:\/\/[^/]+/, "") || "/"} #${p.position} ${p.clicks}clicks`).join(", ")}
- Devices: ${(gsc?.byDevice || []).map((d: any) => `${d.device} ${d.clicks}clicks CTR${d.ctr}%`).join(", ")}
- Top country: ${(gsc?.byCountry || [])[0]?.country || "N/A"} (${(gsc?.byCountry || [])[0]?.clicks || 0} clicks)

GA4 DATA (on-site behaviour):
- Total sessions: ${ga4?.summary?.sessions} (${ga4?.summary?.change?.sessions > 0 ? "+" : ""}${ga4?.summary?.change?.sessions}% vs prev)
- Active users: ${ga4?.summary?.users}
- Engagement rate: ${ga4?.summary?.engRate}% (${ga4?.summary?.change?.engRate > 0 ? "+" : ""}${ga4?.summary?.change?.engRate}%)
- Avg session duration: ${Math.floor((ga4?.summary?.avgDuration || 0) / 60)}m ${Math.floor((ga4?.summary?.avgDuration || 0) % 60)}s
${organicChannel ? `- Organic channel: ${organicChannel.sessions} sessions, ${organicChannel.engRate}% engagement rate` : ""}
- Top pages by views: ${(ga4?.topPages || []).slice(0, 4).map((p: any) => `${p.page} ${p.pageviews}views ${Math.floor(p.avgDuration/60)}m${Math.floor(p.avgDuration%60)}s`).join(", ")}
- Devices: ${(ga4?.devices || []).map((d: any) => `${d.device} ${d.sessions}sessions`).join(", ")}

Respond ONLY with a raw JSON object, no markdown, no extra text:
{
  "headline": "2-3 sentences combining GSC visibility + GA4 engagement for the period",
  "working": [
    "specific GSC or GA4 win with real numbers (max 15 words)",
    "specific GSC or GA4 win with real numbers (max 15 words)",
    "specific GSC or GA4 win with real numbers (max 15 words)"
  ],
  "watchout": [
    "specific concern from GSC or GA4 with real numbers (max 15 words)",
    "specific concern from GSC or GA4 with real numbers (max 15 words)",
    "specific concern from GSC or GA4 with real numbers (max 15 words)"
  ],
  "priority": "One focused action combining GSC + GA4 insight with quantified impact (max 25 words)"
}

Rules: Use real numbers from the data. Reference both GSC and GA4 where relevant. Be specific about organic traffic behaviour — clicks that lead to engaged sessions, duration, drop-offs. No generic advice.`;

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
        max_tokens: 700,
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
