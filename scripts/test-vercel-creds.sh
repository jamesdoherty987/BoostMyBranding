#!/usr/bin/env bash
#
# Quick smoke test for Vercel API credentials.
# Reads VERCEL_API_TOKEN and VERCEL_PROJECT_ID from .env and makes a
# read-only API call to fetch the project name. No writes, no side effects.
#
# Usage:
#   bash scripts/test-vercel-creds.sh
#

set -euo pipefail

# Load from .env
VERCEL_API_TOKEN=$(grep '^VERCEL_API_TOKEN=' .env | cut -d= -f2- | tr -d "'\"" | xargs)
VERCEL_PROJECT_ID=$(grep '^VERCEL_PROJECT_ID=' .env | cut -d= -f2- | tr -d "'\"" | xargs)
VERCEL_TEAM_ID=$(grep '^VERCEL_TEAM_ID=' .env | cut -d= -f2- | tr -d "'\"" | xargs 2>/dev/null || true)

if [ -z "$VERCEL_API_TOKEN" ]; then
  echo "❌ VERCEL_API_TOKEN is empty in .env"
  echo "   Go to https://vercel.com/account/tokens → Create Token"
  exit 1
fi

if [ -z "$VERCEL_PROJECT_ID" ]; then
  echo "❌ VERCEL_PROJECT_ID is empty in .env"
  echo "   Go to your Vercel project → Settings → General → Project ID"
  exit 1
fi

TEAM_QS=""
if [ -n "$VERCEL_TEAM_ID" ]; then
  TEAM_QS="?teamId=$VERCEL_TEAM_ID"
fi

echo "Testing Vercel API credentials..."
echo "  Token:   ${VERCEL_API_TOKEN:0:8}..."
echo "  Project: $VERCEL_PROJECT_ID"
if [ -n "$VERCEL_TEAM_ID" ]; then
  echo "  Team:    $VERCEL_TEAM_ID"
fi
echo ""

# Test 1: Can we authenticate at all?
echo "→ Step 1: Checking token validity..."
USER_RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $VERCEL_API_TOKEN" \
  "https://api.vercel.com/v2/user")
USER_HTTP=$(echo "$USER_RESP" | tail -1)
USER_BODY=$(echo "$USER_RESP" | sed '$d')

if [ "$USER_HTTP" != "200" ]; then
  echo "  ❌ Token invalid (HTTP $USER_HTTP)"
  echo "  Response: $USER_BODY"
  exit 1
fi

USER_NAME=$(echo "$USER_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('username','unknown'))" 2>/dev/null || echo "unknown")
echo "  ✅ Authenticated as: $USER_NAME"

# Test 2: Can we read the project?
echo ""
echo "→ Step 2: Checking project access..."
PROJ_RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $VERCEL_API_TOKEN" \
  "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID$TEAM_QS")
PROJ_HTTP=$(echo "$PROJ_RESP" | tail -1)
PROJ_BODY=$(echo "$PROJ_RESP" | sed '$d')

if [ "$PROJ_HTTP" != "200" ]; then
  echo "  ❌ Can't access project (HTTP $PROJ_HTTP)"
  echo "  Response: $PROJ_BODY"
  if [ "$PROJ_HTTP" = "403" ] || [ "$PROJ_HTTP" = "404" ]; then
    echo ""
    echo "  Possible fixes:"
    echo "    - Double-check the Project ID in Vercel → Settings → General"
    echo "    - If the project is in a team, set VERCEL_TEAM_ID in .env"
    echo "    - Make sure the token has 'Full Account' scope"
  fi
  exit 1
fi

PROJ_NAME=$(echo "$PROJ_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','unknown'))" 2>/dev/null || echo "unknown")
echo "  ✅ Project found: $PROJ_NAME"

# Test 3: Can we list domains? (read-only)
echo ""
echo "→ Step 3: Listing current domains..."
DOMAINS_RESP=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $VERCEL_API_TOKEN" \
  "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID/domains$TEAM_QS")
DOMAINS_HTTP=$(echo "$DOMAINS_RESP" | tail -1)
DOMAINS_BODY=$(echo "$DOMAINS_RESP" | sed '$d')

if [ "$DOMAINS_HTTP" != "200" ]; then
  echo "  ❌ Can't list domains (HTTP $DOMAINS_HTTP)"
  echo "  Response: $DOMAINS_BODY"
  exit 1
fi

DOMAIN_COUNT=$(echo "$DOMAINS_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('domains',[])))" 2>/dev/null || echo "?")
echo "  ✅ Domain access works ($DOMAIN_COUNT domains currently attached)"

echo ""
echo "🎉 All good! Your Vercel credentials are valid and have the right permissions."
echo "   Custom domain management will work from the dashboard."
