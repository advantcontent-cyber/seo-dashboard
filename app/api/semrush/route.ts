import { NextRequest, NextResponse } from "next/server";

const SEMRUSH_BASE = "https://api.semrush.com/reports/v1/projects";

const CAMPAIGNS: Record<string, { id: string; name: string }> = {
  "https://www.sorahotels.com/sorasukhumvit/": { id: "28548179", name: "Sora Hotels Sukhumvit" },
  "https://khao-yai.intercontinental.com/": { id: "28547626", name: "IC Khao Yai" },
};

async function fetchSemrush(campaignId: string, params: Record<string, string>) {
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) throw new Error("SEMRUSH_API_KEY not configured");

  const p = new URLSearchParams({ key: apiKey, action: "report", ...params });
  const url = `${SEMRUSH_BASE}/${campaignId}/tracking/?${p}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SEMrush error ${res.status}: ${text.slice(0, 200)}`);
  }

  const text = await res.text();
  // SEMrush returns CSV
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
  const campaign = CAMPAIGNS[siteUrl];

  if (!campaign) {
    // Return all campaigns list
    return NextResponse.json({ campaigns: Object.entries(CAMPAIGNS).map(([url, c]) => ({ url, ...c })) });
  }

  try {
    // All organic positions
    const allPositions = await fetchSemrush(campaign.id, {
      type: "tracking_position_organic",
    });

    // Keywords in AI Overview (domain ranks in AIO)
    const aioRanking = await fetchSemrush(campaign.id, {
      type: "tracking_position_organic",
      serp_feature_filter: "aio,0", // domain ranks in AIO
    });

    // Keywords where AIO exists but domain doesn't rank in it
    const aioMissing = await fetchSemrush(campaign.id, {
      type: "tracking_position_organic",
      serp_feature_filter: "aio,1", // AIO present, domain NOT in it
    });

    // Keywords where AIO is triggered (all)
    const aioTriggered = await fetchSemrush(campaign.id, {
      type: "tracking_position_organic",
      serp_feature_filter: "aio", // AIO present on SERP
    });

    const total = allPositions.length;
    const inAIO = aioRanking.length;
    const aioOpportunities = aioMissing.filter(k => {
      const pos = parseInt(k.Position || k.position || "999");
      return pos <= 20; // ranking in top 20 but not in AIO
    });

    // Build keyword table with AIO status
    const aioRankingUrls = new Set(aioRanking.map(k => (k.Keyword || k.keyword || "").toLowerCase()));
    const aioTriggeredUrls = new Set(aioTriggered.map(k => (k.Keyword || k.keyword || "").toLowerCase()));

    const keywordTable = allPositions.slice(0, 50).map(k => {
      const kw = (k.Keyword || k.keyword || "").toLowerCase();
      const pos = parseInt(k.Position || k.position || "0");
      const inAio = aioRankingUrls.has(kw);
      const aioExists = aioTriggeredUrls.has(kw);
      return {
        keyword: kw,
        position: pos,
        previousPosition: parseInt(k["Previous position"] || k.previous_position || "0"),
        volume: parseInt(k["Search Volume"] || k.search_volume || "0"),
        url: k.URL || k.url || "",
        inAIO: inAio,
        aioExists: aioExists,
        opportunity: aioExists && !inAio && pos <= 20,
      };
    }).sort((a, b) => a.position - b.position);

    return NextResponse.json({
      campaign: campaign.name,
      summary: {
        total,
        inAIO,
        aioTriggered: aioTriggered.length,
        opportunities: aioOpportunities.length,
        aioRate: total > 0 ? Math.round((inAIO / total) * 100) : 0,
      },
      keywordTable,
      opportunities: aioOpportunities.slice(0, 20).map(k => ({
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
