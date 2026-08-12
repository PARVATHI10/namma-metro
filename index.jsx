import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";

import {
  Home, Map as MapIcon, CreditCard, Bell, MoreHorizontal, Moon, Sun, Globe,
  Wifi, WifiOff, QrCode, Train, AlertTriangle, CheckCircle2, ChevronRight,
  X, Users, MessageSquareWarning, ArrowRight, RefreshCw, Clock, MapPin,
  Plus, IndianRupee, ShieldAlert, ChevronLeft, Sparkles, TrendingUp
} from "lucide-react";

/* ----------------------------------------------------------------------
   NAMMA METRO — prototype companion app
   Purely front-end demo: balances, UPI top-ups, QR tickets, crowd data
   and delay alerts are all simulated locally. Nothing here talks to
   BMRCL systems or a real payments network.
------------------------------------------------------------------------*/

/* ---------------------------- Design tokens ---------------------------- */
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

/* ---------------------------- Station data ----------------------------- */
// Schematic (not geographic) placement, in a 400x420 viewBox.
const PURPLE = [
  { id: "kengeri", name: "Kengeri", x: 40, y: 232 },
  { id: "vijayanagar", name: "Vijayanagar", x: 108, y: 214 },
  { id: "majestic", name: "Majestic", x: 200, y: 200, interchange: true },
  { id: "mgroad", name: "MG Road", x: 262, y: 190 },
  { id: "indiranagar", name: "Indiranagar", x: 312, y: 182 },
  { id: "baiyappanahalli", name: "Baiyappanahalli", x: 348, y: 174 },
  { id: "whitefield", name: "Whitefield", x: 382, y: 160 },
];
const GREEN = [
  { id: "nagasandra", name: "Nagasandra", x: 197, y: 34 },
  { id: "yeshwanthpur", name: "Yeshwanthpur", x: 198, y: 92 },
  { id: "majestic", name: "Majestic", x: 200, y: 200, interchange: true },
  { id: "lalbagh", name: "Lalbagh", x: 203, y: 256 },
  { id: "jayanagar", name: "Jayanagar", x: 205, y: 300 },
  { id: "banashankari", name: "Banashankari", x: 207, y: 344 },
  { id: "silkinstitute", name: "Silk Institute", x: 209, y: 390 },
];
const LINES = { purple: PURPLE, green: GREEN };
const LINE_COLOR = { purple: "var(--purple)", green: "var(--green)" };

const STATION_OPTIONS = (() => {
  const seen = new Map();
  [...PURPLE.map(s => ({ ...s, line: "purple" })), ...GREEN.map(s => ({ ...s, line: "green" }))]
    .forEach(s => {
      if (!seen.has(s.id)) seen.set(s.id, { ...s, lines: [s.line] });
      else seen.get(s.id).lines.push(s.line);
    });
  return Array.from(seen.values());
})();

function findRoute(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return null;
  const onLine = (id, arr) => arr.findIndex(s => s.id === id);
  const pIdxFrom = onLine(fromId, PURPLE), pIdxTo = onLine(toId, PURPLE);
  const gIdxFrom = onLine(fromId, GREEN), gIdxTo = onLine(toId, GREEN);

  if (pIdxFrom !== -1 && pIdxTo !== -1) {
    const [a, b] = pIdxFrom < pIdxTo ? [pIdxFrom, pIdxTo] : [pIdxTo, pIdxFrom];
    const seg = PURPLE.slice(a, b + 1);
    return { interchange: false, line: "purple", stops: pIdxFrom < pIdxTo ? seg : [...seg].reverse() };
  }
  if (gIdxFrom !== -1 && gIdxTo !== -1) {
    const [a, b] = gIdxFrom < gIdxTo ? [gIdxFrom, gIdxTo] : [gIdxTo, gIdxFrom];
    const seg = GREEN.slice(a, b + 1);
    return { interchange: false, line: "green", stops: gIdxFrom < gIdxTo ? seg : [...seg].reverse() };
  }
  // cross-line via Majestic
  const fromLine = pIdxFrom !== -1 ? "purple" : "green";
  const toLine = pIdxTo !== -1 ? "purple" : gIdxTo !== -1 ? "green" : null;
  if (!toLine) return null;
  const fromArr = LINES[fromLine];
  const fIdx = fromArr.findIndex(s => s.id === fromId);
  const mIdxF = fromArr.findIndex(s => s.id === "majestic");
  const [a1, b1] = fIdx < mIdxF ? [fIdx, mIdxF] : [mIdxF, fIdx];
  let leg1 = fromArr.slice(a1, b1 + 1);
  if (fIdx > mIdxF) leg1 = [...leg1].reverse();

  const toArr = LINES[toLine];
  const tIdx = toArr.findIndex(s => s.id === toId);
  const mIdxT = toArr.findIndex(s => s.id === "majestic");
  const [a2, b2] = mIdxT < tIdx ? [mIdxT, tIdx] : [tIdx, mIdxT];
  let leg2 = toArr.slice(a2, b2 + 1);
  if (mIdxT > tIdx) leg2 = [...leg2].reverse();

  return {
    interchange: true,
    line: fromLine,
    line2: toLine,
    stops: [...leg1, ...leg2.slice(1)],
  };
}

