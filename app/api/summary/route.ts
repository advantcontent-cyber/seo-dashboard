import { NextRequest, NextResponse } from "next/server";

const SEASONAL_CONTEXT: Record<string, string> = {
  "shintamani": "Cambodia dry season peaks Nov-Feb (Wild/Angkor). Nepal trekking seasons: spring (Mar-May) and autumn (Sep-Nov) for Mustang.",
  "sorahotels": "Bangkok high season Oct-Feb. Songkran (Apr) drives domestic travel. MICE season Sep-Nov.",
  "khaoyai": "Khao Yai cool season Nov-Feb is peak. Thai public holidays and long weekends drive weekend getaways year-round.",
  "intercontinental": "Khao Yai cool season Nov-Feb is peak. Thai public holidays and long weekends drive weekend getaways year-round.",
  "songsaa": "Cambodia dry season Nov-May is peak island season. Wet season Jun-Oct sees significant drop in bookings.",
  "cottars": "Kenya peak seasons: Jan-Mar and Jul-Oct (Great Migration Jul-Sep). Low season Apr-Jun.",
};

function getSeasonalContext(clientName: string): string {
  const key = Object.keys(SEASONAL_CONTEXT).find(k => clientName.toLowerCase().includes(k));
  return key ? SEASONAL_CONTEXT[key] : "Consider local public holidays and regional travel patterns when contextualising performance.";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, dateFrom, dateTo, gsc, ga4 } = body;

  const organicChannel = (ga4?.channels || []).find((c: any) =>
    c.channel?.toLowerCase().includes("organic")
  );

  const purchases = ga4?.channelPerformance?.reduce((s: number, c: any) => s + (c.purchases || 0), 0) || 0;
  const organicPurchases = ga4?.channelPerformance?.find((c: any) =>
    c.channel?.toLowerCase().includes("organic")
  );
  const funnelData = ga4?.funnel || [];
  const checkoutStep = funnelData.find((s: any) => s.label?.includes("Checkout"));
  const purchaseStep = funnelData.find((s: any) => s.label?.includes("Purchase"));
  const sessionStep = funnelData[0];
  const checkoutConv = sessionStep?.count > 0 && purchaseStep?.count > 0
    ? ((purchaseStep.count / sessionStep.count) * 100).toFixed(3)
    : null;

  const seasonal = getSeasonalContext(clientName);
  const currentMonth = new Date().toLocaleString("en", { month: "long" });

  const prompt = `You are a senior SEO strategist at Advant AI, a luxury hotel digital marketing agency. Write a performance summary for ${clientName} covering ${dateFrom} to ${dateTo}. Current month: ${currentMonth}.

SEASONAL CONTEXT: ${seasonal}

GSC DATA:
- Clicks: ${gsc?.summary?.clicks} (${gsc?.summary?.change?.clicks > 0 ? "+" : ""}${gsc?.summary?.change?.clicks}% vs prev period)
- Impressions: ${gsc?.summary?.impressions} (${gsc?.summary?.change?.impressions > 0 ? "+" : ""}${gsc?.summary?.change?.impressions}%)
- CTR: ${gsc?.summary?.ctr}% | Avg Position: #${gsc?.summary?.position} (${gsc?.summary?.change?.position > 0 ? "+" : ""}${gsc?.summary?.change?.position}%)
- Top queries: ${(gsc?.topQueries || []).slice(0, 5).map((q: any) => `"${q.query}" pos#${q.position} ${q.clicks}clicks ${q.impressions}impr CTR${q.ctr}%`).join(", ")}
- Top pages: ${(gsc?.topPages || []).slice(0, 4).map((p: any) => `${p.page?.replace(/^https?:\/\/[^/]+/, "") || "/"} pos#${p.position} ${p.clicks}clicks ${p.impressions}impr CTR${p.ctr}%`).join(", ")}
- Devices: ${(gsc?.byDevice || []).map((d: any) => `${d.device} ${d.clicks}clicks CTR${d.ctr}%`).join(", ")}
- Top countries: ${(gsc?.byCountry || []).slice(0, 3).map((c: any) => `${c.country} ${c.clicks}clicks`).join(", ")}

GA4 DATA:
- Sessions: ${ga4?.summary?.sessions} (${ga4?.summary?.change?.sessions > 0 ? "+" : ""}${ga4?.summary?.change?.sessions}% vs prev)
- Engagement rate: ${ga4?.summary?.engRate}% | Avg duration: ${Math.floor((ga4?.summary?.avgDuration || 0) / 60)}m ${Math.floor((ga4?.summary?.avgDuration || 0) % 60)}s
${organicChannel ? `- Organic sessions: ${organicChannel.sessions} | Organic engagement rate: ${organicChannel.engRate}%` : ""}
${purchases > 0 ? `- Total purchases/bookings (all channels): ${purchases}` : "- Purchase/booking data: not available for this client"}
${organicPurchases?.purchases > 0 ? `- Organic channel purchases: ${organicPurchases.purchases} | Organic conv. rate: ${organicPurchases.convRate}%` : ""}
${checkoutConv && parseFloat(checkoutConv) > 0 ? `- Session-to-booking conv. rate: ${checkoutConv}%` : ""}
${checkoutStep?.count > 0 ? `- Checkout events: ${checkoutStep.count}` : ""}
${purchaseStep?.count > 0 ? `- Confirmed bookings/purchases (GA4 purchase event): ${purchaseStep.count}` : ""}

Write the response as a JSON object. No markdown, no extra text:
{
  "headline": "3-4 sentences, approximately 200 words. Write as a senior SEO strategist presenting to a hotel GM. Rules: (1) Lead with the click/impression/CTR dynamic using exact numbers from GSC. (2) Reference 1-2 specific top queries or pages with their actual position and click numbers. (3) Connect to seasonal context — what does this performance mean heading into the upcoming season. (4) ONLY mention bookings if GA4 booking data is available and greater than zero — if so, state the channel (e.g. organic channel drove X bookings at Y% conv rate from GA4 data). If booking data is not available or zero, skip it entirely and focus on engagement metrics instead. (5) End with the single sharpest implication for the business. Never use phrases like: zero bookings, data gaps, signals stronger relevance, cannot assess.",
  "working": [
    "Specific win with real numbers referencing actual query/page/country data (max 18 words)",
    "Specific win with real numbers (max 18 words)",
    "Specific win with real numbers (max 18 words)"
  ],
  "watchout": [
    "Specific concern with real numbers and consequence (max 18 words)",
    "Specific concern with real numbers and consequence (max 18 words)",
    "Specific concern with real numbers and consequence (max 18 words)"
  ],
  "priority": "One focused action with quantified impact, seasonal urgency, and which page/query to target (max 30 words)"
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
        max_tokens: 1000,
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
