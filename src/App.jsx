import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = "https://skytrace-proxy.manishdas317.workers.dev/";

// ── Airport coordinates lookup ────────────────────────────────
const AIRPORTS = {
  // India
  BLR:{lat:13.1986,lon:77.7066,city:"Bengaluru"},DEL:{lat:28.5562,lon:77.1000,city:"Delhi"},
  BOM:{lat:19.0896,lon:72.8656,city:"Mumbai"},MAA:{lat:12.9941,lon:80.1709,city:"Chennai"},
  HYD:{lat:17.2403,lon:78.4294,city:"Hyderabad"},CCU:{lat:22.6520,lon:88.4463,city:"Kolkata"},
  COK:{lat:10.1520,lon:76.4019,city:"Kochi"},GOI:{lat:15.3808,lon:73.8314,city:"Goa"},
  AMD:{lat:23.0772,lon:72.6347,city:"Ahmedabad"},PNQ:{lat:18.5822,lon:73.9197,city:"Pune"},
  JAI:{lat:26.8242,lon:75.8122,city:"Jaipur"},LKO:{lat:26.7606,lon:80.8893,city:"Lucknow"},
  ATQ:{lat:31.7096,lon:74.7973,city:"Amritsar"},IXC:{lat:30.6735,lon:76.7885,city:"Chandigarh"},
  BBI:{lat:20.2444,lon:85.8178,city:"Bhubaneswar"},GAU:{lat:26.1061,lon:91.5859,city:"Guwahati"},
  IXB:{lat:26.6812,lon:88.3286,city:"Bagdogra"},PAT:{lat:25.5913,lon:85.0880,city:"Patna"},
  SXR:{lat:33.9871,lon:74.7742,city:"Srinagar"},VNS:{lat:25.4524,lon:82.8593,city:"Varanasi"},
  // International
  DXB:{lat:25.2532,lon:55.3657,city:"Dubai"},LHR:{lat:51.4700,lon:-0.4543,city:"London"},
  JFK:{lat:40.6413,lon:-73.7781,city:"New York"},SIN:{lat:1.3644,lon:103.9915,city:"Singapore"},
  BKK:{lat:13.6811,lon:100.7472,city:"Bangkok"},KUL:{lat:2.7456,lon:101.7099,city:"Kuala Lumpur"},
  HKG:{lat:22.3080,lon:113.9185,city:"Hong Kong"},NRT:{lat:35.7720,lon:140.3929,city:"Tokyo"},
  SYD:{lat:-33.9461,lon:151.1772,city:"Sydney"},CDG:{lat:49.0097,lon:2.5479,city:"Paris"},
  FRA:{lat:50.0379,lon:8.5622,city:"Frankfurt"},AMS:{lat:52.3086,lon:4.7639,city:"Amsterdam"},
  DOH:{lat:25.2731,lon:51.6080,city:"Doha"},AUH:{lat:24.4330,lon:54.6511,city:"Abu Dhabi"},
  CMB:{lat:7.1808,lon:79.8841,city:"Colombo"},DAC:{lat:23.8433,lon:90.3978,city:"Dhaka"},
  KTM:{lat:27.6966,lon:85.3591,city:"Kathmandu"},MLE:{lat:4.1918,lon:73.5290,city:"Maldives"},
  LAX:{lat:33.9425,lon:-118.4081,city:"Los Angeles"},ORD:{lat:41.9742,lon:-87.9073,city:"Chicago"},
  TSV:{lat:-19.2525,lon:146.7650,city:"Townsville"},BNE:{lat:-27.3842,lon:153.1175,city:"Brisbane"},
  AKL:{lat:-37.0082,lon:174.7850,city:"Auckland"},MEL:{lat:-37.6690,lon:144.8410,city:"Melbourne"},
  PER:{lat:-31.9403,lon:115.9670,city:"Perth"},ICN:{lat:37.4602,lon:126.4407,city:"Seoul"},
  PVG:{lat:31.1443,lon:121.8083,city:"Shanghai"},PEK:{lat:40.0799,lon:116.6031,city:"Beijing"},
  IST:{lat:41.2608,lon:28.7418,city:"Istanbul"},CAI:{lat:30.1219,lon:31.4056,city:"Cairo"},
  JNB:{lat:-26.1392,lon:28.2460,city:"Johannesburg"},NBO:{lat:-1.3192,lon:36.9275,city:"Nairobi"},
  GRU:{lat:-23.4356,lon:-46.4731,city:"São Paulo"},YYZ:{lat:43.6772,lon:-79.6306,city:"Toronto"},
  SFO:{lat:37.6213,lon:-122.3790,city:"San Francisco"},
};

