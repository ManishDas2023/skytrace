import { useState, useEffect, useCallback } from "react";

const OPENSKY_URL =
  "https://opensky-network.org/api/states/all?lamin=6&lomin=68&lamax=37&lomax=97";

function parseState(s) {
  const vel = s[9] ? Math.round(s[9] * 3.6) : null;
  const alt = s[7] ? Math.round(s[7]) : null;
  const callsign = (s[1] || "").trim();
  return {
    icao24: s[0],
    callsign: callsign || "UNKNOWN",
    country: s[2],
    lon: s[5],
    lat: s[6],
    altitude: alt ? `${(alt * 3.281).toLocaleString()} ft` : "—",
    altMetres: alt,
    speed: vel ? `${vel} km/h` : "—",
    heading: s[10] ? Math.round(s[10]) : null,
    onGround: s[8],
  };
}

function guessAirline(callsign) {
  const map = {
    AI: "Air India 🔴", "6E": "IndiGo 🔵", SG: "SpiceJet 🟠",
    UK: "Vistara 🟣", QP: "Akasa Air 🟡", IX: "Air India Express 🔴",
    G8: "GoFirst ⚪", EK: "Emirates 🔷", QR: "Qatar Airways 🟤",
    SQ: "Singapore Air 🔶", BA: "British Airways 🇬🇧", LH: "Lufthansa 🔵",
  };
  const prefix = callsign.slice(0, 2);
  return map[prefix] || callsign.slice(0, 2) + " Airlines";
}

// LocalStorage-based DB (works in real browsers, unlike artifacts)
const DB = {
  getSaved: () => {
    try { return JSON.parse(localStorage.getItem("skytrace-saved") || "[]"); } catch { return []; }
  },
  setSaved: (ids) => {
    try { localStorage.setItem("skytrace-saved", JSON.stringify(ids)); } catch {}
  },
  getHistory: () => {
    try { return JSON.parse(localStorage.getItem("skytrace-history") || "[]"); } catch { return []; }
  },
  addHistory: (flight) => {
    try {
      const h = DB.getHistory();
      const entry = { id: flight.icao24, callsign: flight.callsign, country: flight.country, altitude: flight.altitude, speed: flight.speed, viewedAt: new Date().toISOString() };
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
  .search-input{background:transparent;border:none;outline:none;color:var(--white);font-family:'Space Grotesk',sans-serif;font-size:15px;width:100%;text-transform:uppercase;letter-spacing:1px;}
  .search-input::placeholder{text-transform:none;letter-spacing:0;color:var(--muted);}
  .stats-row{display:flex;gap:10px;padding:0 20px 14px;}
  .stat-card{flex:1;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 14px;text-align:center;}
  .stat-value{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:600;color:var(--white);}
  .stat-label{font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;}
  .sec-label{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:0 20px 10px;}
  .flight-card{margin:0 20px 10px;background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px 16px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden;}
  .flight-card:hover{border-color:rgba(59,130,246,0.4);transform:translateY(-1px);}
  .flight-card.is-saved{border-color:rgba(251,191,36,0.35);}
  .fc-accent{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px;}
  .fc-row1{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
  .fc-callsign{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;color:var(--white);}
  .fc-airline{font-size:12px;color:var(--muted);margin-top:2px;}
  .fc-right{display:flex;align-items:center;gap:8px;}
  .ground-badge{font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(251,191,36,0.12);color:var(--amber);border:1px solid rgba(251,191,36,0.25);}
  .air-badge{font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(34,211,238,0.12);color:var(--cyan);border:1px solid rgba(34,211,238,0.25);}
  .save-btn{background:none;border:none;cursor:pointer;font-size:18px;padding:2px;}
  .fc-row2{display:flex;gap:20px;}
  .fc-stat-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;}
  .fc-stat-val{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:var(--white);}
  .fc-country{margin-left:auto;font-size:11px;color:var(--muted);align-self:flex-end;}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:40;backdrop-filter:blur(3px);}
  .detail-panel{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:#0f1e30;border-top:1px solid var(--border);border-radius:24px 24px 0 0;padding:20px 20px 36px;z-index:50;animation:slideUp .3s ease;}
  @keyframes slideUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}
  .detail-handle{width:36px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 20px;}
  .dp-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;}
  .dp-callsign{font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:700;color:var(--white);}
  .dp-airline{font-size:13px;color:var(--muted);margin-top:3px;}
  .close-btn{background:var(--card);border:1px solid var(--border);border-radius:10px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);font-size:16px;}
  .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
  .detail-item{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;}
  .di-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
  .di-val{font-size:14px;font-weight:600;color:var(--white);font-family:'JetBrains Mono',monospace;}
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

