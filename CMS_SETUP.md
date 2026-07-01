# CMS Setup

The AI-driven editor overlay is **off by default**. Follow these steps to enable it.

## What it does

- Log in at `/edit` with a password → redirected to home with an editing overlay
- Click any highlighted element (currently: pricing prices, min-night counts, fees) to select it
- Chat with the AI ("Change Christmas price to 7500 Kč") → AI proposes an update
- Click **Publikovat** → commits to GitHub → Cloudflare rebuilds → live in ~1 min
- No GitHub account or technical knowledge needed by the editor

## Editable fields (v1)

- `pricing.vanoce_2026.price_per_night` — Christmas 2026 nightly rate
- `pricing.vanoce_2026.min_nights` — Christmas 2026 minimum nights
- `pricing.silvestr_2026.price_per_night` — New Year's Eve 2026 nightly rate
- `pricing.silvestr_2026.min_nights` — New Year's Eve 2026 minimum nights
- `pricing.fees.cleaning` — Cleaning fee
- `pricing.fees.tourism_tax_per_adult_per_night` — Tourism tax per adult per night

Everything else is safe from edits.

## Setup

### 1. Enable the feature flag (build-time)

In Cloudflare Pages → Settings → Environment variables → Production, add:

```
PUBLIC_CMS_ENABLED = true
```

Without this, `/scripts/editor.js` is never loaded and the site behaves as if the CMS doesn't exist.

### 2. Set worker secrets

You need four secrets. From your local terminal:

```bash
# Password the editor will type at /edit
npx wrangler secret put CMS_PASSWORD

# Random string used to sign session cookies (any 32+ char string)
# Generate one: openssl rand -hex 32
npx wrangler secret put CMS_SESSION_SECRET

# Anthropic API key — https://console.anthropic.com/settings/keys
npx wrangler secret put ANTHROPIC_API_KEY

# GitHub Personal Access Token with `contents: write` on the repo
# Create at https://github.com/settings/tokens?type=beta (fine-grained token)
# Repository access: select this repo, Permissions: Contents (read/write)
npx wrangler secret put GITHUB_TOKEN
```

### 3. Set the repo path

Also in Cloudflare Pages env vars (Production, plaintext — not secret):

```
GITHUB_REPO = simonkoran1/chalupa-sejkora
```

### 4. Deploy

Push any commit or trigger a redeploy in Cloudflare. Once live:

- Visit `chalupasejkora.cz/edit`
- Enter your password
- You'll be redirected to home with the editing toolbar visible

## Turn it off

Two levels:

1. **Soft off (keep code, hide UI):** Delete the `PUBLIC_CMS_ENABLED` env var and redeploy. `editor.js` won't load, overlay never appears, site works normally.

2. **Hard off (revoke access):** Delete `CMS_PASSWORD` from Wrangler secrets. All `/api/cms/*` endpoints return 404 even if someone has a stale cookie.

Either way the public site keeps working. The CMS is fully additive.

## Adding more editable fields (v2)

Two steps to expose a new field:

1. Add it to `src/content/site.json`
2. Add the same dotted path to `EDITABLE_SCHEMA` in `worker.js` (with type + range/limits + label)
3. Reference it in the template with `data-cms-field="path.to.field"` and interpolate the value

Example: to make the "seasonal discount" text editable, add `pricing.vanoce_2026.discount_text: "*Při delším pobytu sleva"` to the JSON, add the schema entry with `type: 'string'`, then in `index.astro`:

```astro
<div data-cms-field="pricing.vanoce_2026.discount_text">{site.pricing.vanoce_2026.discount_text}</div>
```

## Security notes

- Cookies are HMAC-signed (SHA-256) with your `CMS_SESSION_SECRET`. Only your Worker can mint valid cookies.
- Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, 7-day expiry.
- Claude can only call the `updateField` tool with paths listed in `EDITABLE_SCHEMA`. Any other path is rejected by the Worker before committing.
- Numeric fields are range-validated on the server.
- The GitHub token needs `contents: write` on the site repo only — no other scopes.
