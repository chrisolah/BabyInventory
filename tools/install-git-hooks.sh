#!/usr/bin/env bash
#
# One-shot installer for the repo's git hooks. Run once after cloning
# (and any time tools/git-hooks/ contents change in a way that needs
# re-blessing — git tracks the hook scripts but the executable bit can
# get lost on copy).
#
# What it does:
#   1. Points git at tools/git-hooks/ via core.hooksPath. This is local
#      to your clone (not pushed); each contributor runs it once.
#   2. Marks every script in tools/git-hooks/ as executable.
#
# Why core.hooksPath instead of .git/hooks/: .git/hooks isn't tracked
# by git, so hooks dropped there don't ship with clones. core.hooksPath
# lets us keep the hooks in the repo so everyone runs the same checks.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

git config core.hooksPath tools/git-hooks
chmod +x tools/git-hooks/*

echo "Installed git hooks:"
ls -1 tools/git-hooks/ | sed 's/^/  /'
echo ""
echo "core.hooksPath now points at tools/git-hooks/. To bypass a hook"
echo "for a single commit (rare — usually means you're intentionally"
echo "weakening a guard and want to document it), use:"
echo "  git commit --no-verify"