export default function App() {
  const [flights, setFlights]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [countdown, setCountdown] = useState(30);
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
      const res = await fetch(OPENSKY_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const parsed = (data.states || []).map(parseState).filter(f => f.callsign !== "UNKNOWN" && f.lat && f.lon);
      setFlights(parsed);
      setLastFetch(new Date());
      setCountdown(30);
    } catch (err) {
      setApiError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlights(); }, []);
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { fetchFlights(); return 30; } return c - 1; }), 1000);
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

  const filtered = flights.filter(f => !query || f.callsign.includes(query.toUpperCase()) || (f.country || "").toUpperCase().includes(query.toUpperCase()));
  const saved    = flights.filter(f => savedIds.includes(f.icao24));
  const inAir    = flights.filter(f => !f.onGround).length;
  const onGround = flights.filter(f => f.onGround).length;

  const FlightCard = ({ f }) => {
    const isSaved = savedIds.includes(f.icao24);
    return (
      <div className={`flight-card ${isSaved ? "is-saved" : ""}`} onClick={() => openDetail(f)}>
        <div className="fc-accent" style={{ background: f.onGround ? "var(--amber)" : "var(--cyan)" }} />
        <div className="fc-row1">
          <div>
            <div className="fc-callsign">{f.callsign}</div>
            <div className="fc-airline">{guessAirline(f.callsign)}</div>
          </div>
          <div className="fc-right">
            <span className={f.onGround ? "ground-badge" : "air-badge"}>{f.onGround ? "ON GROUND" : "IN AIR"}</span>
            <button className="save-btn" onClick={e => toggleSave(e, f)}>{isSaved ? "⭐" : "☆"}</button>
          </div>
        </div>
        <div className="fc-row2">
          <div><div className="fc-stat-label">Altitude</div><div className="fc-stat-val">{f.altitude}</div></div>
          <div><div className="fc-stat-label">Speed</div><div className="fc-stat-val">{f.speed}</div></div>
          {f.heading !== null && <div><div className="fc-stat-label">Heading</div><div className="fc-stat-val"><span style={{display:"inline-block",transform:`rotate(${f.heading}deg)`}}>↑</span> {f.heading}°</div></div>}
          <div className="fc-country">{f.country}</div>
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
            {apiError ? `Error: ${apiError}` : lastFetch ? `OpenSky API · ${flights.length} aircraft over India` : "Connecting…"}
          </div>
          {!loading && <span style={{ fontSize: 10, color: "var(--muted)" }}>Refresh in {countdown}s</span>}
        </div>

        <div className="search-wrap">
          <div className="search-box">
            <span style={{ fontSize: 16, color: "var(--muted)" }}>🔍</span>
            <input className="search-input" placeholder="Search callsign or country" value={query} onChange={e => setQuery(e.target.value)} />
            {query && <button style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }} onClick={() => setQuery("")}>✕</button>}
          </div>
        </div>

        {activeTab === "track" && (
          <>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--cyan)" }}>{inAir}</div><div className="stat-label">In Air</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--amber)" }}>{onGround}</div><div className="stat-label">On Ground</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--green)" }}>{flights.length}</div><div className="stat-label">Total</div></div>
            </div>
            <div className="sec-label">{loading && !flights.length ? "Fetching live data…" : `${filtered.length} aircraft · tap ☆ to track`}</div>
            {apiError && <div className="err-card">⚠️ {apiError} — <span style={{ color: "var(--cyan)", cursor: "pointer" }} onClick={fetchFlights}>Retry</span></div>}
            {loading && !flights.length ? <div className="empty-state"><div className="empty-icon">🛰️</div>Connecting to OpenSky…</div> : filtered.map(f => <FlightCard key={f.icao24} f={f} />)}
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
                  <div><div className="hi-call">{h.callsign}</div><div className="hi-meta">{h.country} · {h.altitude}</div></div>
                  <div className="hi-right"><div>{h.speed}</div><div style={{ marginTop: 4 }}>{new Date(h.viewedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div></div>
                </div>
              ))}
          </>
        )}

        <div style={{ height: 20 }} />

        <div className="bottom-nav">
          {[{ id: "track", ico: "✈️", txt: "Live" }, { id: "saved", ico: "⭐", txt: "Saved", badge: savedIds.length || null }, { id: "history", ico: "🕐", txt: "History" }].map(n => (
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
                <div><div className="dp-callsign">{selected.callsign}</div><div className="dp-airline">{guessAirline(selected.callsign)} · {selected.country}</div></div>
                <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="detail-grid">
                <div className="detail-item"><div className="di-label">Status</div><div className="di-val" style={{ color: selected.onGround ? "var(--amber)" : "var(--cyan)" }}>{selected.onGround ? "On Ground" : "In Air"}</div></div>
                <div className="detail-item"><div className="di-label">Altitude</div><div className="di-val">{selected.altitude}</div></div>
                <div className="detail-item"><div className="di-label">Speed</div><div className="di-val">{selected.speed}</div></div>
                <div className="detail-item"><div className="di-label">Heading</div><div className="di-val">{selected.heading !== null ? `${selected.heading}°` : "—"}</div></div>
                <div className="detail-item"><div className="di-label">Latitude</div><div className="di-val">{selected.lat?.toFixed(3)}</div></div>
                <div className="detail-item"><div className="di-label">Longitude</div><div className="di-val">{selected.lon?.toFixed(3)}</div></div>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14, textAlign: "center" }}>ICAO24: <span style={{ color: "var(--cyan)", fontFamily: "monospace" }}>{selected.icao24}</span></div>
              <div className="detail-btns">
                <button className="track-btn" onClick={e => { toggleSave(e, selected); setSelected(null); }}>{savedIds.includes(selected.icao24) ? "✓ Tracking" : "⭐ Track This Flight"}</button>
                {savedIds.includes(selected.icao24) && <button className="unsave-btn" onClick={e => { toggleSave(e, selected); setSelected(null); }}>Remove</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
