"use client";

import { useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Country {
  code: string;
  name: string;
  liveDate: string;
  scope: string;
  nonRes: "Yes" | "Upcoming" | "TBD" | "No";
  res: "Yes" | "Upcoming" | "No";
  localSellers: number;
  nonLocalSellers: number;
  pipeline: number;
  customerRequests?: string[];
  eezi: boolean;
  invopop: boolean;
}

interface Deal {
  company: string;
  arr: number;
  countryCode: string;
}

interface ComputedCountry extends Country {
  pipelineARR: number;
  deals: Deal[];
  priority: number;
}

interface ClosedLostDeal {
  company: string;
  arr: number;
  date: string;
  reason: string;
  countries?: string[];
}

// ── Data ─────────────────────────────────────────────────────────────────────
//
// Non-local seller counts come from the rules table only — they represent
// sellers actually in scope for that country's mandate, NOT all Anrok
// customers who file VAT there. Countries with no non-resident rules show
// "—" in the rules table and use 0 here, even if Anrok has non-local VAT
// filers in those markets (e.g. UAE has 13 non-local VAT filers but
// nonRes="No", so those sellers are not in scope for e-invoicing → 0).

const INITIAL_COUNTRIES: Country[] = [
  // ── Live mandates ────────────────────────────────────────────────────────────
  { code:"KR",     name:"South Korea",      liveDate:"2011",                                     scope:"B2B + B2G",       nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:21, pipeline:0, eezi:true,  invopop:false },
  { code:"TR",     name:"Turkey",           liveDate:"2012",                                     scope:"B2B + B2G",       nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:6,  pipeline:0, eezi:false, invopop:false },
  { code:"ID",     name:"Indonesia",        liveDate:"2016",                                     scope:"B2B + B2G",       nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:4,  pipeline:0, eezi:false, invopop:false },
  { code:"CH",     name:"Switzerland",      liveDate:"2016",                                     scope:"B2G only",        nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:31, pipeline:0, eezi:true,  invopop:false },
  { code:"IT",     name:"Italy",            liveDate:"Jan 2019",                                 scope:"B2B + B2G",       nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"EE",     name:"Estonia",          liveDate:"2019",                                     scope:"B2G only",        nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"LU",     name:"Luxembourg",       liveDate:"2019",                                     scope:"B2G only",        nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"SE",     name:"Sweden",           liveDate:"2019",                                     scope:"B2G only",        nonRes:"No",  res:"Yes",      localSellers:1,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"LT",     name:"Lithuania",        liveDate:"2019",                                     scope:"B2G only",        nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"IN",     name:"India",            liveDate:"2020",                                     scope:"B2B + B2G",       nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:29, pipeline:0, eezi:true,  invopop:false },
  { code:"IS",     name:"Iceland",          liveDate:"2020",                                     scope:"B2G only",        nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:1,  pipeline:0, eezi:true,  invopop:false },
  { code:"AL",     name:"Albania",          liveDate:"2021",                                     scope:"B2B + B2G",       nonRes:"Yes", res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:1, eezi:false, invopop:false, customerRequests:["Notion","Anthropic"] },
  { code:"SA",     name:"Saudi Arabia",     liveDate:"2021",                                     scope:"B2B + B2C + B2G", nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:1,  pipeline:0, eezi:true,  invopop:true  },
  { code:"AU",     name:"Australia",        liveDate:"2022",                                     scope:"B2G only",        nonRes:"No",  res:"Yes",      localSellers:1,  nonLocalSellers:47, pipeline:0, eezi:false, invopop:true  },
  { code:"VN",     name:"Vietnam",          liveDate:"2022",                                     scope:"B2B + B2C + B2G", nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:4,  pipeline:0, eezi:false, invopop:false },
  { code:"TW",     name:"Taiwan",           liveDate:"Jan 2020 (non-res); Jan 2021 (locals)",    scope:"B2B + B2C",       nonRes:"Yes", res:"Yes",      localSellers:0,  nonLocalSellers:3,  pipeline:0, eezi:true,  invopop:false },
  { code:"RS",     name:"Serbia",           liveDate:"Jan 2023",                                 scope:"B2B + B2G",       nonRes:"Yes", res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:1, eezi:false, invopop:false, customerRequests:["Anthropic"] },
  { code:"RO",     name:"Romania",          liveDate:"Jan 2024",                                 scope:"B2B",             nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"IL",     name:"Israel",           liveDate:"May 2024",                                 scope:"B2B",             nonRes:"No",  res:"Yes",      localSellers:1,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"DE",     name:"Germany",          liveDate:"Jan 2025 (receive); Jan 2027–2028 (send)", scope:"B2B",             nonRes:"No",  res:"Yes",      localSellers:2,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"MY",     name:"Malaysia",         liveDate:"Jul 2025 (phased by revenue)",             scope:"B2B + B2C + B2G", nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:5,  pipeline:0, eezi:true,  invopop:true  },
  { code:"JO",     name:"Jordan",           liveDate:"2025",                                     scope:"B2B + B2C + B2G", nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"NG",     name:"Nigeria",          liveDate:"2025",                                     scope:"TBD",             nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:1,  pipeline:0, eezi:true,  invopop:false },
  { code:"BE",     name:"Belgium",          liveDate:"Jan 2026",                                 scope:"B2B",             nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"PT",     name:"Portugal",         liveDate:"Jan 2026",                                 scope:"B2B + B2G",       nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"HR",     name:"Croatia",          liveDate:"Jan 2026",                                 scope:"B2B",             nonRes:"TBD", res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"CM",     name:"Cameroon",         liveDate:"2026",                                     scope:"—",               nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:false, invopop:false },
  { code:"MK",     name:"North Macedonia",  liveDate:"2026",                                     scope:"—",               nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:false, invopop:false },
  { code:"PL",     name:"Poland",           liveDate:"Feb–Apr 2026 (phased)",                    scope:"B2B + B2G",       nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"GR",     name:"Greece",           liveDate:"Feb 2026 (large); Oct 2026 (all)",         scope:"B2B + B2G",       nonRes:"TBD", res:"Yes",      localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"MX",     name:"Mexico",           liveDate:"2014 (res); Apr 2026 (non-res)",            scope:"B2B + B2C",       nonRes:"Yes", res:"Yes",      localSellers:0,  nonLocalSellers:2,  pipeline:0, eezi:true,  invopop:true  },
  { code:"SG",     name:"Singapore",        liveDate:"Nov 2025 (new vol); 2028–31 (exist)",      scope:"B2B",             nonRes:"No",  res:"Yes",      localSellers:0,  nonLocalSellers:10, pipeline:0, eezi:false, invopop:true  },
  // ── Upcoming mandates ────────────────────────────────────────────────────────
  { code:"FR",     name:"France",           liveDate:"Sep 2026 (large/mid); Sep 2027 (SME)",     scope:"B2B",             nonRes:"No",  res:"Upcoming", localSellers:1,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"NZ",     name:"New Zealand",      liveDate:"2026–2027",                                scope:"B2G only",        nonRes:"No",  res:"Upcoming", localSellers:0,  nonLocalSellers:15, pipeline:0, eezi:false, invopop:true  },
  { code:"KH",     name:"Cambodia",         liveDate:"2027",                                     scope:"—",               nonRes:"No",  res:"Upcoming", localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:false, invopop:false },
  { code:"AE",     name:"UAE",              liveDate:"Jan 2027 (large); Jul 2026 pilot",         scope:"B2B + B2G",       nonRes:"No",  res:"Upcoming", localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:false, invopop:true  },
  { code:"ES",     name:"Spain",            liveDate:"2027–2028",                                scope:"B2B",             nonRes:"No",  res:"Upcoming", localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"ZA",     name:"South Africa",     liveDate:"~2028",                                    scope:"B2B + B2G",       nonRes:"No",  res:"Upcoming", localSellers:0,  nonLocalSellers:11, pipeline:0, eezi:false, invopop:false },
  { code:"GB",     name:"United Kingdom",   liveDate:"~2029",                                    scope:"B2B",             nonRes:"No",  res:"Upcoming", localSellers:13, nonLocalSellers:96, pipeline:0, eezi:true,  invopop:false },
  { code:"IE",     name:"Ireland",          liveDate:"2028–2030 (ViDA)",                         scope:"B2B",             nonRes:"No",  res:"Upcoming", localSellers:4,  nonLocalSellers:0,  pipeline:0, eezi:false, invopop:false },
  { code:"NO",     name:"Norway",           liveDate:"2028–2030",                                scope:"B2B + B2G",       nonRes:"No",  res:"Upcoming", localSellers:0,  nonLocalSellers:22, pipeline:0, eezi:true,  invopop:true  },
  { code:"DK",     name:"Denmark",          liveDate:"~2030",                                    scope:"B2B + B2G",       nonRes:"No",  res:"Upcoming", localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
  { code:"AT",     name:"Austria",          liveDate:"~2030",                                    scope:"B2B + B2G",       nonRes:"No",  res:"Upcoming", localSellers:0,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"NL",     name:"Netherlands",      liveDate:"~2030 (ViDA)",                             scope:"B2B",             nonRes:"No",  res:"Upcoming", localSellers:2,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"SE_VIDA",name:"Sweden (ViDA B2B)",liveDate:"~2030 (ViDA)",                             scope:"B2B",             nonRes:"No",  res:"Upcoming", localSellers:1,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:false },
  { code:"FI",     name:"Finland",          liveDate:"~2030 (ViDA)",                             scope:"B2B",             nonRes:"No",  res:"Upcoming", localSellers:1,  nonLocalSellers:0,  pipeline:0, eezi:true,  invopop:true  },
];

const CLOSED_LOST: ClosedLostDeal[] = [
  { company:"Airwallex",           arr:100000, date:"Feb 2026", reason:"Chose Fonoa; e-invoicing 'checked every single box'", countries:[] },
  { company:"Rhapsody",            arr:140000, date:"",         reason:"",                                                    countries:["Denmark","France","United Kingdom"] },
  { company:"Witbe",               arr:45000,  date:"Apr 2026", reason:"Couldn't guarantee France e-invoicing by Sept 2026",  countries:["France"] },
  { company:"SirionLabs",          arr:31988,  date:"Feb 2025", reason:"Wanted e-invoicing as hard requirement",              countries:[] },
  { company:"Tive Inc.",           arr:30000,  date:"Dec 2025", reason:"E-invoicing among missing features",                  countries:[] },
  { company:"Plusgrade",           arr:10000,  date:"Jan 2026", reason:"E-invoicing primary requirement; will re-engage",     countries:[] },
  { company:"Datasnipper",         arr:20000,  date:"",         reason:"Surfaced by Dhiv, Feb 2026",                          countries:["Belgium","France","Saudi Arabia","Luxembourg"] },
  { company:"Automation Anywhere", arr:0,      date:"Feb 2024", reason:"Needs e-invoicing in 4 countries before US",          countries:[] },
];

const VIDA_MILESTONES = [
  { year:2025, label:"ViDA in force" },
  { year:2027, label:"OSS expansion" },
  { year:2028, label:"SVR + expanded OSS" },
  { year:2030, label:"Mandatory cross-border B2B e-invoicing (all EU)" },
  { year:2035, label:"Domestic systems harmonize to EN 16931" },
];

// ── Priority formula ──────────────────────────────────────────────────────────

const ARR_ELEVATION_THRESHOLD = 100_000;

type CalcInput = Omit<ComputedCountry, "priority">;

function calcPriority({ nonRes, res, localSellers: H, nonLocalSellers: I, pipeline: J, pipelineARR: ARR = 0 }: CalcInput): number {
  let score: number;
  if      (nonRes === "Yes" && I > 0)                                                           score = 7;
  else if (nonRes === "Yes" && J > 0)                                                           score = 6;
  else if (res === "Yes"    && H > 0)                                                           score = 5;
  else if ((res === "Yes" && J > 0) || (res === "Upcoming" && H > 0 && J > 0))                 score = 4;
  else if ((res === "Upcoming" || nonRes === "Upcoming") && (H > 0 || I > 0 || J > 0))         score = 3;
  else if (res === "Upcoming" || nonRes === "Upcoming")                                         score = 2;
  else                                                                                           score = 1;

  if (ARR >= ARR_ELEVATION_THRESHOLD && score < 5) score = Math.min(5, score + 1);
  return score;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PM: Record<number, { bg: string; text: string; label: string }> = {
  7: { bg:"#dc2626", text:"#fff",    label:"Live non-res rules + non-local sellers" },
  6: { bg:"#ea580c", text:"#fff",    label:"Live non-res rules + pipeline" },
  5: { bg:"#d97706", text:"#fff",    label:"Live resident rules + local sellers" },
  4: { bg:"#ca8a04", text:"#1a1a1a", label:"Live resident rules + pipeline" },
  3: { bg:"#16a34a", text:"#fff",    label:"Upcoming rules + in-scope exposure" },
  2: { bg:"#0891b2", text:"#fff",    label:"Upcoming rules, no in-scope exposure" },
  1: { bg:"#6b7280", text:"#fff",    label:"No rules or far-away rules" },
};

const TIMELINE_START = 2019;
const TIMELINE_END   = 2035;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFirstYear(s: string): number {
  const m = s.match(/\d{4}/);
  return m ? parseInt(m[0]) : 2035;
}

function parseYearRange(s: string): { start: number; end: number } {
  const nums = [...s.matchAll(/\d{4}/g)].map(m => parseInt(m[0]));
  if (!nums.length) return { start:2030, end:2032 };
  return { start: nums[0], end: nums[nums.length-1] + 1 };
}

function pct(y: number): number {
  return ((y - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100;
}

const fmtArr = (n: number): string => n ? `$${n.toLocaleString()}` : "—";

// ── UI atoms ──────────────────────────────────────────────────────────────────

function Badge({ p }: { p: number }) {
  const m = PM[p];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:"50%", fontWeight:700, fontSize:12, background:m.bg, color:m.text, flexShrink:0 }}>
      {p}
    </span>
  );
}

function ResTag({ value }: { value: string }) {
  const styles: Record<string, string[]> = { Yes:["#dcfce7","#15803d"], Upcoming:["#fef9c3","#854d0e"], TBD:["#fef3c7","#92400e"], No:["#f1f5f9","#64748b"] };
  const s = styles[value] ?? ["#f1f5f9","#64748b"];
  return <span style={{ fontSize:11, padding:"2px 7px", borderRadius:10, fontWeight:600, background:s[0], color:s[1] }}>{value}</span>;
}

function InlineEdit({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [on, setOn]       = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const n = parseInt(draft);
    onChange(isNaN(n) || n < 0 ? 0 : n);
    setOn(false);
  }

  if (on) return (
    <input autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key==="Enter") commit(); if (e.key==="Escape") setOn(false); }}
      style={{ width:40, textAlign:"center", border:"1px solid #3b82f6", borderRadius:4, padding:"2px 4px", fontSize:13 }}
    />
  );
  return (
    <span onClick={() => { setDraft(String(value)); setOn(true); }}
      title="Click to edit"
      style={{ cursor:"pointer", borderBottom:"1px dashed #94a3b8", padding:"1px 3px", fontSize:13, userSelect:"none" }}>
      {value === 0 ? "—" : value}
    </span>
  );
}

