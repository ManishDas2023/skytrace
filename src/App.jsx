import { useState, useEffect, useCallback, useRef } from "react";

// ── AviationStack via Cloudflare Worker ──────────────────────
const API_URL = "https://skytrace-proxy.manishdas317.workers.dev/";

function parseAviationStack(flight) {
  return {
    icao24: flight.flight?.icao || flight.flight?.iata || Math.random().toString(36).slice(2),
    callsign: flight.flight?.iata || flight.flight?.icao || "UNKNOWN",
    airline: flight.airline?.name || "Unknown Airline",
    from: flight.departure?.airport || "—",
    fromCode: flight.departure?.iata || "—",
    to: flight.arrival?.airport || "—",
    toCode: flight.arrival?.iata || "—",
    status: flight.flight_status || "unknown",
    depTime: flight.departure?.scheduled || null,
    arrTime: flight.arrival?.scheduled || null,
    depActual: flight.departure?.actual || null,
    arrActual: flight.arrival?.actual || null,
    gate: flight.departure?.gate || "—",
    terminal: flight.departure?.terminal || "—",
    delay: flight.departure?.delay || 0,
    lat: null,
    lon: null,
    onGround: false,
  };
}

const STATUS_COLOR = {
  scheduled: "var(--cyan)",
  active: "var(--green)",
  landed: "var(--blue)",
  cancelled: "var(--red)",
  incident: "var(--red)",
  diverted: "var(--amber)",
};

const STATUS_LABEL = {
  scheduled: "Scheduled",
  active: "In Air ✈",
  landed: "Landed",
  cancelled: "Cancelled",
  incident: "Incident",
  diverted: "Diverted",
  unknown: "Unknown",
};

