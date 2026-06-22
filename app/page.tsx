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

      {loading && (
        <div className="ai-loading">
          <div className="ai-spinner" />
          Running 2-pass Claude SEO analysis...
        </div>
      )}
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>⚠ {error}</div>}

      {insights && !loading && (
        <>
          {insights.headline && <div className="insight-headline">{insights.headline}</div>}
          {insights.focusStatement && (
            <div style={{ background: "#1C1C1C", color: "#C9A96E", padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              🎯 {insights.focusStatement}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--cream-border)", paddingBottom: 0 }}>
            {(["insights","opportunities","actions"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "8px 14px", border: "none", background: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif",
                color: tab === t ? "var(--text)" : "var(--text-muted)",
                borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent",
                textTransform: "capitalize", letterSpacing: "0.02em",
              }}>{t === "insights" ? "Brightspots & Issues" : t === "opportunities" ? "Quick Wins" : "Action Plan"}</button>
            ))}
          </div>

          {/* Insights Tab */}
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

          {/* Quick Wins Tab */}
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
                        <span style={{ background: "var(--text)", color: "var(--cream)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap", marginTop: 1 }}>{g.type?.toUpperCase()}</span>
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

          {/* Action Plan Tab */}
          {tab === "actions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {insights.competitorEdge && (
                <div style={{ padding: "14px 16px", background: "var(--cream)", borderRadius: 8, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, borderLeft: "3px solid var(--gold)" }}>
                  <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>What Competitors Are Doing Better</div>
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
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: a.impact === "high" ? "#E8F5F0" : a.impact === "medium" ? "#FEF3E2" : "#F5F5F5", color: a.impact === "high" ? "var(--teal)" : a.impact === "medium" ? "#B07C20" : "var(--text-muted)" }}>
                        {a.impact?.toUpperCase()} IMPACT
                      </span>
                      <span style={{