function getCoords(iata) {
  return AIRPORTS[iata] || null;
}

// Great circle interpolation
function interpolate(lat1, lon1, lat2, lon2, t) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2-φ1)/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin((λ2-λ1)/2)**2));
  if (d === 0) return { lat: lat1, lon: lon1 };
  const A = Math.sin((1-t)*d)/Math.sin(d);
  const B = Math.sin(t*d)/Math.sin(d);
  const x = A*Math.cos(φ1)*Math.cos(λ1) + B*Math.cos(φ2)*Math.cos(λ2);
  const y = A*Math.cos(φ1)*Math.sin(λ1) + B*Math.cos(φ2)*Math.sin(λ2);
  const z = A*Math.sin(φ1) + B*Math.sin(φ2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x*x+y*y))), lon: toDeg(Math.atan2(y,x)) };
}

// Estimate flight progress 0-1
function getProgress(depTime, arrTime) {
  if (!depTime || !arrTime) return 0.5;
  const now = Date.now();
  const dep = new Date(depTime).getTime();
  const arr = new Date(arrTime).getTime();
  if (now <= dep) return 0;
  if (now >= arr) return 1;
  return (now - dep) / (arr - dep);
}

// Generate arc points
function arcPoints(lat1, lon1, lat2, lon2, n = 50) {
  return Array.from({ length: n + 1 }, (_, i) => interpolate(lat1, lon1, lat2, lon2, i / n));
}

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
  };
}