// ── Add Deal Modal ────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = { display:"block", fontSize:11, fontWeight:700, color:"#6b7280", marginBottom:4, marginTop:14, letterSpacing:"0.05em" };
const inp: React.CSSProperties = { width:"100%", padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6, fontSize:14, boxSizing:"border-box" };
const btnP: React.CSSProperties = { padding:"8px 18px", border:"none", borderRadius:6, background:"#1d4ed8", color:"#fff", cursor:"pointer", fontWeight:600, fontSize:14 };
const btnS: React.CSSProperties = { padding:"8px 18px", border:"1px solid #d1d5db", borderRadius:6, background:"#fff", cursor:"pointer", fontSize:14 };

function AddDealModal({ countries, onAdd, onClose }: { countries: ComputedCountry[]; onAdd: (d: Deal) => void; onClose: () => void }) {
  const [form, setForm] = useState({ company:"", arr:"", countryCode:"" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company || !form.countryCode) return;
    onAdd({ company:form.company, arr:parseInt(form.arr)||0, countryCode:form.countryCode });
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
      <div style={{ background:"#fff", borderRadius:12, padding:28, width:420, boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <h3 style={{ margin:"0 0 4px", fontSize:18, fontWeight:700 }}>Add Pipeline Deal</h3>
        <p style={{ margin:"0 0 4px", fontSize:12, color:"#64748b" }}>Adding a deal increments that country&apos;s pipeline count and recalculates its priority.</p>
        <form onSubmit={submit}>
          <label style={lbl}>COMPANY NAME</label>
          <input value={form.company} onChange={e=>set("company",e.target.value)} placeholder="e.g. Benchling" style={inp} required />
          <label style={lbl}>ARR ($)</label>
          <input type="number" value={form.arr} onChange={e=>set("arr",e.target.value)} placeholder="e.g. 100000" style={inp} />
          <label style={lbl}>COUNTRY REQUIRING E-INVOICING</label>
          <select value={form.countryCode} onChange={e=>set("countryCode",e.target.value)} style={inp} required>
            <option value="">Select country...</option>
            {countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:22 }}>
            <button type="button" onClick={onClose} style={btnS}>Cancel</button>
            <button type="submit" style={btnP}>Add Deal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Phase Board ───────────────────────────────────────────────────────────────

function PhaseBoard({ countries }: { countries: ComputedCountry[] }) {
  const cols = [7,6,5,4,3,2,1]
    .map(p => ({ p, items: countries.filter(c=>c.priority===p).sort((a,b)=>parseFirstYear(a.liveDate)-parseFirstYear(b.liveDate)) }))
    .filter(col=>col.items.length>0);

  return (
    <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:16, alignItems:"flex-start" }}>
      {cols.map(col=>(
        <div key={col.p} style={{ minWidth:215, maxWidth:245, flexShrink:0 }}>
          <div style={{ background:PM[col.p].bg, color:PM[col.p].text, padding:"8px 12px", borderRadius:"8px 8px 0 0", fontWeight:700, fontSize:12, textAlign:"center" }}>
            P{col.p} · {col.items.length} countr{col.items.length===1?"y":"ies"}
          </div>
          <div style={{ border:`2px solid ${PM[col.p].bg}`, borderTop:"none", borderRadius:"0 0 8px 8px" }}>
            {col.items.map((c,i)=>(
              <div key={c.code} style={{ padding:"10px 12px", borderTop:i>0?"1px solid #f1f5f9":"none", background:i%2===0?"#fff":"#f8fafc" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:6 }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{c.name}</span>
                  <span style={{ fontSize:10, color:"#64748b", whiteSpace:"nowrap", flexShrink:0, paddingTop:2 }}>
                    {c.liveDate.split(";")[0].replace(/\(.*?\)/g,"").trim()}
                  </span>
                </div>
                <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{c.scope}</div>
                <div style={{ display:"flex", gap:4, marginTop:5, flexWrap:"wrap" }}>
                  {(c.res === "Yes" || c.res === "Upcoming") && (
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, fontWeight:600, background:c.res==="Yes"?"#dcfce7":"#fef9c3", color:c.res==="Yes"?"#15803d":"#854d0e" }}>
                      Local{c.res==="Upcoming"?" (upcoming)":""}
                    </span>
                  )}
                  {(c.nonRes === "Yes" || c.nonRes === "Upcoming") && (
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, fontWeight:600, background:c.nonRes==="Yes"?"#dbeafe":"#fef9c3", color:c.nonRes==="Yes"?"#1d4ed8":"#854d0e" }}>
                      Non-local{c.nonRes==="Upcoming"?" (upcoming)":""}
                    </span>
                  )}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6, fontSize:11, color:"#475569" }}>
                  {c.localSellers    > 0 && <span>🏠 {c.localSellers} local</span>}
                  {c.nonLocalSellers > 0 && <span>🌐 {c.nonLocalSellers} non-local</span>}
                  {c.customerRequests && c.customerRequests.length > 0
                    ? <span title="Existing customer requests">🏢 {c.customerRequests.join(", ")}</span>
                    : c.pipeline > 0 && <span>📋 {c.pipeline} pipeline</span>}
                </div>
                {c.deals?.length>0 && (
                  <div style={{ marginTop:6 }}>
                    {c.deals.map((d,di)=>(
                      <div key={di} style={{ display:"flex", justifyContent:"space-between", background:"#eff6ff", borderRadius:4, padding:"3px 7px", marginTop:2, fontSize:11 }}>
                        <span style={{ color:"#1d4ed8", fontWeight:600 }}>{d.company}</span>
                        {d.arr>0 && <span style={{ color:"#1d4ed8" }}>{fmtArr(d.arr)}</span>}
                      </div>
                    ))}
                    {c.pipelineARR >= ARR_ELEVATION_THRESHOLD && (
                      <div style={{ fontSize:10, color:"#7c3aed", marginTop:4, fontWeight:600 }}>
                        ↑ ARR-elevated · {fmtArr(c.pipelineARR)} pipeline
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ countries }: { countries: ComputedCountry[] }) {
  const sorted = [...countries].sort((a,b)=>parseFirstYear(a.liveDate)-parseFirstYear(b.liveDate));
  const years  = Array.from({ length: TIMELINE_END-TIMELINE_START+1 }, (_,i)=>TIMELINE_START+i);

  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ marginBottom:10, padding:"7px 12px", background:"#eff6ff", borderRadius:6, fontSize:12, color:"#1d4ed8", border:"1px solid #bfdbfe" }}>
        <strong>ViDA:</strong> Apr 2025 in force · Jul 2028 SVR + expanded OSS · <strong>Jul 2030 mandatory cross-border B2B e-invoicing (all EU)</strong> · 2035 harmonization
      </div>
      <div style={{ position:"relative", minWidth:1000 }}>
        <div style={{ display:"flex", paddingLeft:170, marginBottom:4 }}>
          {years.map(y=>(
            <div key={y} style={{ flex:`0 0 ${100/(TIMELINE_END-TIMELINE_START)}%`, fontSize:10, color:y%5===0?"#374151":"#9ca3af", fontWeight:y%5===0?700:400, borderLeft:"1px solid #e5e7eb", paddingLeft:2 }}>
              {y}
            </div>
          ))}
        </div>
        {VIDA_MILESTONES.map(m=>(
          <div key={m.year} style={{ position:"absolute", left:`calc(170px + ${pct(m.year)}%)`, top:0, bottom:0, borderLeft:"2px dashed #bfdbfe", zIndex:0, pointerEvents:"none" }} />
        ))}
        {sorted.map(c=>{
          const { start, end } = parseYearRange(c.liveDate);
          const left  = Math.max(0, pct(start));
          const width = Math.min(100-left, Math.max(pct(end)-pct(start), 1.5));
          const m     = PM[c.priority];
          return (
            <div key={c.code} style={{ display:"flex", alignItems:"center", height:28, marginBottom:3 }}>
              <div style={{ width:170, flexShrink:0, display:"flex", alignItems:"center", gap:6, paddingRight:8 }}>
                <Badge p={c.priority} />
                <span style={{ fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
              </div>
              <div style={{ flex:1, position:"relative", height:"100%", display:"flex", alignItems:"center" }}>
                {years.map(y=><div key={y} style={{ position:"absolute", left:`${pct(y)}%`, top:0, bottom:0, borderLeft:"1px solid #f3f4f6" }} />)}
                <div style={{ position:"absolute", left:`${left}%`, width:`${width}%`, height:18, background:m.bg, borderRadius:4, opacity:0.88, display:"flex", alignItems:"center", overflow:"hidden" }}>
                  <span style={{ color:m.text, fontSize:10, fontWeight:600, paddingLeft:5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.liveDate}</span>
                </div>
                {c.deals?.map((d,di)=>(
                  <div key={di} title={`${d.company} — ${fmtArr(d.arr)}`}
                    style={{ position:"absolute", left:`${left}%`, top:1, width:8, height:8, borderRadius:"50%", background:"#1d4ed8", border:"2px solid #fff", transform:`translateX(${di*11+2}px)`, zIndex:1 }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function Table({ countries, onUpdate }: { countries: ComputedCountry[]; onUpdate: (code: string, field: string, val: number) => void }) {
  const sorted = [...countries].sort((a,b)=>b.priority-a.priority||parseFirstYear(a.liveDate)-parseFirstYear(b.liveDate));
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
            {["P","Country","Mandate Date","Scope","Non-Res","Resident","Local","Non-Local","Pipeline","Deals","Eezi","Invopop"].map(h=>(
              <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748b", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c,i)=>(
            <tr key={c.code} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"#fff":"#f8fafc" }}>
              <td style={{ padding:"8px 10px" }}><Badge p={c.priority} /></td>
              <td style={{ padding:"8px 10px", fontWeight:600 }}>{c.name}</td>
              <td style={{ padding:"8px 10px", color:"#475569", fontSize:12 }}>{c.liveDate}</td>
              <td style={{ padding:"8px 10px", color:"#475569", fontSize:12 }}>{c.scope}</td>
              <td style={{ padding:"8px 10px" }}><ResTag value={c.nonRes} /></td>
              <td style={{ padding:"8px 10px" }}><ResTag value={c.res} /></td>
              <td style={{ padding:"8px 10px", textAlign:"center" }}><InlineEdit value={c.localSellers}    onChange={v=>onUpdate(c.code,"localSellers",v)} /></td>
              <td style={{ padding:"8px 10px", textAlign:"center" }}><InlineEdit value={c.nonLocalSellers} onChange={v=>onUpdate(c.code,"nonLocalSellers",v)} /></td>
              <td style={{ padding:"8px 10px", textAlign:"center" }}><InlineEdit value={c.pipeline}        onChange={v=>onUpdate(c.code,"pipeline",v)} /></td>
              <td style={{ padding:"8px 10px" }}>
                {c.deals?.length
                  ? c.deals.map((d,di)=><div key={di} style={{ fontSize:11, color:"#1d4ed8" }}>{d.company}{d.arr?` · ${fmtArr(d.arr)}`:""}</div>)
                  : <span style={{ color:"#d1d5db" }}>—</span>}
              </td>
              <td style={{ padding:"8px 10px", textAlign:"center" }}>
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600, background:c.eezi?"#dcfce7":"#f1f5f9", color:c.eezi?"#15803d":"#94a3b8" }}>{c.eezi?"Yes":"No"}</span>
              </td>
              <td style={{ padding:"8px 10px", textAlign:"center" }}>
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600, background:c.invopop?"#dbeafe":"#f1f5f9", color:c.invopop?"#1d4ed8":"#94a3b8" }}>{c.invopop?"Yes":"No"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Roadmap() {
  const [view,         setView]     = useState("phases");
  const [rawCountries, setRaw]      = useState<Country[]>(INITIAL_COUNTRIES);
  const [deals,        setDeals]    = useState<Deal[]>([
    { company:"Benchling",   arr:100000, countryCode:"FR" },
    { company:"Rhapsody",    arr:155000, countryCode:"DK" },
    { company:"Rhapsody",    arr:0,      countryCode:"FR" },
    { company:"Rhapsody",    arr:0,      countryCode:"GB" },
  ]);
  const [showModal,    setShowModal]    = useState(false);
  const [showCL,       setShowCL]       = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);

  const countries = useMemo<ComputedCountry[]>(()=>rawCountries.map(c=>{
    const cDeals      = deals.filter(d=>d.countryCode===c.code);
    const pipelineARR = cDeals.reduce((sum,d)=>sum+(d.arr||0), 0);
    const merged      = { ...c, pipeline:c.pipeline+cDeals.length, pipelineARR, deals:cDeals };
    return { ...merged, priority:calcPriority(merged) };
  }), [rawCountries, deals]);

  function updateField(code: string, field: string, val: number) {
    setRaw(prev=>prev.map(c=>c.code===code?{...c,[field]:val}:c));
  }

  const companyMaxArr = deals.reduce<Record<string,number>>((acc,d)=>{ acc[d.company]=Math.max(acc[d.company]||0,d.arr||0); return acc; },{});
  const pipelineArr   = Object.values(companyMaxArr).reduce((s,v)=>s+v,0);
  const closedLostArr = CLOSED_LOST.reduce((s,d)=>s+(d.arr||0),0);
  const p7 = countries.filter(c=>c.priority===7);
  const p6 = countries.filter(c=>c.priority===6);

  return (
    <div style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background:"#f8fafc", minHeight:"100vh" }}>

      {/* Header */}
      <div style={{ background:"#0f172a", color:"#fff", padding:"20px 28px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, letterSpacing:"-0.4px" }}>Anrok E-Invoicing Mandate Roadmap</h1>
            <p style={{ margin:"4px 0 0", fontSize:13, color:"#94a3b8" }}>
              {countries.length} countries · click seller &amp; pipeline counts to edit · priority scores update live
            </p>
          </div>
          <button onClick={()=>setShowModal(true)} style={{ ...btnP, padding:"9px 18px" }}>+ Add Pipeline Deal</button>
        </div>
        <div style={{ display:"flex", gap:14, marginTop:18, flexWrap:"wrap" }}>
          {[
            { label:"P7 — Act now",        val:p7.length?p7.map(c=>c.name).join(", "):"None", sub:"Live non-res mandate + non-local sellers",  accent:"#ef4444" },
            { label:"P6 — High urgency",   val:p6.length?p6.map(c=>c.name).join(", "):"None", sub:"Live non-res mandate + pipeline",           accent:"#f97316" },
            { label:"Pipeline ARR at risk",val:fmtArr(pipelineArr),   sub:"Click to expand",                                                   accent:"#3b82f6", onClick:()=>setShowPipeline(v=>!v) },
            { label:"Closed-lost to gap",  val:fmtArr(closedLostArr), sub:"Click to expand",                                                   accent:"#dc2626", onClick:()=>setShowCL(v=>!v) },
          ].map(s=>(
            <div key={s.label} onClick={s.onClick} style={{ background:"#1e293b", borderRadius:8, padding:"10px 14px", minWidth:190, cursor:s.onClick?"pointer":"default", border:"1px solid #334155" }}>
              <div style={{ fontSize:11, color:"#64748b", fontWeight:700, marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:16, fontWeight:700, color:s.accent }}>{s.val}</div>
              <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Closed-lost panel */}
      {showCL && (
        <div style={{ background:"#fef2f2", borderBottom:"1px solid #fecaca", padding:"12px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontWeight:700, color:"#dc2626", fontSize:13 }}>Closed Lost — E-Invoicing Gap ({fmtArr(closedLostArr)} total)</span>
            <button onClick={()=>setShowCL(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:20, lineHeight:1 }}>×</button>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {CLOSED_LOST.map((d,i)=>(
              <div key={i} style={{ background:"#fff", border:"1px solid #fecaca", borderRadius:8, padding:"8px 12px", minWidth:200, maxWidth:240 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{d.company}</div>
                <div style={{ fontSize:13, color:"#dc2626", fontWeight:700 }}>{fmtArr(d.arr)}</div>
                {d.countries && d.countries.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:5 }}>
                    {d.countries.map(c=>(
                      <span key={c} style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:"#fee2e2", color:"#b91c1c", fontWeight:600 }}>{c}</span>
                    ))}
                  </div>
                )}
                {d.reason && <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>{d.reason}</div>}
                {d.date   && <div style={{ fontSize:10, color:"#9ca3af", marginTop:2 }}>{d.date}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline panel */}
      {showPipeline && (
        <div style={{ background:"#eff6ff", borderBottom:"1px solid #bfdbfe", padding:"12px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontWeight:700, color:"#1d4ed8", fontSize:13 }}>Active Pipeline — E-Invoicing Requirement ({fmtArr(pipelineArr)} total)</span>
            <button onClick={()=>setShowPipeline(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#1d4ed8", fontSize:20, lineHeight:1 }}>×</button>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {Object.values(deals.reduce<Record<string,{company:string;arr:number;countryCodes:string[]}>>((acc,d)=>{
              if (!acc[d.company]) acc[d.company] = { company:d.company, arr:0, countryCodes:[] };
              acc[d.company].arr = Math.max(acc[d.company].arr, d.arr||0);
              acc[d.company].countryCodes.push(d.countryCode);
              return acc;
            },{})).map(g=>{
              const names = g.countryCodes.map(code=>countries.find(c=>c.code===code)?.name||code);
              return (
                <div key={g.company} style={{ background:"#fff", border:"1px solid #bfdbfe", borderRadius:8, padding:"8px 12px", minWidth:200, maxWidth:240 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <span style={{ fontWeight:700, fontSize:13 }}>{g.company}</span>
                    <span onClick={()=>setDeals(prev=>prev.filter(d=>d.company!==g.company))} style={{ cursor:"pointer", color:"#94a3b8", fontWeight:700, fontSize:16, lineHeight:1, marginLeft:6 }}>×</span>
                  </div>
                  {g.arr>0 && <div style={{ fontSize:13, color:"#1d4ed8", fontWeight:700 }}>{fmtArr(g.arr)}</div>}
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:5 }}>
                    {names.map(n=>(
                      <span key={n} style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:"#dbeafe", color:"#1d4ed8", fontWeight:600 }}>{n}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View tabs */}
      <div style={{ padding:"14px 28px 0", display:"flex", alignItems:"center", gap:6 }}>
        {[{id:"phases",label:"Phase Board"},{id:"timeline",label:"Timeline"},{id:"table",label:"Table"}].map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} style={{ padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:600, border:view===v.id?"none":"1px solid #e2e8f0", background:view===v.id?"#0f172a":"#fff", color:view===v.id?"#fff":"#64748b" }}>
            {v.label}
          </button>
        ))}
        <span style={{ marginLeft:"auto", fontSize:11, color:"#94a3b8" }}>Edit local / non-local / pipeline counts in Table view</span>
      </div>

      {/* Main view */}
      <div style={{ padding:"14px 28px 28px" }}>
        {view==="phases"   && <PhaseBoard countries={countries} />}
        {view==="timeline" && <Timeline   countries={countries} />}
        {view==="table"    && <Table      countries={countries} onUpdate={updateField} />}
      </div>

      {/* Legend */}
      <div style={{ padding:"0 28px 32px" }}>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"12px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:8, letterSpacing:"0.05em" }}>PRIORITY SCORING</div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10 }}>
            {[7,6,5,4,3,2,1].map(p=>(
              <div key={p} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <Badge p={p} />
                <span style={{ fontSize:11, color:"#475569" }}>{PM[p].label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#7c3aed", borderTop:"1px solid #f1f5f9", paddingTop:8 }}>
            <strong>ARR elevation:</strong> pipeline ARR ≥ ${ARR_ELEVATION_THRESHOLD.toLocaleString()} bumps base score +1 tier (max P5). Shown as <strong>↑ ARR-elevated</strong> on country cards.
          </div>
        </div>
      </div>

      {showModal && <AddDealModal countries={countries} onAdd={d=>setDeals(prev=>[...prev,d])} onClose={()=>setShowModal(false)} />}
    </div>
  );
}
