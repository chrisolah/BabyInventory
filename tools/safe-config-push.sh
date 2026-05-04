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
REQUIRED_SECTIONS=("[api]")
for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -qF "$section" "$CONFIG"; then
    cat <<EOF
REFUSED: $CONFIG is missing required section: $section

  Pushing without this section would reset that area to CLI defaults.
  Last time this happened, beta schema got stripped from PostgREST and
  every page in the app errored "Invalid schema: beta".

  Add the section to config.toml before pushing again.
EOF
    exit 1
  fi
done

# ── Recommended sections — warn but allow with confirmation ──────────────
RECOMMENDED_SECTIONS=("[auth]")
for section in "${RECOMMENDED_SECTIONS[@]}"; do
  if ! grep -qF "$section" "$CONFIG"; then
    cat <<EOF

WARNING: $CONFIG is missing recommended section: $section

  Push will reset auth.site_url, auth.additional_redirect_urls, signup
  toggles, OTP expiry, anonymous-trial flag, etc. to CLI defaults if your
  dashboard has non-default values for any of those.

  If your dashboard auth config matches CLI defaults exactly, this is
  safe. If not, add an [auth] block to config.toml first (use
  [remotes.<ref>.auth] for env-specific values).

EOF
    read -r -p "  Continue without [auth]? (type 'yes' to proceed) " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
      echo "Aborted."
      exit 1
    fi
  fi
done

# ── Show what's in config.toml + require explicit confirmation ───────────
# `supabase config push` does not support --dry-run as of CLI v2.90.x, so
# we can't show a real diff. Best we can do is print the sections currently
# in config.toml so you can sanity-check what's about to be asserted,
# and require a typed 'yes' before the destructive command runs.
echo ""
echo "─────────────────────────────────────────────────────────────"
echo "About to push to $ENV_LABEL ($PROJECT_REF)."
echo ""
echo "Sections in $CONFIG that will be asserted:"
grep -E "^\[" "$CONFIG" | sed 's/^/  /'
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
