"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, Key, AlertCircle, ChevronRight, X, ChevronDown, Calendar, Lock } from "lucide-react";

const TT = { background: "white", border: "1px solid #DDD5C4", borderRadius: 8, fontSize: 12 };
const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 28 days", days: 28 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last 12 months", days: 365 },
];

function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }
function subtractDays(days: number) { const d = new Date(); d.setDate(d.getDate() - days); return toDateStr(d); }
function fmtDisplay(s: string) {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fNum(n: number) { if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1000) return (n / 1000).toFixed(1) + "K"; return Math.round(n).toString(); }
function siteName(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }

// ── Date Range Picker ─────────────────────────────────────────────────────────
function DateRangePicker({ dateFrom, dateTo, onChange }: { dateFrom: string; dateTo: string; onChange: (f: string, t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalFrom(dateFrom); setLocalTo(dateTo); }, [dateFrom, dateTo]);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function apply() {
    if (localFrom && localTo && localFrom <= localTo) { onChange(localFrom, localTo); setOpen(false); }
  }
  function applyPreset(days: number) {
    const to = toDateStr(new Date()), from = subtractDays(days);
    onChange(from, to); setLocalFrom(from); setLocalTo(to); setOpen(false);
  }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="date-range-btn" onClick={() => setOpen(!open)}>
        <Calendar size={13} />
        <span>{fmtDisplay(dateFrom)} → {fmtDisplay(dateTo)}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="date-picker-dropdown">
          <div className="date-picker-presets">
            <div className="date-picker-preset-label">Quick Select</div>
            {PRESETS.map(p => (
              <button key={p.days} className="date-preset-btn" onClick={() => applyPreset(p.days)}>{p.label}</button>
            ))}
          </div>
          <div className="date-picker-custom">
            <div className="date-picker-preset-label">Custom Range</div>
            <div className="date-picker-inputs">
              <div className="date-input-group">
                <label>From</label>
                <input type="date" value={localFrom} max={localTo || toDateStr(new Date())} onChange={e => setLocalFrom(e.target.value)} className="date-input" />
              </div>
              <div className="date-input-group">
                <label>To</label>
                <input type="date" value={localTo} min={localFrom} max={toDateStr(new Date())} onChange={e => setLocalTo(e.target.value)} className="date-input" />
              </div>
            </div>
            <button className="date-apply-btn" onClick={apply} disabled={!localFrom || !localTo || localFrom > localTo}>Apply Range</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Client Dropdown ───────────────────────────────────────────────────────────
function ClientDropdown({ sites, activeUrl, onChange }: { sites: any[]; activeUrl: string; onChange: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const active = sites.find(s => s.url === activeUrl);
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="client-dropdown-btn" onClick={() => setOpen(!open)}>
        <div className="client-dropdown-active">
          <span className="client-dropdown-name">{active ? siteName(active.url) : "Select client"}</span>
          {active && <span className="client-dropdown-url">{active.url.replace(/^https?:\/\//, "")}</span>}
        </div>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="client-dropdown-menu">
          {sites.length === 0 && <div className="client-dropdown-empty">No sites found</div>}
          {sites.map(s => (
            <button key={s.url} className={`client-dropdown-item ${s.url === activeUrl ? "active" : ""}`} onClick={() => { onChange(s.url); setOpen(false); }}>
              <span className="cdi-name">{siteName(s.url)}</span>
              <span className="cdi-url">{s.url.replace(/^https?:\/\//, "")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Insights ───────────────────────────────────────────────────────────────
function AIInsights({ data, clientName }: { data: any; clientName: string }) {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true); setError(null); setInsights(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, ...data }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setInsights(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [clientName, data?.summary?.clicks]);

  useEffect(() => { if (data) generate(); }, [clientName, data?.summary?.clicks]);

  return (
    <div className="card">
      <div className="card-header">
        <div><div className="card-eyebrow">AI Analysis</div><div className="card-title">Brightspots & Critical Issues</div></div>
        <button className="btn-refresh" onClick={generate} disabled={loading} style={{ fontSize: 11, padding: "5px 11px" }}>
          <RefreshCw size={11} /> Regenerate
        </button>
      </div>
      {loading && <div className="ai-loading"><div className="ai-spinner" />Analysing SEO data with Claude AI...</div>}
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>⚠ {error}</div>}
      {insights && !loading && (
        <>
          {insights.headline && <div className="insight-headline">{insights.headline}</div>}
          <div className="insights-grid">
            {(insights.brightspots || []).map((b: any, i: number) => (
              <div key={i} className="insight-box bright">
                <div className="insight-icon">✦</div>
                <div className="insight-title bright">{b.title}</div>
                <div className="insight-detail">{b.detail}</div>
              </div>
            ))}
            {(insights.criticalIssues || []).map((c: any, i: number) => (
              <div key={i} className="insight-box issue">
                <div className="insight-icon">▲</div>
                <div className="insight-title issue">{c.title}</div>
                <div className="insight-detail">{c.detail}</div>
              </div>
            ))}
          </div>
          {insights.recommendations?.length > 0 && (
            <div>
              <div className="card-eyebrow" style={{ marginBottom: 12 }}>What We Should Do</div>
              <div className="recs-list">
                {insights.recommendations.map((r: string, i: number) => (
                  <div key={i} className="rec-item">
                    <div className="rec-num">{i + 1}</div>
                    <div className="rec-text">{r}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, change, sub, inverseGood }: any) {
  const pos = change > 0;
  const cls = pos ? (inverseGood ? "up-bad" : "up") : (inverseGood ? "down-good" : "down");
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {change !== undefined && (
        <div className={`kpi-change ${cls}`}>
          {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{Math.abs(change)}% vs prev period</span>
        </div>
      )}
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Table({ cols, rows, empty }: any) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{cols.map((c: any) => <th key={c.key} style={{ textAlign: c.align || "left" }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} className="empty-cell">{empty || "No data"}</td></tr>
            : rows.map((row: any, i: number) => (
              <tr key={i}>{cols.map((c: any) => (
                <td key={c.key} style={{ textAlign: c.align || "left" }}>
                  {c.render ? c.render(row[c.key], row) : row[c.key]}
                </td>
              ))}</tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function PosTag({ v }: { v: number }) {
  return <span className={`pos-tag ${v <= 3 ? "pos-top" : v <= 10 ? "pos-mid" : "pos-low"}`}>#{v}</span>;
}

function DeviceBars({ devices }: { devices: any[] }) {
  const total = devices.reduce((s, d) => s + d.clicks, 0) || 1;
  const colors = ["#2A6B5E", "#C9A96E", "#1C1C1C"];
  return (
    <div className="device-row">
      {devices.map((d, i) => (
        <div key={d.device} className="device-bar-row">
          <div className="device-bar-label">
            <span className="device-bar-name">{d.device}</span>
            <span className="device-bar-val">{fNum(d.clicks)} clicks · {d.ctr}% CTR</span>
          </div>
          <div className="device-bar-track">
            <div className="device-bar-fill" style={{ width: `${(d.clicks / total) * 100}%`, background: colors[i % colors.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [authed, setAuthed] = useState<boolean>(true);
  const [sites, setSites] = useState<any[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [activeUrl, setActiveUrl] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(subtractDays(28));
  const [dateTo, setDateTo] = useState(toDateStr(new Date()));




  // Load sites once authed
  const loadSites = useCallback(async () => {
    setSitesLoading(true);
    try {
      const res = await fetch("/api/sites");
      const json = await res.json();
      if (json.sites?.length) { setSites(json.sites); setActiveUrl(json.sites[0].url); }
    } catch {}
    finally { setSitesLoading(false); }
  }, []);

  useEffect(() => { if (authed) loadSites(); }, [authed]);

  const fetchData = useCallback(async (url?: string, from?: string, to?: string) => {
    const u = url || activeUrl;
    const f = from || dateFrom;
    const t = to || dateTo;
    if (!u) return;
    setLoading(true); setError(null); setData(null);
    try {
      const params = new URLSearchParams({ date_from: f, date_to: t, site: u });
      const res = await fetch(`/api/windsor?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [activeUrl, dateFrom, dateTo]);

  useEffect(() => { if (authed && activeUrl) fetchData(); }, [activeUrl]);

  function handleDateChange(from: string, to: string) {
    setDateFrom(from); setDateTo(to);
    fetchData(activeUrl, from, to);
  }
  function handleClientChange(url: string) {
    setActiveUrl(url);
    fetchData(url, dateFrom, dateTo);
  }

  const s = data?.summary;
  const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="portal">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-label">Client Portal</div>
          <div className="brand-name">Advant SEO</div>
          <div className="brand-rule" />
        </div>

        <div className="sidebar-section-label">Active Client</div>
        <div style={{ padding: "0 12px 16px" }}>
          {sitesLoading
            ? <div style={{ color: "#555", fontSize: 12, padding: "8px" }}>Loading clients...</div>
            : <ClientDropdown sites={sites} activeUrl={activeUrl} onChange={handleClientChange} />}
        </div>

        {sites.length > 0 && (
          <>
            <div className="sidebar-section-label">All Clients</div>
            {sites.map(s => (
              <button key={s.url} className={`client-item ${s.url === activeUrl ? "active" : ""}`} onClick={() => handleClientChange(s.url)}>
                <span className="client-name">{siteName(s.url)}</span>
                <span className="client-url">{s.url.replace(/^https?:\/\//, "")}</span>
              </button>
            ))}
          </>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">Advant AI · SEO Portal</div>

        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-eyebrow">SEO Performance</div>
            <div className="topbar-title">{activeUrl ? siteName(activeUrl) : "Select a client"}</div>
          </div>
          <div className="topbar-right">
            <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={handleDateChange} />
            <button className={`btn-refresh ${loading ? "spinning" : ""}`} onClick={() => fetchData()} disabled={loading}>
              <RefreshCw size={13} />{loading ? "Fetching..." : "Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <AlertCircle size={14} /><span>{error}</span>
            <button className="error-close" onClick={() => setError(null)}><X size={13} /></button>
          </div>
        )}

        {loading && (
          <div className="loading-screen" style={{ height: "60vh" }}>
            <div className="spinner" /><p>Fetching from Windsor.ai...</p>
          </div>
        )}

        {!activeUrl && !loading && (
          <div className="loading-screen" style={{ height: "60vh" }}>
            <p style={{ fontStyle: "italic" }}>Select a client from the sidebar to get started</p>
          </div>
        )}

        {s && !loading && (
          <div className="content">
            <div className="kpi-grid">
              <KpiCard label="Organic Clicks" value={fNum(s.clicks)} change={s.change.clicks} />
              <KpiCard label="Impressions" value={fNum(s.impressions)} change={s.change.impressions} />
              <KpiCard label="Avg CTR" value={s.ctr + "%"} change={s.change.ctr} />
              <KpiCard label="Avg Position" value={"#" + s.position} change={s.change.position} sub="Lower is better" inverseGood />
            </div>

            <div className="card">
              <div className="card-header">
                <div><div className="card-eyebrow">Organic Search</div><div className="card-title">Clicks & Impressions</div></div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.trend}>
                  <defs>
                    <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2A6B5E" stopOpacity={0.15}/><stop offset="95%" stopColor="#2A6B5E" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#C9A96E" stopOpacity={0.12}/><stop offset="95%" stopColor="#C9A96E" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D8"/>
                  <XAxis dataKey="date" tick={{fill:"#9A9080",fontSize:10}}/>
                  <YAxis yAxisId="l" tick={{fill:"#9A9080",fontSize:10}}/>
                  <YAxis yAxisId="r" orientation="right" tick={{fill:"#9A9080",fontSize:10}}/>
                  <Tooltip contentStyle={TT}/>
                  <Area yAxisId="l" type="monotone" dataKey="clicks" stroke="#2A6B5E" fill="url(#gc)" strokeWidth={2} name="Clicks"/>
                  <Area yAxisId="r" type="monotone" dataKey="impressions" stroke="#C9A96E" fill="url(#gi)" strokeWidth={2} name="Impressions"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="two-col">
              <div className="card">
                <div className="card-eyebrow">Click-Through Rate</div>
                <div className="card-title">CTR Over Time</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D8"/>
                    <XAxis dataKey="date" tick={{fill:"#9A9080",fontSize:10}}/>
                    <YAxis tick={{fill:"#9A9080",fontSize:10}} unit="%"/>
                    <Tooltip contentStyle={TT}/>
                    <Line type="monotone" dataKey="ctr" stroke="#2A6B5E" strokeWidth={2} dot={false} name="CTR %"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div className="card-eyebrow">Rankings</div>
                <div className="card-title">Avg Position Over Time</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D8"/>
                    <XAxis dataKey="date" tick={{fill:"#9A9080",fontSize:10}}/>
                    <YAxis reversed tick={{fill:"#9A9080",fontSize:10}}/>
                    <Tooltip contentStyle={TT}/>
                    <Line type="monotone" dataKey="position" stroke="#C9A96E" strokeWidth={2} dot={false} name="Avg Position"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <AIInsights data={data} clientName={siteName(activeUrl)} />

            <div className="two-col">
              <div className="card">
                <div className="card-eyebrow">Organic Search</div><div className="card-title">Top Queries</div>
                <Table cols={[
                  {key:"query",label:"Query",render:(v:string)=><span className="query-text">{v}</span>},
                  {key:"clicks",label:"Clicks",align:"right",render:(v:number)=>fNum(v)},
                  {key:"ctr",label:"CTR",align:"right",render:(v:number)=>v+"%"},
                  {key:"position",label:"Pos",align:"right",render:(v:number)=><PosTag v={v}/>},
                ]} rows={data.topQueries||[]} empty="No query data"/>
              </div>
              <div className="card">
                <div className="card-eyebrow">Organic Search</div><div className="card-title">Top Pages</div>
                <Table cols={[
                  {key:"page",label:"Page",render:(v:string)=><span className="page-text" title={v}>{v?.replace(/^https?:\/\/[^/]+/,"")}</span>},
                  {key:"clicks",label:"Clicks",align:"right",render:(v:number)=>fNum(v)},
                  {key:"ctr",label:"CTR",align:"right",render:(v:number)=>v+"%"},
                  {key:"position",label:"Pos",align:"right",render:(v:number)=><PosTag v={v}/>},
                ]} rows={data.topPages||[]} empty="No page data"/>
              </div>
            </div>

            <div className="two-col">
              <div className="card">
                <div className="card-eyebrow">Traffic Breakdown</div><div className="card-title">Device Performance</div>
                <DeviceBars devices={data.byDevice||[]}/>
                <Table cols={[
                  {key:"device",label:"Device"},
                  {key:"clicks",label:"Clicks",align:"right",render:(v:number)=>fNum(v)},
                  {key:"impressions",label:"Impr.",align:"right",render:(v:number)=>fNum(v)},
                  {key:"ctr",label:"CTR",align:"right",render:(v:number)=>v+"%"},
                  {key:"position",label:"Pos",align:"right",render:(v:number)=><PosTag v={v}/>},
                ]} rows={data.byDevice||[]} empty="No device data"/>
              </div>
              <div className="card">
                <div className="card-eyebrow">Traffic Breakdown</div><div className="card-title">Top Countries</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={(data.byCountry||[]).slice(0,7)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D8"/>
                    <XAxis type="number" tick={{fill:"#9A9080",fontSize:10}}/>
                    <YAxis type="category" dataKey="country" tick={{fill:"#9A9080",fontSize:9}} width={70}/>
                    <Tooltip contentStyle={TT}/>
                    <Bar dataKey="clicks" fill="#C9A96E" radius={[0,4,4,0]} name="Clicks"/>
                  </BarChart>
                </ResponsiveContainer>
                <Table cols={[
                  {key:"country",label:"Country"},
                  {key:"clicks",label:"Clicks",align:"right",render:(v:number)=>fNum(v)},
                  {key:"impressions",label:"Impr.",align:"right",render:(v:number)=>fNum(v)},
                  {key:"ctr",label:"CTR",align:"right",render:(v:number)=>v+"%"},
                ]} rows={data.byCountry||[]} empty="No country data"/>
              </div>
            </div>

            <div style={{textAlign:"center",color:"var(--text-dim)",fontSize:11,paddingBottom:8}}>
              Advant SEO Portal · Last refreshed {now}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
