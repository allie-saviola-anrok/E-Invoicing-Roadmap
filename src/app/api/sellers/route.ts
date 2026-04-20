import { NextResponse } from "next/server";

// Omni API queries derived from the e-invoicing seller count reports.
// Non-local: live sellers with non-US, non-local juris registrations (easyFile/partnerFiles/sellerFiles).
// Local: sellers with .local juris_ids, complete registration, live, non-test.

const OMNI_API_URL = "https://anrok.omniapp.co/api/v1/query";
const MODEL_ID     = "7002b5da-4dcc-4aad-8f88-177009d582c9";
const TOPIC_ID     = "Seller Juris Versions";

async function queryOmni(prompt: string): Promise<Record<string, number | string>[]> {
  const res = await fetch(OMNI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OMNI_API_KEY}`,
    },
    body: JSON.stringify({ modelId: MODEL_ID, topicId: TOPIC_ID, prompt }),
    next: { revalidate: 3600 }, // cache for 1 hour
  });
  if (!res.ok) throw new Error(`Omni query failed: ${res.status}`);
  const data = await res.json();
  return data.result ?? [];
}

export async function GET() {
  try {
    const [nonLocalRows, localRows] = await Promise.all([
      queryOmni(
        "Count of distinct live sellers by juris_id where filing_flow_type is easyFile, partnerFiles, or sellerFiles, is_latest is true, juris_id does not start with 'us', juris_id does not contain 'local', and account_type is 'live'. Group by juris_id, order by count descending, limit 100."
      ),
      queryOmni(
        "List of seller names and juris_id where juris_id contains '.local', is_latest is true, registration_status is 'complete', seller is live, and seller is not a test account. Group by filing_frequency_type, juris_id, and seller name. Order by juris_id. Limit 1000."
      ),
    ]);

    // Build non-local map: juris_id (uppercase) → count
    const nonLocal: Record<string, number> = {};
    for (const row of nonLocalRows) {
      const code = String(row["Juris ID"] ?? "").toUpperCase();
      const count = Number(row["Seller ID Count Distinct"] ?? 0);
      if (code && code !== "EU-OSS" && !code.includes("-")) {
        nonLocal[code] = count;
      }
    }

    // Build local map: country code (from XX.local) → distinct seller count
    const localSellers: Record<string, Set<string>> = {};
    for (const row of localRows) {
      const jurisId = String(row["Juris ID"] ?? "");
      const name    = String(row["Name"] ?? "");
      // Extract country code from e.g. "GB.local", "DE.local", "CA-BC.local"
      const match = jurisId.match(/^([A-Z]{2})(?:-[A-Z]{2})?\.local$/i);
      if (!match) continue;
      const code = match[1].toUpperCase();
      if (!localSellers[code]) localSellers[code] = new Set();
      localSellers[code].add(name);
    }
    const local: Record<string, number> = {};
    for (const [code, names] of Object.entries(localSellers)) {
      local[code] = names.size;
    }

    return NextResponse.json({ nonLocal, local });
  } catch (err) {
    console.error("Seller counts API error:", err);
    return NextResponse.json({ error: "Failed to fetch seller counts" }, { status: 500 });
  }
}