const STATUS_COLOR = {
  scheduled: "var(--cyan)", active: "var(--green)", landed: "var(--blue)",
  cancelled: "var(--red)", incident: "var(--red)", diverted: "var(--amber)",
};
const STATUS_LABEL = {
  scheduled: "Scheduled", active: "In Air ✈", landed: "Landed",
  cancelled: "Cancelled", incident: "Incident", diverted: "Diverted", unknown: "Unknown",
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

// ── LIVE MAP COMPONENT ────────────────────────────────────────
function LiveMap({ flights, onSelect, focusFlight }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const layersRef = useRef({});
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      if (!mapRef.current || leafletMap.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, { center: [20, 78], zoom: 4, zoomControl: true, attributionControl: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
      leafletMap.current = map;
      setMapReady(true);
    };
    document.head.appendChild(script);
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, []);

  // Draw all flight routes
  useEffect(() => {
    const L = window.L;
    if (!mapReady || !L || !leafletMap.current) return;
    const map = leafletMap.current;

    // Clear old layers
    Object.values(layersRef.current).forEach(l => { try { map.removeLayer(l); } catch {} });
    layersRef.current = {};

    const mappable = flights.filter(f => {
      const dep = getCoords(f.fromCode);
      const arr = getCoords(f.toCode);
      return dep && arr;
    });

    mappable.forEach(f => {
      const dep = getCoords(f.fromCode);
      const arr = getCoords(f.toCode);
      if (!dep || !arr) return;

      const progress = getProgress(f.depActual || f.depTime, f.arrActual || f.arrTime);
      const arc = arcPoints(dep.lat, dep.lon, arr.lat, arr.lon);
      const pos = interpolate(dep.lat, dep.lon, arr.lat, arr.lon, Math.min(progress, 0.98));

      // Route line
      const line = L.polyline(arc.map(p => [p.lat, p.lon]), {
        color: f.status === "active" ? "#22D3EE" : "rgba(255,255,255,0.15)",
        weight: f.status === "active" ? 1.5 : 1,
        dashArray: f.status === "active" ? null : "4 6",
      }).addTo(map);

      // Departure marker
      const depIcon = L.divIcon({
        html: `<div style="width:8px;height:8px;border-radius:50%;background:#4ADE80;border:2px solid #0D1B2A;box-shadow:0 0 6px #4ADE80"></div>`,
        className: "", iconSize: [8, 8], iconAnchor: [4, 4],
      });
      const depMarker = L.marker([dep.lat, dep.lon], { icon: depIcon })
        .addTo(map)
        .bindTooltip(`🛫 ${f.fromCode} — ${dep.city}`, { permanent: false, direction: "top" });

      // Arrival marker
      const arrIcon = L.divIcon({
        html: `<div style="width:8px;height:8px;border-radius:50%;background:#F87171;border:2px solid #0D1B2A;box-shadow:0 0 6px #F87171"></div>`,
        className: "", iconSize: [8, 8], iconAnchor: [4, 4],
      });
      const arrMarker = L.marker([arr.lat, arr.lon], { icon: arrIcon })
        .addTo(map)
        .bindTooltip(`🛬 ${f.toCode} — ${arr.city}`, { permanent: false, direction: "top" });

      // Plane marker (only for active/scheduled with progress)
      if (f.status === "active" || (f.status === "scheduled" && progress > 0)) {
        const planeIcon = L.divIcon({
          html: `<div style="font-size:18px;filter:drop-shadow(0 0 6px #22D3EE);cursor:pointer" title="${f.callsign}">✈</div>`,
          className: "", iconSize: [20, 20], iconAnchor: [10, 10],
        });
        const plane = L.marker([pos.lat, pos.lon], { icon: planeIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:monospace;font-size:13px;font-weight:700;color:#fff;margin-bottom:6px">${f.callsign}</div>
            <div style="font-size:11px;color:#888">${f.airline}</div>
            <div style="font-size:11px;color:#22D3EE;margin-top:4px">${f.fromCode} → ${f.toCode}</div>
            <div style="font-size:11px;color:#4ADE80;margin-top:2px">${STATUS_LABEL[f.status]}</div>
          `, { maxWidth: 180 })
          .on("click", () => onSelect(f));
        layersRef.current[`plane-${f.icao24}`] = plane;
      }

      layersRef.current[`line-${f.icao24}`] = line;
      layersRef.current[`dep-${f.icao24}`] = depMarker;
      layersRef.current[`arr-${f.icao24}`] = arrMarker;
    });
  }, [flights, mapReady]);

  // Focus on selected flight
  useEffect(() => {
    if (!focusFlight || !leafletMap.current || !mapReady) return;
    const dep = getCoords(focusFlight.fromCode);
    const arr = getCoords(focusFlight.toCode);
    if (dep && arr) {
      const L = window.L;
      const bounds = L.latLngBounds([[dep.lat, dep.lon], [arr.lat, arr.lon]]);
      leafletMap.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [focusFlight, mapReady]);

  const mappable = flights.filter(f => getCoords(f.fromCode) && getCoords(f.toCode));

  return (
    <div style={{ margin: "0 20px 16px", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div ref={mapRef} style={{ height: 340, width: "100%", background: "#0D1B2A" }} />
      <div style={{ background: "#162032", padding: "10px 14px", fontSize: 11, color: "#4B6070", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>✈ <span style={{ color: "#22D3EE", fontWeight: 600 }}>{mappable.length}</span> routes mapped · tap plane to view</span>
        <span style={{ display: "flex", gap: 10 }}>
          <span>🟢 Dep</span>
          <span>🔴 Arr</span>
          <span style={{ color: "#22D3EE" }}>✈ Active</span>
        </span>
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--sky:#0D1B2A;--panel:#111927;--card:#162032;--border:rgba(255,255,255,0.07);--blue:#3B82F6;--cyan:#22D3EE;--green:#4ADE80;--amber:#FBBF24;--red:#F87171;--muted:#4B6070;--text:#CBD5E1;--white:#F1F5F9;}
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
  .search-input{background:transparent;border:none;outline:none;color:var(--white);font-family:'Space Grotesk',sans-serif;font-size:15px;width:100%;}
  .search-input::placeholder{color:var(--muted);}
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
  .route-mid{flex:1;text-align:center;position:relative;}
  .route-line{height:1px;background:var(--border);position:relative;margin:4px 0;}
  .route-plane-icon{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:14px;}
  .fc-times{display:flex;justify-content:space-between;}
  .time-val{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:var(--white);}
  .time-label{font-size:10px;color:var(--muted);margin-top:1px;}
  .delay-badge{color:var(--amber);font-size:10px;margin-top:2px;}
  .map-btn{font-size:11px;color:var(--cyan);background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);border-radius:8px;padding:3px 8px;cursor:pointer;margin-top:6px;display:inline-block;}
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
  .map-detail-btn{padding:14px 16px;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.3);border-radius:14px;color:var(--cyan);font-family:'Space Grotesk',sans-serif;font-size:15px;cursor:pointer;}
  .unsave-btn{padding:14px 18px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:14px;color:var(--amber);font-family:'Space Grotesk',sans-serif;font-size:15px;cursor:pointer;}
  .bottom-nav{position:sticky;bottom:0;margin-top:auto;background:rgba(13,27,42,0.97);backdrop-filter:blur(20px);border-top:1px solid var(--border);padding:12px 0 28px;display:flex;justify-content:space-around;}
  .nav-btn{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:4px 14px;position:relative;}
  .nav-btn.active .nav-ico{color:var(--cyan);}
  .nav-btn.active .nav-txt{color:var(--cyan);}
  .nav-ico{font-size:20px;color:var(--muted);}
  .nav-txt{font-size:10px;color:var(--muted);font-weight:600;letter-spacing:.3px;}
  .nav-badge{position:absolute;top:0;right:6px;background:var(--amber);color:#000;font-size:9px;font-weight:700;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
  .empty-state{text-align:center;padding:50px 20px;color:var(--muted);font-size:13px;line-height:1.9;}
  .empty-icon{font-size:40px;margin-bottom:10px;}
  .history-item{margin:0 20px 8px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}
  .hi-call{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:600;color:var(--white);}
  .hi-meta{font-size:11px;color:var(--muted);margin-top:3px;}
  .hi-right{text-align:right;font-size:11px;color:var(--muted);}
  .err-card{margin:0 20px 16px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:16px;padding:14px 16px;font-size:12px;color:var(--red);line-height:1.7;}
  .toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:var(--green);color:#000;padding:10px 20px;border-radius:30px;font-size:13px;font-weight:700;pointer-events:none;z-index:200;white-space:nowrap;transition:all .3s;}
  .leaflet-popup-content-wrapper{background:#162032!important;border:1px solid rgba(255,255,255,0.07)!important;border-radius:14px!important;box-shadow:0 8px 32px rgba(0,0,0,0.4)!important;color:#F1F5F9!important;}
  .leaflet-popup-tip{background:#162032!important;}
  .leaflet-popup-content{margin:12px 16px!important;font-family:'Space Grotesk',sans-serif!important;}
`;

export default function App() {
  const [flights, setFlights]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [apiError, setApiError]     = useState(null);
  const [lastFetch, setLastFetch]   = useState(null);
  const [countdown, setCountdown]   = useState(60);
  const [query, setQuery]           = useState("");
  const [activeTab, setActiveTab]   = useState("track");
  const [selected, setSelected]     = useState(null);
  const [focusFlight, setFocusFlight] = useState(null);
  const [savedIds, setSavedIds]     = useState(() => DB.getSaved());
  const [history, setHistory]       = useState(() => DB.getHistory());
  const [toast, setToast]           = useState("");

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

  const showOnMap = (e, f) => {
    e?.stopPropagation();
    setSelected(null);
    setFocusFlight(f);
    setActiveTab("map");
  };

  const filtered = flights.filter(f =>
    !query ||
    f.callsign.toLowerCase().includes(query.toLowerCase()) ||
    f.airline.toLowerCase().includes(query.toLowerCase()) ||
    f.fromCode.toLowerCase().includes(query.toLowerCase()) ||
    f.toCode.toLowerCase().includes(query.toLowerCase())
  );

  const saved     = flights.filter(f => savedIds.includes(f.icao24));
  const inAir     = flights.filter(f => f.status === "active").length;
  const landed    = flights.filter(f => f.status === "landed").length;
  const scheduled = flights.filter(f => f.status === "scheduled").length;

  const FlightCard = ({ f }) => {
    const isSaved = savedIds.includes(f.icao24);
    const statusColor = STATUS_COLOR[f.status] || "var(--muted)";
    const hasCords = getCoords(f.fromCode) && getCoords(f.toCode);
    return (
      <div className={`flight-card ${isSaved ? "is-saved" : ""}`} onClick={() => openDetail(f)}>
        <div className="fc-accent" style={{ background: statusColor }} />
        <div className="fc-row1">
          <div>
            <div className="fc-callsign">{f.callsign}</div>
            <div className="fc-airline">{f.airline}</div>
          </div>
          <div className="fc-right">
            <div className="status-badge" style={{ color: statusColor, borderColor: statusColor, background: `${statusColor}18` }}>
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
            {hasCords && <button className="map-btn" onClick={e => showOnMap(e, f)}>🗺️ View on Map</button>}
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

        {/* TRACK TAB */}
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

        {/* MAP TAB */}
        {activeTab === "map" && (
          <>
            <div className="sec-label" style={{ paddingTop: 8 }}>
              Live Route Map {focusFlight ? `· ${focusFlight.callsign}` : "· All Flights"}
              {focusFlight && <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 8, cursor: "pointer" }} onClick={() => setFocusFlight(null)}>✕ Clear</span>}
            </div>
            {flights.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🗺️</div>Loading map…<br /><span style={{ color: "var(--cyan)", cursor: "pointer", fontSize: 12 }} onClick={fetchFlights}>Tap to retry</span></div>
            ) : (
              <LiveMap flights={flights} onSelect={openDetail} focusFlight={focusFlight} />
            )}
            <div className="sec-label">Active Flights ({inAir})</div>
            {flights.filter(f => f.status === "active").slice(0, 5).map(f => <FlightCard key={f.icao24} f={f} />)}
          </>
        )}

        {/* SAVED TAB */}
        {activeTab === "saved" && (
          <>
            <div className="sec-label" style={{ paddingTop: 8 }}>Tracked ({saved.length})</div>
            {saved.length === 0 ? <div className="empty-state"><div className="empty-icon">⭐</div>No flights tracked.<br />Tap ☆ on any flight.</div> : saved.map(f => <FlightCard key={f.icao24} f={f} />)}
          </>
        )}

        {/* HISTORY TAB */}
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
            { id: "track",   ico: "✈️", txt: "Live" },
            { id: "map",     ico: "🗺️", txt: "Map" },
            { id: "saved",   ico: "⭐", txt: "Saved", badge: savedIds.length || null },
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
                <div className="dp-mid"><div style={{ fontSize: 24 }}>✈️</div></div>
                <div className="dp-airport" style={{ textAlign: "right" }}>
                  <div className="dp-code">{selected.toCode}</div>
                  <div className="dp-city">{selected.to}</div>
                  <div className="dp-time">{formatTime(selected.arrActual || selected.arrTime)}</div>
                </div>
              </div>
              <div className="detail-grid">
                <div className="detail-item"><div className="di-label">Status</div><div className="di-val" style={{ color: STATUS_COLOR[selected.status] }}>{STATUS_LABEL[selected.status]}</div></div>
                <div className="detail-item"><div className="di-label">Delay</div><div className="di-val" style={{ color: selected.delay > 0 ? "var(--amber)" : "var(--green)" }}>{selected.delay > 0 ? `+${selected.delay} min` : "On Time"}</div></div>
                <div className="detail-item"><div className="di-label">Gate</div><div className="di-val">{selected.gate}</div></div>
                <div className="detail-item"><div className="di-label">Terminal</div><div className="di-val">{selected.terminal}</div></div>
              </div>
              <div className="detail-btns">
                <button className="track-btn" onClick={e => { toggleSave(e, selected); setSelected(null); }}>
                  {savedIds.includes(selected.icao24) ? "✓ Tracking" : "⭐ Track"}
                </button>
                {getCoords(selected.fromCode) && getCoords(selected.toCode) && (
                  <button className="map-detail-btn" onClick={e => showOnMap(e, selected)}>🗺️ Map</button>
                )}
                {savedIds.includes(selected.icao24) && (
                  <button className="unsave-btn" onClick={e => { toggleSave(e, selected); setSelected(null); }}>Remove</button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
