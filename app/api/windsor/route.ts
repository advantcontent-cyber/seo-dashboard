import { NextRequest, NextResponse } from "next/server";

const BASE = "https://connectors.windsor.ai";

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}
async function windsor(apiKey: string, fields: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ api_key: apiKey, fields, ...extra });
  const res = await fetch(`${BASE}/searchconsole?${params}`, { next: { revalidate: 300 } });
  if (!res.ok) { const text = await res.text(); throw new Error(`Windsor error ${res.status}: ${text.slice(0, 300)}`); }
  const json = await res.json();
  return json.data || json || [];
}
function pct(a: number, b: number) { return b === 0 ? 0 : Math.round(((a - b) / b) * 100); }
function sumF(arr: any[], key: string) { return arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0); }
function avgF(arr: any[], key: string) { return arr.length === 0 ? 0 : sumF(arr, key) / arr.length; }
function agg(arr: any[], keyFn: (r: any) => string, fields: string[]) {
  const map: Record<string, any> = {};
  for (const r of arr) {
    const k = keyFn(r); if (!k) continue;
    if (!map[k]) { map[k] = { _key: k }; for (const f of fields) map[k][f] = (f === "ctr" || f === "position") ? [] : 0; }
    for (const f of fields) {
      if (f === "ctr" || f === "position") map[k][f].push(parseFloat(r[f]) || 0);
      else map[k][f] += parseFloat(r[f]) || 0;
    }
  }
  return Object.values(map).map((row: any) => {
    const out: any = { _key: row._key };
    for (const f of fields) {
      if (Array.isArray(row[f])) out[f] = row[f].length ? Math.round(row[f].reduce((a: number, b: number) => a + b, 0) / row[f].length * 10) / 10 : 0;
      else out[f] = Math.round(row[f]);
    }
    return out;
  });
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.WINDSOR_API_KEY || "b4b2b8120b1e45cf203b6ef7ebb6278a6b11";
  if (!apiKey) return NextResponse.json({ error: "WINDSOR_API_KEY not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const site = searchParams.get("site") || "";
  let dateFrom = searchParams.get("date_from") || "";
  let dateTo = searchParams.get("date_to") || "";
  if (!dateFrom || !dateTo) {
    const days = parseInt(searchParams.get("days") || "28");
    dateTo = new Date().toISOString().split("T")[0];
    dateFrom = subtractDays(dateTo, days);
  }
  const span = daysBetween(dateFrom, dateTo);
  const prevDateTo = subtractDays(dateFrom, 1);
  const prevDateFrom = subtractDays(prevDateTo, span);
  const siteExtra: Record<string, string> = site ? { site } : {};

  try {
    const [gscAll, gscPrev, gscByQuery, gscByPage, gscByDate, gscByDevice, gscByCountry] = await Promise.all([
      windsor(apiKey, "clicks,impressions,ctr,position", { date_from: dateFrom, date_to: dateTo, ...siteExtra }),
      windsor(apiKey, "clicks,impressions,ctr,position", { date_from: prevDateFrom, date_to: prevDateTo, ...siteExtra }),
      windsor(apiKey, "query,clicks,impressions,ctr,position", { date_from: dateFrom, date_to: dateTo, ...siteExtra }),
      windsor(apiKey, "page,clicks,impressions,ctr,position", { date_from: dateFrom, date_to: dateTo, ...siteExtra }),
      windsor(apiKey, "date,clicks,impressions,ctr,position", { date_from: dateFrom, date_to: dateTo, ...siteExtra }),
      windsor(apiKey, "device,clicks,impressions,ctr,position", { date_from: dateFrom, date_to: dateTo, ...siteExtra }),
      windsor(apiKey, "country,clicks,impressions,ctr", { date_from: dateFrom, date_to: dateTo, ...siteExtra }),
    ]);

    const gscCurr = { clicks: sumF(gscAll,"clicks"), impressions: sumF(gscAll,"impressions"), ctr: sumF(gscAll,"clicks") / (sumF(gscAll,"impressions") || 1) * 100, position: avgF(gscAll,"position") };
const gscPrevS = { clicks: sumF(gscPrev,"clicks"), impressions: sumF(gscPrev,"impressions"), ctr: sumF(gscPrev,"clicks") / (sumF(gscPrev,"impressions") || 1) * 100, position: avgF(gscPrev,"position") };
    const topQueries = agg(gscByQuery, r => r.query, ["clicks","impressions","ctr","position"]).map((r: any) => ({ query: r._key, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })).sort((a: any, b: any) => b.clicks - a.clicks).slice(0, 15);
    const topPages = agg(gscByPage, r => r.page, ["clicks","impressions","ctr","position"]).map((r: any) => ({ page: r._key, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })).sort((a: any, b: any) => b.clicks - a.clicks).slice(0, 15);
    const trendMap: Record<string, any> = {};
for (const r of gscByDate) {
  const d = r.date; if (!d) continue;
  if (!trendMap[d]) trendMap[d] = { date: d, clicks: 0, impressions: 0, positions: [] };
  trendMap[d].clicks += parseFloat(r.clicks) || 0;
  trendMap[d].impressions += parseFloat(r.impressions) || 0;
  trendMap[d].positions.push(parseFloat(r.position) || 0);
}
const trend = Object.values(trendMap).map((d: any) => ({
  date: d.date.slice(5), clicks: Math.round(d.clicks), impressions: Math.round(d.impressions),
  ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 1000) / 10 : 0,
  position: d.positions.length ? Math.round(d.positions.reduce((a: number, b: number) => a + b, 0) / d.positions.length * 10) / 10 : 0,
})).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const byDevice = agg(gscByDevice, r => r.device || "UNKNOWN", ["clicks","impressions","ctr","position"]).map((r: any) => ({ device: r._key, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })).sort((a: any, b: any) => b.clicks - a.clicks);
    const byCountry = agg(gscByCountry, r => r.country, ["clicks","impressions","ctr"]).map((r: any) => ({ country: r._key, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr })).sort((a: any, b: any) => b.clicks - a.clicks).slice(0, 10);

    return NextResponse.json({
      dateFrom, dateTo,
      summary: {
        clicks: Math.round(gscCurr.clicks), impressions: Math.round(gscCurr.impressions),
        ctr: Math.round(gscCurr.ctr * 10) / 10, position: Math.round(gscCurr.position * 10) / 10,
        change: { clicks: pct(gscCurr.clicks, gscPrevS.clicks), impressions: pct(gscCurr.impressions, gscPrevS.impressions), ctr: pct(gscCurr.ctr, gscPrevS.ctr), position: -pct(gscCurr.position, gscPrevS.position) },
      },
      topQueries, topPages, trend, byDevice, byCountry,
    });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}