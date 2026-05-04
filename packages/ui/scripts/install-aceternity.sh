#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Bulk-install every Aceternity UI primitive we need.
#
# Run from the `packages/ui` directory:
#   bash scripts/install-aceternity.sh
#
# Requires:
#   - ACETERNITY_API_KEY exported (we source it from the repo-root .env)
#   - Internet access
#   - pnpm installed
#
# What it does:
#   For each primitive name, invokes `npx shadcn@latest add @aceternity/<name>`
#   which fetches the component + its dependencies from Aceternity's private
#   registry using our Bearer token.
#
#   Primitives land in `src/components/ui/` (shadcn default). We move them
#   into `src/aceternity/ui/` at the end so they live alongside the demos.
#
# Failures: any 404 / auth / schema issue is logged to install-failures.log
# and the loop continues so one bad name doesn't kill the whole run.
# ----------------------------------------------------------------------------

# No `set -u` — an empty array expansion crashes on bash 3 under nounset.
# We explicitly handle empty cases instead.

# Load the API key from the repo-root .env if not already in the env.
if [ -z "${ACETERNITY_API_KEY:-}" ]; then
  if [ -f ../../.env ]; then
    export ACETERNITY_API_KEY="$(grep -E '^ACETERNITY_API_KEY=' ../../.env | cut -d '=' -f 2-)"
  fi
fi

if [ -z "${ACETERNITY_API_KEY:-}" ]; then
  echo "❌ ACETERNITY_API_KEY is not set. Add it to .env or export before running."
  exit 1
fi

echo "🔑 Using API key: ${ACETERNITY_API_KEY:0:20}..."
echo ""

# List of primitive slugs to install. These are the component names as they
# appear on ui.aceternity.com/components/<name>. Ordered roughly by
# category for readability.
PRIMITIVES=(
  # Backgrounds
  "aurora-background"
  "background-beams"
  "background-beams-with-collision"
  "background-boxes"
  "background-gradient"
  "background-gradient-animation"
  "background-lines"
  "background-ripple-effect"
  "canvas-reveal-effect"
  "grid-and-dot-backgrounds"
  "google-gemini-effect"
  "hero-highlight"
  "meteors"
  "noise-background"
  "shooting-stars"
  "sparkles"
  "spotlight"
  "spotlight-new"
  "vortex"
  "wavy-background"
  "world-map"
  "dot-background"
  "grid-background"

  # Cards
  "3d-card-effect"
  "3d-marquee"
  "animated-pin"
  "apple-cards-carousel"
  "background-overlay-card"
  "bento-grid"
  "card-hover-effect"
  "card-spotlight"
  "card-stack"
  "compare"
  "direction-aware-hover"
  "draggable-card"
  "evervault-card"
  "expandable-card"
  "focus-cards"
  "glare-card"
  "glowing-stars-background-card"
  "glowing-effect"
  "hover-effect"
  "infinite-moving-cards"
  "layout-grid"
  "lens"
  "linkpreview"
  "macbook-scroll"
  "moving-border"
  "parallax-scroll"
  "pin-container"
  "sticky-scroll-reveal"
  "svg-mask-effect"
  "text-reveal-card"
  "tracing-beam"
  "wobble-card"

  # Buttons
  "hover-border-gradient"
  "moving-border"
  "shimmer-button"
  "stateful-button"
  "tailwindcss-buttons"

  # Text effects
  "aceternity-logo"
  "animated-modal"
  "animated-testimonials"
  "animated-tooltip"
  "colourful-text"
  "container-scroll-animation"
  "container-text-flip"
  "cover"
  "flip-words"
  "glowing-stars"
  "gradient-text"
  "lamp-effect"
  "multi-step-loader"
  "placeholders-and-vanish-input"
  "scroll-based-velocity"
  "signup-form"
  "sidebar"
  "sticky-banner"
  "sticky-scroll-reveal"
  "tabs"
  "text-generate-effect"
  "text-hover-effect"
  "text-reveal-card"
  "timeline"
  "typewriter-effect"

  # Hero & navigation
  "feature-sections"
  "floating-dock"
  "floating-navbar"
  "floating-dock"
  "follow-pointer"
  "hero-parallax"
  "navbar-menu"
  "resizable-navbar"
  "sidebar"
  "layout"

  # 3D / complex
  "3d-pin"
  "canvas-text"
  "draggable-cards"
  "file-upload"
  "github-globe"
  "globe"
  "google-gemini-effect"
  "macbook-scroll"
  "pointer"
)

# Dedupe preserving order (macOS bash 3 compatible — no associative arrays).
UNIQUE=()
for p in "${PRIMITIVES[@]}"; do
  # Grep the existing list for an exact match; if not present, append.
  if ! printf '%s\n' "${UNIQUE[@]}" | grep -qxF "$p" 2>/dev/null; then
    UNIQUE+=("$p")
  fi
done

TOTAL=${#UNIQUE[@]}
SUCCESS=0
FAIL=0
: > install-failures.log

echo "📦 Installing ${TOTAL} primitives from @aceternity..."
echo ""

for i in "${!UNIQUE[@]}"; do
  NAME="${UNIQUE[$i]}"
  NUM=$((i + 1))
  printf "[%3d/%d] %-40s " "$NUM" "$TOTAL" "$NAME"

  OUTPUT=$(npx shadcn@latest add "@aceternity/${NAME}" --yes 2>&1)
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ] && echo "$OUTPUT" | grep -q -E "(Created|Updated) "; then
    echo "✓"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "✗"
    FAIL=$((FAIL + 1))
    {
      echo "=== ${NAME} ==="
      echo "$OUTPUT"
      echo ""
    } >> install-failures.log
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Succeeded: $SUCCESS"
echo "❌ Failed:    $FAIL"
if [ $FAIL -gt 0 ]; then
  echo "   See install-failures.log for details."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Move anything that landed in the default shadcn location into our
# aceternity/ui folder so it lives next to the demos.
if [ -d "src/components/ui" ]; then
  mkdir -p src/aceternity/ui
  echo ""
  echo "📁 Relocating primitives from src/components/ui → src/aceternity/ui"
  mv src/components/ui/*.tsx src/aceternity/ui/ 2>/dev/null || true
  rmdir src/components/ui 2>/dev/null || true
  rmdir src/components 2>/dev/null || true
fi

# Swap any `motion/react` imports for `framer-motion` (Aceternity's newer
# components reference the `motion` package but we standardised on
# `framer-motion` — they're API-compatible for what Aceternity uses).
echo ""
echo "🔧 Patching imports: motion/react → framer-motion"
if find src/aceternity/ui -name "*.tsx" -type f 2>/dev/null | head -1 > /dev/null; then
  # macOS sed needs empty '' after -i for in-place edit.
  find src/aceternity/ui -name "*.tsx" -type f -exec \
    sed -i '' 's#from "motion/react"#from "framer-motion"#g' {} +
  find src/aceternity/ui -name "*.tsx" -type f -exec \
    sed -i '' "s#from 'motion/react'#from 'framer-motion'#g" {} +
fi

echo ""
echo "✨ Done. Next:"
echo "   1. Review install-failures.log for any missing pieces"
echo "   2. Run 'pnpm exec tsc --noEmit' from packages/ui to check for type errors"
