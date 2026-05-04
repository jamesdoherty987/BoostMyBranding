#!/usr/bin/env bash
# Retry the components that failed by name. Aceternity uses slightly
# different slugs than what the demo filenames suggest — these are the
# corrected names based on the registry's naming convention (singular
# forms, no redundant suffixes, etc.).

if [ -z "${ACETERNITY_API_KEY:-}" ]; then
  if [ -f ../../.env ]; then
    export ACETERNITY_API_KEY="$(grep -E '^ACETERNITY_API_KEY=' ../../.env | cut -d '=' -f 2-)"
  fi
fi

# Map: "attempted-name" -> "alternative-slug-to-try"
# We cycle through likely variants — singular form, shorter form, etc.
RETRIES=(
  # grid-and-dot-backgrounds: it's two separate components on the site
  "dot-pattern"
  "grid-pattern"
  # 3d-card-effect → listed as just "3d-card"
  "3d-card"
  # animated-pin is part of 3d-pin already, skip
  # background-overlay-card → likely "content-card"
  "content-card"
  # expandable-card → "expandable-cards" (plural)
  "expandable-cards"
  # glowing-stars-background-card
  "glowing-stars-card"
  # hover-effect = card-hover-effect (already installed)
  # linkpreview → "link-preview"
  "link-preview"
  # pin-container = 3d-pin (same thing; already installed)
  # shimmer-button
  "shimmer-button"
  # aceternity-logo → "logo"
  "aceternity"
  # gradient-text
  "colourful-text"
  # lamp-effect → "lamp"
  "lamp"
  # scroll-based-velocity
  "velocity-scroll"
  # signup-form
  "sign-up-form"
  # feature-sections → not a primitive, skip
  # follow-pointer
  "following-pointer"
  # layout → skip, that's a template concept not a primitive
  # github-globe → just "globe" (already installed)
  # pointer
  "cursor"
  # Additional primitives discovered from demo file references:
  "moving-border"
  "tilt-image"
  "sticky-scroll"
  "parallax-scroll"
  "hover-border-gradient"
  "number-ticker"
)

SUCCESS=0
FAIL=0
: > retry-failures.log

echo "🔁 Retrying ${#RETRIES[@]} alternative names..."
echo ""

for NAME in "${RETRIES[@]}"; do
  printf "  %-30s " "$NAME"
  OUTPUT=$(npx shadcn@latest add "@aceternity/${NAME}" --yes 2>&1)
  if [ $? -eq 0 ] && echo "$OUTPUT" | grep -q -E "(Created|Updated) "; then
    echo "✓"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "✗"
    FAIL=$((FAIL + 1))
    {
      echo "=== ${NAME} ==="
      echo "$OUTPUT"
      echo ""
    } >> retry-failures.log
  fi
done

# Relocate anything new that landed in the default path.
if [ -d "src/components/ui" ]; then
  mkdir -p src/aceternity/ui
  mv src/components/ui/*.tsx src/aceternity/ui/ 2>/dev/null || true
  rmdir src/components/ui 2>/dev/null || true
  rmdir src/components 2>/dev/null || true
fi

# Patch motion/react → framer-motion on any newly-added files.
find src/aceternity/ui -name "*.tsx" -type f -exec \
  sed -i '' 's#from "motion/react"#from "framer-motion"#g' {} + 2>/dev/null || true
find src/aceternity/ui -name "*.tsx" -type f -exec \
  sed -i '' "s#from 'motion/react'#from 'framer-motion'#g" {} + 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Succeeded: $SUCCESS"
echo "❌ Failed:    $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
