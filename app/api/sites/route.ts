import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "WINDSOR_API_KEY not configured" }, { status: 500 });
  try {
    const today = new Date().toISOString().split("T")[0];
    const params = new URLSearchParams({ api_key: apiKey, fields: "site,clicks", date_from: "2025-01-01", date_to: today });
    const res = await fetch("https://connectors.windsor.ai/searchconsole?" + params, { next: { revalidate: 3600 } });
    if (!res.ok) { const t = await res.text(); throw new Error("Windsor error " + res.status + ": " + t.slice(0, 200)); }
    const json = await res.json();
    const rows = json.data || json || [];
    const siteMap: Record<string, number> = {};
    for (const r of rows) { const site = r.site; if (!site) continue; siteMap[site] = (siteMap[site] || 0) + (parseFloat(r.clicks) || 0); }
    const sites = Object.entries(siteMap).map(([url, clicks]) => ({ url, clicks: Math.round(clicks as number) })).sort((a, b) => b.clicks - a.clicks);
    return NextResponse.json({ sites });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}