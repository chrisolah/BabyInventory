#!/usr/bin/env bash
#
# Safe wrapper for `supabase config push`.
#
# Why this exists: `supabase config push` is COMPREHENSIVE, not merge —
# anything not explicitly in config.toml gets reset to CLI defaults on push.
# That's bit prod twice now (2026-04-26, 2026-05-02), both times stripping
# the `beta` schema from `[api].schemas` and breaking every authed page in
# the app with "Invalid schema: beta". See feedback_supabase_config_push_
# clobbers memory entry.
#
# This wrapper enforces three things before letting you push:
#   1. config.toml MUST contain `[api]` (refuse if missing)
#   2. config.toml SHOULD contain `[auth]` (warn + require confirmation)
#   3. Lists every `[section]` in config.toml + requires you to type "yes"
#      before the push runs. (CLI v2.90+ removed `config push --dry-run`,
#      so the section list is the best preview we can offer.)
#
# Usage:
#   tools/safe-config-push.sh adojihtjkfhozwbxfjae    # beta
#   tools/safe-config-push.sh udtgpgqniieedlxxglvf    # prod

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$REPO_ROOT/supabase/config.toml"

# ── Project-ref shortcuts ────────────────────────────────────────────────
BETA_REF="adojihtjkfhozwbxfjae"
PROD_REF="udtgpgqniieedlxxglvf"

if [ $# -lt 1 ]; then
  cat <<EOF
Usage: $0 <project-ref|beta|prod>

  Project refs:
    beta  ($BETA_REF)
    prod  ($PROD_REF)

  Or pass the literal ref string for one-off projects.
EOF
  exit 1
fi

case "$1" in
  beta) PROJECT_REF="$BETA_REF" ;;
  prod) PROJECT_REF="$PROD_REF" ;;
  *)    PROJECT_REF="$1" ;;
esac

ENV_LABEL="$1"
if [ "$ENV_LABEL" != "beta" ] && [ "$ENV_LABEL" != "prod" ]; then
  ENV_LABEL="ref=$PROJECT_REF"
fi

# ── Required sections — refuse to push if missing ────────────────────────
# [auth] was upgraded from "warn + confirm" to hard-required on 2026-05-04
# after a push without [auth] silently reset anonymous sign-ins to off and
# wiped site_url + additional_redirect_urls on both beta and prod.
#
# The check uses a line-anchored regex (^\s*\[section\]) instead of a
# substring match, so a section commented out via `# [auth]` does NOT
# satisfy the requirement — only a real section header does.
REQUIRED_SECTIONS=("api" "auth")
for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -qE "^[[:space:]]*\[${section}\][[:space:]]*\$" "$CONFIG"; then
    cat <<EOF
REFUSED: $CONFIG is missing required section: [${section}]

  Pushing without this section would reset that area to CLI defaults.
  Past incidents:
    - missing [api] stripped beta schema from PostgREST → "Invalid schema: beta"
    - missing [auth] reset site_url, redirect URLs, anon sign-ins (2026-05-04)

  Add the section to config.toml before pushing again. Comments
  (# [${section}]) do NOT satisfy this check.
EOF
    exit 1
  fi
done

# ── Per-env auth values via env() interpolation ──────────────────────────
# config.toml uses env(VAR) placeholders for the project-specific bits
# (site_url, redirect URLs). Set them here so the same config.toml can
# safely push to both beta and prod — without these exports, env() falls
# back to empty string and the dashboard ends up with no Site URL.
case "$1" in
  beta)
    export SUPABASE_AUTH_SITE_URL="https://baby-inventory-chrisolah-olahwoven.vercel.app"
    export SUPABASE_AUTH_PRIMARY_URL_GLOB="https://baby-inventory-chrisolah-olahwoven.vercel.app/**"
    export SUPABASE_AUTH_PREVIEW_URL_GLOB="https://baby-inventory-*-olahwoven.vercel.app/**"
    ;;
  prod)
    export SUPABASE_AUTH_SITE_URL="https://sprigloop.com"
    export SUPABASE_AUTH_PRIMARY_URL_GLOB="https://sprigloop.com/**"
    # Prod has no preview pattern; reuse the primary so the array entry
    # stays valid (Supabase dedupes identical entries).
    export SUPABASE_AUTH_PREVIEW_URL_GLOB="https://sprigloop.com/**"
    ;;
  *)
    cat <<EOF
WARNING: pushing to a non-standard project ref ($PROJECT_REF).

  The wrapper only knows site_url + redirect URL globs for 'beta' and
  'prod'. For any other ref, set these env vars yourself before re-running:
    SUPABASE_AUTH_SITE_URL
    SUPABASE_AUTH_PRIMARY_URL_GLOB
    SUPABASE_AUTH_PREVIEW_URL_GLOB

EOF
    ;;
esac

# ── Validate env() placeholders resolve to non-empty values ──────────────
# config.toml uses env(VAR) for the per-project URL fields. If any of
# those env vars is missing or empty, Supabase CLI would push an empty
# string — silently breaking auth flows on the target project. Refuse
# the push if any required env is missing/empty, regardless of how we
# got here (case statement above for beta/prod, or caller's shell for
# other refs).
REQUIRED_ENV_VARS=(
  SUPABASE_AUTH_SITE_URL
  SUPABASE_AUTH_PRIMARY_URL_GLOB
  SUPABASE_AUTH_PREVIEW_URL_GLOB
)
for var in "${REQUIRED_ENV_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    cat <<EOF
REFUSED: required env var $var is empty or unset.

  config.toml uses env($var) to interpolate per-project URL config.
  If we push with that env unset, Supabase pushes an empty value,
  which silently breaks redirects / Site URL on the target project.

  If you're pushing 'beta' or 'prod', the wrapper sets these for you —
  this means something deleted the case branch. Check tools/safe-config-push.sh.
  If you're pushing a custom ref, export the var before re-running:
    export $var=...
