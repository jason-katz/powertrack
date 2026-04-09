import { useState, useEffect, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const ACCESS_KEY = import.meta.env.VITE_ACCESS_KEY || "power2024";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const CURRENCY = "R";
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtR = (n) => n == null ? "—" : `${CURRENCY} ${Number(n).toFixed(2)}`;
const fmtN = (n, dec = 1) => n == null ? "—" : Number(n).toFixed(dec);
const nowDate = new Date();
const currentYear = nowDate.getFullYear();
const currentMonth = nowDate.getMonth() + 1;

// ─── PRINT STATEMENT ──────────────────────────────────────────────────────────
function printStatement(year, month, data) {
  const existing = document.getElementById("pt-print-statement");
  if (existing) existing.remove();
  const { mainReading, mainDelta, billAmt, tenantRows } = data;
  const attributed = tenantRows.reduce((s, r) => s + (r.amount || 0), 0);
  const generatedOn = new Date().toLocaleDateString("en-ZA", { year:"numeric", month:"long", day:"numeric" });
  const rows = tenantRows.map(r => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;">${r.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;text-align:right;">${r.reading != null ? Number(r.reading).toFixed(1) : "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;text-align:right;">${r.netDelta != null ? Number(r.netDelta).toFixed(1) : "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;text-align:right;">${r.share != null ? (r.share*100).toFixed(1)+"%" : "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e4dc;text-align:right;font-weight:600;color:${r.amount != null ? "#1a5c28" : "#999"};">${r.amount != null ? "R "+Number(r.amount).toFixed(2) : "—"}</td>
    </tr>`).join("");
  const el = document.createElement("div");
  el.id = "pt-print-statement";
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:20px;border-bottom:2px solid #1a1510;">
      <div>
        <div style="font-family:'Instrument Serif',serif;font-size:32px;font-style:italic;color:#1a1510;line-height:1;">PowerTrack</div>
        <div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8a7a65;margin-top:4px;">Electricity Usage Statement</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'Instrument Serif',serif;font-size:22px;font-style:italic;color:#1a1510;">${SHORT_MONTHS[month-1]} ${year}</div>
        <div style="font-size:10px;color:#8a7a65;margin-top:4px;">Generated ${generatedOn}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px;">
      ${[["Main Meter Reading", mainReading!=null?Number(mainReading).toFixed(1)+" kWh":"—"],
         ["Main Meter Usage",   mainDelta!=null  ?Number(mainDelta).toFixed(1)+" kWh":"—"],
         ["Total Bill",         billAmt!=null    ?"R "+Number(billAmt).toFixed(2):"—"]
        ].map(([label,val])=>`
        <div style="border:1px solid #d8d0c4;padding:14px 16px;">
          <div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#8a7a65;margin-bottom:6px;">${label}</div>
          <div style="font-size:20px;font-family:'Instrument Serif',serif;font-style:italic;color:#1a1510;">${val}</div>
        </div>`).join("")}
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f4efe6;">
          ${["Tenant","Reading (kWh)","Usage (kWh)","Share %","Amount Owed"].map((h,i)=>
            `<th style="padding:8px 12px;border-bottom:2px solid #1a1510;font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:400;color:#4a4035;text-align:${i===0?"left":"right"};">${h}</th>`
          ).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;gap:24px;padding:10px 12px;background:#f4efe6;border:1px solid #d8d0c4;font-size:11px;color:#4a4035;">
      <span>Attributed: <strong>R ${attributed.toFixed(2)}</strong></span>
      <span>Total bill: <strong style="color:#b83d0a;">R ${billAmt!=null?Number(billAmt).toFixed(2):"0.00"}</strong></span>
    </div>
    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e0d8cc;font-size:9px;color:#aaa;letter-spacing:.08em;">
      This statement was generated automatically by PowerTrack. Usage is calculated as the delta between consecutive meter readings.
      Each tenant's share is proportional to their usage relative to the main meter delta for the period.
    </div>`;
  document.body.appendChild(el);
  window.print();
  setTimeout(() => el.remove(), 1000);
}

// ─── SUPABASE SETUP SQL ───────────────────────────────────────────────────────
const SETUP_SQL = `create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_tenant_id uuid references tenants(id) on delete set null,
  created_at timestamptz default now()
);

create table main_readings (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  reading numeric not null,
  created_at timestamptz default now(),
  unique(year, month)
);

create table tenant_readings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  year int not null,
  month int not null,
  reading numeric not null,
  created_at timestamptz default now(),
  unique(tenant_id, year, month)
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  total_amount numeric not null,
  created_at timestamptz default now(),
  unique(year, month)
);

alter table tenants disable row level security;
alter table main_readings disable row level security;
alter table tenant_readings disable row level security;
alter table bills disable row level security;`;

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#f4efe6;}
:root{
  --bg:#f4efe6;--bg2:#ece6d8;--bg3:#e2dace;
  --ink:#1a1510;--ink2:#4a4035;--ink3:#8a7a65;
  --rule:#cec6b4;--white:#ffffff;
  --accent:#b83d0a;--green:#2a6e38;
  --mono:'IBM Plex Mono',monospace;--serif:'Instrument Serif',serif;
}
input,select,button{font-family:var(--mono);}
input:focus,select:focus{outline:none;border-color:var(--accent)!important;}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:var(--rule);}
.tab{background:none;border:none;border-bottom:2px solid transparent;padding:12px 18px;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);cursor:pointer;transition:all .15s;}
.tab.on{color:var(--accent);border-bottom-color:var(--accent);}
.tab:hover:not(.on){color:var(--ink2);}
.btn{background:var(--accent);color:#fff;border:none;padding:10px 22px;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background .15s;}
.btn:hover{background:#952f06;}
.btn:disabled{background:var(--rule);color:var(--ink3);cursor:not-allowed;}
.btn-sm{background:none;border:1px solid var(--rule);padding:6px 13px;font-family:var(--mono);font-size:10px;letter-spacing:.09em;text-transform:uppercase;cursor:pointer;color:var(--ink3);transition:all .15s;}
.btn-sm:hover{border-color:var(--accent);color:var(--accent);}
.btn-del{background:none;border:1px solid #fcc;padding:5px 11px;font-family:var(--mono);font-size:10px;cursor:pointer;color:#b83030;transition:all .15s;}
.btn-del:hover{background:#b83030;color:#fff;border-color:#b83030;}
.inp{background:var(--white);border:1px solid var(--rule);padding:9px 12px;font-family:var(--mono);font-size:13px;color:var(--ink);width:100%;transition:border .15s;}
.sel{background:var(--white);border:1px solid var(--rule);padding:9px 12px;font-family:var(--mono);font-size:13px;color:var(--ink);width:100%;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238a7a65'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:30px;}
.card{background:var(--white);border:1px solid var(--rule);}
.lbl{font-size:10px;color:var(--ink3);letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;}
table{width:100%;border-collapse:collapse;}
th{font-size:10px;color:var(--ink3);letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;border-bottom:1px solid var(--rule);background:var(--bg2);font-weight:400;text-align:left;}
th:not(:first-child){text-align:right;}
td{padding:12px 14px;border-bottom:1px solid var(--bg3);font-size:13px;color:var(--ink2);}
td:not(:first-child){text-align:right;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:var(--bg);}
.toast{position:fixed;bottom:24px;right:24px;background:var(--ink);color:#fff;padding:11px 18px;font-family:var(--mono);font-size:12px;z-index:999;animation:up .2s ease;}
.toast.err{background:var(--accent);}
@keyframes up{from{transform:translateY(6px);opacity:0;}to{transform:translateY(0);opacity:1;}}
.hint{background:var(--bg);border:1px solid var(--rule);padding:10px 13px;font-size:11px;color:var(--ink3);margin-bottom:14px;}
.pill{display:inline-block;padding:2px 8px;font-size:10px;background:var(--bg2);color:var(--ink3);margin-left:8px;}
.code{background:#1a1510;color:#a0c090;font-family:var(--mono);font-size:11px;padding:20px;white-space:pre;overflow-x:auto;line-height:1.75;}

@media print {
  body * { visibility: hidden !important; }
  #pt-print-statement, #pt-print-statement * { visibility: visible !important; }
  #pt-print-statement {
    position: fixed; inset: 0;
    background: #fff; color: #000;
    font-family: 'IBM Plex Mono', monospace;
    padding: 48px 56px;
    font-size: 12px;
  }
  @page { margin: 0; size: A4; }
}
`;

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState("auth");
  const [keyInput, setKeyInput] = useState("");
  const [keyErr, setKeyErr] = useState(false);
  const [sbUrl, setSbUrl] = useState(SUPABASE_URL);
  const [sbKey, setSbKey] = useState(SUPABASE_ANON_KEY);
  const [sb, setSb] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [mainReadings, setMainReadings] = useState([]);
  const [tenantReadings, setTenantReadings] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const connect = (url, key) => {
    try {
      const client = createClient(url, key);
      setSb(client);
      setPhase("app");
    } catch { showToast("Invalid credentials", "err"); }
  };

  const handleLogin = () => {
    if (keyInput !== ACCESS_KEY) {
      setKeyErr(true); setTimeout(() => setKeyErr(false), 600); return;
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { setPhase("setup"); return; }
    connect(SUPABASE_URL, SUPABASE_ANON_KEY);
  };

  const loadAll = useCallback(async () => {
    if (!sb) return;
    setLoading(true);
    const [t, mr, tr, b] = await Promise.all([
      sb.from("tenants").select("*").order("created_at"),
      sb.from("main_readings").select("*").order("year").order("month"),
      sb.from("tenant_readings").select("*").order("year").order("month"),
      sb.from("bills").select("*").order("year").order("month"),
    ]);
    if (t.data) setTenants(t.data);
    if (mr.data) setMainReadings(mr.data);
    if (tr.data) setTenantReadings(tr.data);
    if (b.data) setBills(b.data);
    if (t.error || mr.error || tr.error || b.error) showToast("Error loading data", "err");
    setLoading(false);
  }, [sb]);

  useEffect(() => { if (phase === "app") loadAll(); }, [phase, loadAll]);

  // Compute usage & amounts for a given month
  const computeMonth = useCallback((year, month) => {
    const mainThis = mainReadings.find(r => r.year === year && r.month === month);
    const mainPrev = mainReadings
      .filter(r => r.year < year || (r.year === year && r.month < month))
      .sort((a, b) => b.year - a.year || b.month - a.month)[0];
    const mainDelta = mainThis && mainPrev ? mainThis.reading - mainPrev.reading : null;
    const bill = bills.find(b => b.year === year && b.month === month);

    // First pass: compute raw deltas for every tenant
    const rawDeltas = {};
    tenants.forEach(t => {
      const tThis = tenantReadings.find(r => r.tenant_id === t.id && r.year === year && r.month === month);
      const tPrev = tenantReadings
        .filter(r => r.tenant_id === t.id && (r.year < year || (r.year === year && r.month < month)))
        .sort((a, b) => b.year - a.year || b.month - a.month)[0];
      rawDeltas[t.id] = tThis && tPrev ? tThis.reading - tPrev.reading : null;
    });

    // Second pass: subtract sub-tenant deltas from parent tenant net usage
    const tenantRows = tenants.map(t => {
      const tThis = tenantReadings.find(r => r.tenant_id === t.id && r.year === year && r.month === month);
      const grossDelta = rawDeltas[t.id];

      // Sum deltas of any tenants that have this tenant as parent
      const subDeltaTotal = tenants
        .filter(s => s.parent_tenant_id === t.id)
        .reduce((sum, s) => {
          const sd = rawDeltas[s.id];
          return sd != null ? sum + sd : sum;
        }, 0);

      const hasSubTenants = tenants.some(s => s.parent_tenant_id === t.id);
      const netDelta = grossDelta != null
        ? (hasSubTenants ? grossDelta - subDeltaTotal : grossDelta)
        : null;

      const share = mainDelta && netDelta != null ? netDelta / mainDelta : null;
      const amount = share != null && bill ? share * bill.total_amount : null;
      const parentName = t.parent_tenant_id
        ? tenants.find(p => p.id === t.parent_tenant_id)?.name ?? null
        : null;

      return { ...t, reading: tThis?.reading ?? null, grossDelta, netDelta, share, amount, parentName };
    });

    return { mainReading: mainThis?.reading ?? null, mainDelta, billAmt: bill?.total_amount ?? null, tenantRows };
  }, [mainReadings, tenantReadings, bills, tenants]);

  const allMonths = [...new Set([
    ...mainReadings.map(r => `${r.year}-${String(r.month).padStart(2,"0")}`),
    ...bills.map(b => `${b.year}-${String(b.month).padStart(2,"0")}`),
  ])].sort().reverse().map(k => { const [y,m]=k.split("-").map(Number); return {year:y,month:m}; });

  // ── AUTH ──
  if (phase === "auth") return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{CSS}</style>
      <div style={{width:340}}>
        <div style={{fontFamily:"var(--serif)",fontSize:40,fontStyle:"italic",color:"var(--ink)",lineHeight:1}}>PowerTrack</div>
        <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--ink3)",letterSpacing:".15em",textTransform:"uppercase",marginBottom:32,marginTop:4}}>Utility Management</div>
        <div className="card" style={{padding:"26px 24px"}}>
          <div className="lbl">Access Key</div>
          <input className="inp" type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="Enter access key" style={{marginBottom:14,borderColor:keyErr?"var(--accent)":undefined}} autoFocus />
          {keyErr && <div style={{fontSize:11,color:"var(--accent)",marginBottom:10,fontFamily:"var(--mono)"}}>Incorrect key</div>}
          <button className="btn" style={{width:"100%"}} onClick={handleLogin}>Enter →</button>
        </div>
      </div>
    </div>
  );

  // ── SETUP ──
  if (phase === "setup") return (
    <div style={{minHeight:"100vh",background:"var(--bg)",padding:"48px 24px"}}>
      <style>{CSS}</style>
      <div style={{maxWidth:660,margin:"0 auto"}}>
        <div style={{fontFamily:"var(--serif)",fontSize:32,fontStyle:"italic",color:"var(--ink)",marginBottom:4}}>Supabase Setup</div>
        <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--ink3)",marginBottom:28}}>One-time setup — credentials are saved locally in your browser.</div>
        <div className="card" style={{padding:24,marginBottom:18}}>
          <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--ink2)",marginBottom:14,fontWeight:500}}>Step 1 — Run this SQL in your Supabase SQL editor</div>
          <div className="code">{SETUP_SQL}</div>
        </div>
        <div className="card" style={{padding:24,marginBottom:20}}>
          <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--ink2)",marginBottom:16,fontWeight:500}}>Step 2 — Paste your Supabase credentials</div>
          <div style={{display:"grid",gap:14}}>
            <div><div className="lbl">Project URL</div><input className="inp" value={sbUrl} onChange={e=>setSbUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></div>
            <div><div className="lbl">Anon Public Key</div><input className="inp" value={sbKey} onChange={e=>setSbKey(e.target.value)} placeholder="eyJ..." /></div>
          </div>
        </div>
        <button className="btn" onClick={()=>connect(sbUrl,sbKey)}>Connect & Launch →</button>
      </div>
    </div>
  );

  // ── MAIN APP ──
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",fontFamily:"var(--mono)"}}>
      <style>{CSS}</style>
      {toast && <div className={`toast ${toast.type==="err"?"err":""}`}>{toast.msg}</div>}

      {/* Nav */}
      <div style={{background:"var(--white)",borderBottom:"1px solid var(--rule)",padding:"0 28px",display:"flex",alignItems:"center",gap:0}}>
        <div style={{fontFamily:"var(--serif)",fontSize:20,fontStyle:"italic",color:"var(--ink)",paddingRight:24,marginRight:8,paddingTop:14,paddingBottom:14,borderRight:"1px solid var(--rule)"}}>PowerTrack</div>
        {[["dashboard","Dashboard"],["record","Record"],["history","History"],["tenants","Tenants"]].map(([id,label])=>(
          <button key={id} className={`tab ${tab===id?"on":""}`} onClick={()=>setTab(id)}>{label}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          {loading && <span style={{fontSize:10,color:"var(--ink3)"}}>Loading…</span>}
          <button className="btn-sm" onClick={loadAll}>↻</button>
          <button className="btn-sm" onClick={()=>{setSb(null);setPhase("auth");}}>⎋ Lock</button>
        </div>
      </div>

      <div style={{maxWidth:940,margin:"0 auto",padding:"32px 24px"}}>
        {tab==="dashboard" && <Dashboard allMonths={allMonths} computeMonth={computeMonth} tenants={tenants} fmtR={fmtR} fmtN={fmtN} />}
        {tab==="record"    && <Record sb={sb} tenants={tenants} mainReadings={mainReadings} tenantReadings={tenantReadings} bills={bills} loadAll={loadAll} showToast={showToast} fmtN={fmtN} />}
        {tab==="history"   && <History allMonths={allMonths} computeMonth={computeMonth} fmtR={fmtR} fmtN={fmtN} />}
        {tab==="tenants"   && <Tenants sb={sb} tenants={tenants} loadAll={loadAll} showToast={showToast} />}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ allMonths, computeMonth, tenants, fmtR, fmtN }) {
  const [idx, setIdx] = useState(0);
  const sel = allMonths[idx];
  const d = sel ? computeMonth(sel.year, sel.month) : null;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div style={{fontFamily:"var(--serif)",fontSize:28,fontStyle:"italic",color:"var(--ink)"}}>
          {sel ? `${SHORT_MONTHS[sel.month-1]} ${sel.year}` : "No data yet"}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="btn-sm" disabled={idx>=allMonths.length-1} onClick={()=>setIdx(i=>i+1)}>‹ Prev</button>
          <button className="btn-sm" disabled={idx===0} onClick={()=>setIdx(i=>i-1)}>Next ›</button>
          {sel && d && (
            <button className="btn" style={{marginLeft:8,fontSize:10,padding:"7px 16px"}}
              onClick={()=>printStatement(sel.year, sel.month, d)}>
              ↓ Export PDF
            </button>
          )}
        </div>
      </div>

      {!sel ? (
        <div style={{color:"var(--ink3)",fontSize:13,textAlign:"center",padding:"60px 0"}}>No records yet — go to Record to enter your first readings.</div>
      ) : <>
        {/* Summary cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
          {[
            {label:"Main Meter Reading", val: d?.mainReading!=null ? `${fmtN(d.mainReading,1)} kWh` : "—", sub:"Raw reading this month"},
            {label:"Main Meter Usage",   val: d?.mainDelta!=null   ? `${fmtN(d.mainDelta,1)} kWh`   : "—", sub:"Delta from previous month"},
            {label:"Total Bill",         val: d?.billAmt!=null     ? fmtR(d.billAmt)                : "—", sub:"Amount to distribute", accent:true},
          ].map(c=>(
            <div key={c.label} className="card" style={{padding:"20px 20px",borderLeft:c.accent?"3px solid var(--accent)":undefined}}>
              <div className="lbl">{c.label}</div>
              <div style={{fontFamily:"var(--serif)",fontSize:28,color:c.accent?"var(--accent)":"var(--ink)",lineHeight:1,margin:"6px 0 4px"}}>{c.val}</div>
              <div style={{fontSize:10,color:"var(--ink3)"}}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Tenant table */}
        {tenants.length===0 ? (
          <div style={{color:"var(--ink3)",fontSize:13,textAlign:"center",padding:"40px 0"}}>No tenants — add them in the Tenants tab.</div>
        ) : (
          <div className="card">
            <table>
              <thead><tr>
                <th>Tenant</th>
                <th>Meter Reading (kWh)</th>
                <th>Usage (kWh)</th>
                <th>Share %</th>
                <th>Amount Owed</th>
              </tr></thead>
              <tbody>
                {d?.tenantRows.map(row=>(
                  <tr key={row.id}>
                    <td style={{color:"var(--ink)",fontWeight:500}}>
                      {row.parentName
                        ? <><span style={{color:"var(--ink3)",marginRight:6}}>↳</span>{row.name}<span style={{fontSize:10,color:"var(--ink3)",fontWeight:400,marginLeft:6}}>sub of {row.parentName}</span></>
                        : row.name}
                    </td>
                    <td style={{fontVariantNumeric:"tabular-nums"}}>{row.reading!=null?fmtN(row.reading,1):<span style={{color:"var(--ink3)"}}>—</span>}</td>
                    <td style={{fontVariantNumeric:"tabular-nums"}}>{row.netDelta!=null?fmtN(row.netDelta,1):<span style={{color:"var(--ink3)"}}>—</span>}</td>
                    <td style={{color:"var(--ink3)"}}>{row.share!=null?`${(row.share*100).toFixed(1)}%`:"—"}</td>
                    <td style={{color:row.amount!=null?"var(--green)":"var(--ink3)",fontWeight:row.amount!=null?500:400}}>
                      {row.amount!=null?fmtR(row.amount):"—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d?.billAmt!=null && d?.tenantRows.some(r=>r.amount!=null) && (
              <div style={{padding:"10px 14px",borderTop:"1px solid var(--rule)",background:"var(--bg)",display:"flex",justifyContent:"flex-end",gap:20,fontSize:11,color:"var(--ink3)"}}>
                <span>Attributed: <strong style={{color:"var(--ink)"}}>{fmtR(d.tenantRows.reduce((s,r)=>s+(r.amount||0),0))}</strong></span>
                <span>Total bill: <strong style={{color:"var(--accent)"}}>{fmtR(d.billAmt)}</strong></span>
              </div>
            )}
          </div>
        )}
      </>}
    </div>
  );
}

// ─── RECORD ───────────────────────────────────────────────────────────────────
function Record({ sb, tenants, mainReadings, tenantReadings, bills, loadAll, showToast, fmtN }) {
  const [mode, setMode] = useState("main");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [tenantId, setTenantId] = useState("");
  const [reading, setReading] = useState("");
  const [billAmt, setBillAmt] = useState("");
  const [saving, setSaving] = useState(false);
  const years = Array.from({length:6},(_,i)=>currentYear-3+i);

  useEffect(()=>{ if(tenants.length&&!tenantId) setTenantId(tenants[0]?.id||""); },[tenants]);
  useEffect(()=>{
    if (mode==="main") {
      const ex = mainReadings.find(r=>r.year===year&&r.month===month);
      setReading(ex ? String(ex.reading) : ""); setBillAmt("");
    } else if (mode==="tenant") {
      const ex = tenantId ? tenantReadings.find(r=>r.tenant_id===tenantId&&r.year===year&&r.month===month) : null;
      setReading(ex ? String(ex.reading) : ""); setBillAmt("");
    } else {
      const ex = bills.find(b=>b.year===year&&b.month===month);
      setBillAmt(ex ? String(ex.total_amount) : ""); setReading("");
    }
  },[mode,year,month,tenantId,mainReadings,tenantReadings,bills]);

  const existingMain   = mainReadings.find(r=>r.year===year&&r.month===month);
  const existingTenant = tenantId ? tenantReadings.find(r=>r.tenant_id===tenantId&&r.year===year&&r.month===month) : null;
  const existingBill   = bills.find(b=>b.year===year&&b.month===month);

  const prevMain = mainReadings
    .filter(r=>r.year<year||(r.year===year&&r.month<month))
    .sort((a,b)=>b.year-a.year||b.month-a.month)[0];
  const prevTenant = tenantId ? tenantReadings
    .filter(r=>r.tenant_id===tenantId&&(r.year<year||(r.year===year&&r.month<month)))
    .sort((a,b)=>b.year-a.year||b.month-a.month)[0] : null;

  const save = async () => {
    setSaving(true);
    try {
      if (mode==="main") {
        const val = parseFloat(reading);
        if (isNaN(val)) { showToast("Enter a valid reading","err"); setSaving(false); return; }
        const {error} = await sb.from("main_readings").upsert({year,month,reading:val},{onConflict:"year,month"});
        if (error) throw error;
        showToast("Main reading saved ✓");
      } else if (mode==="tenant") {
        if (!tenantId) { showToast("Select a tenant","err"); setSaving(false); return; }
        const val = parseFloat(reading);
        if (isNaN(val)) { showToast("Enter a valid reading","err"); setSaving(false); return; }
        const {error} = await sb.from("tenant_readings").upsert({tenant_id:tenantId,year,month,reading:val},{onConflict:"tenant_id,year,month"});
        if (error) throw error;
        showToast("Tenant reading saved ✓");
      } else {
        const val = parseFloat(billAmt);
        if (isNaN(val)) { showToast("Enter a valid amount","err"); setSaving(false); return; }
        const {error} = await sb.from("bills").upsert({year,month,total_amount:val},{onConflict:"year,month"});
        if (error) throw error;
        showToast("Bill saved ✓");
      }
      await loadAll();
      setReading(""); setBillAmt("");
    } catch(e) { showToast(e.message||"Save failed","err"); }
    setSaving(false);
  };

  return (
    <div style={{maxWidth:500}}>
      <div style={{fontFamily:"var(--serif)",fontSize:28,fontStyle:"italic",color:"var(--ink)",marginBottom:22}}>Record Reading</div>

      {/* Mode toggle */}
      <div style={{display:"flex",border:"1px solid var(--rule)",background:"var(--white)",marginBottom:22}}>
        {[["main","Main Meter"],["tenant","Tenant Meter"],["bill","Monthly Bill"]].map(([id,label],i,arr)=>(
          <button key={id} onClick={()=>setMode(id)} style={{
            flex:1,padding:"10px 0",border:"none",borderRight:i<arr.length-1?"1px solid var(--rule)":"none",
            cursor:"pointer",fontFamily:"var(--mono)",fontSize:11,letterSpacing:".08em",textTransform:"uppercase",
            background:mode===id?"var(--accent)":"transparent",color:mode===id?"#fff":"var(--ink3)",transition:"all .15s",
          }}>{label}</button>
        ))}
      </div>

      <div className="card" style={{padding:24}}>
        {/* Month + Year */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
          <div>
            <div className="lbl">Month</div>
            <select className="sel" value={month} onChange={e=>setMonth(Number(e.target.value))}>
              {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="lbl">Year</div>
            <select className="sel" value={year} onChange={e=>setYear(Number(e.target.value))}>
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Tenant picker */}
        {mode==="tenant" && (
          <div style={{marginBottom:18}}>
            <div className="lbl">Tenant</div>
            {tenants.length===0
              ? <div style={{fontSize:12,color:"var(--ink3)"}}>No tenants — add them in the Tenants tab first.</div>
              : <select className="sel" value={tenantId} onChange={e=>setTenantId(e.target.value)}>
                  {tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            }
          </div>
        )}

        {/* Bill input */}
        {mode==="bill" ? (
          <div>
            <div className="lbl">
              Total Bill Amount (R)

            </div>
            <input className="inp" type="number" step="any" value={billAmt} onChange={e=>setBillAmt(e.target.value)} placeholder="e.g. 2450.00" />
          </div>
        ) : (
          <>
            {/* Previous reading hint */}
            <div className="hint">
              {mode==="main"
                ? prevMain
                  ? <>Prev reading: <strong style={{color:"var(--ink)"}}>{fmtN(prevMain.reading,1)} kWh</strong> — {SHORT_MONTHS[prevMain.month-1]} {prevMain.year}</>
                  : "No previous main reading on record"
                : prevTenant
                  ? <>Prev reading: <strong style={{color:"var(--ink)"}}>{fmtN(prevTenant.reading,1)} kWh</strong> — {SHORT_MONTHS[prevTenant.month-1]} {prevTenant.year}</>
                  : "No previous reading for this tenant"
              }
            </div>
            <div>
              <div className="lbl">
                {mode==="main" ? "Main Meter Reading (kWh)" : "Tenant Meter Reading (kWh)"}

              </div>
              <input className="inp" type="number" step="any" value={reading} onChange={e=>setReading(e.target.value)} placeholder="e.g. 5124.7" />
              {reading && (()=>{
                const prev = mode==="main" ? prevMain?.reading : prevTenant?.reading;
                const delta = prev!=null ? parseFloat(reading)-prev : null;
                return delta!=null && !isNaN(delta) ? (
                  <div style={{fontSize:11,color:"var(--ink3)",marginTop:6}}>
                    Usage delta: <strong style={{color:delta>=0?"var(--green)":"var(--accent)"}}>{fmtN(delta,1)} kWh</strong>
                  </div>
                ) : null;
              })()}
            </div>
          </>
        )}

        <div style={{marginTop:20}}>
          <button className="btn" onClick={save} disabled={saving}>{saving?"Saving…":"Save →"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function History({ allMonths, computeMonth, fmtR, fmtN }) {
  return (
    <div>
      <div style={{fontFamily:"var(--serif)",fontSize:28,fontStyle:"italic",color:"var(--ink)",marginBottom:24}}>Billing History</div>
      {allMonths.length===0
        ? <div style={{color:"var(--ink3)",fontSize:13,textAlign:"center",padding:"60px 0"}}>No records yet.</div>
        : allMonths.map(({year,month})=>{
          const d = computeMonth(year,month);
          return (
            <div key={`${year}-${month}`} className="card" style={{marginBottom:16,overflow:"hidden"}}>
              <div style={{padding:"11px 18px",background:"var(--bg2)",borderBottom:"1px solid var(--rule)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontFamily:"var(--serif)",fontSize:18,fontStyle:"italic",color:"var(--ink)"}}>{SHORT_MONTHS[month-1]} {year}</div>
                <div style={{display:"flex",gap:16,alignItems:"center",fontSize:11,color:"var(--ink3)"}}>
                  <span>Main usage: <strong style={{color:"var(--ink)"}}>{d.mainDelta!=null?`${fmtN(d.mainDelta,1)} kWh`:"—"}</strong></span>
                  <span>Bill: <strong style={{color:"var(--accent)"}}>{d.billAmt!=null?fmtR(d.billAmt):"—"}</strong></span>
                  <button className="btn-sm" style={{fontSize:9,padding:"4px 10px"}} onClick={()=>printStatement(year,month,d)}>↓ PDF</button>
                </div>
              </div>
              <table>
                <thead><tr><th>Tenant</th><th>Usage (kWh)</th><th>Share</th><th>Amount</th></tr></thead>
                <tbody>
                  {d.tenantRows.map(row=>(
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.netDelta!=null?fmtN(row.netDelta,1):<span style={{color:"var(--ink3)"}}>—</span>}</td>
                      <td style={{color:"var(--ink3)"}}>{row.share!=null?`${(row.share*100).toFixed(1)}%`:"—"}</td>
                      <td style={{color:row.amount!=null?"var(--green)":"var(--ink3)",fontWeight:row.amount!=null?500:400}}>
                        {row.amount!=null?fmtR(row.amount):"—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      }
    </div>
  );
}

// ─── TENANTS ──────────────────────────────────────────────────────────────────
function Tenants({ sb, tenants, loadAll, showToast }) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingParent, setEditingParent] = useState(null); // tenant id being edited

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    const payload = { name: n, parent_tenant_id: parentId || null };
    const {error} = await sb.from("tenants").insert(payload);
    if (error) showToast(error.message,"err");
    else { showToast(`${n} added ✓`); setName(""); setParentId(""); await loadAll(); }
    setSaving(false);
  };

  const remove = async (id, tname) => {
    // Prevent removing a parent that has sub-tenants
    if (tenants.some(t => t.parent_tenant_id === id)) {
      showToast("Remove sub-tenants first","err"); return;
    }
    if (!confirm(`Remove ${tname}? This will also delete all their readings.`)) return;
    const {error} = await sb.from("tenants").delete().eq("id",id);
    if (error) showToast(error.message,"err");
    else { showToast(`${tname} removed`); await loadAll(); }
  };

  const saveParent = async (id, newParentId) => {
    const {error} = await sb.from("tenants").update({ parent_tenant_id: newParentId || null }).eq("id", id);
    if (error) showToast(error.message,"err");
    else { showToast("Sub-meter updated ✓"); setEditingParent(null); await loadAll(); }
  };

  // Sort: each parent immediately followed by its sub-tenants
  const sorted = tenants
    .filter(t => !t.parent_tenant_id)
    .flatMap(t => [t, ...tenants.filter(s => s.parent_tenant_id === t.id)]);

  return (
    <div style={{maxWidth:520}}>
      <div style={{fontFamily:"var(--serif)",fontSize:28,fontStyle:"italic",color:"var(--ink)",marginBottom:22}}>Tenants</div>

      {/* Add tenant form */}
      <div className="card" style={{padding:20,marginBottom:22}}>
        <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--ink2)",marginBottom:14,fontWeight:500,letterSpacing:".05em"}}>Add tenant</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <div className="lbl">Name</div>
            <input className="inp" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Tenant name" />
          </div>
          <div>
            <div className="lbl">Sub-meter of (optional)</div>
            <select className="sel" value={parentId} onChange={e=>setParentId(e.target.value)}>
              <option value="">— None (independent) —</option>
              {tenants.filter(t=>!t.parent_tenant_id).map(t=>(
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn" onClick={add} disabled={saving||!name.trim()}>+ Add</button>
      </div>

      {/* Tenant list */}
      {tenants.length===0
        ? <div style={{color:"var(--ink3)",fontSize:13,textAlign:"center",padding:"40px 0"}}>No tenants yet.</div>
        : <div className="card">
            {sorted.map((t,i)=>{
              const isSubTenant = !!t.parent_tenant_id;
              const parentName = isSubTenant ? tenants.find(p=>p.id===t.parent_tenant_id)?.name : null;
              const hasSubTenants = tenants.some(s=>s.parent_tenant_id===t.id);
              return (
                <div key={t.id} style={{
                  padding:"13px 16px",
                  borderBottom:i<sorted.length-1?"1px solid var(--bg3)":"none",
                  background: isSubTenant ? "var(--bg)" : "white",
                  paddingLeft: isSubTenant ? 32 : 16,
                }}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:14,color:"var(--ink)",display:"flex",alignItems:"center",gap:6}}>
                        {isSubTenant && <span style={{color:"var(--ink3)"}}>↳</span>}
                        {t.name}
                        {hasSubTenants && <span style={{fontSize:10,background:"var(--bg2)",color:"var(--ink3)",padding:"1px 6px",marginLeft:4}}>parent</span>}
                        {isSubTenant && <span style={{fontSize:10,color:"var(--ink3)"}}>sub of {parentName}</span>}
                      </div>
                      <div style={{fontSize:10,color:"var(--ink3)",marginTop:2}}>
                        Added {new Date(t.created_at).toLocaleDateString("en-ZA",{year:"numeric",month:"short",day:"numeric"})}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <button className="btn-sm" style={{fontSize:9,padding:"4px 10px"}}
                        onClick={()=>setEditingParent(editingParent===t.id?null:t.id)}>
                        {editingParent===t.id?"Cancel":"Edit sub-meter"}
                      </button>
                      <button className="btn-del" onClick={()=>remove(t.id,t.name)}>Remove</button>
                    </div>
                  </div>
                  {/* Inline parent editor */}
                  {editingParent===t.id && (
                    <div style={{marginTop:12,display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{flex:1}}>
                        <div className="lbl">Sub-meter of</div>
                        <select className="sel" defaultValue={t.parent_tenant_id||""}
                          onChange={e=>saveParent(t.id, e.target.value)}>
                          <option value="">— None (independent) —</option>
                          {tenants.filter(p=>p.id!==t.id&&!p.parent_tenant_id).map(p=>(
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}