#!/usr/bin/env bash
# localPipeline.sh — Allium Assault full local validation pipeline
#
# Runs every quality gate in the same order as CI would.
# Usage: bash localPipeline.sh
# Exit code 0 = everything passed. Non-zero = something failed.

set -euo pipefail

PASS="\033[0;32m✓\033[0m"
FAIL="\033[0;31m✗\033[0m"
HEAD="\033[1;34m»\033[0m"

step() { echo -e "\n${HEAD} $1"; }
ok()   { echo -e "${PASS} $1"; }
fail() { echo -e "${FAIL} $1"; exit 1; }

# ── 0. sanity ────────────────────────────────────────────────────────────────
step "Environment check"
command -v node >/dev/null 2>&1  || fail "node not found"
command -v npm  >/dev/null 2>&1  || fail "npm not found"
NODE_VER=$(node --version)
NPM_VER=$(npm --version)
ok "node $NODE_VER  /  npm $NPM_VER"

# ── 1. install ───────────────────────────────────────────────────────────────
step "Installing dependencies (npm ci)"
if [ -f "package-lock.json" ]; then
  npm ci --prefer-offline 2>&1 | tail -3
else
  npm install 2>&1 | tail -3
fi
ok "Dependencies installed"

# ── 2. format check ──────────────────────────────────────────────────────────
step "Format check (Prettier)"
npm run format:check && ok "Formatting OK" || {
  echo -e "  Run: npm run format"
  fail "Formatting issues found"
}

# ── 3. typecheck ─────────────────────────────────────────────────────────────
step "Type check (tsc --noEmit)"
npm run typecheck && ok "Types OK" || fail "TypeScript errors found"

# ── 4. lint ──────────────────────────────────────────────────────────────────
step "Lint (ESLint)"
npm run lint && ok "Lint OK" || fail "Lint errors found"

# ── 5. tests ─────────────────────────────────────────────────────────────────
step "Unit tests (Vitest)"
npm run test && ok "All tests passed" || fail "Tests failed"

# ── 6. build ─────────────────────────────────────────────────────────────────
step "Production build (Vite)"
npm run build 2>&1 | tail -10
ok "Build succeeded"

# ── 7. summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "\033[1;32m══════════════════════════════════════"
echo -e "  Pipeline PASSED — ready to ship"
echo -e "══════════════════════════════════════\033[0m"
