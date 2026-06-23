import { NextRequest, NextResponse } from "next/server";

const CAMPAIGNS: Record<string, { projectId: string; campaignId: string; name: string; hasTracking: boolean }> = {
  "https://www.sorahotels.com/sorasukhumvit/": { projectId: "28548179", campaignId: "28548179_5012473", name: "Sora Hotels Sukhumvit", hasTracking: true },
  "https://www.sorahotels.com/": { projectId: "28548179", campaignId: "28548179_5012473", name: "Sora Hotels", hasTracking: true },
  "https://www.sorahotels.com": { projectId: "28548179", campaignId: "28548179_5012473", name: "Sora Hotels", hasTracking: true },
  "https://khao-yai.intercontinental.com/": { projectId: "28547626", campaignId: "", name: "IC Khao Yai", hasTracking: false },
  "https://khao-yai.intercontinental.com": { projectId: "28547626", campaignId: "", name: "IC Khao Yai", hasTracking: false },
};

async function fetchTracking(projectId: string, params: Record<string, string>) {
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) throw new Error("SEMRUSH_API_KEY not configured");

  // Build query string manually — URLSearchParams drops empty values
  const base = `key=${apiKey}&action=report&competitors[]=`;
  const extra = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const url = `https://api.semrush.com/reports/v1/projects/${projectId}/tracking/?${base}&${extra}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SEMrush error ${res.status}: ${text.slice(0, 300)}`);
  }

  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(";").map(v => v.trim().replace(/"/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siteUrl = searchParams.get("site") || "";
  // Normalize URL for lookup — try exact, then with/without trailing slash
  const normalizedUrl = siteUrl.endsWith("/") ? siteUrl : siteUrl + "/";
  const campaign = CAMPAIGNS[siteUrl] || CAMPAIGNS[normalizedUrl] || CAMPAIGNS[siteUrl.replace(/\/$/, "")];

  if (!campaign) {
    return NextResponse.json({
      campaigns: Object.entries(CAMPAIGNS).map(([url, c]) => ({ url, ...c })),
    });
  }

  if (!campaign.hasTracking) {
    return NextResponse.json({
      error: `Position Tracking is not set up for ${campaign.name} in SEMrush. Go to SEMrush → Projects → ${campaign.name} → Set up Position Tracking.`,
      setupRequired: true,
    });
  }

  try {
    // Fetch all tracked keywords
    const [allPositions, aioRanking, aioMissing, aioTriggered] = await Promise.all([
      fetchTracking(campaign.campaignId, { type: "tracking_position_organic" }),
      fetchTracking(campaign.campaignId, { type: "tracking_position_organic", serp_feature_filter: "aio,0" }),
      fetchTracking(campaign.campaignId, { type: "tracking_position_organic", serp_feature_filter: "aio,1" }),
      fetchTracking(campaign.campaignId, { type: "tracking_position_organic", serp_feature_filter: "aio" }),
    ]);

    const total = allPositions.length;
    const inAIO = aioRanking.length;

    const aioRankingSet = new Set(aioRanking.map(k => (k.Keyword || k.keyword || "").toLowerCase()));
    const aioTriggeredSet = new Set(aioTriggered.map(k => (k.Keyword || k.keyword || "").toLowerCase()));

    const opportunities = aioMissing.filter(k => {
      const pos = parseInt(k.Position || k.position || "999");
      return pos <= 20;
    });

    const keywordTable = allPositions.slice(0, 50).map(k => {
      const kw = (k.Keyword || k.keyword || "").toLowerCase();
      const pos = parseInt(k.Position || k.position || "0");
      const prevPos = parseInt(k["Previous position"] || k.previous_position || "0");
      const inAio = aioRankingSet.has(kw);
      const aioExists = aioTriggeredSet.has(kw);
      return {
        keyword: kw,
        position: pos,
        previousPosition: prevPos,
        volume: parseInt(k["Search Volume"] || k.search_volume || "0"),
        url: k.URL || k.url || "",
        inAIO: inAio,
        aioExists,
        opportunity: aioExists && !inAio && pos <= 20,
      };
    }).sort((a, b) => a.position - b.position);

    return NextResponse.json({
      campaign: campaign.name,
      summary: {
        total,
        inAIO,
        aioTriggered: aioTriggered.length,
        opportunities: opportunities.length,
        aioRate: aioTriggered.length > 0 ? Math.round((inAIO / aioTriggered.length) * 100) : 0,
      },
      keywordTable,
      opportunities: opportunities.slice(0, 20).map(k => ({
        keyword: k.Keyword || k.keyword || "",
        position: parseInt(k.Position || k.position || "0"),
        volume: parseInt(k["Search Volume"] || k.search_volume || "0"),
        url: k.URL || k.url || "",
      })).sort((a, b) => a.position - b.position),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
