#!/usr/bin/env bash
set -euo pipefail

# Cloudflare can check out a preview branch without a local main branch.
# Moon needs its configured base branch even when building explicit targets.
if ! git show-ref --verify --quiet refs/heads/main; then
  git fetch origin main
  git branch main FETCH_HEAD
fi

bun moon run gurafu:build
