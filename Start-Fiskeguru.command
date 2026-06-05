#!/usr/bin/env bash
# Dobbeltklikk denne fila (Mac/Linux) for å starte Fiskeguru.
cd "$(dirname "$0")"
clear
echo "🎣  Starter Fiskeguru..."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js mangler. Last ned 'LTS' fra https://nodejs.org , installer,"
  echo "   og dobbeltklikk denne fila på nytt."
  echo
  read -p "Trykk Enter for å lukke..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 Installerer (kun første gang, tar ~1 min)..."
  npm install || { echo "Install feilet."; read -p "Enter for å lukke..."; exit 1; }
  echo
fi

PORT="${PORT:-3000}"

# Sett opp HTTPS via Tailscale hvis det finnes (gir mobil-tilgang + GPS).
if command -v tailscale >/dev/null 2>&1; then
  echo "🔒 Setter opp Tailscale (HTTPS) ..."
  tailscale serve --bg "$PORT" >/dev/null 2>&1 \
    || tailscale serve --bg "https / http://127.0.0.1:$PORT" >/dev/null 2>&1 || true
fi

# Åpne nettleseren automatisk når serveren er oppe.
( sleep 2; open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null ) &

echo "✅ Åpner appen i nettleseren. La dette vinduet stå åpent."
echo "   (Lukk vinduet eller trykk Ctrl+C for å stoppe.)"
echo
PORT="$PORT" npm start
