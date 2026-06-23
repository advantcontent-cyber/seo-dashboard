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
  const [tab, setTab] = useState<"insights"|"opportunities"|"actions">("insights");

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
        <div><div className="card-eyebrow">AI Analysis · 2-Pass Claude Strategy</div><div className="card-title">SEO Intelligence</div></div>
        <button className="btn-refresh" onClick={generate} disabled={loading} style={{ fontSize: 11, padding: "5px 11px" }}>
          <RefreshCw size={11} /> Regenerate
        </button>
      </div>

      {loading && <div className="ai-loading"><div className="ai-spinner" />Running 2-pass Claude SEO analysis...</div>}
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>⚠ {error}</div>}

      {insights && !loading && (
        <>
          {insights.headline && <div className="insight-headline">{insights.headline}</div>}
          {insights.focusStatement && (
            <div style={{ background: "#1C1C1C", color: "#C9A96E", padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              🎯 {insights.focusStatement}
            </div>
          )}

          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--cream-border)" }}>
            {(["insights","opportunities","actions"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "8px 14px", border: "none", background: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif",
                color: tab === t ? "var(--text)" : "var(--text-muted)",
                borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent",
                textTransform: "capitalize" as const,
              }}>{t === "insights" ? "Brightspots & Issues" : t === "opportunities" ? "Quick Wins" : "Action Plan"}</button>
            ))}
          </div>

          {tab === "insights" && (
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
          )}

          {tab === "opportunities" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {insights.quickWins?.length > 0 && (
                <div>
                  <div className="card-eyebrow" style={{ marginBottom: 10 }}>Quick Wins — Close to Page 1</div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Query</th><th style={{textAlign:"right"}}>Pos</th><th style={{textAlign:"right"}}>Impr.</th><th>Action</th></tr></thead>
                      <tbody>
                        {insights.quickWins.map((q: any, i: number) => (
                          <tr key={i}>
                            <td><span className="query-text">{q.query}</span></td>
                            <td style={{textAlign:"right"}}><span className={`pos-tag ${q.position <= 10 ? "pos-mid" : "pos-low"}`}>#{q.position}</span></td>
                            <td style={{textAlign:"right"}}>{fNum(q.impressions)}</td>
                            <td style={{fontSize:12,color:"var(--text-muted)"}}>{q.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {insights.contentGaps?.length > 0 && (
                <div>
                  <div className="card-eyebrow" style={{ marginBottom: 10 }}>Content Gaps — Pages to Create or Update</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {insights.contentGaps.map((g: any, i: number) => (
                      <div key={i} style={{ display: "flex", gap: 12, padding: "12px", background: "var(--cream)", borderRadius: 8, alignItems: "flex-start" }}>
                        <span style={{ background: "var(--text)", color: "var(--cream)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap" as const, marginTop: 1 }}>{g.type?.toUpperCase()}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{g.title}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.rationale}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {insights.missedOpportunities?.length > 0 && (
                <div>
                  <div className="card-eyebrow" style={{ marginBottom: 10 }}>Missed Opportunities</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {insights.missedOpportunities.map((m: any, i: number) => (
                      <div key={i} className="insight-box issue">
                        <div className="insight-title issue">{m.opportunity}</div>
                        <div className="insight-detail">{m.recommendation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "actions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {insights.competitorEdge && (
                <div style={{ padding: "14px 16px", background: "var(--cream)", borderRadius: 8, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, borderLeft: "3px solid var(--gold)" }}>
                  <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>What Competitors Are Doing Better</div>
                  {insights.competitorEdge}
                </div>
              )}
              <div className="card-eyebrow" style={{ marginBottom: 4 }}>Prioritised Action Plan</div>
              {(insights.actionPlan || []).map((a: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "14px", background: "var(--cream)", borderRadius: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 24, height: 24, background: "var(--text)", color: "var(--cream)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, marginTop: 1 }}>{a.priority}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{a.action}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{a.rationale}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: a.impact === "high" ? "#E8F5F0" : a.impact === "medium" ? "#FEF3E2" : "#F5F5F5", color: a.impact === "high" ? "var(--teal)" : a.impact === "medium" ? "#B07C20" : "var(--text-muted)" }}>{a.impact?.toUpperCase()} IMPACT</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#F5F5F5", color: "var(--text-muted)" }}>{a.effort?.toUpperCase()} EFFORT</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}



// ── AI Overview Section ──────────────────────────────────────────────────────
function AIOverview({ siteUrl }: { siteUrl: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"summary"|"opportunities"|"keywords">("summary");

  const load = useCallback(async () => {
    if (!siteUrl) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/semrush?site=${encodeURIComponent(siteUrl)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [siteUrl]);

  useEffect(() => { load(); }, [siteUrl]);

  const s = data?.summary;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-eyebrow">Semrush · Position Tracking</div>
          <div className="card-title">AI Overview Performance</div>
        </div>
        <button className="btn-refresh" onClick={load} disabled={loading} style={{ fontSize: 11, padding: "5px 11px" }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading && <div className="ai-loading"><div className="ai-spinner" />Fetching AI Overview data from SEMrush...</div>}
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>⚠ {error}</div>}

      {s && !loading && (
        <>
          {/* AIO KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {[
              { label: "Keywords Tracked", value: s.total, color: "var(--text)" },
              { label: "AIO Triggered", value: s.aioTriggered, color: "#C9A96E", sub: "Keywords with AI Overview on SERP" },
              { label: "You Appear In AIO", value: s.inAIO, color: "#2A6B5E", sub: "Your domain cited in AI Overview" },
              { label: "Missed Opportunities", value: s.opportunities, color: "#C0504A", sub: "Rank top 20 but not in AIO" },
            ].map((m, i) => (
              <div key={i} style={{ background: "var(--cream)", border: "1px solid var(--cream-border)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontFamily: "Playfair Display, serif", fontSize: 28, fontWeight: 500, color: m.color }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>{m.sub}</div>}
              </div>
            ))}
          </div>

          {/* AIO rate bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>AI Overview Inclusion Rate</span>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{s.aioRate}%</span>
            </div>
            <div style={{ height: 8, background: "var(--cream-dark)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.aioRate}%`, background: "#2A6B5E", borderRadius: 4, transition: "width 0.8s ease" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5 }}>
              Your domain appears in {s.inAIO} of {s.aioTriggered} AI Overviews triggered by your tracked keywords
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--cream-border)" }}>
            {(["summary","opportunities","keywords"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "7px 14px", border: "none", background: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif",
                color: tab === t ? "var(--text)" : "var(--text-muted)",
                borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent",
                textTransform: "capitalize",
              }}>
                {t === "summary" ? "Overview" : t === "opportunities" ? `Opportunities (${s.opportunities})` : "All Keywords"}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {tab === "summary" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#EDF7F3", border: "1px solid #C5E4D8", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#2A6B5E", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>✦ AIO Wins</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Your domain appears in <strong>{s.inAIO}</strong> AI Overviews out of <strong>{s.aioTriggered}</strong> triggered — a {s.aioRate}% inclusion rate. 
                  {s.aioRate >= 20 ? " Strong AI visibility for this client." : s.aioRate >= 10 ? " Moderate AI visibility with room to grow." : " Low AI visibility — prioritise AIO optimisation."}
                </div>
              </div>
              <div style={{ background: "#FDF0EF", border: "1px solid #F0C9C6", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#C0504A", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>▲ Priority Action</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  <strong>{s.opportunities}</strong> keywords rank in top 20 but are missing from the AI Overview. 
                  These are your easiest wins — pages already have authority, just need AIO optimisation.
                </div>
              </div>
            </div>
          )}

          {/* Opportunities tab */}
          {tab === "opportunities" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, padding: "10px 14px", background: "var(--cream)", borderRadius: 8, borderLeft: "3px solid var(--gold)" }}>
                These keywords rank in your top 20 organically but your page is <strong>not cited</strong> in the AI Overview. 
                Adding FAQ schema, improving E-E-A-T signals, and expanding content depth are the fastest paths to AIO inclusion.
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th style={{textAlign:"right"}}>Position</th>
                      <th style={{textAlign:"right"}}>Volume</th>
                      <th>Page</th>
                      <th style={{textAlign:"center"}}>AIO Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.opportunities || []).map((k: any, i: number) => (
                      <tr key={i}>
                        <td><span className="query-text">{k.keyword}</span></td>
                        <td style={{textAlign:"right"}}><span className={`pos-tag ${k.position <= 3 ? "pos-top" : k.position <= 10 ? "pos-mid" : "pos-low"}`}>#{k.position}</span></td>
                        <td style={{textAlign:"right", color:"var(--text-muted)"}}>{fNum(k.volume)}</td>
                        <td><span className="page-text" title={k.url}>{k.url?.replace(/^https?:\/\/[^/]+/, "") || "/"}</span></td>
                        <td style={{textAlign:"center"}}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#FDF0EF", color: "#C0504A" }}>NOT IN AIO</span>
                        </td>
                      </tr>
                    ))}
                    {(!data.opportunities || data.opportunities.length === 0) && (
                      <tr><td colSpan={5} className="empty-cell">No opportunities found — great AIO coverage!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All keywords tab */}
          {tab === "keywords" && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Keyword</th>
                    <th style={{textAlign:"right"}}>Pos</th>
                    <th style={{textAlign:"right"}}>Prev</th>
                    <th style={{textAlign:"right"}}>Volume</th>
                    <th style={{textAlign:"center"}}>AIO</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.keywordTable || []).map((k: any, i: number) => (
                    <tr key={i}>
                      <td><span className="query-text">{k.keyword}</span></td>
                      <td style={{textAlign:"right"}}><span className={`pos-tag ${k.position <= 3 ? "pos-top" : k.position <= 10 ? "pos-mid" : "pos-low"}`}>#{k.position}</span></td>
                      <td style={{textAlign:"right", color: k.position < k.previousPosition ? "#2A6B5E" : k.position > k.previousPosition ? "#C0504A" : "var(--text-muted)", fontSize: 12}}>
                        {k.previousPosition > 0 ? `#${k.previousPosition}` : "—"}
                      </td>
                      <td style={{textAlign:"right", color:"var(--text-muted)"}}>{fNum(k.volume)}</td>
                      <td style={{textAlign:"center"}}>
                        {k.inAIO
                          ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#EDF7F3", color: "#2A6B5E" }}>✓ IN AIO</span>
                          : k.aioExists
                          ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#FDF0EF", color: "#C0504A" }}>MISSING</span>
                          : <span style={{ fontSize: 10, color: "var(--text-dim)" }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

            <AIOverview siteUrl={activeUrl} />

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
