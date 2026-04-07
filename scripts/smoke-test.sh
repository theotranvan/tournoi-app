#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Kickoff — Post-deploy Smoke Test
#
# Usage:
#   ./scripts/smoke-test.sh                    # Test against localhost
#   ./scripts/smoke-test.sh https://footix.app # Test against production URL
# ─────────────────────────────────────────────────────────────────────────────

BASE_URL="${1:-http://localhost}"
ERRORS=0

log()   { echo "[$(date +%H:%M:%S)] $*"; }
pass()  { log "✓ $*"; }
fail()  { log "✗ $*"; ERRORS=$((ERRORS + 1)); }

check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"

    local status_code
    status_code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    if [ "$status_code" = "$expected_status" ]; then
        pass "$name → $status_code"
    else
        fail "$name → got $status_code (expected $expected_status)"
    fi
}

check_json_field() {
    local name="$1"
    local url="$2"
    local field="$3"
    local expected="$4"

    local value
    value=$(curl -sf --max-time 10 "$url" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field',''))" 2>/dev/null || echo "")

    if [ "$value" = "$expected" ]; then
        pass "$name → $field=$value"
    else
        fail "$name → $field='$value' (expected '$expected')"
    fi
}

echo ""
echo "═══════════════════════════════════════════════"
echo " SMOKE TEST — $BASE_URL"
echo "═══════════════════════════════════════════════"
echo ""

# ── Basic health ──────────────────────────────────
log "─── Health endpoints ───"
check_endpoint "Health (simple)" "$BASE_URL/api/v1/health/"
check_json_field "Health status" "$BASE_URL/api/v1/health/" "status" "ok"

# ── Public health (used by nginx) ─────────────────
check_endpoint "Public health" "$BASE_URL/api/v1/public/health/"

# ── Full health (DB + Redis + Celery) ─────────────
check_endpoint "Health full" "$BASE_URL/api/v1/health/full/"
check_json_field "Health full status" "$BASE_URL/api/v1/health/full/" "status" "ok"

# ── Frontend ──────────────────────────────────────
log "─── Frontend ───"
check_endpoint "Frontend homepage" "$BASE_URL/"

# ── Auth endpoints respond ────────────────────────
log "─── API endpoints (should return 4xx, not 500) ───"
local_status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/api/v1/auth/me/" 2>/dev/null || echo "000")
if [ "$local_status" = "401" ]; then
    pass "Auth /me → 401 (unauthenticated, expected)"
elif [ "$local_status" = "000" ] || [ "$local_status" = "500" ]; then
    fail "Auth /me → $local_status (server error or unreachable)"
else
    pass "Auth /me → $local_status"
fi

# ── API schema blocked in prod ────────────────────
log "─── Security checks ───"
schema_status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/api/v1/schema/" 2>/dev/null || echo "000")
if [ "$schema_status" = "404" ] || [ "$schema_status" = "403" ]; then
    pass "API schema blocked → $schema_status"
else
    fail "API schema accessible → $schema_status (should be 404)"
fi

docs_status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/api/v1/docs/" 2>/dev/null || echo "000")
if [ "$docs_status" = "404" ] || [ "$docs_status" = "403" ]; then
    pass "API docs blocked → $docs_status"
else
    fail "API docs accessible → $docs_status (should be 404)"
fi

# ── HTTPS redirect (only if testing http) ─────────
if [[ "$BASE_URL" == http://* ]] && [[ "$BASE_URL" != *localhost* ]]; then
    log "─── HTTPS redirect ───"
    redirect_status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 -L "$BASE_URL/" 2>/dev/null || echo "000")
    if [ "$redirect_status" = "200" ]; then
        pass "HTTP→HTTPS redirect works"
    else
        fail "HTTP→HTTPS redirect → $redirect_status"
    fi
fi

# ── Version check ─────────────────────────────────
log "─── Version ───"
version=$(curl -sf --max-time 10 "$BASE_URL/api/v1/health/" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','unknown'))" 2>/dev/null || echo "unknown")
log "  Deployed version: $version"

# ── Summary ───────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    echo " ✓ ALL SMOKE TESTS PASSED"
else
    echo " ✗ $ERRORS SMOKE TEST(S) FAILED"
fi
echo "═══════════════════════════════════════════════"

exit $ERRORS
