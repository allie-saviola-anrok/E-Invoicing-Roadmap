# Anrok E-Invoicing Mandate Roadmap

An interactive tool for EPD, LFT, and Sales to explore e-invoicing mandates by country — with live priority scoring, pipeline deal tracking, and ARR weighting.

## Running locally

**Prerequisites:** [Node.js](https://nodejs.org) (v18 or later)

```bash
# 1. Clone the repo
git clone https://github.com/allie-saviola-anrok/E-Invoicing-Roadmap.git
cd E-Invoicing-Roadmap

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Open .env.local and set NEXTAUTH_SECRET to any random string (e.g. "dev-secret-123")

# 4. Start the dev server
npm run dev
```

Then open [http://localhost:3001](http://localhost:3001).

## What you can do

- **Phase Board** — countries grouped by priority (P7 → P1), updated live as you edit
- **Timeline** — Gantt-style view of mandate go-live dates
- **Table** — edit local seller, non-local seller, and pipeline counts inline
- **Add Pipeline Deal** — add a company + ARR + country; priority scores recalculate automatically
- Pipeline ARR ≥ $100K elevates a country's base priority by +1 tier (max P5)

## Priority scoring

| Priority | Condition |
|----------|-----------|
| P7 | Live non-resident rules + non-local sellers in scope |
| P6 | Live non-resident rules + pipeline deals |
| P5 | Live resident rules + local sellers |
| P4 | Live resident rules + pipeline, or upcoming resident rules + local sellers + pipeline |
| P3 | Upcoming rules + any in-scope exposure |
| P2 | Upcoming rules, no in-scope exposure yet |
| P1 | No rules or far-future rules |