EOF
    exit 1
  fi
done

# ── Optional: fetch live dashboard auth config via Management API ────────
# Reads SUPABASE_MANAGEMENT_API_TOKEN. If set, fetches the project's
# current auth config and prints the key field values BEFORE the
# typed-yes prompt so the user sees what's about to be overwritten.
# This catches "dashboard drift" — a setting added in the dashboard
# but never mirrored into config.toml — which the missing-section
# check can't detect.
#
# If the token is missing, or the API call fails (network, 401, etc.),
# we degrade gracefully: print a hint, skip the dashboard preview,
# fall through to the typed-yes prompt with the section list only.
DASHBOARD_PREVIEW=""
if [ -n "${SUPABASE_MANAGEMENT_API_TOKEN:-}" ]; then
  DASHBOARD_RAW="$(
    curl --silent --show-error --max-time 10 \
      -H "Authorization: Bearer $SUPABASE_MANAGEMENT_API_TOKEN" \
      "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
      2>&1 || echo ""
  )"
  if [ -n "$DASHBOARD_RAW" ] && echo "$DASHBOARD_RAW" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    DASHBOARD_PREVIEW="$(
      echo "$DASHBOARD_RAW" | python3 - "$SUPABASE_AUTH_SITE_URL" "$SUPABASE_AUTH_PRIMARY_URL_GLOB" "$SUPABASE_AUTH_PREVIEW_URL_GLOB" <<'PY'
import json, sys

dash = json.load(sys.stdin)
expected_site_url, expected_primary, expected_preview = sys.argv[1:4]

# Fields that have caused incidents or are critical to user-facing auth.
# Names are the Management API's, which differ from config.toml's:
#   site_url            <-> auth.site_url
#   uri_allow_list      <-> auth.additional_redirect_urls (comma-separated string)
#   external_anonymous_users_enabled  <-> auth.enable_anonymous_sign_ins
#   disable_signup      <-> NOT auth.enable_signup
#   mailer_autoconfirm  <-> NOT auth.email.enable_confirmations
WATCH = [
  ("site_url",                       "Site URL"),
  ("uri_allow_list",                 "Redirect URLs"),
  ("external_anonymous_users_enabled", "Anonymous sign-ins"),
  ("disable_signup",                 "Signup DISABLED?"),
  ("mailer_autoconfirm",             "Auto-confirm email (skip confirmations)"),
  ("password_min_length",            "Min password length"),
  ("mailer_otp_length",              "OTP length"),
  ("mailer_otp_exp",                 "OTP expiry (sec)"),
]

drift = []
lines = []
for key, label in WATCH:
  if key not in dash:
    continue
  v = dash[key]
  display = "(empty)" if v in (None, "", []) else v
  marker = "  "
  if key == "site_url" and expected_site_url and v != expected_site_url:
    marker = "!!"
    drift.append(f"site_url: dashboard={v!r} → push={expected_site_url!r}")
  if key == "external_anonymous_users_enabled" and v is not True:
    marker = "!!"
    drift.append("anon sign-ins: dashboard=OFF → push=ON")
  if key == "disable_signup" and v is not False:
    marker = "!!"
    drift.append("signup: dashboard=DISABLED → push=ENABLED")
  if key == "mailer_autoconfirm" and v is not True:
    marker = "!!"
    drift.append("email confirmations: dashboard=ON → push=OFF (autoconfirm true)")
  lines.append(f"  {marker} {label:<40} {display}")

print("\n".join(lines))
if drift:
  print("\n  !! Dashboard differs from what this push would set:")
  for d in drift:
    print(f"     - {d}")
PY
    )"
  fi
fi

# ── Show what's in config.toml + require explicit confirmation ───────────
# `supabase config push` does not support --dry-run as of CLI v2.90.x, so
# we can't show a real diff. Best we can do is print the sections currently
# in config.toml so you can sanity-check what's about to be asserted,
# the dashboard preview above (if available), and require a typed 'yes'
# before the destructive command runs.
echo ""
echo "─────────────────────────────────────────────────────────────"
echo "About to push to $ENV_LABEL ($PROJECT_REF)."
echo ""
echo "Sections in $CONFIG that will be asserted:"
grep -E "^\[" "$CONFIG" | sed 's/^/  /'
echo ""
if [ -n "$DASHBOARD_PREVIEW" ]; then
  echo "Current dashboard auth config (live, fetched via Management API):"
  echo "$DASHBOARD_PREVIEW"
  echo ""
  echo "Lines marked !! diverge from what this push would set. Read each"
  echo "carefully — anything you weren't expecting to change is dashboard"
  echo "drift that needs to land in config.toml first."
else
  echo "(Dashboard preview skipped — set SUPABASE_MANAGEMENT_API_TOKEN to"
  echo " enable. Get a token at supabase.com/dashboard/account/tokens.)"
fi
echo ""
echo "Anything NOT listed above will be reset to CLI defaults on the"
echo "remote project. Common things to watch for:"
echo "  - [api]   schemas, extra_search_path"
echo "  - [auth]  site_url, additional_redirect_urls, OTP expiry"
echo "─────────────────────────────────────────────────────────────"
read -r -p "Type 'yes' to push to $ENV_LABEL for real: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Pushing to $ENV_LABEL..."
supabase config push --project-ref "$PROJECT_REF"
echo "Push complete on $ENV_LABEL."