const DB = {
  getSaved: () => { try { return JSON.parse(localStorage.getItem("skytrace-saved") || "[]"); } catch { return []; } },
  setSaved: (ids) => { try { localStorage.setItem("skytrace-saved", JSON.stringify(ids)); } catch {} },
  getHistory: () => { try { return JSON.parse(localStorage.getItem("skytrace-history") || "[]"); } catch { return []; } },
  addHistory: (flight) => {
    try {
      const h = DB.getHistory();
      const entry = { id: flight.icao24, callsign: flight.callsign, airline: flight.airline, from: flight.fromCode, to: flight.toCode, status: flight.status, viewedAt: new Date().toISOString() };
      const updated = [entry, ...h.filter(x => x.id !== flight.icao24)].slice(0, 30);
      localStorage.setItem("skytrace-history", JSON.stringify(updated));
      return updated;
    } catch { return []; }
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --sky:#0D1B2A;--panel:#111927;--card:#162032;--border:rgba(255,255,255,0.07);
    --blue:#3B82F6;--cyan:#22D3EE;--green:#4ADE80;--amber:#FBBF24;--red:#F87171;
    --muted:#4B6070;--text:#CBD5E1;--white:#F1F5F9;
  }
  body{background:var(--sky);color:var(--text);font-family:'Space Grotesk',sans-serif;}
  .app{max-width:430px;margin:0 auto;min-height:100vh;background:var(--sky);display:flex;flex-direction:column;}
  .header{padding:52px 20px 16px;background:linear-gradient(180deg,#0a1520 0%,transparent 100%);display:flex;align-items:center;justify-content:space-between;}
  .brand{display:flex;align-items:center;gap:10px;}
  .brand-icon{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--blue),var(--cyan));display:flex;align-items:center;justify-content:center;font-size:18px;}
  .brand-name{font-size:20px;font-weight:700;color:var(--white);letter-spacing:-0.5px;}
  .brand-name span{color:var(--cyan);}
  .live-pill{display:flex;align-items:center;gap:6px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.25);border-radius:20px;padding:5px 10px;font-size:11px;font-weight:600;color:var(--green);letter-spacing:0.5px;cursor:pointer;}
  .live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.4s infinite;}
  .live-dot.loading{background:var(--amber);}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
  .api-badge{margin:0 20px 12px;background:rgba(34,211,238,0.07);border:1px solid rgba(34,211,238,0.18);border-radius:10px;padding:8px 14px;font-size:11px;color:var(--cyan);display:flex;align-items:center;justify-content:space-between;}
  .api-pulse{width:6px;height:6px;border-radius:50%;background:var(--cyan);animation:blink 2s infinite;flex-shrink:0;margin-right:8px;}
  .api-pulse.err{background:var(--red);animation:none;}
  .search-wrap{padding:4px 20px 14px;}
  .search-box{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:12px 16px;}
  .search-box:focus-within{border-color:var(--blue);}
  .search-input{background:transparent;border:none;outline:none;color:var(--white);font-family:'Space Grotesk',sans-serif;font-size:15px;width:100%;letter-spacing:1px;}
  .search-input::placeholder{letter-spacing:0;color:var(--muted);}
  .stats-row{display:flex;gap:10px;padding:0 20px 14px;}
  .stat-card{flex:1;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 14px;text-align:center;}
  .stat-value{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:600;color:var(--white);}
  .stat-label{font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;}
  .sec-label{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:0 20px 10px;}
  .flight-card{margin:0 20px 10px;background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px 16px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden;}
  .flight-card:hover{border-color:rgba(59,130,246,0.4);transform:translateY(-1px);}
  .flight-card.is-saved{border-color:rgba(251,191,36,0.35);}
  .fc-accent{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px;}
  .fc-row1{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
  .fc-callsign{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;color:var(--white);}
  .fc-airline{font-size:12px;color:var(--muted);margin-top:2px;}
  .fc-right{display:flex;align-items:center;gap:8px;}
  .status-badge{font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid;}
  .save-btn{background:none;border:none;cursor:pointer;font-size:18px;padding:2px;}
  .fc-route{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
  .route-code{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--white);}
  .route-city{font-size:10px;color:var(--muted);margin-top:2px;}
  .route-mid{flex:1;text-align:center;}
  .route-line{height:1px;background:var(--border);position:relative;margin:4px 0;}
  .route-plane-icon{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:14px;}
  .route-duration{font-size:10px;color:var(--muted);}
  .fc-times{display:flex;justify-content:space-between;}
  .time-val{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:var(--white);}
  .time-label{font-size:10px;color:var(--muted);margin-top:1px;}
  .delay-badge{color:var(--amber);font-size:10px;margin-top:2px;}

  .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:40;backdrop-filter:blur(3px);}
  .detail-panel{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:#0f1e30;border-top:1px solid var(--border);border-radius:24px 24px 0 0;padding:20px 20px 36px;z-index:50;animation:slideUp .3s ease;}
  @keyframes slideUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}
  .detail-handle{width:36px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 20px;}
  .dp-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;}
  .dp-callsign{font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:700;color:var(--white);}
  .dp-airline{font-size:13px;color:var(--muted);margin-top:3px;}
  .close-btn{background:var(--card);border:1px solid var(--border);border-radius:10px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);font-size:16px;}
  .dp-route{display:flex;align-items:center;gap:12px;margin-bottom:20px;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;}
  .dp-airport{flex:1;}
  .dp-code{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:var(--white);}
  .dp-city{font-size:11px;color:var(--muted);margin-top:2px;}
  .dp-time{font-family:'JetBrains Mono',monospace;font-size:15px;color:var(--cyan);margin-top:6px;}
  .dp-mid{text-align:center;flex:1;}
  .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
  .detail-item{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;}
  .di-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
  .di-val{font-size:14px;font-weight:600;color:var(--white);}
  .detail-btns{display:flex;gap:10px;}
  .track-btn{flex:1;padding:14px;background:linear-gradient(135deg,var(--blue),var(--cyan));border:none;border-radius:14px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;cursor:pointer;}
  .unsave-btn{padding:14px 18px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:14px;color:var(--amber);font-family:'Space Grotesk',sans-serif;font-size:15px;cursor:pointer;}
  .bottom-nav{position:sticky;bottom:0;margin-top:auto;background:rgba(13,27,42,0.97);backdrop-filter:blur(20px);border-top:1px solid var(--border);padding:12px 0 28px;display:flex;justify-content:space-around;}
  .nav-btn{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:4px 16px;position:relative;}
  .nav-btn.active .nav-ico{color:var(--cyan);}
  .nav-btn.active .nav-txt{color:var(--cyan);}
  .nav-ico{font-size:20px;color:var(--muted);}
  .nav-txt{font-size:10px;color:var(--muted);font-weight:600;letter-spacing:.3px;}
  .nav-badge{position:absolute;top:0;right:8px;background:var(--amber);color:#000;font-size:9px;font-weight:700;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
  .empty-state{text-align:center;padding:50px 20px;color:var(--muted);font-size:13px;line-height:1.9;}
  .empty-icon{font-size:40px;margin-bottom:10px;}
  .history-item{margin:0 20px 8px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}
  .hi-call{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:600;color:var(--white);}
  .hi-meta{font-size:11px;color:var(--muted);margin-top:3px;}
  .hi-right{text-align:right;font-size:11px;color:var(--muted);}
  .err-card{margin:0 20px 16px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:16px;padding:14px 16px;font-size:12px;color:var(--red);line-height:1.7;}
  .toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:var(--green);color:#000;padding:10px 20px;border-radius:30px;font-size:13px;font-weight:700;pointer-events:none;z-index:200;white-space:nowrap;transition:all .3s;}
`;

function formatTime(isoString) {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

export default function App() {
  const [flights, setFlights]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [countdown, setCountdown] = useState(60);
  const [query, setQuery]         = useState("");
  const [activeTab, setActiveTab] = useState("track");
  const [selected, setSelected]   = useState(null);
  const [savedIds, setSavedIds]   = useState(() => DB.getSaved());
  const [history, setHistory]     = useState(() => DB.getHistory());
  const [toast, setToast]         = useState("");

  const fetchFlights = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const parsed = (data.data || []).map(parseAviationStack).filter(f => f.callsign !== "UNKNOWN");
      setFlights(parsed);
      setLastFetch(new Date());
      setCountdown(60);
    } catch (err) {
      setApiError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlights(); }, []);
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { fetchFlights(); return 60; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [fetchFlights]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const toggleSave = (e, f) => {
    e?.stopPropagation();
    const already = savedIds.includes(f.icao24);
    const updated = already ? savedIds.filter(i => i !== f.icao24) : [...savedIds, f.icao24];
    setSavedIds(updated);
    DB.setSaved(updated);
    showToast(already ? `Removed ${f.callsign}` : `✓ Tracking ${f.callsign}`);
  };

  const openDetail = (f) => {
    setSelected(f);
    const hist = DB.addHistory(f);
    setHistory(hist);
  };

  const filtered = flights.filter(f =>
    !query ||
    f.callsign.toLowerCase().includes(query.toLowerCase()) ||
    f.airline.toLowerCase().includes(query.toLowerCase()) ||
    f.fromCode.toLowerCase().includes(query.toLowerCase()) ||
    f.toCode.toLowerCase().includes(query.toLowerCase())
  );

  const saved    = flights.filter(f => savedIds.includes(f.icao24));
  const inAir    = flights.filter(f => f.status === "active").length;
  const landed   = flights.filter(f => f.status === "landed").length;
  const scheduled = flights.filter(f => f.status === "scheduled").length;

  const FlightCard = ({ f }) => {
    const isSaved = savedIds.includes(f.icao24);
    const statusColor = STATUS_COLOR[f.status] || "var(--muted)";
    return (
      <div className={`flight-card ${isSaved ? "is-saved" : ""}`} onClick={() => openDetail(f)}>
        <div className="fc-accent" style={{ background: statusColor }} />
        <div className="fc-row1">
          <div>
            <div className="fc-callsign">{f.callsign}</div>
            <div className="fc-airline">{f.airline}</div>
          </div>
          <div className="fc-right">
            <div className="status-badge" style={{ color: statusColor, borderColor: statusColor, background: `${statusColor}15` }}>
              {STATUS_LABEL[f.status] || f.status}
            </div>
            <button className="save-btn" onClick={e => toggleSave(e, f)}>{isSaved ? "⭐" : "☆"}</button>
          </div>
        </div>
        <div className="fc-route">
          <div>
            <div className="route-code">{f.fromCode}</div>
            <div className="route-city">{f.from?.split(" ")[0] || "—"}</div>
          </div>
          <div className="route-mid">
            <div className="route-line"><span className="route-plane-icon">✈</span></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="route-code">{f.toCode}</div>
            <div className="route-city">{f.to?.split(" ")[0] || "—"}</div>
          </div>
        </div>
        <div className="fc-times">
          <div>
            <div className="time-val">{formatTime(f.depActual || f.depTime)}</div>
            <div className="time-label">Departure</div>
            {f.delay > 0 && <div className="delay-badge">+{f.delay} min delay</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="time-val">{formatTime(f.arrActual || f.arrTime)}</div>
            <div className="time-label">Arrival</div>
            {f.gate !== "—" && <div className="time-label" style={{ color: "var(--cyan)" }}>Gate {f.gate}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{css}</style>
      <div className="toast" style={{ opacity: toast ? 1 : 0, transform: `translateX(-50%) translateY(${toast ? "0" : "16px"})` }}>{toast}</div>
      <div className="app">
        <div className="header">
          <div className="brand">
            <div className="brand-icon">✈️</div>
            <div className="brand-name">Sky<span>Trace</span></div>
          </div>
          <div className="live-pill" onClick={fetchFlights}>
            <div className={`live-dot ${loading ? "loading" : ""}`} />
            {loading ? "UPDATING" : "LIVE"}
          </div>
        </div>

        <div className="api-badge">
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className={`api-pulse ${apiError ? "err" : ""}`} />
            {apiError ? `Error: ${apiError}` : lastFetch ? `AviationStack · ${flights.length} flights` : "Connecting…"}
          </div>
          {!loading && <span style={{ fontSize: 10, color: "var(--muted)" }}>Refresh in {countdown}s</span>}
        </div>

        <div className="search-wrap">
          <div className="search-box">
            <span style={{ fontSize: 16, color: "var(--muted)" }}>🔍</span>
            <input className="search-input" placeholder="Search flight, airline, airport..." value={query} onChange={e => setQuery(e.target.value)} />
            {query && <button style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }} onClick={() => setQuery("")}>✕</button>}
          </div>
        </div>

        {activeTab === "track" && (
          <>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--green)" }}>{inAir}</div><div className="stat-label">In Air</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--cyan)" }}>{scheduled}</div><div className="stat-label">Scheduled</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--blue)" }}>{landed}</div><div className="stat-label">Landed</div></div>
            </div>
            <div className="sec-label">{loading && !flights.length ? "Fetching flights…" : `${filtered.length} flights · tap ☆ to track`}</div>
            {apiError && <div className="err-card">⚠️ {apiError} — <span style={{ color: "var(--cyan)", cursor: "pointer" }} onClick={fetchFlights}>Retry</span></div>}
            {loading && !flights.length ? <div className="empty-state"><div className="empty-icon">🛰️</div>Loading flight data…</div> : filtered.map(f => <FlightCard key={f.icao24} f={f} />)}
          </>
        )}

        {activeTab === "saved" && (
          <>
            <div className="sec-label" style={{ paddingTop: 8 }}>Tracked ({saved.length})</div>
            {saved.length === 0 ? <div className="empty-state"><div className="empty-icon">⭐</div>No flights tracked.<br />Tap ☆ on any flight.</div> : saved.map(f => <FlightCard key={f.icao24} f={f} />)}
          </>
        )}

        {activeTab === "history" && (
          <>
            <div className="sec-label" style={{ paddingTop: 8 }}>Recently Viewed ({history.length})</div>
            {history.length === 0 ? <div className="empty-state"><div className="empty-icon">🕐</div>No history yet.</div> :
              history.map((h, i) => (
                <div key={i} className="history-item">
                  <div><div className="hi-call">{h.callsign}</div><div className="hi-meta">{h.airline} · {h.from} → {h.to}</div></div>
                  <div className="hi-right">
                    <div style={{ color: STATUS_COLOR[h.status] || "var(--muted)" }}>{STATUS_LABEL[h.status]}</div>
                    <div style={{ marginTop: 4 }}>{new Date(h.viewedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              ))}
          </>
        )}

        <div style={{ height: 20 }} />

        <div className="bottom-nav">
          {[
            { id: "track", ico: "✈️", txt: "Live" },
            { id: "saved", ico: "⭐", txt: "Saved", badge: savedIds.length || null },
            { id: "history", ico: "🕐", txt: "History" },
          ].map(n => (
            <div key={n.id} className={`nav-btn ${activeTab === n.id ? "active" : ""}`} onClick={() => setActiveTab(n.id)}>
              <div className="nav-ico">{n.ico}</div>
              <div className="nav-txt">{n.txt}</div>
              {n.badge ? <div className="nav-badge">{n.badge}</div> : null}
            </div>
          ))}
        </div>

        {selected && (
          <>
            <div className="overlay" onClick={() => setSelected(null)} />
            <div className="detail-panel">
              <div className="detail-handle" />
              <div className="dp-header">
                <div><div className="dp-callsign">{selected.callsign}</div><div className="dp-airline">{selected.airline}</div></div>
                <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="dp-route">
                <div className="dp-airport">
                  <div className="dp-code">{selected.fromCode}</div>
                  <div className="dp-city">{selected.from}</div>
                  <div className="dp-time">{formatTime(selected.depActual || selected.depTime)}</div>
                </div>
                <div className="dp-mid">
                  <div style={{ fontSize: 24 }}>✈️</div>
                </div>
                <div className="dp-airport" style={{ textAlign: "right" }}>
                  <div className="dp-code">{selected.toCode}</div>
                  <div className="dp-city">{selected.to}</div>
                  <div className="dp-time">{formatTime(selected.arrActual || selected.arrTime)}</div>
                </div>
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="di-label">Status</div>
                  <div className="di-val" style={{ color: STATUS_COLOR[selected.status] }}>{STATUS_LABEL[selected.status]}</div>
                </div>
                <div className="detail-item">
                  <div className="di-label">Delay</div>
                  <div className="di-val" style={{ color: selected.delay > 0 ? "var(--amber)" : "var(--green)" }}>
                    {selected.delay > 0 ? `+${selected.delay} min` : "On Time"}
                  </div>
                </div>
                <div className="detail-item"><div className="di-label">Gate</div><div className="di-val">{selected.gate}</div></div>
                <div className="detail-item"><div className="di-label">Terminal</div><div className="di-val">{selected.terminal}</div></div>
              </div>
              <div className="detail-btns">
                <button className="track-btn" onClick={e => { toggleSave(e, selected); setSelected(null); }}>
                  {savedIds.includes(selected.icao24) ? "✓ Tracking" : "⭐ Track This Flight"}
                </button>
                {savedIds.includes(selected.icao24) && <button className="unsave-btn" onClick={e => { toggleSave(e, selected); setSelected(null); }}>Remove</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
