#!/usr/bin/env bash
# One-command launcher for the WhatsApp AI Platform (local dev).
# Usage:  ./start.sh      then open http://localhost:5173
# Login:  workspace "demo"  ·  admin / ChangeMe!2026
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "==> 1/3  Starting PostgreSQL…"
brew services start postgresql@16 >/dev/null 2>&1 || true
for i in $(seq 1 20); do pg_isready -q 2>/dev/null && break; sleep 1; done
echo "    Postgres ready."

echo "==> 2/3  Starting backend API (:4000)…"
cd "$ROOT"
[ -d node_modules ] || npm install
npx prisma generate >/dev/null 2>&1 || true
npm run dev > /tmp/wa-backend.log 2>&1 &
BACKEND_PID=$!
for i in $(seq 1 20); do curl -s http://localhost:4000/api/health >/dev/null 2>&1 && break; sleep 1; done
echo "    Backend ready (logs: /tmp/wa-backend.log)"

echo "==> 3/3  Starting frontend (:5173)…"
cd "$ROOT/web"
[ -d node_modules ] || npm install
echo ""
echo "  ┌────────────────────────────────────────────────┐"
echo "  │  Open:   http://localhost:5173                 │"
echo "  │  Login:  workspace 'demo'                      │"
echo "  │          admin / ChangeMe!2026                 │"
echo "  │  (agents: priya, arjun, sana… / Demo@2026)     │"
echo "  └────────────────────────────────────────────────┘"
echo ""
echo "  Press Ctrl+C to stop the frontend. Backend keeps running"
echo "  in the background (stop it with: kill $BACKEND_PID)."
echo ""
npm run dev