function fareFor(route) {
  if (!route) return 0;
  const stops = route.stops.length - 1;
  let fare = 10 + stops * 7 + (route.interchange ? 5 : 0);
  return Math.min(fare, 60);
}
function timeFor(route) {
  if (!route) return 0;
  const stops = route.stops.length - 1;
  return 3 + stops * 3 + (route.interchange ? 4 : 0);
}

/* ------------------------------ i18n ------------------------------ */
const T = {
  brand: { en: "Namma Metro", kn: "ನಮ್ಮ ಮೆಟ್ರೋ", hi: "नम्मा मेट्रो" },
  tagline: { en: "Our metro, your commute", kn: "ನಮ್ಮ ಮೆಟ್ರೋ, ನಿಮ್ಮ ಪ್ರಯಾಣ", hi: "अपना मेट्रो, अपनी यात्रा" },
  home: { en: "Home", kn: "ಮನೆ", hi: "होम" },
  plan: { en: "Route", kn: "ಮಾರ್ಗ", hi: "मार्ग" },
  card: { en: "Card", kn: "ಕಾರ್ಡ್", hi: "कार्ड" },
  alerts: { en: "Alerts", kn: "ಎಚ್ಚರಿಕೆ", hi: "अलर्ट" },
  more: { en: "More", kn: "ಇನ್ನಷ್ಟು", hi: "अधिक" },
  balance: { en: "Balance", kn: "ಬ್ಯಾಲೆನ್ಸ್", hi: "बैलेंस" },
  topUp: { en: "Top up", kn: "ರೀಚಾರ್ಜ್", hi: "रिचार्ज" },
  from: { en: "From", kn: "ಇಂದ", hi: "से" },
  to: { en: "To", kn: "ಗೆ", hi: "तक" },
  bookTicket: { en: "Book & generate ticket", kn: "ಟಿಕೆಟ್ ಬುಕ್ ಮಾಡಿ", hi: "टिकट बुक करें" },
  myTicket: { en: "My ticket", kn: "ನನ್ನ ಟಿಕೆಟ್", hi: "मेरा टिकट" },
  monthlyPass: { en: "Monthly pass", kn: "ಮಾಸಿಕ ಪಾಸ್", hi: "मासिक पास" },
  crowd: { en: "Live crowd density", kn: "ಜನದಟ್ಟಣೆ", hi: "भीड़ की स्थिति" },
  feedback: { en: "Report an issue", kn: "ಸಮಸ್ಯೆ ವರದಿ", hi: "समस्या दर्ज करें" },
  insights: { en: "Your commute insights", kn: "ಪ್ರಯಾಣ ಒಳನೋಟ", hi: "यात्रा जानकारी" },
  offline: { en: "Offline map", kn: "ಆಫ್‌ಲೈನ್ ನಕ್ಷೆ", hi: "ऑफ़लाइन मानचित्र" },
};
function useT(lang) {
  return (key) => (T[key] ? (T[key][lang] || T[key].en) : key);
}

/* ------------------------------ Small helpers ------------------------------ */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h;
}
function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function fmtMoney(n) { return `₹${n.toFixed(2)}`; }

/* ------------------------------ QR mock ------------------------------ */
function FakeQR({ seed, size = 168 }) {
  const cells = 21;
  const rand = seededRand(hashStr(seed) || 1);
  const grid = useMemo(() => {
    const g = Array.from({ length: cells }, () => Array.from({ length: cells }, () => rand() > 0.55));
    // finder patterns
    const stamp = (ox, oy) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const border = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        g[oy + y][ox + x] = border || core;
      }
      for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
        if (y === -1 || y === 7 || x === -1 || x === 7) {
          if (oy + y >= 0 && oy + y < cells && ox + x >= 0 && ox + x < cells) g[oy + y][ox + x] = false;
        }
      }
    };
    stamp(0, 0); stamp(cells - 7, 0); stamp(0, cells - 7);
    return g;
  }, [seed]);
  const cell = size / cells;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <rect width={size} height={size} fill="#fff" />
      {grid.map((row, y) => row.map((on, x) => on ? (
        <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#12121a" />
      ) : null))}
    </svg>
  );
}

/* ------------------------------ Line Map (signature) ------------------------------ */
function LineMap({ dark, activeStopId, pulse }) {
  const pathFor = (arr) => arr.map((s, i) => `${i === 0 ? "M" : "L"} ${s.x} ${s.y}`).join(" ");
  return (
    <svg viewBox="0 0 400 420" width="100%" height="auto" role="img" aria-label="Namma Metro line map">
      <path d={pathFor(PURPLE)} fill="none" stroke="var(--purple)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" />
      <path d={pathFor(GREEN)} fill="none" stroke="var(--green)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" />
      {PURPLE.map(s => (
        <g key={"p-" + s.id}>
          <circle cx={s.x} cy={s.y} r={s.interchange ? 7 : 4.5} fill={dark ? "#14121a" : "#fff"} stroke="var(--purple)" strokeWidth="3" />
        </g>
      ))}
      {GREEN.filter(s => !s.interchange).map(s => (
        <circle key={"g-" + s.id} cx={s.x} cy={s.y} r="4.5" fill={dark ? "#14121a" : "#fff"} stroke="var(--green)" strokeWidth="3" />
      ))}
      {/* interchange ring pulse at Majestic */}
      <circle cx="200" cy="200" r="7" fill="none" stroke="var(--marigold)" strokeWidth="2">
        <animate attributeName="r" values="7;16;7" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0;0.9" dur="2.6s" repeatCount="indefinite" />
      </circle>
      {pulse && (
        <circle cx={pulse.x} cy={pulse.y} r="6" fill="var(--marigold)">
          <animate attributeName="opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}
      {activeStopId && [...PURPLE, ...GREEN].filter(s => s.id === activeStopId).map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r="9" fill="none" stroke="var(--marigold)" strokeWidth="2.5" />
      ))}
    </svg>
  );
}

