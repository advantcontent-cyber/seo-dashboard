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

// ── Period Summary ───────────────────────────────────────────────────────────
function PeriodSummary({ data, ga4Data, clientName, siteUrl }: { data: any; ga4Data: any; clientName: string; siteUrl: string }) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!data) return;
    setLoading(true); setError(null); setSummary(null);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          dateFrom: data.dateFrom,
          dateTo: data.dateTo,
          gsc: data,
          ga4: ga4Data,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSummary(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [clientName, data?.summary?.clicks, ga4Data?.summary?.sessions]);

  useEffect(() => { if (data) generate(); }, [clientName, data?.summary?.clicks]);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-eyebrow">Claude AI · {data?.dateFrom} → {data?.dateTo}</div>
          <div className="card-title">Performance Summary</div>
        </div>
        <button className="btn-refresh" onClick={generate} disabled={loading} style={{ fontSize: 11, padding: "5px 11px" }}>
          <RefreshCw size={11} />{loading ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {loading && <div className="ai-loading"><div className="ai-spinner" />Summarising with Claude...</div>}
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>⚠ {error}</div>}

      {summary && !loading && (
        <>
          {/* Headline */}
          {summary.headline && (
            <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.7, padding: "13px 16px", background: "var(--cream)", borderRadius: 0, borderLeft: "3px solid var(--gold)", fontStyle: "italic" }}>
              {summary.headline}
            </div>
          )}

          {/* Working + Watch out */}
          <div className="two-col">
            <div style={{ background: "#EDF7F3", border: "1px solid #C5E4D8", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>✦</span>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--teal)" }}>What&apos;s working</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 9 }}>
                {(summary.working || []).map((w: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span style={{ minWidth: 18, height: 18, background: "var(--teal)", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{w}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#FDF0EF", border: "1px solid #F0C9C6", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>▲</span>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--rose)" }}>Watch out for</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 9 }}>
                {(summary.watchout || []).map((w: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span style={{ minWidth: 18, height: 18, background: "var(--rose)", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Priority */}
          {summary.priority && (
            <div style={{ display: "flex", gap: 12, padding: "13px 16px", background: "var(--cream)", borderRadius: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: "var(--text)", color: "var(--cream)", whiteSpace: "nowrap" as const, marginTop: 1 }}>TOP PRIORITY</span>
              <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{summary.priority}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── AI Action Table ───────────────────────────────────────────────────────────
function AIActionTable({ data, clientName }: { data: any; clientName: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");

  const generate = useCallback(async () => {
    if (!data) return;
    setLoading(true); setError(null); setItems([]);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, ...data }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(json.items || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [clientName, data?.summary?.clicks]);

  useEffect(() => { if (data) generate(); }, [clientName, data?.summary?.clicks]);

  const types = ["All", "GEO", "CONTENT", "ON-PAGE", "TECHNICAL"];
  const filtered = filter === "All" ? items : items.filter(i => i.type === filter);

  const impactColor = (v: string) => v === "High" ? { bg: "#EDF7F3", color: "var(--teal)" } : v === "Medium" ? { bg: "#FEF3E2", color: "#B07C20" } : { bg: "var(--cream-dark)", color: "var(--text-muted)" };
  const effortColor = (v: string) => v === "Low" ? { bg: "#EDF7F3", color: "var(--teal)" } : v === "Medium" ? { bg: "#FEF3E2", color: "#B07C20" } : { bg: "#FDF0EF", color: "var(--rose)" };
  const typeColor = (v: string) => v === "GEO" ? { bg: "var(--blue-bg, #E8F0FE)", color: "#1A73E8" } : v === "CONTENT" ? { bg: "#FEF3E2", color: "#B07C20" } : v === "TECHNICAL" ? { bg: "#F3E8FD", color: "#7C3AED" } : { bg: "var(--cream-dark)", color: "var(--text-muted)" };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-eyebrow">Claude AI · GSC Data</div>
          <div className="card-title">SEO Action Items</div>
        </div>
        <button className="btn-refresh" onClick={generate} disabled={loading} style={{ fontSize: 11, padding: "5px 11px" }}>
          <RefreshCw size={11} />{loading ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            padding: "4px 12px", borderRadius: 20, border: "1px solid",
            borderColor: filter === t ? "var(--gold)" : "var(--cream-border)",
            background: filter === t ? "var(--text)" : "white",
            color: filter === t ? "var(--cream)" : "var(--text-muted)",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}>{t}</button>
        ))}
      </div>

      {loading && <div className="ai-loading"><div className="ai-spinner" />Analysing with Claude Haiku...</div>}
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>⚠ {error}</div>}

      {!loading && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>Action</th>
                <th>Query</th>
                <th style={{ textAlign: "center" }}>Type</th>
                <th style={{ textAlign: "center" }}>Impact</th>
                <th style={{ textAlign: "center" }}>Effort</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any, i: number) => {
                const ic = impactColor(item.impact);
                const ec = effortColor(item.effort);
                const tc = typeColor(item.type);
                return (
                  <tr key={i}>
                    <td style={{ color: "var(--text-dim)", fontSize: 11 }}>{i + 1}</td>
                    <td style={{ color: "var(--text)", fontWeight: 500, fontSize: 13 }}>{item.action}</td>
                    <td><span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{item.query}</span></td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: tc.bg, color: tc.color }}>{item.type}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: ic.bg, color: ic.color }}>{item.impact}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: ec.bg, color: ec.color }}>{item.effort}</span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.category}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="empty-cell">No action items yet — click Regenerate</div>
      )}

      <div style={{ fontSize: 10, color: "var(--text-dim)", textAlign: "right" }}>
        Generated from {data?.dateFrom} → {data?.dateTo} GSC data · {items.length} actions
      </div>
    </div>
  );
}

// ── GA4 Section ───────────────────────────────────────────────────────────────
function GA4Section({ siteUrl, dateFrom, dateTo, onData }: { siteUrl: string; dateFrom: string; dateTo: string; onData?: (d: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [ga4Data, setGa4Data] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!siteUrl) return;
    setLoading(true); setError(null); setData(null);
    try {
      const params = new URLSearchParams({ site: siteUrl, date_from: dateFrom, date_to: dateTo });
      const res = await fetch(`/api/ga4?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      onData?.(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [siteUrl, dateFrom, dateTo]);

  useEffect(() => { load(); }, [siteUrl, dateFrom, dateTo]);

  function fNum(n: number) { if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1000) return (n / 1000).toFixed(1) + "K"; return Math.round(n).toString(); }
  function fDur(s: number) { return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`; }

  const s = data?.summary;

  const TT = { background: "white", border: "1px solid #DDD5C4", borderRadius: 8, fontSize: 12 };

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>

      {/* GA4 Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="card-eyebrow">Google Analytics 4</div>
          <div style={{ fontFamily: "Playfair Display, serif", fontSize: 17, fontWeight: 500, color: "var(--text)" }}>Audience & Engagement</div>
        </div>
        <button className="btn-refresh" onClick={load} disabled={loading} style={{ fontSize: 11, padding: "5px 11px" }}>
          <RefreshCw size={11} />{loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loading && <div className="ai-loading"><div className="ai-spinner" />Fetching GA4 data...</div>}
      {error && (
        <div style={{ background: "#FDF0EF", border: "1px solid #F0C9C6", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "var(--rose)" }}>
          ⚠ {error.includes("No GA4 property") ? "GA4 not configured for this client yet." : error}
        </div>
      )}

      {s && !loading && (
        <>
          {/* GA4 KPI row */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Sessions</div>
              <div className="kpi-value">{fNum(s.sessions)}</div>
              <div className={`kpi-change ${s.change.sessions >= 0 ? "up" : "down"}`}>
                {s.change.sessions >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                <span>{Math.abs(s.change.sessions)}% vs prev</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Active Users</div>
              <div className="kpi-value">{fNum(s.users)}</div>
              <div className={`kpi-change ${s.change.users >= 0 ? "up" : "down"}`}>
                {s.change.users >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                <span>{Math.abs(s.change.users)}% vs prev</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Engagement Rate</div>
              <div className="kpi-value">{s.engRate}%</div>
              <div className={`kpi-change ${s.change.engRate >= 0 ? "up" : "down"}`}>
                {s.change.engRate >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                <span>{Math.abs(s.change.engRate)}% vs prev</span>
              </div>
              <div className="kpi-sub">Engaged / total sessions</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg Session Duration</div>
              <div className="kpi-value">{fDur(s.avgDuration)}</div>
              <div className={`kpi-change ${s.change.avgDuration >= 0 ? "up" : "down"}`}>
                {s.change.avgDuration >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                <span>{Math.abs(s.change.avgDuration)}% vs prev</span>
              </div>
            </div>
          </div>

          {/* Sessions trend */}
          <div className="card">
            <div className="card-eyebrow">Traffic Trend</div>
            <div className="card-title">Sessions Over Time</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="ga4g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2A6B5E" stopOpacity={0.15}/><stop offset="95%" stopColor="#2A6B5E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D8"/>
                <XAxis dataKey="date" tick={{fill:"#9A9080",fontSize:10}}/>
                <YAxis tick={{fill:"#9A9080",fontSize:10}}/>
                <Tooltip contentStyle={TT}/>
                <Area type="monotone" dataKey="sessions" stroke="#2A6B5E" fill="url(#ga4g1)" strokeWidth={2} name="Sessions"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Channel + Top pages */}
          <div className="two-col">
            <div className="card">
              <div className="card-eyebrow">Traffic Sources</div>
              <div className="card-title">Channel Performance</div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr>
                    <th>Channel</th>
                    <th style={{textAlign:"right"}}>Sessions</th>
                    <th style={{textAlign:"right"}}>Users</th>
                    <th style={{textAlign:"right"}}>Eng. Rate</th>
                  </tr></thead>
                  <tbody>
                    {(data.channels || []).map((c: any, i: number) => (
                      <tr key={i}>
                        <td style={{color:"var(--text)",fontWeight:500,fontSize:13}}>{c.channel}</td>
                        <td style={{textAlign:"right",color:"var(--text-muted)"}}>{fNum(c.sessions)}</td>
                        <td style={{textAlign:"right",color:"var(--text-muted)"}}>{fNum(c.users)}</td>
                        <td style={{textAlign:"right"}}>
                          <span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:4,
                            background:c.engRate>=60?"#EDF7F3":c.engRate>=40?"#FEF3E2":"#FDF0EF",
                            color:c.engRate>=60?"var(--teal)":c.engRate>=40?"#B07C20":"var(--rose)"}}>
                            {c.engRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-eyebrow">Top Content</div>
              <div className="card-title">Top Pages (GA4)</div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr>
                    <th>Page</th>
                    <th style={{textAlign:"right"}}>Views</th>
                    <th style={{textAlign:"right"}}>Duration</th>
                  </tr></thead>
                  <tbody>
                    {(data.topPages || []).slice(0,8).map((p: any, i: number) => (
                      <tr key={i}>
                        <td><span className="page-text" title={p.page}>{p.page}</span></td>
                        <td style={{textAlign:"right",color:"var(--text-muted)"}}>{fNum(p.pageviews)}</td>
                        <td style={{textAlign:"right",color:"var(--text-muted)"}}>{fDur(p.avgDuration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Device split */}
          <div className="card">
            <div className="card-eyebrow">Audience</div>
            <div className="card-title">Device Split</div>
            <div className="device-row">
              {(data.devices || []).map((d: any, i: number) => {
                const total = (data.devices || []).reduce((s: number, x: any) => s + x.sessions, 0) || 1;
                const colors = ["#2A6B5E", "#C9A96E", "#1C1C1C"];
                return (
                  <div key={i} className="device-bar-row">
                    <div className="device-bar-label">
                      <span className="device-bar-name" style={{textTransform:"capitalize"}}>{d.device}</span>
                      <span className="device-bar-val">{fNum(d.sessions)} sessions · {Math.round((d.sessions/total)*100)}%</span>
                    </div>
                    <div className="device-bar-track">
                      <div className="device-bar-fill" style={{width:`${(d.sessions/total)*100}%`,background:colors[i%colors.length]}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
  const [ga4Data, setGa4Data] = useState<any>(null);
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
            <PeriodSummary data={data} ga4Data={ga4Data} clientName={siteName(activeUrl)} siteUrl={activeUrl} />

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

            <AIActionTable data={data} clientName={siteName(activeUrl)} />

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

            {/* GA4 divider */}
            <div style={{borderTop:"2px solid var(--cream-border)", paddingTop:8}}>
              <GA4Section siteUrl={activeUrl} dateFrom={dateFrom} dateTo={dateTo} onData={setGa4Data} />
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
