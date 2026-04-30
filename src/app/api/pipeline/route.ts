import { NextResponse } from "next/server";
import { soqlQuery, soslSearch } from "@/lib/salesforce";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PipelineDeal {
  company: string;
  arr: number;
  source: "salesforce" | "intake";
  matchedField: string;
  note: string;
}

// ── Keywords ──────────────────────────────────────────────────────────────────

const KEYWORDS = ["e-invoicing","einvoicing","e-archiving","earchiving","e-reporting","ereporting"];

function containsKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return KEYWORDS.some(kw => lower.includes(kw));
}

function parseCompany(opportunityName: string): string {
  return opportunityName.split(/-(?:New Business|Renewal|Expansion|Amendment)/)[0].trim();
}

// ── Source: Salesforce (direct API) ──────────────────────────────────────────

const SF_OPP_FILTER = KEYWORDS.map(k => `NextStep LIKE '%${k}%'`).join(" OR ");

interface SFNote { Body: string; ParentId: string }
interface SFOpp  { Id: string; Name: string; Amount: number; ARR__c: number; NextStep: string; Description: string }

async function fetchSalesforceDeals(): Promise<PipelineDeal[]> {
  const seen  = new Set<string>();
  const deals: PipelineDeal[] = [];

  const addDeal = (company: string, arr: number, field: string, text: string) => {
    if (seen.has(company)) return;
    seen.add(company);
    deals.push({ company, arr, source: "salesforce", matchedField: field, note: text.slice(0, 300) });
  };

  // 1. Open opps where NextStep mentions e-invoicing (SOQL LIKE works on short text)
  const opps = await soqlQuery<SFOpp>(
    `SELECT Id, Name, ARR__c, Amount, NextStep, Description FROM Opportunity
     WHERE IsClosed = false AND (${SF_OPP_FILTER})
     LIMIT 200`
  );
  for (const o of opps) {
    const company = parseCompany(o.Name ?? "");
    if (!company) continue;
    const arr = o.ARR__c ?? o.Amount ?? 0;
    if (o.NextStep && containsKeyword(o.NextStep)) addDeal(company, arr, "Next Step", o.NextStep);
    else if (o.Description && containsKeyword(o.Description)) addDeal(company, arr, "Description", o.Description);
  }

  // 2. Description is a long text field — must use SOSL, then re-query open opps
  const soslTerm = "einvoicing OR earchiving OR ereporting";
  const soslOpps = await soslSearch<{ Id: string }>(
    `FIND {${soslTerm}} IN ALL FIELDS RETURNING Opportunity(Id LIMIT 200)`
  );
  if (soslOpps.length > 0) {
    const ids = [...new Set(soslOpps.map(o => o.Id))].map(id => `'${id}'`).join(",");
    const descOpps = await soqlQuery<SFOpp>(
      `SELECT Id, Name, ARR__c, Amount, NextStep, Description FROM Opportunity
       WHERE IsClosed = false AND Id IN (${ids}) LIMIT 200`
    );
    for (const o of descOpps) {
      const company = parseCompany(o.Name ?? "");
      if (!company) continue;
      const arr = o.ARR__c ?? o.Amount ?? 0;
      if (o.NextStep && containsKeyword(o.NextStep)) addDeal(company, arr, "Next Step", o.NextStep);
      else if (o.Description && containsKeyword(o.Description)) addDeal(company, arr, "Description", o.Description);
    }
  }

  // 3. Classic Notes — Body is long text, must use SOSL
  const notes = await soslSearch<SFNote>(
    `FIND {${soslTerm}} IN ALL FIELDS RETURNING Note(Body, ParentId LIMIT 200)`
  );
  const filteredNotes = notes.filter(n => containsKeyword(n.Body ?? ""));
  if (filteredNotes.length > 0) {
    const parentIds = [...new Set(filteredNotes.map(n => n.ParentId).filter(Boolean))];
    const idList    = parentIds.map(id => `'${id}'`).join(",");
    const noteOpps  = await soqlQuery<SFOpp>(
      `SELECT Id, Name, ARR__c, Amount FROM Opportunity WHERE IsClosed = false AND Id IN (${idList}) LIMIT 200`
    );
    const oppMap = new Map(noteOpps.map(o => [o.Id, o]));
    for (const n of filteredNotes) {
      const opp = oppMap.get(n.ParentId);
      if (!opp) continue;
      const company = parseCompany(opp.Name ?? "");
      if (!company) continue;
      addDeal(company, opp.ARR__c ?? opp.Amount ?? 0, "Opportunity Note", n.Body ?? "");
    }
  }

  return deals;
}

// ── Source: Intake form (Railway backend) ─────────────────────────────────────

interface IntakeRow {
  company_name: string;
  total_arr_estimate: string;
  needs_e_invoicing: string;
  e_invoicing_details: string;
}

async function fetchIntakeDeals(): Promise<PipelineDeal[]> {
  const baseUrl  = process.env.INTAKE_API_BASE_URL;
  const adminKey = process.env.INTAKE_ADMIN_API_KEY;
  if (!baseUrl || !adminKey || adminKey === "your_intake_admin_key") return [];

  const res = await fetch(`${baseUrl}/api/admin/intake-submissions.csv`, {
    headers: { "X-Admin-Key": adminKey },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Intake CSV fetch failed: ${res.status}`);

  const csv = await res.text();
  const lines = csv.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/^﻿/, ""));
  const idx = (col: string) => headers.indexOf(col);

  const iCompany     = idx("company_name");
  const iArr         = idx("total_arr_estimate");
  const iNeedsEInv   = idx("needs_e_invoicing");
  const iEInvDetails = idx("e_invoicing_details");

  const seen  = new Set<string>();
  const deals: PipelineDeal[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const needsEInv = (cols[iNeedsEInv] ?? "").toLowerCase();
    if (needsEInv !== "yes" && needsEInv !== "true") continue;
    const company = (cols[iCompany] ?? "").trim();
    if (!company || seen.has(company)) continue;
    seen.add(company);
    deals.push({
      company,
      arr: parseFloat(cols[iArr] ?? "") || 0,
      source: "intake",
      matchedField: "E-Invoicing Required",
      note: (cols[iEInvDetails] ?? "").slice(0, 300),
    });
  }
  return deals;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const results = await Promise.allSettled([
    fetchSalesforceDeals(),
    fetchIntakeDeals(),
  ]);

  const allDeals: PipelineDeal[] = [];
  const errors: string[] = [];

  const sourceNames = ["salesforce", "intake"] as const;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      allDeals.push(...r.value);
    } else {
      errors.push(`${sourceNames[i]}: ${r.reason?.message ?? r.reason}`);
      console.error(`Pipeline ${sourceNames[i]} error:`, r.reason);
    }
  }

  // Deduplicate across sources: keep first occurrence per company
  const seen = new Set<string>();
  const deals = allDeals.filter(d => {
    if (seen.has(d.company)) return false;
    seen.add(d.company);
    return true;
  });

  return NextResponse.json({
    deals,
    errors: errors.length ? errors : undefined,
    lastUpdated: new Date().toISOString(),
  });
}