/* ------------------------------ App ------------------------------ */
export default function NammaMetroApp() {
  const [dark, setDark] = useState(true);
  const [lang, setLang] = useState("en");
  const [langOpen, setLangOpen] = useState(false);
  const [tab, setTab] = useState("home");
  const [offline, setOffline] = useState(false);

  const [balance, setBalance] = useState(342.5);
  const [pass, setPass] = useState({ active: true, line: "Purple Line", expiry: "31 Aug 2026" });

  const [topUp, setTopUp] = useState({ open: false, amount: 200, step: "amount", method: null });

  const [fromId, setFromId] = useState("whitefield");
  const [toId, setToId] = useState("banashankari");
  const route = useMemo(() => findRoute(fromId, toId), [fromId, toId]);
  const fare = fareFor(route);
  const eta = timeFor(route);

  const [ticket, setTicket] = useState(null); // {id, from, to, fare, ts, expiresAt}
  const [ticketError, setTicketError] = useState("");

  const [notifications, setNotifications] = useState([
    { id: 1, type: "delay", text: "Purple Line: ~5 min delay near Vijayanagar due to a signal check.", ts: "08:12", read: false },
    { id: 2, type: "info", text: "Green Line trains are running on schedule.", ts: "07:50", read: true },
    { id: 3, type: "station", text: "Heads up — Indiranagar is 2 stops away.", ts: "07:41", read: true },
  ]);
  const unread = notifications.filter(n => !n.read).length;

  const [crowdTrainId, setCrowdTrainId] = useState("PL-2201 · Purple Line");
  const [crowdSeed, setCrowdSeed] = useState(1);
  const coaches = useMemo(() => {
    const rand = seededRand(hashStr(crowdTrainId + crowdSeed));
    return Array.from({ length: 6 }, (_, i) => {
      const v = rand();
      const level = v < 0.35 ? "low" : v < 0.65 ? "moderate" : v < 0.88 ? "high" : "vhigh";
      return { coach: i + 1, level, pct: Math.round(20 + v * 78) };
    });
  }, [crowdTrainId, crowdSeed]);
  const crowdMeta = {
    low: { label: "Low", color: "var(--green)" },
    moderate: { label: "Moderate", color: "var(--marigold)" },
    high: { label: "High", color: "#E0742B" },
    vhigh: { label: "Very high", color: "#D14343" },
  };

  const [feedback, setFeedback] = useState({ open: false, station: STATION_OPTIONS[0].id, category: "Cleanliness", note: "" });
  const [myReports, setMyReports] = useState([]);

  const [tickerIdx, setTickerIdx] = useState(0);
  const tickerMsgs = [
    "Next Purple Line train · Majestic → Whitefield · 3 min",
    "Next Green Line train · Majestic → Silk Institute · 5 min",
    "Interchange at Majestic · both lines on time",
  ];
  useEffect(() => {
    const iv = setInterval(() => setTickerIdx(i => (i + 1) % tickerMsgs.length), 3400);
    return () => clearInterval(iv);
  }, []);

  const t = useT(lang);

  useEffect(() => {
    if (ticket && ticket.expiresAt) {
      const iv = setInterval(() => {
        if (Date.now() > ticket.expiresAt) setTicket(prev => prev ? { ...prev, expired: true } : prev);
      }, 5000);
      return () => clearInterval(iv);
    }
  }, [ticket]);

  function openTopUp() { setTopUp({ open: true, amount: 200, step: "amount", method: null }); }
  function closeTopUp() { setTopUp(t0 => ({ ...t0, open: false })); }
  function confirmTopUp() {
    setTopUp(t0 => ({ ...t0, step: "processing" }));
    setTimeout(() => {
      setBalance(b => +(b + topUp.amount).toFixed(2));
      setTopUp(t0 => ({ ...t0, step: "success" }));
    }, 1200);
  }

  function bookTicket() {
    setTicketError("");
    if (!route) { setTicketError("Pick two different stations to plan a route."); return; }
    if (balance < fare) { setTicketError("Insufficient balance — top up your card to book this ticket."); return; }
    setBalance(b => +(b - fare).toFixed(2));
    const id = `NM-${Date.now().toString(36).toUpperCase()}`;
    setTicket({
      id,
      from: STATION_OPTIONS.find(s => s.id === fromId)?.name,
      to: STATION_OPTIONS.find(s => s.id === toId)?.name,
      fare, eta,
      ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      expiresAt: Date.now() + 60 * 60 * 1000,
      expired: false,
    });
    setTab("card");
  }

  function renewPass() {
    if (balance < 1200) { setTicketError("Insufficient balance to renew the monthly pass (₹1200)."); setTab("card"); return; }
    setBalance(b => +(b - 1200).toFixed(2));
    setPass({ active: true, line: pass.line, expiry: "30 Sep 2026" });
  }

  function simulateLiveUpdate() {
    const options = [
      { type: "delay", text: "Green Line: 4 min bunching near Lalbagh, trains being regulated." },
      { type: "info", text: "Purple Line back to normal frequency." },
      { type: "station", text: "Your stop MG Road is next." },
    ];
    const pick = options[Math.floor(Math.random() * options.length)];
    setNotifications(n => [{ id: Date.now(), ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), read: false, ...pick }, ...n]);
  }
  function markAllRead() { setNotifications(n => n.map(x => ({ ...x, read: true }))); }

  function submitFeedback() {
    const st = STATION_OPTIONS.find(s => s.id === feedback.station);
    setMyReports(r => [{ id: Date.now(), station: st?.name, category: feedback.category, note: feedback.note, status: "Submitted" }, ...r]);
    setFeedback(f => ({ ...f, open: false, note: "" }));
    setTimeout(() => {
      setMyReports(r => r.map((rep, i) => i === 0 ? { ...rep, status: "In review by station staff" } : rep));
    }, 3500);
  }

  const insights = { trips: 38, spend: 1240, favorite: "Majestic", weekly: [3, 5, 2, 6, 4, 1, 0] };

  /* ---------------------------- styles ---------------------------- */
  const css = `
    ${FONT_IMPORT}
    .nm-root{
      --purple:#9A2AA6; --purple-deep:#6E1C79; --green:#00A65A; --green-deep:#037A43;
      --marigold:#F2A93B; --danger:#D14343;
      font-family:'Inter',system-ui,sans-serif;
    }
    .nm-root[data-theme="dark"]{
      --bg:#100E16; --surface:#1B1823; --surface2:#221E2C; --text:#F3F0FA; --text-dim:#A79FBE; --border:#332C42;
    }
    .nm-root[data-theme="light"]{
      --bg:#F6F3ED; --surface:#FFFFFF; --surface2:#FBF8F2; --text:#1D1729; --text-dim:#6B6178; --border:#E7E0D4;
    }
    .nm-display{ font-family:'Space Grotesk',sans-serif; }
    .nm-mono{ font-family:'JetBrains Mono',monospace; }
    .nm-shell{ background:var(--bg); color:var(--text); }
    .nm-card{ background:var(--surface); border:1px solid var(--border); }
    .nm-card2{ background:var(--surface2); border:1px solid var(--border); }
    .nm-navbtn{ color:var(--text-dim); }
    .nm-navbtn.active{ color:var(--text); }
    .nm-scrollbar::-webkit-scrollbar{ width:0; height:0; }
    .nm-tabbar{ background:var(--surface); border-top:1px solid var(--border); }
    .nm-input{ background:var(--surface2); border:1px solid var(--border); color:var(--text); }
    .nm-btn-purple{ background:linear-gradient(135deg,var(--purple),var(--purple-deep)); color:#fff; }
    .nm-btn-green{ background:linear-gradient(135deg,var(--green),var(--green-deep)); color:#fff; }
    .nm-chip{ border:1px solid var(--border); color:var(--text-dim); }
    .nm-chip.active{ border-color:var(--marigold); color:var(--text); background:var(--surface2); }
    .nm-divider{ border-color:var(--border); }
    @keyframes nmfade{ from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:translateY(0);} }
    .nm-fade{ animation:nmfade .25s ease both; }
  `;

  const NAV = [
    { id: "home", icon: Home, label: t("home") },
    { id: "plan", icon: MapIcon, label: t("plan") },
    { id: "card", icon: CreditCard, label: t("card") },
    { id: "alerts", icon: Bell, label: t("alerts") },
    { id: "more", icon: MoreHorizontal, label: t("more") },
  ];

  return (
    <div className="nm-root" data-theme={dark ? "dark" : "light"}>
      <style>{css}</style>
      <div className="nm-shell flex items-center justify-center" style={{ minHeight: 600, padding: 18 }}>
        <div
          className="nm-card nm-scrollbar"
          style={{ width: 390, maxWidth: "100%", height: 780, borderRadius: 34, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", position: "relative" }}
        >
          {/* Header */}
          <div style={{ padding: "16px 18px 12px" }} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, var(--purple), var(--green))" }}>
                <Train size={18} color="#fff" />
              </div>
              <div>
                <div className="nm-display" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{t("brand")}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 2 }}>{t("tagline")}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setOffline(o => !o)} title="Offline mode" className="nm-card2 flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9 }}>
                {offline ? <WifiOff size={14} /> : <Wifi size={14} />}
              </button>
              <div style={{ position: "relative" }}>
                <button onClick={() => setLangOpen(o => !o)} className="nm-card2 flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9 }}>
                  <Globe size={14} />
                </button>
                {langOpen && (
                  <div className="nm-card nm-fade" style={{ position: "absolute", right: 0, top: 36, borderRadius: 10, overflow: "hidden", zIndex: 20, minWidth: 96 }}>
                    {[["en", "English"], ["kn", "ಕನ್ನಡ"], ["hi", "हिन्दी"]].map(([code, label]) => (
                      <button key={code} onClick={() => { setLang(code); setLangOpen(false); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12.5, background: lang === code ? "var(--surface2)" : "transparent", color: "var(--text)" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setDark(d => !d)} className="nm-card2 flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9 }}>
                {dark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </div>

          {offline && (
            <div className="nm-fade" style={{ margin: "0 18px 10px", padding: "6px 10px", borderRadius: 8, background: "var(--surface2)", fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
              <WifiOff size={12} /> Offline mode — showing cached line map &amp; last-synced balance.
            </div>
          )}

          {/* Body */}
          <div className="nm-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "4px 18px 18px" }}>
            {tab === "home" && (
              <HomeView t={t} dark={dark} balance={balance} openTopUp={openTopUp} pass={pass}
                tickerMsgs={tickerMsgs} tickerIdx={tickerIdx} insights={insights}
                goPlan={() => setTab("plan")} goAlerts={() => setTab("alerts")}
                unread={unread} />
            )}
            {tab === "plan" && (
              <PlanView t={t} fromId={fromId} toId={toId} setFromId={setFromId} setToId={setToId}
                route={route} fare={fare} eta={eta} onBook={bookTicket} error={ticketError} setError={setTicketError} />
            )}
            {tab === "card" && (
              <CardView t={t} balance={balance} openTopUp={openTopUp} pass={pass} renewPass={renewPass}
                ticket={ticket} clearTicket={() => setTicket(null)} error={ticketError} />
            )}
            {tab === "alerts" && (
              <AlertsView notifications={notifications} simulateLiveUpdate={simulateLiveUpdate} markAllRead={markAllRead} />
            )}
            {tab === "more" && (
              <MoreView
                crowdTrainId={crowdTrainId} setCrowdTrainId={setCrowdTrainId} coaches={coaches} crowdMeta={crowdMeta}
                refreshCrowd={() => setCrowdSeed(s => s + 1)}
                feedback={feedback} setFeedback={setFeedback} submitFeedback={submitFeedback} myReports={myReports}
                insights={insights}
              />
            )}
          </div>

          {/* Tab bar */}
          <div className="nm-tabbar" style={{ padding: "8px 6px", display: "flex", justifyContent: "space-around" }}>
            {NAV.map(n => {
              const Icon = n.icon;
              const active = tab === n.id;
              return (
                <button key={n.id} onClick={() => setTab(n.id)} className={`nm-navbtn ${active ? "active" : ""}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 10px", position: "relative" }}>
                  <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
                  <span style={{ fontSize: 10 }}>{n.label}</span>
                  {n.id === "alerts" && unread > 0 && (
                    <span style={{ position: "absolute", top: -1, right: 3, width: 7, height: 7, borderRadius: 99, background: "var(--danger)" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Top-up modal */}
          {topUp.open && (
            <TopUpModal topUp={topUp} setTopUp={setTopUp} close={closeTopUp} confirm={confirmTopUp} />
          )}
          {feedback.open && (
            <FeedbackModal feedback={feedback} setFeedback={setFeedback} submit={submitFeedback} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Views ------------------------------ */

function HomeView({ t, dark, balance, openTopUp, pass, tickerMsgs, tickerIdx, insights, goPlan, goAlerts, unread }) {
  return (
    <div className="nm-fade">
      {/* Balance card */}
      <div className="nm-btn-purple" style={{ borderRadius: 20, padding: 18, marginTop: 6, position: "relative", overflow: "hidden" }}>
        <div style={{ fontSize: 11.5, opacity: 0.85 }}>{t("balance")}</div>
        <div className="nm-mono" style={{ fontSize: 30, fontWeight: 600, marginTop: 4 }}>{fmtMoney(balance)}</div>
        <div className="flex items-center justify-between" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            {pass.active ? `${pass.line} pass · valid to ${pass.expiry}` : "No active pass"}
          </div>
          <button onClick={openTopUp} className="flex items-center gap-1" style={{ background: "rgba(255,255,255,0.18)", padding: "7px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
            <Plus size={13} /> {t("topUp")}
          </button>
        </div>
        <IndianRupee size={90} style={{ position: "absolute", right: -18, bottom: -22, opacity: 0.12 }} />
      </div>

      {/* Live line map */}
      <div className="nm-card" style={{ borderRadius: 18, padding: 14, marginTop: 14 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <div className="nm-display" style={{ fontSize: 13, fontWeight: 700 }}>Live network</div>
          <div className="flex items-center gap-3" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
            <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--purple)", display: "inline-block" }} />Purple</span>
            <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--green)", display: "inline-block" }} />Green</span>
          </div>
        </div>
        <LineMap dark={dark} pulse={{ x: 262, y: 190 }} />
        <div className="nm-card2" style={{ borderRadius: 10, padding: "8px 10px", marginTop: 6, fontSize: 11.5, display: "flex", alignItems: "center", gap: 7 }}>
          <Sparkles size={13} color="var(--marigold)" />
          <span key={tickerIdx} className="nm-fade" style={{ color: "var(--text-dim)" }}>{tickerMsgs[tickerIdx]}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <button onClick={goPlan} className="nm-card" style={{ borderRadius: 16, padding: 13, textAlign: "left" }}>
          <MapIcon size={17} color="var(--purple)" />
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>Plan a trip</div>
          <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>Fastest route + fare</div>
        </button>
        <button onClick={goAlerts} className="nm-card" style={{ borderRadius: 16, padding: 13, textAlign: "left", position: "relative" }}>
          <Bell size={17} color="var(--green)" />
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>Service alerts</div>
          <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{unread} unread update{unread === 1 ? "" : "s"}</div>
        </button>
      </div>

      {/* Insights teaser */}
      <div className="nm-card" style={{ borderRadius: 16, padding: 14, marginTop: 10 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <TrendingUp size={15} color="var(--marigold)" />
          <div className="nm-display" style={{ fontSize: 13, fontWeight: 700 }}>{t("insights")}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 46 }}>
          {insights.weekly.map((v, i) => (
            <div key={i} style={{ flex: 1, height: `${8 + v * 12}%`, minHeight: 6, borderRadius: 4, background: i === insights.weekly.length - 1 ? "var(--purple)" : "var(--surface2)", border: "1px solid var(--border)" }} />
          ))}
        </div>
        <div className="flex justify-between" style={{ marginTop: 8, fontSize: 10.5, color: "var(--text-dim)" }}>
          <span>{insights.trips} trips this month</span>
          <span>{fmtMoney(insights.spend)} spent</span>
        </div>
      </div>
    </div>
  );
}

function StationSelect({ value, onChange, exclude }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="nm-input" style={{ width: "100%", padding: "10px 10px", borderRadius: 10, fontSize: 13 }}>
      {STATION_OPTIONS.filter(s => s.id !== exclude).map(s => (
        <option key={s.id} value={s.id}>{s.name}{s.interchange ? " · Interchange" : ""}</option>
      ))}
    </select>
  );
}

function PlanView({ t, fromId, toId, setFromId, setToId, route, fare, eta, onBook, error, setError }) {
  return (
    <div className="nm-fade">
      <div className="nm-display" style={{ fontSize: 17, fontWeight: 700, margin: "10px 0 12px" }}>Plan your trip</div>
      <div className="nm-card" style={{ borderRadius: 16, padding: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5 }}>{t("from")}</div>
          <StationSelect value={fromId} onChange={id => { setError(""); setFromId(id); }} exclude={toId} />
        </div>
        <div className="flex justify-center" style={{ margin: "2px 0" }}>
          <button onClick={() => { const a = fromId; setFromId(toId); setToId(a); }} className="nm-card2 flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 99 }}>
            <ArrowRight size={13} style={{ transform: "rotate(90deg)" }} />
          </button>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5 }}>{t("to")}</div>
          <StationSelect value={toId} onChange={id => { setError(""); setToId(id); }} exclude={fromId} />
        </div>
      </div>

      {route ? (
        <div className="nm-card" style={{ borderRadius: 16, padding: 14, marginTop: 12 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div style={{ width: 10, height: 10, borderRadius: 99, background: "var(--purple)" }} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                {route.interchange ? "Purple ↔ Green via Majestic" : route.line === "purple" ? "Purple Line" : "Green Line"}
              </span>
            </div>
            <span className="nm-mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmtMoney(fare)}</span>
          </div>
          <div className="flex items-center gap-1" style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
            <Clock size={12} /> ~{eta} min · {route.stops.length - 1} stop{route.stops.length - 1 === 1 ? "" : "s"}
            {route.interchange && <span> · change at Majestic</span>}
          </div>
          <div className="nm-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 12, paddingBottom: 4 }}>
            {route.stops.map((s, i) => (
              <div key={i} className="nm-card2" style={{ flex: "0 0 auto", padding: "6px 10px", borderRadius: 9, fontSize: 10.5, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={10} color={s.id === "majestic" ? "var(--marigold)" : "var(--text-dim)"} /> {s.name}
              </div>
            ))}
          </div>
          {error && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 10 }}>{error}</div>}
          <button onClick={onBook} className="nm-btn-purple" style={{ width: "100%", marginTop: 12, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <QrCode size={15} /> {t("bookTicket")}
          </button>
        </div>
      ) : (
        <div className="nm-card2" style={{ borderRadius: 14, padding: 16, marginTop: 12, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
          Choose two different stations to see route, fare and time.
        </div>
      )}
    </div>
  );
}

function CardView({ t, balance, openTopUp, pass, renewPass, ticket, clearTicket, error }) {
  return (
    <div className="nm-fade">
      <div className="nm-display" style={{ fontSize: 17, fontWeight: 700, margin: "10px 0 12px" }}>{t("card")}</div>

      {ticket ? (
        <div className="nm-card" style={{ borderRadius: 18, padding: 16, marginBottom: 14, textAlign: "center" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: ticket.expired ? "var(--danger)" : "var(--green)" }}>
              {ticket.expired ? "Expired" : "Valid for single journey"}
            </span>
            <button onClick={clearTicket}><X size={14} color="var(--text-dim)" /></button>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ padding: 8, background: "#fff", borderRadius: 10, opacity: ticket.expired ? 0.35 : 1 }}>
              <FakeQR seed={ticket.id} />
            </div>
          </div>
          <div className="nm-mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 10 }}>{ticket.id}</div>
          <div className="flex items-center justify-center gap-2" style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>
            {ticket.from} <ArrowRight size={13} /> {ticket.to}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
            Booked {ticket.ts} · {fmtMoney(ticket.fare)} · ~{ticket.eta} min
          </div>
        </div>
      ) : (
        <div className="nm-card2" style={{ borderRadius: 14, padding: 16, marginBottom: 14, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
          No active ticket. Plan a trip to generate a QR ticket.
        </div>
      )}

      <div className="nm-card" style={{ borderRadius: 16, padding: 14 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{t("balance")}</span>
          <span className="nm-mono" style={{ fontSize: 15, fontWeight: 600 }}>{fmtMoney(balance)}</span>
        </div>
        <button onClick={openTopUp} className="nm-btn-purple" style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 11, fontSize: 12.5, fontWeight: 600 }}>
          {t("topUp")} via UPI
        </button>
        {error && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8 }}>{error}</div>}
      </div>

      <div className="nm-card" style={{ borderRadius: 16, padding: 14, marginTop: 12 }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t("monthlyPass")}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 2 }}>
              {pass.active ? `${pass.line} · valid to ${pass.expiry}` : "No active pass"}
            </div>
          </div>
          <CreditCard size={20} color="var(--green)" />
        </div>
        <button onClick={renewPass} className="nm-btn-green" style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 11, fontSize: 12.5, fontWeight: 600 }}>
          Renew for ₹1200
        </button>
      </div>
    </div>
  );
}

function AlertsView({ notifications, simulateLiveUpdate, markAllRead }) {
  const iconFor = (type) => type === "delay" ? <AlertTriangle size={15} color="var(--marigold)" /> : type === "station" ? <MapPin size={15} color="var(--purple)" /> : <CheckCircle2 size={15} color="var(--green)" />;
  return (
    <div className="nm-fade">
      <div className="flex items-center justify-between" style={{ margin: "10px 0 12px" }}>
        <div className="nm-display" style={{ fontSize: 17, fontWeight: 700 }}>Alerts</div>
        <button onClick={markAllRead} style={{ fontSize: 11, color: "var(--text-dim)" }}>Mark all read</button>
      </div>
      <button onClick={simulateLiveUpdate} className="nm-card2 flex items-center justify-center gap-2" style={{ width: "100%", padding: "9px", borderRadius: 11, fontSize: 12, marginBottom: 12 }}>
        <RefreshCw size={13} /> Check for live updates
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifications.map(n => (
          <div key={n.id} className="nm-card" style={{ borderRadius: 13, padding: 12, display: "flex", gap: 10, opacity: n.read ? 0.72 : 1 }}>
            <div style={{ marginTop: 1 }}>{iconFor(n.type)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, lineHeight: 1.4 }}>{n.text}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>{n.ts}</div>
            </div>
            {!n.read && <div style={{ width: 7, height: 7, borderRadius: 99, background: "var(--danger)", marginTop: 4 }} />}
          </div>
        ))}
      </div>

      <div className="nm-card2" style={{ borderRadius: 13, padding: 12, marginTop: 14, display: "flex", gap: 9, alignItems: "flex-start" }}>
        <ShieldAlert size={15} color="var(--danger)" style={{ marginTop: 1 }} />
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Seeing something unsafe on a platform right now? Use "Report an issue" under More → this reaches on-duty station staff.
        </div>
      </div>
    </div>
  );
}

function MoreView({ crowdTrainId, setCrowdTrainId, coaches, crowdMeta, refreshCrowd, feedback, setFeedback, myReports, insights }) {
  return (
    <div className="nm-fade">
      <div className="nm-display" style={{ fontSize: 17, fontWeight: 700, margin: "10px 0 12px" }}>More</div>

      {/* Crowd density */}
      <div className="nm-card" style={{ borderRadius: 16, padding: 14 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div className="flex items-center gap-2">
            <Users size={15} color="var(--purple)" />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Live crowd density</span>
          </div>
          <button onClick={refreshCrowd} className="nm-card2 flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 8 }}>
            <RefreshCw size={12} />
          </button>
        </div>
        <select value={crowdTrainId} onChange={e => setCrowdTrainId(e.target.value)} className="nm-input" style={{ width: "100%", padding: "8px 10px", borderRadius: 9, fontSize: 12, marginBottom: 10 }}>
          <option>PL-2201 · Purple Line</option>
          <option>PL-2214 · Purple Line</option>
          <option>GL-1107 · Green Line</option>
          <option>GL-1132 · Green Line</option>
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
          {coaches.map(c => (
            <div key={c.coach} style={{ textAlign: "center" }}>
              <div style={{ height: 44, borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                <div style={{ width: "100%", height: `${c.pct}%`, background: crowdMeta[c.level].color }} />
              </div>
              <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 3 }}>C{c.coach}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
          {Object.entries(crowdMeta).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1" style={{ fontSize: 10, color: "var(--text-dim)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: v.color, display: "inline-block" }} /> {v.label}
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      <div className="nm-card" style={{ borderRadius: 16, padding: 14, marginTop: 12 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareWarning size={15} color="var(--marigold)" />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Report an issue</span>
          </div>
          <button onClick={() => setFeedback(f => ({ ...f, open: true }))} className="nm-btn-purple" style={{ padding: "6px 11px", borderRadius: 9, fontSize: 11, fontWeight: 600 }}>New report</button>
        </div>
        {myReports.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
            {myReports.map(r => (
              <div key={r.id} className="nm-card2" style={{ borderRadius: 10, padding: 9, fontSize: 11 }}>
                <div style={{ fontWeight: 600 }}>{r.category} · {r.station}</div>
                {r.note && <div style={{ color: "var(--text-dim)", marginTop: 2 }}>{r.note}</div>}
                <div style={{ color: "var(--marigold)", marginTop: 3, fontSize: 10 }}>{r.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insights detail */}
      <div className="nm-card" style={{ borderRadius: 16, padding: 14, marginTop: 12 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <TrendingUp size={15} color="var(--green)" />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Commute insights</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.7 }}>
          {insights.trips} trips and {fmtMoney(insights.spend)} spent this month.<br />
          Most-used station: <strong style={{ color: "var(--text)" }}>{insights.favorite}</strong> interchange.<br />
          Based on your history, Tue &amp; Thu mornings are your busiest commute times.
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--text-dim)", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Prototype build · balances, tickets and alerts are simulated locally and are not connected to BMRCL or a live UPI network.
      </div>
    </div>
  );
}

/* ------------------------------ Modals ------------------------------ */

function TopUpModal({ topUp, setTopUp, close, confirm }) {
  const amounts = [100, 200, 500, 1000];
  const apps = ["GPay", "PhonePe", "Paytm", "BHIM"];
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 30 }}>
      <div className="nm-card nm-fade" style={{ width: "100%", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 }}>
        {topUp.step === "amount" && (
          <>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <span className="nm-display" style={{ fontSize: 15, fontWeight: 700 }}>Top up via UPI</span>
              <button onClick={close}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {amounts.map(a => (
                <button key={a} onClick={() => setTopUp(t0 => ({ ...t0, amount: a }))}
                  className={`nm-chip ${topUp.amount === a ? "active" : ""}`} style={{ padding: "10px", borderRadius: 11, fontSize: 13, fontWeight: 600 }}>
                  ₹{a}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>Pay using</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {apps.map(a => (
                <button key={a} onClick={() => setTopUp(t0 => ({ ...t0, method: a }))} className={`nm-chip ${topUp.method === a ? "active" : ""}`} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 11 }}>
                  {a}
                </button>
              ))}
            </div>
            <button disabled={!topUp.method} onClick={confirm} className="nm-btn-purple" style={{ width: "100%", padding: 12, borderRadius: 12, fontSize: 13, fontWeight: 600, opacity: topUp.method ? 1 : 0.5 }}>
              Pay ₹{topUp.amount}
            </button>
          </>
        )}
        {topUp.step === "processing" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <RefreshCw size={26} className="nm-mono" style={{ animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize: 12.5, marginTop: 12, color: "var(--text-dim)" }}>Confirming with {topUp.method}…</div>
          </div>
        )}
        {topUp.step === "success" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <CheckCircle2 size={32} color="var(--green)" />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>₹{topUp.amount} added</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Your balance has been updated.</div>
            <button onClick={close} className="nm-btn-green" style={{ width: "100%", padding: 11, borderRadius: 11, fontSize: 12.5, fontWeight: 600, marginTop: 16 }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackModal({ feedback, setFeedback, submit }) {
  const categories = ["Cleanliness", "Escalator / lift not working", "Overcrowding", "Safety concern", "Staff behaviour", "Other"];
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 30 }}>
      <div className="nm-card nm-fade" style={{ width: "100%", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: "85%", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <span className="nm-display" style={{ fontSize: 15, fontWeight: 700 }}>Report an issue</span>
          <button onClick={() => setFeedback(f => ({ ...f, open: false }))}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5 }}>Station</div>
        <select value={feedback.station} onChange={e => setFeedback(f => ({ ...f, station: e.target.value }))} className="nm-input" style={{ width: "100%", padding: "9px 10px", borderRadius: 10, fontSize: 12.5, marginBottom: 12 }}>
          {STATION_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5 }}>Category</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {categories.map(c => (
            <button key={c} onClick={() => setFeedback(f => ({ ...f, category: c }))} className={`nm-chip ${feedback.category === c ? "active" : ""}`} style={{ padding: "7px 10px", borderRadius: 9, fontSize: 11 }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5 }}>Details (optional)</div>
        <textarea value={feedback.note} onChange={e => setFeedback(f => ({ ...f, note: e.target.value }))} rows={3}
          placeholder="What did you notice?" className="nm-input" style={{ width: "100%", padding: 10, borderRadius: 10, fontSize: 12.5, resize: "none", marginBottom: 14 }} />
        <button onClick={submit} className="nm-btn-purple" style={{ width: "100%", padding: 12, borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
          Submit to station staff
        </button>
      </div>
    </div>
  );
}
const root = createRoot(document.getElementById("root"));
root.render(<NammaMetroApp />);