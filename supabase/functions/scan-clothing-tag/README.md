# scan-clothing-tag

Phase 1 of the photo-scan add-item flow. Accepts a base64-encoded image,
calls Claude (Haiku by default) to extract `brand`, `size_label`, `category`,
and `item_type`, and returns them as JSON for the client to drop into the
AddItem form.

## Secrets

Set once per environment:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Optional overrides (have sensible defaults):
supabase secrets set SCAN_DAILY_LIMIT=50
supabase secrets set ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
provided automatically by the Supabase runtime — don't set them yourself.

## Deploy

```bash
supabase functions deploy scan-clothing-tag
```

The function lives at
`https://<project-ref>.functions.supabase.co/scan-clothing-tag` once
deployed. The web client calls it via `supabase.functions.invoke(...)`, so
the URL is derived from `VITE_SUPABASE_URL` — no client env update is
needed.

## Local emulation

```bash
# 1. Apply migration 009 if you haven't already:
psql "$DATABASE_URL" -f db/migrations/009_scan_usage.sql

# 2. Serve the function locally with a .env file containing ANTHROPIC_API_KEY:
supabase functions serve scan-clothing-tag --env-file .env.local
```

Local Vite will hit the local function automatically because
`supabase.functions.invoke` respects the `VITE_SUPABASE_URL` you set — point
that at the Supabase CLI's `http://localhost:54321` when you want to test
the full stack locally.

## Rate limit

Backed by `beta.scan_usage` (migration 009). Each successful call bumps
the per-user counter for today. If the post-bump count exceeds
`SCAN_DAILY_LIMIT`, the function returns `429 rate_limited` without
calling Anthropic.

## Cost

~$0.002 per scan at Haiku image pricing (April 2026). A 50-scan daily cap
bounds a misbehaving client to ~$0.10/day.

## Error codes

| Status | `error` field           | Meaning                                       |
|--------|-------------------------|-----------------------------------------------|
| 400    | `invalid_json`          | Body isn't valid JSON                         |
| 400    | `missing_image_base64`  | No `image_base64` key on the body             |
| 401    | `missing_bearer`        | No `Authorization: Bearer ...` header         |
| 401    | `invalid_jwt`           | Bearer token is expired / wrong project       |
| 405    | `method_not_allowed`    | Anything other than POST or OPTIONS           |
| 413    | `image_too_large`       | Decoded image > 2 MB                          |
| 415    | `unsupported_mime`      | `mime_type` not in {jpeg, png, webp}          |
| 429    | `rate_limited`          | User is over today's cap                      |
| 500    | `missing_anthropic_key` | `ANTHROPIC_API_KEY` not set in secrets        |
| 500    | `missing_supabase_env`  | Function is running without runtime env       |
| 502    | `anthropic_http_error`  | Upstream non-2xx from Anthropic               |
| 502    | `anthropic_bad_json`    | Model returned something that wasn't parsable |
| 502    | `anthropic_fetch_failed`| `fetch()` threw before we got a response      |
