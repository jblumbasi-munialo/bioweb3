[bioweb3-fixes-README.md](https://github.com/user-attachments/files/27856298/bioweb3-fixes-README.md)
# BioWeb3 — 5 Critical Fixes

Apply these in order. Each fix is a standalone JS file — paste the relevant
sections into your existing js/bio-core.js (or the new api/ file).

---

## Fix 1 — Supabase credentials (file: fix1-supabase-init.js)

**Problem:** Supabase is imported but never initialised — all data tabs fail silently.

**Steps:**
1. Go to your Supabase project → Settings → API
2. Copy `Project URL` and `anon public` key
3. Open `fix1-supabase-init.js` and replace:
   - `"https://YOUR_PROJECT_ID.supabase.co"` with your URL
   - `"YOUR_ANON_KEY"` with your anon key
4. Paste the entire file content at the **top** of `js/bio-core.js`
5. Add to Vercel: Settings → Environment Variables (optional for server-side use)

**What it does:**
- Safely initialises Supabase once on page load
- Provides a `dbFetch(table, options)` wrapper with error handling
- Replace all bare `supabase.from()` calls with `await dbFetch(...)` calls

---

## Fix 2 — AI Chatbot (files: fix2-chatbot-frontend.js + fix2b-api-chat.js)

**Problem:** Chatbot UI exists but is completely non-functional.

**Steps:**
1. **Create the backend route:**
   - Create a folder called `api/` in your repo root
   - Save `fix2b-api-chat.js` as `api/chat.js`
   - In Vercel → Settings → Environment Variables, add:
     `ANTHROPIC_API_KEY` = `sk-ant-...your key...`
   
2. **Update the frontend:**
   - In `js/bio-core.js`, find your existing chatbot section
     (search for `chatbotSendBtn` or `chatbotToggleBtn`)
   - Replace that entire section with the content of `fix2-chatbot-frontend.js`

3. **Push to GitHub** — Vercel will auto-deploy the new `/api/chat` endpoint

**How it works:**
- Frontend sends conversation history to `/api/chat` (your Vercel function)
- The Vercel function calls Anthropic's API server-side (key never exposed to browser)
- Responses stream back and display as chat bubbles
- Multi-turn conversation maintained in memory

---

## Fix 3 — Wallet Connect (file: fix3-wallet-connect.js)

**Problem:** `connectWallet()` crashes silently if MetaMask isn't installed.

**Steps:**
1. In `js/bio-core.js`, find your existing `connectWallet` function
2. Replace it (and all related wallet code) with the content of `fix3-wallet-connect.js`

**What's improved:**
- Detects whether MetaMask is installed before attempting connection
- Shows a friendly modal with install link if no wallet is detected
- Persists wallet address and token balance to localStorage
- Toast notifications when tokens are awarded
- Disconnect button
- `awardTokens(amount, reason)` function — call this at the end of each
  successful analysis to reward users

**To award tokens on analysis completion, add to each function:**
```js
// At the end of analyzeSeq():
awardTokens(5, "Sequence analyzed");

// At the end of searchUniProt():
awardTokens(10, "Structure loaded");

// At the end of runDock():
awardTokens(15, "Docking complete");
```

---

## Fix 4 — Live Exchange Rate (file: fix4-live-exchange-rate.js)

**Problem:** config.json hardcodes KES rate from Dec 2025 — prices drift wrong.

**Steps:**
1. In `js/bio-core.js`, find your `refreshPrices()` function — replace it with
   the content of `fix4-live-exchange-rate.js`
2. In `index.html`, update the pricing table:

   Change thead:
   ```html
   <thead><tr><th>Drug</th><th>Price (USD)</th><th>Price (KES)</th></tr></thead>
   ```

   Add below the table:
   ```html
   <p class="text-muted small mt-2" id="exchangeRateNote">Loading live rate…</p>
   ```

**What it does:**
- Fetches live USD→KES rate from frankfurter.app (free, no API key)
- Falls back to 130 if the API is unavailable
- `refreshPrices()` button re-fetches the rate
- Shows the live rate below the table

---

## Fix 5 — DEG Pipeline (file: fix5-deg-pipeline.js)

**Problem:** DEG analysis runs but results are statistically meaningless — no
real math, no disclaimer, no output download.

**Steps:**
1. In `js/bio-core.js`, find `runDEGPipeline()` — replace the entire function
   with the content of `fix5-deg-pipeline.js`
2. Plotly must already be loaded in index.html (it is — via CDN on line 6 ✅)

**What's improved:**
- Clear simulation disclaimer shown before results (users are not misled)
- Genuine log₂ fold-change calculation from your uploaded CSV data
- Welch's t-test with Benjamini-Hochberg FDR correction
- Volcano plot rendered with Plotly (interactive, hover labels)
- Sortable top-DEG table with direction badges
- Download button exports full results as CSV
- Auto-detects control vs treatment columns by name pattern
  (columns containing ctrl/control/untreated vs treat/treated/case)

**CSV format expected:**
```
gene,ctrl_1,ctrl_2,treat_1,treat_2
BRCA1,120,130,45,40
TP53,88,92,210,198
...
```

---

## Deployment Checklist

After applying all fixes:

- [ ] Replaced `SUPABASE_URL` and `SUPABASE_ANON` in bio-core.js
- [ ] Created `api/chat.js` in repo root
- [ ] Added `ANTHROPIC_API_KEY` to Vercel environment variables
- [ ] Pushed all changes to GitHub (triggers Vercel redeploy)
- [ ] Tested chatbot in the live site
- [ ] Tested "Connect Wallet" without MetaMask (should show modal)
- [ ] Tested Pricing tab shows live rate
- [ ] Tested DEG pipeline with a sample CSV

---

## Quick test CSV for Fix 5

Save this as `test_counts.csv` and upload to the DEG Pipeline tab:

```
gene,ctrl_rep1,ctrl_rep2,ctrl_rep3,treat_rep1,treat_rep2,treat_rep3
BRCA1,120,130,125,45,42,48
TP53,88,92,85,215,198,220
MYC,200,195,210,380,395,370
EGFR,55,60,58,22,18,25
CDK4,180,175,185,90,88,95
PTEN,70,75,72,140,138,145
AKT1,160,155,162,320,315,330
MDM2,45,48,44,95,98,92
VEGFA,90,85,88,180,175,185
RB1,130,125,128,65,68,62
```
