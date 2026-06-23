import { NextRequest, NextResponse } from "next/server";

const BASE = "https://connectors.windsor.ai";

const GA4_PROPERTIES: Record<string, string> = {
  "https://khao-yai.intercontinental.com/": "339641415",
  "https://www.sorahotels.com/sorasukhumvit/": "484664374",
  "https://www.sorahotels.com/": "484664374",
  "https://shintamani.com/": "476347859",
  "https://www.shintamani.com/": "476347859",
};

async function windsor(apiKey: string, fields: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ api_key: apiKey, fields, ...extra });
  const url = `${BASE}/googleanalytics4?${params}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.data || json || [];
}

function sumF(arr: any[], key: string) { return arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0); }
function avgF(arr: any[], key: string) { return arr.length === 0 ? 0 : sumF(arr, key) / arr.length; }
function pct(a: number, b: number) { return b === 0 ? 0 : Math.round(((a - b) / b) * 100); }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const apiKey = process.env.WINDSOR_API_KEY;
  const siteUrl = searchParams.get("site") || "";
  let dateFrom = searchParams.get("date_from") || "";
  let dateTo = searchParams.get("date_to") || "";

  if (!apiKey) return NextResponse.json({ error: "WINDSOR_API_KEY not configured" }, { status: 500 });

  const propertyId = GA4_PROPERTIES[siteUrl] || GA4_PROPERTIES[siteUrl.replace(/\/$/, "") + "/"];
  if (!propertyId) return NextResponse.json({ error: "No GA4 property configured for this site" }, { status: 404 });

  if (!dateFrom || !dateTo) {
    dateTo = new Date().toISOString().split("T")[0];
    const d = new Date(); d.setDate(d.getDate() - 28);
    dateFrom = d.toISOString().split("T")[0];
  }

  // Previous period
  const span = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000);
  const prevTo = new Date(dateFrom); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - span);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const extra = { date_from: dateFrom, date_to: dateTo, property_id: propertyId };
  const extraPrev = { date_from: fmt(prevFrom), date_to: fmt(prevTo), property_id: propertyId };

  try {
    const [curr, prev, byChannel, byPage, byDate, byDevice] = await Promise.all([
      windsor(apiKey, "sessions,active_users,engaged_sessions,average_session_duration,screen_page_views", extra),
      windsor(apiKey, "sessions,active_users,engaged_sessions,average_session_duration", extraPrev),
      windsor(apiKey, "session_default_channel_group,sessions,active_users,engaged_sessions", extra),
      windsor(apiKey, "page_path,screen_page_views,active_users,average_session_duration,engaged_sessions", extra),
      windsor(apiKey, "date,sessions,active_users", extra),
      windsor(apiKey, "device_category,sessions,active_users", extra),
    ]);

    const cs = sumF(curr, "sessions"), cu = sumF(curr, "active_users");
    const ce = sumF(curr, "engaged_sessions"), cd = avgF(curr, "average_session_duration");
    const cpv = sumF(curr, "screen_page_views");
    const ps = sumF(prev, "sessions"), pu = sumF(prev, "active_users");
    const pe = sumF(prev, "engaged_sessions"), pd = avgF(prev, "average_session_duration");

    const engRate = cs > 0 ? Math.round((ce / cs) * 100) : 0;
    const prevEngRate = ps > 0 ? Math.round((pe / ps) * 100) : 0;

    // Channels
    const chMap: Record<string, any> = {};
    for (const r of byChannel) {
      const ch = r.session_default_channel_group || "Other";
      if (!chMap[ch]) chMap[ch] = { channel: ch, sessions: 0, users: 0, engaged: 0 };
      chMap[ch].sessions += parseFloat(r.sessions) || 0;
      chMap[ch].users += parseFloat(r.active_users) || 0;
      chMap[ch].engaged += parseFloat(r.engaged_sessions) || 0;
    }
    const channels = Object.values(chMap).map((c: any) => ({
      channel: c.channel,
      sessions: Math.round(c.sessions),
      users: Math.round(c.users),
      engRate: c.sessions > 0 ? Math.round((c.engaged / c.sessions) * 100) : 0,
    })).sort((a, b) => b.sessions - a.sessions);

    // Top pages
    const pgMap: Record<string, any> = {};
    for (const r of byPage) {
      const p = r.page_path; if (!p) continue;
      if (!pgMap[p]) pgMap[p] = { page: p, pageviews: 0, users: 0, durations: [], engaged: 0 };
      pgMap[p].pageviews += parseFloat(r.screen_page_views) || 0;
      pgMap[p].users += parseFloat(r.active_users) || 0;
      pgMap[p].durations.push(parseFloat(r.average_session_duration) || 0);
      pgMap[p].engaged += parseFloat(r.engaged_sessions) || 0;
    }
    const topPages = Object.values(pgMap).map((p: any) => ({
      page: p.page,
      pageviews: Math.round(p.pageviews),
      users: Math.round(p.users),
      avgDuration: Math.round(p.durations.reduce((a: number, b: number) => a + b, 0) / (p.durations.length || 1)),
      engRate: p.pageviews > 0 ? Math.round((p.engaged / p.pageviews) * 100) : 0,
    })).sort((a, b) => b.pageviews - a.pageviews).slice(0, 10);

    // Trend
    const dMap: Record<string, any> = {};
    for (const r of byDate) {
      const d = r.date; if (!d) continue;
      if (!dMap[d]) dMap[d] = { date: d, sessions: 0, users: 0 };
      dMap[d].sessions += parseFloat(r.sessions) || 0;
      dMap[d].users += parseFloat(r.active_users) || 0;
    }
    const trend = Object.values(dMap).map((d: any) => ({
      date: d.date.slice(5), sessions: Math.round(d.sessions), users: Math.round(d.users),
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Devices
    const devMap: Record<string, any> = {};
    for (const r of byDevice) {
      const dev = r.device_category || "other";
      if (!devMap[dev]) devMap[dev] = { device: dev, sessions: 0, users: 0 };
      devMap[dev].sessions += parseFloat(r.sessions) || 0;
      devMap[dev].users += parseFloat(r.active_users) || 0;
    }
    const devices = Object.values(devMap).map((d: any) => ({
      device: d.device, sessions: Math.round(d.sessions), users: Math.round(d.users),
    })).sort((a, b) => b.sessions - a.sessions);

    return NextResponse.json({
      summary: {
        sessions: Math.round(cs), users: Math.round(cu),
        engagedSessions: Math.round(ce), engRate,
        avgDuration: Math.round(cd), pageviews: Math.round(cpv),
        change: {
          sessions: pct(cs, ps), users: pct(cu, pu),
          engRate: pct(engRate, prevEngRate),
          avgDuration: pct(cd, pd),
        },
      },
      channels, topPages, trend, devices,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
