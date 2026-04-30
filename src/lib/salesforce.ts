import { SignJWT, importPKCS8 } from "jose";

interface SalesforceToken {
  access_token: string;
  instance_url: string;
}

// Cache token for up to 55 minutes (SF tokens expire at 1 hour)
let tokenCache: { token: SalesforceToken; expiresAt: number } | null = null;

export async function getSalesforceToken(): Promise<SalesforceToken> {
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt) return tokenCache.token;

  const clientId  = process.env.SALESFORCE_CLIENT_ID!;
  const username  = process.env.SALESFORCE_USERNAME!;
  const loginUrl  = process.env.SALESFORCE_INSTANCE_URL ?? "https://login.salesforce.com";
  // .env stores newlines as literal \n — convert back
  const pemRaw    = (process.env.SALESFORCE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  const privateKey = await importPKCS8(pemRaw, "RS256");

  const assertion = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(clientId)
    .setSubject(username)
    .setAudience(loginUrl)
    .setExpirationTime("3m")
    .sign(privateKey);

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Salesforce auth failed: ${res.status} ${err}`);
  }

  const token: SalesforceToken = await res.json();
  tokenCache = { token, expiresAt: now + 55 * 60 * 1000 };
  return token;
}

export async function soqlQuery<T>(soql: string): Promise<T[]> {
  const { access_token, instance_url } = await getSalesforceToken();
  const url = `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SOQL query failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.records ?? [];
}

// SOSL full-text search — required for long text fields (Note.Body, Opportunity.Description)
// searchTerm should be space-separated words; Salesforce OR's them automatically in SOSL.
export async function soslSearch<T>(sosl: string): Promise<T[]> {
  const { access_token, instance_url } = await getSalesforceToken();
  const url = `${instance_url}/services/data/v59.0/search?q=${encodeURIComponent(sosl)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SOSL search failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.searchRecords ?? [];
}
