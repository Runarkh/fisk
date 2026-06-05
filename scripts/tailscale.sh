#!/usr/bin/env bash
# Starter Fiskeguru og eksponerer den over Tailscale med HTTPS (Tailscale Serve).
# Gir en https://<maskin>.<tailnet>.ts.net-adresse som funker fra alle enhetene
# dine på tailnettet – og gir sikker kontekst, slik at GPS-posisjon virker på mobil.
#
# Bruk:  npm run tailscale        (eller:  bash scripts/tailscale.sh)
set -euo pipefail

PORT="${PORT:-3000}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "❌ Fant ikke 'tailscale' i PATH. Installer Tailscale og kjør 'tailscale up' først."
  echo "   (Du kan fortsatt bruke 'npm start' og nå appen på Tailscale-IP-en uten HTTPS.)"
  exit 1
fi

echo "🔒 Setter opp Tailscale Serve (HTTPS) mot port ${PORT} ..."
# Nyere Tailscale: 'tailscale serve --bg <port>'. Faller tilbake til eldre syntaks.
if ! tailscale serve --bg "${PORT}" 2>/dev/null; then
  tailscale serve --bg "https / http://127.0.0.1:${PORT}" 2>/dev/null || \
    echo "⚠️  Klarte ikke sette opp 'tailscale serve' automatisk – sett det opp manuelt om nødvendig."
fi

echo
tailscale serve status 2>/dev/null || true
echo
echo "🎣 Starter Fiskeguru på port ${PORT} (Ctrl+C for å stoppe) ..."
exec env PORT="${PORT}" node server.js
