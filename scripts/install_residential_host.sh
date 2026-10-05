#!/bin/bash
# One-command setup of the residential Bonhams scrape host (B-25) on a Mac.
#
# This is the "fresh machine" path. Bonhams' lot pages 403 datacenter IPs, so
# they're scraped from a residential machine and pushed; this installs the
# launchd agent that does it. Idempotent — safe to re-run (to update the clone,
# regenerate the plist, or reload the agent).
#
# Fresh machine, from scratch:
#   git clone https://github.com/markatmutter-cloud/watchlist.git ~/watchlist-bonhams
#   bash ~/watchlist-bonhams/scripts/install_residential_host.sh
#
# Portable: uses $HOME / your uid, so it works for any user on any Mac — the
# Pi/Mac-mini "host swap" is just running this there. See
# scripts/RESIDENTIAL_SCRAPE_SETUP.md for the why and how-to-operate.
set -euo pipefail

REPO_URL="https://github.com/markatmutter-cloud/watchlist.git"
CLONE_DIR="$HOME/watchlist-bonhams"          # dedicated clone; only ever on main
LABEL="com.thewatchlist.bonhams-scrape"
LIVE_PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGDIR="$HOME/Library/Logs"
WRAPPER="$CLONE_DIR/scripts/bonhams_residential_scrape.sh"
PY=/usr/bin/python3

echo "▶ Residential Bonhams scrape host — install (B-25)"

# 1. Dedicated clone on main. The agent runs here, never your working copy.
if [ ! -d "$CLONE_DIR/.git" ]; then
  echo "▶ cloning → $CLONE_DIR"
  git clone "$REPO_URL" "$CLONE_DIR"
else
  echo "▶ updating existing clone at $CLONE_DIR"
  git -C "$CLONE_DIR" checkout main
  git -C "$CLONE_DIR" pull --rebase --autostash origin main
fi

# Clean commit identity for the automated pushes (local to this clone only —
# avoids git's auto-config warning + the ugly host-derived email).
git -C "$CLONE_DIR" config user.name  "watchlist residential scraper"
git -C "$CLONE_DIR" config user.email "scraper@the-watch-list.app"

# 2. Dependencies. User site-packages, no venv (launchd runs system python).
#
#   - curl-cffi   Bonhams' Chrome-TLS fetch.
#   - playwright  Watches of Lancashire. Its Cloudflare block is a MANAGED
#                 challenge, which demands JavaScript from every client on
#                 every path — so no TLS impersonation and no change of IP
#                 defeats it, and the only client that passes is a real
#                 browser (B-99). Lancashire sat frozen for 41 days because
#                 the move to this host was made without one.
#
# requirements-residential.txt composes the auction pins, so curl-cffi still
# comes from exactly one place.
echo "▶ ensuring curl-cffi + playwright"
"$PY" -m pip install --user -q -r "$CLONE_DIR/requirements-residential.txt" \
  || echo "  (pip returned nonzero — continuing; verifying imports)"
"$PY" -c "import curl_cffi" 2>/dev/null \
  || { echo "✗ curl_cffi missing — run: $PY -m pip install --user -r $CLONE_DIR/requirements-residential.txt"; exit 1; }
"$PY" -c "import playwright" 2>/dev/null \
  || { echo "✗ playwright missing — run: $PY -m pip install --user -r $CLONE_DIR/requirements-residential.txt"; exit 1; }

# The browser binary is a separate download from the pip package, and without
# it every Lancashire tick fails at launch. Idempotent: a no-op once present.
echo "▶ ensuring the Chromium binary playwright drives"
"$PY" -m playwright install chromium \
  || { echo "✗ could not install Chromium — run: $PY -m playwright install chromium"; exit 1; }

# 3. Generate the live plist from the repo template, rewriting the template's
#    /Users/markmutter paths to THIS machine's $HOME (portable across machines).
echo "▶ writing $LIVE_PLIST"
mkdir -p "$HOME/Library/LaunchAgents" "$LOGDIR"
sed "s|/Users/markmutter|$HOME|g" "$CLONE_DIR/scripts/$LABEL.plist" > "$LIVE_PLIST"

# 4. (Re)load the LaunchAgent.
echo "▶ loading LaunchAgent ($LABEL)"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LIVE_PLIST"
launchctl enable "gui/$(id -u)/$LABEL" 2>/dev/null || true

# 5. One real run now (watch for a first-time keychain prompt allowing git push).
echo "▶ smoke-test run"
bash "$WRAPPER" || true

echo ""
echo "✓ Installed. Agent ticks hourly; the scraper self-throttles (≈6h normal,"
echo "  hourly near a sale's close)."
echo "  Logs:   tail -f $LOGDIR/watchlist-bonhams-scrape.log"
echo "  Status: launchctl print gui/$(id -u)/$LABEL | head -20"
echo "  Remove: bash $CLONE_DIR/scripts/uninstall_residential_host.sh"
