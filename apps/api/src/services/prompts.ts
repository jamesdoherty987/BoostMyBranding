/**
 * Prompt templates for the content pipeline. Kept as pure strings with
 * mustache-style slots so they can be fed into Claude verbatim.
 */

import type { SiteTemplate } from '@boost/core';

export function brandVoicePrompt(vars: {
  websiteMarkdown: string;
  businessName: string;
  industry: string;
}) {
  return `You are a brand strategist writing a VOICE STYLE GUIDE — not content, not posts, not facts. This guide describes HOW the brand communicates, not WHAT it says. Downstream AI will use this to style real posts about real events; this guide must NEVER instruct it to invent staff names, tenure, events, products, anniversaries, or any other specifics.

BUSINESS: "${vars.businessName}" (${vars.industry})

SOURCE CONTENT (scraped from the business's website — treat as the only source of truth for facts):
${vars.websiteMarkdown || '(no website provided — do not invent claims; stay generic on facts and specific on style)'}

════════════════════════════════════════════════════════════════════
HARD RULES
════════════════════════════════════════════════════════════════════

- Do NOT invent names of staff, pets, regulars, suppliers, founders.
- Do NOT invent dates, tenure, years in business, or anniversaries.
- Do NOT invent products, prices, services, awards, or certifications.
- Do NOT invent customer stories or testimonials.
- Example posts below must describe the STYLE only — use placeholders like [service name] / [location] / [staff name], never real-sounding names unless they are literally in the SOURCE CONTENT.
- If SOURCE CONTENT is empty or thin, lean on industry norms and keep every field honest. Generic is fine. Made-up is not.

════════════════════════════════════════════════════════════════════
OUTPUT — JSON only
════════════════════════════════════════════════════════════════════

{
  "tone": "<two adjectives that describe how this brand sounds. Pull from evidence in the SOURCE where possible. E.g. 'direct and warm' or 'dry and technical'. Avoid meaningless pairs like 'professional and friendly'.>",
  "personality": "<one sentence about HOW the brand communicates, not who. E.g. 'Talks like an experienced tradesperson explaining things to a homeowner — plain language, no jargon unless necessary.' NOT 'A 52-year-old plumber named Liam who…' — never invent biography.>",
  "vocabulary": {
    "use": ["<6-12 style-level words this brand prefers. Only include craft/industry terms that actually appear in SOURCE CONTENT, e.g. 'boiler service', 'power flush'. Avoid brand-marketing fluff like 'quality', 'premium'.>"],
    "avoid": ["<6-10 words this brand would not use. Be specific: 'synergy', 'disrupt', 'journey', 'curate', 'passionate'.>"]
  },
  "sentenceStyle": "<short|medium|long + a specific rule. E.g. 'short — 6-12 words per sentence; fragments OK; one idea per sentence'>",
  "emojiUsage": "<none|minimal|moderate|heavy + what's acceptable>",
  "hashtagStyle": "<rule for hashtag choice. Mention only categories (location, craft, community), not specific tags, unless SOURCE CONTENT confirms them.>",
  "callToActionStyle": "<describe the CTA style. E.g. 'Soft and factual. Point at a real contact method from the business info. Never urgency ("DON\\'T MISS OUT") or vague ("DM us").'>",
  "targetAudience": "<one sentence about who the business serves, drawn from SOURCE CONTENT. If unknown, describe the typical ${vars.industry} audience generically.>",
  "contentPillarsAllowed": [
    "<4-5 content pillars the brand is qualified to post about — styled as topic categories, not specific claims. E.g. 'Education about the craft (how boilers work, what causes blockages)'. NOT 'Spotlight on our team member Liam'.>"
  ],
  "dontDoList": ["<5-7 things this brand should never post. E.g. 'Motivational quotes', 'Happy Monday', 'Generic stock-photo promos', 'Fabricated testimonials', 'Trending dances'>"],
  "stylisticExamples": {
    "instagram": "<ONE template-style Instagram post using placeholders for anything that would be a fact. Example for a plumber: 'Quick [service] in [area] this morning. [1-sentence generic tip about the service].' NOT an invented anecdote with invented names and times. Show the STYLE without inventing content.>",
    "linkedin": "<Same idea for LinkedIn — placeholder-based template demonstrating sentence length, tone, professional register>",
    "facebook": "<Same idea for Facebook — conversational, placeholder-based>"
  }
}

CRITICAL: the downstream content generator will read this guide and treat any factual claim as real. Placeholders protect against hallucination. If you write "Liam's been with us three years" in an example, downstream posts will reuse that fabricated fact. Use [staff name] and [tenure] instead.`;
}

export function imageAnalysisPrompt(vars: { industry: string; businessName: string }) {
  return `You are a photo editor evaluating this image for social media use. The business is "${vars.businessName}" (${vars.industry}).

Score honestly — a 10 is a magazine-quality hero shot, a 7 is a solid usable image, a 5 is OK with a caption, a 3 or lower should not be published.

Return ONLY valid JSON:
{
  "qualityScore": <1-10 integer. Consider: focus, lighting, composition, on-brand subject, resolution.>,
  "usable": <true if qualityScore >= 5 AND the subject matches the business. Otherwise false.>,
  "issues": [<short list of specific defects. Example: ['blurry at edges', 'yellow white-balance', 'off-center subject', 'visible competitor branding', 'stock-photo vibe']. Omit if none.>],
  "subject": "<one specific sentence. Not 'a coffee shop' but 'a flat-white in a stoneware mug on a wooden counter, morning light from the left'. Name what's actually in the frame.>",
  "mood": "<one of: professional|casual|energetic|warm|luxurious|rustic|modern|cozy|bold|quiet>",
  "bestPlatforms": [<subset of: 'instagram-feed', 'instagram-story', 'instagram-reel-cover', 'facebook', 'linkedin', 'tiktok-cover', 'x'. Pick based on aspect ratio and subject. Don't pick all of them.>],
  "suggestedCrop": "<portrait|landscape|square — match the strongest composition>",
  "captionAngle": "<ONE specific caption hook this photo could anchor. Not 'promote the service' but a specific angle like 'Tuesday morning rush — three flat whites in, and we haven't had ours yet' or 'New lash tint range landed this week — the warm brown is selling out fast'.>",
  "tags": [<2-4 short tags for filtering: 'food', 'team', 'behind-the-scenes', 'product', 'exterior', 'before-after', 'tool-of-trade', 'customer', 'location'>],
  "needsEditing": <true if fixable defects (exposure, crop, background clutter) would lift this from 4-6 to 7+. False if fundamentally unusable or already good.>,
  "editingSuggestions": [<only if needsEditing. Short bullet list: 'brighten shadows', 'crop to square centering on mug', 'desaturate background'.>],
  "fluxKontextPrompt": "<only if needsEditing. One concrete instruction to Flux Kontext. Example: 'Slightly brighten the foreground without changing the subject. Keep the mug exactly as-is. Warm the white balance by 200K.' Keep the subject unchanged — never describe a different scene.>"
}

CRITICAL: fluxKontextPrompt must preserve the original subject. Flux Kontext edits; it doesn't reimagine. If the image needs a new subject, set needsEditing to false and usable to false.`;
}

export function contentCalendarPrompt(vars: {
  businessName: string;
  industry: string;
  brandVoice: string;
  imageDescriptions: string;
  knownFacts?: string;
  month: string;
  year: string | number;
  postsCount: number;
  platforms: string[];
  direction?: string;
}) {
  return `You are the in-house social media manager for "${vars.businessName}" (${vars.industry}). Your job is to write captions that are truthful, in the brand's voice, and grounded in the inputs below.

════════════════════════════════════════════════════════════════════
ANTI-HALLUCINATION RULES — READ FIRST, THESE OVERRIDE EVERYTHING
════════════════════════════════════════════════════════════════════

You are writing for a REAL company that will post these to REAL social accounts. Fabricating facts can damage their business.

YOU MAY NEVER:
- Invent names of staff, team members, customers, suppliers, or partners
- Invent tenure ("three years this week", "since 2019")
- Invent dates, anniversaries, opening times, or events that aren't in the inputs
- Invent products, menu items, service names, or prices
- Invent locations, addresses, or cities (other than confirmed ones)
- Invent customer testimonials, reviews, or quotes
- Invent certifications, awards, or credentials
- Invent statistics ("90% of our customers…")
- Use phrases like "our team", "our staff", "my apprentice" unless the inputs name specific people
- Write stories, anecdotes, or "behind-the-scenes moments" that didn't happen

You MAY:
- Describe what is literally visible in a provided image
- Reference facts explicitly listed in KNOWN FACTS
- Make general educational statements about the industry (with no false specifics)
- Ask open questions
- Describe services in generic-but-truthful language
- Use seasonal context that's objectively true (e.g. "May" is May)

IF YOU CANNOT WRITE A POST WITHOUT FABRICATING, return that entry with:
  "skip": true,
  "skipReason": "<one sentence saying what data was missing>"
The system will drop skipped entries and deliver fewer posts rather than publishing lies. This is expected and correct behaviour. Returning 18 honest posts is better than 30 made-up ones.

════════════════════════════════════════════════════════════════════
INPUTS
════════════════════════════════════════════════════════════════════

BRAND VOICE GUIDE (style rules only — NOT facts):
${vars.brandVoice}

KNOWN FACTS (truthful inputs you may reference verbatim):
${vars.knownFacts || '(no facts provided — keep captions factual and general; do not invent specifics)'}

AVAILABLE IMAGES THIS MONTH (index → AI description of what the image actually shows):
${vars.imageDescriptions || '(no images — skip any post that cannot be written without one)'}

MONTH: ${vars.month} ${vars.year}
POSTS TO GENERATE (maximum): ${vars.postsCount}
PLATFORMS: ${vars.platforms.join(', ')}
${vars.direction ? `\nEXTRA DIRECTION FROM AGENCY:\n${vars.direction}` : ''}

════════════════════════════════════════════════════════════════════
OUTPUT
════════════════════════════════════════════════════════════════════

Return ONLY a JSON array. Each entry is either a real post or a skip:

[
  {
    "skip": false,
    "dayOfMonth": <1-28>,
    "platform": "<one of the platforms>",
    "caption": "<full caption in brand voice — see rules below>",
    "hashtags": ["<relevant tags>"],
    "imageIndex": <integer index from AVAILABLE IMAGES — REQUIRED for 'real' posts>,
    "contentType": "<educational|service_info|product_info|behind_the_scenes|question|seasonal|generic>",
    "timeOfDay": "<morning|afternoon|evening>",
    "hook": "<first 4-7 words of caption>",
    "groundingSources": ["<short list naming which inputs you drew from. e.g. ['image index 3', 'known fact: address'] — if empty or uncertain, set skip=true instead>"]
  },
  {
    "skip": true,
    "skipReason": "<e.g. 'No team photos or named staff provided; team-intro post cannot be written honestly.'>"
  }
]

════════════════════════════════════════════════════════════════════
IMAGE MATCHING — STRICT
════════════════════════════════════════════════════════════════════

- imageIndex is REQUIRED for every non-skipped post. If no suitable image exists, SKIP the post.
- The caption MUST describe or relate to what the image actually shows (per its AI description).
- Never invent what's in an image. If the description says "exterior shopfront with green door", don't write "Maria behind the counter".
- Never reuse the same imageIndex more than twice across the month.

════════════════════════════════════════════════════════════════════
CAPTION RULES
════════════════════════════════════════════════════════════════════

1. HOOKS. Specific, but only from facts you actually have. If the image description says "espresso machine with portafilter locked in", a good hook is "Pulling shots this morning." If you don't know what morning or who, don't invent it.

2. TRUTHFUL SPECIFICITY. Reference real details from the image or KNOWN FACTS. Not "our award-winning coffee" unless an award is in KNOWN FACTS. Not "Liam's been with us three years" unless Liam and three years are in KNOWN FACTS.

3. ONE IDEA PER POST.

4. SOFT CTAs ONLY. Match brand voice's CTA style. Use only contact methods that appear in KNOWN FACTS.

5. PLATFORM LENGTH (strict):
   - Instagram: 150-300 chars + 15-25 hashtags
   - LinkedIn: 400-800 chars, 3-5 hashtags at end
   - Facebook: 100-250 chars, 2-5 hashtags
   - TikTok: 50-150 chars, 5-10 hashtags
   - X: under 270 chars total

6. HASHTAG QUALITY. Location-based only if the location is in KNOWN FACTS. Otherwise stick to craft/industry tags (#plumbing, #emergencyplumber). No generic fluff (#love, #instagood, #mondaymotivation).

7. NO AI TELLS. Never: "dive into", "elevate", "seamless", "game-changer", "journey", "unlock", "curate", "craft" (verb), "passion", "harness", "ever wondered".

8. NO HOLIDAY FILLER. No "Happy Monday" or day-of-the-week posts.

════════════════════════════════════════════════════════════════════
CONTENT TYPES (what's allowed without specific facts)
════════════════════════════════════════════════════════════════════

- service_info: describe what the business does, generically. "Boiler breakdowns, 24/7." Safe without specifics.
- educational: general tips about the craft. "Three signs your radiator needs bleeding." Safe.
- product_info: describe something literally visible in an image.
- behind_the_scenes: ONLY with a matching image. Describe what the image shows.
- question: ask an engagement question. "What's the weirdest thing you've pulled out of a sink trap?" Safe.
- seasonal: seasonal framing of a service. "Frozen pipes season. Lag the external ones first." Safe.
- generic: general brand-voice post tied to an image subject.

NOT ALLOWED without matching KNOWN FACTS:
- team_spotlight (needs named people)
- testimonial (needs real quote)
- anniversary / tenure ("X years", "since Y")
- specific customer stories

════════════════════════════════════════════════════════════════════
FINAL SELF-CHECK
════════════════════════════════════════════════════════════════════

Before returning, for each non-skipped post ask:
1. Can every specific claim in this caption be traced back to KNOWN FACTS or the imageIndex description?
2. If I remove the brand name, would this post still be factually correct?
3. Is the image actually suitable for this caption?

If any answer is "no", change the post to skip=true with skipReason.

Generate up to ${vars.postsCount} posts. Return fewer if that's all you can honestly write.`;
}

export function platformFormatterPrompt(vars: {
  targetPlatform: string;
  sourcePlatform: string;
  caption: string;
  hashtags: string[];
  brandVoiceSummary: string;
}) {
  return `Reformat this social media post for ${vars.targetPlatform}.

ORIGINAL (written for ${vars.sourcePlatform}):
Caption: ${vars.caption}
Hashtags: ${vars.hashtags.join(' ')}

BRAND VOICE: ${vars.brandVoiceSummary}

PLATFORM RULES:
- Instagram: 150-300 chars, 20-30 hashtags, emoji-friendly
- LinkedIn: 200-500 chars, professional tone, 3-5 hashtags
- Facebook: 100-250 chars, conversational, 2-5 hashtags
- TikTok: 50-150 chars, casual/trendy, 5-10 hashtags, hook first
- X: under 280 chars total with hashtags, punchy, 1-3 hashtags

Return ONLY JSON:
{ "caption": "<reformatted>", "hashtags": [...] }`;
}

/**
 * Regenerate a single post. The user is looking at an existing caption
 * and wants a fresh take — either because the original was bland,
 * off-brand, or because they want to nudge the angle. Unlike the
 * calendar prompt, this is ONE post, so we can give Claude a tighter
 * brief and demand more specificity.
 */
export function regeneratePostPrompt(vars: {
  businessName: string;
  industry: string;
  brandVoice: string;
  currentCaption: string;
  currentHashtags: string[];
  platform: string;
  contentType?: string;
  imageSubject?: string;
  knownFacts?: string;
  instruction?: string;
}) {
  return `You are rewriting a single social post for "${vars.businessName}" (${vars.industry}).

════════════════════════════════════════════════════════════════════
ANTI-HALLUCINATION RULES
════════════════════════════════════════════════════════════════════

You must NEVER invent names of staff, customers, partners; tenure or anniversaries; events that didn't happen; products or prices; testimonials; awards; statistics. If the current caption already contains any fabricated specifics, strip them out — don't preserve them.

Facts you may use:
- Anything literally visible in IMAGE IN THE POST (see below).
- Anything listed in KNOWN FACTS.
- General industry-standard information.

Nothing else.

If you cannot write a better version without fabricating, return the current caption with a note.

════════════════════════════════════════════════════════════════════
INPUTS
════════════════════════════════════════════════════════════════════

BRAND VOICE GUIDE (style only — not facts):
${vars.brandVoice}

KNOWN FACTS (safe to reference):
${vars.knownFacts || '(none — keep this post generic/factual; do not invent specifics)'}

PLATFORM: ${vars.platform}
CONTENT TYPE: ${vars.contentType ?? 'general'}
${vars.imageSubject ? `IMAGE IN THE POST: ${vars.imageSubject}` : 'NO IMAGE'}

CURRENT CAPTION:
${vars.currentCaption}

CURRENT HASHTAGS: ${vars.currentHashtags.join(' ')}

${vars.instruction ? `USER FEEDBACK: ${vars.instruction}\n` : ''}

════════════════════════════════════════════════════════════════════
OUTPUT
════════════════════════════════════════════════════════════════════

Return ONLY JSON:
{
  "caption": "<rewritten caption — grounded in inputs only>",
  "hashtags": ["<fresh hashtags, lowercase, no generic fluff>"],
  "hook": "<first 4-7 words of new caption>",
  "rationale": "<one sentence: what you changed and why, or 'Could not rewrite without fabricating — see note' if applicable>",
  "fabricatedClaimsStrippedFromOriginal": ["<list anything you removed because it was invented, e.g. 'named a staff member Liam', '3-year tenure claim'. Empty if none found.>"]
}

════════════════════════════════════════════════════════════════════
RULES
════════════════════════════════════════════════════════════════════

- No fabrications. Period.
- Honor brand voice style (tone, sentence length, emoji rules, CTA style).
- Platform length: Instagram 150-300, LinkedIn 400-800, Facebook 100-250, TikTok 50-150, X under 270.
- NO AI TELLS: "dive into", "elevate", "seamless", "game-changer", "journey", "unlock", "curate", "craft" (verb), "passion", "harness", "ever wondered".
- Hashtags lowercase; no #love, #instagood, #mondaymotivation, #inspiration.
- If IMAGE IN THE POST is present, the caption MUST relate to what the image actually shows.
- If the user gave feedback, prioritise it — but anti-hallucination still wins. If the user asks for something that requires invented facts ("mention my apprentice Liam"), only comply if those facts are in KNOWN FACTS.`;
}

/**
 * Website config generator. Produces a structured JSON blob that drives a
 * marketing site from a small set of client inputs. Intentionally opinionated
 * about shape so the front-end can render it deterministically.
 *
 * The output can describe either a single-page site OR a multi-page site
 * — Claude decides based on the business. Most small service businesses
 * just need one scroll-able page; restaurants often benefit from a
 * separate Menu page; professional services sometimes want Practice
 * Areas / About / Contact as distinct pages.
 */
export function websiteConfigPrompt(vars: {
  businessName: string;
  industry: string;
  description: string;
  existingMarkdown?: string;
  services?: string[];
  hasHours?: boolean;
  hasBooking?: boolean;
  imageDescriptions?: string;
  template?: SiteTemplate;
  suggestions?: string;
  /**
   * Authoritative business facts (address, phone, team, service areas etc.)
   * the agency has typed into the generation form. Claude should use these
   * verbatim in copy — the renderer also stamps them onto the final
   * config after the AI pass, so invented variants are overwritten.
   */
  seededFacts?: string;
}) {
  return `You are a senior brand & web designer + copywriter. Generate a complete, high-quality website config JSON for "${vars.businessName}", a ${vars.industry} business.

BUSINESS DESCRIPTION:
${vars.description}

${vars.existingMarkdown ? `EXISTING SITE CONTENT (for voice + facts):\n${vars.existingMarkdown}\n` : ''}${vars.services?.length ? `KNOWN SERVICES: ${vars.services.join(', ')}\n` : ''}${vars.imageDescriptions ? `AVAILABLE IMAGES:\n${vars.imageDescriptions}\n` : ''}${vars.template ? `TEMPLATE HINT (may override if a different one fits better): ${vars.template}\n` : ''}${vars.suggestions ? `AGENCY SUGGESTIONS:\n${vars.suggestions}\n` : ''}${vars.seededFacts ? `\nAUTHORITATIVE BUSINESS FACTS (use these exactly — do NOT invent or paraphrase the values. These are ground truth from the agency):\n${vars.seededFacts}\n` : ''}

Return ONLY valid JSON in this exact shape:
{
  "template": "<service|food|beauty|fitness|professional|retail|medical|creative|realestate|education|automotive|hospitality|legal|nonprofit|tech>",
  "layout": ["nav","hero","stats","services","about","gallery","reviews","faq","contact","footer"],
  "meta": {
    "title": "<SEO page title, ≤60 chars>",
    "description": "<SEO meta description, ≤160 chars>",
    "keywords": ["..."]
  },
  "brand": {
    "tagline": "<6-10 words>",
    "tone": "<warm|professional|playful|premium>",
    "primaryColor": "<hex, industry-appropriate>",
    "accentColor": "<hex, complementary>",
    "popColor": "<hex, optional highlight>",
    "darkColor": "<hex, near-black for footer>",
    "heroStyle": "<light|dark>",
    "logoIndex": <index from AVAILABLE IMAGES if one is a logo (square, transparent, contains business name), or null>
  },
  "hero": {
    "eyebrow": "<optional 2-4 word kicker, e.g. 'Family-run since 1998'>",
    "headline": "<8-14 words, benefit-led. Last 2 words are auto-highlighted.>",
    "subheadline": "<1-2 sentences>",
    "ctaPrimary": { "label": "<action verb>", "href": "<#section or url>" },
    "ctaSecondary": { "label": "...", "href": "..." },
    "imageIndex": <index from AVAILABLE IMAGES, or null if none suit the hero>,
    "variant": "<spotlight|beams|floating-icons|parallax-layers|gradient-mesh|aurora|wavy|sparkles|hero-highlight|dither|multicolor|full-bg-image|two-column-image|meteors|vortex|lamp|shooting-stars|boxes|ripple>",
    "floatingIcons": ["<6-8 Lucide icon names OR emoji strings — only when variant is floating-icons>"],
    "cutouts": [
      {
        "url": "<transparent PNG URL — leave empty array unless the client has provided one>",
        "x": <0-100, percent from left>,
        "y": <0-100, percent from top>,
        "size": <15-45, percent of hero width>,
        "rotate": <degrees, usually 0 to 15>,
        "layer": <0 behind copy, 1 in front>,
        "animation": "<float|tilt|orbit|pulse|drift|none>",
        "speed": <0.5-2>,
        "shadow": <0-2>
      }
    ]
  },
  "stats": [
    { "value": <number>, "suffix": "<optional>", "prefix": "<optional>", "label": "<label>" }
  ],
  "statsSection": { "eyebrow": "<optional, uppercase kicker above stats>", "heading": "<optional, e.g. 'The numbers behind the craft.'>" },
  "about": {
    "eyebrow": "<optional eyebrow, e.g. 'About us', 'Our story'>",
    "heading": "...",
    "body": "<2-3 short paragraphs separated by blank lines>",
    "bullets": ["<3-5 short proof points>"],
    "imageIndex": <number or null>
  },
  "servicesSection": { "eyebrow": "<short uppercase kicker, e.g. 'What we do'>", "heading": "<punchy, e.g. 'Every job, done properly.'>", "tagline": "<1 short sentence under the heading>" },
  "services": [
    {
      "title": "...",
      "description": "<1-2 sentences>",
      "icon": "<one of: Sparkles, Wrench, Hammer, Coffee, Utensils, Leaf, Scissors, HeartPulse, Dumbbell, Phone, Calendar, Globe, Camera, MessageCircle, Star, CheckCircle2, Zap, Truck, Home, Shield, Brush, Sun, Flame, Award, Users>"
    }
  ],
  "gallery": {
    "eyebrow": "<optional eyebrow, e.g. 'Gallery'>",
    "heading": "<optional, e.g. 'A look around.'>",
    "imageIndices": [<indices from AVAILABLE IMAGES above>]
  },
  "reviewsSection": { "eyebrow": "<short kicker, e.g. 'Reviews', 'Loved locally'>", "heading": "<e.g. 'What customers say.'>" },
  "reviews": [
    { "text": "<realistic-sounding testimonial>", "author": "<first name + last initial>", "rating": 5 }
  ],
  "faqSection": { "eyebrow": "<short kicker, e.g. 'FAQ'>", "heading": "<e.g. 'Questions, answered.'>" },
  "faq": [
    { "question": "...", "answer": "..." }
  ],
  "contact": {
    "eyebrow": "<optional, e.g. 'Contact', 'Get in touch'>",
    "heading": "...",
    "body": "...",
    "address": "<optional>",
    "phone": "<optional, international format e.g. +353 1 555 0100>",
    "email": "<optional>",
    "hours": "<optional>",
    "whatsapp": "<optional, international format e.g. +353851234567 — include for businesses where customers would message on WhatsApp (barbers, restaurants, tradesmen)>",
    "showBookingForm": ${vars.hasBooking ?? false},
    "showHours": ${vars.hasHours ?? true}
  },
  "socials": {
    "facebook": "<optional URL>",
    "instagram": "<optional URL>",
    "tiktok": "<optional URL>",
    "google": "<optional Google Business Profile URL>"
  },
  "mobileCta": {
    "primaryLabel": "<action verb for the sticky mobile bar, e.g. 'Book now', 'Get a quote', 'View menu'>",
    "primaryHref": "<same rules as hero CTA href>",
    "showCall": true,
    "showWhatsApp": <true if whatsapp is set, false otherwise>
  },
  "footer": { "tagline": "<optional footer tagline. Leave empty to reuse brand.tagline>" },
  "navigation": ["Home", "Services", "About", "Contact"],

  // INDUSTRY BLOCKS — include ONLY when the business needs them. Adding
  // the block's key to a layout without populating its data will render nothing.

  "menu": {
    "eyebrow": "<e.g. 'The menu'>",
    "heading": "<e.g. 'Small menu, done well.'>",
    "currency": "<e.g. '€', '$', '£'>",
    "categories": [
      {
        "title": "<e.g. 'Coffee', 'Mains'>",
        "description": "<optional short blurb under the category title>",
        "items": [
          {
            "name": "...",
            "description": "<optional short description>",
            "price": "<stored as string — '4.50' or 'from 12'>",
            "tags": ["V","VG","GF"],
            "featured": false
          }
        ]
      }
    ]
  },

  "priceList": {
    "eyebrow": "<e.g. 'Pricing'>",
    "heading": "<e.g. 'Simple, honest pricing.'>",
    "currency": "<e.g. '€', '$', '£'>",
    "groups": [
      { "title": "<optional group name>", "items": [ { "name": "...", "price": "25", "duration": "45 min", "note": "incl. consultation", "featured": false } ] }
    ],
    "items": [<use this flat list only when you have no groupings>],
    "footnote": "<optional, e.g. 'Prices from. Final quote on booking.'>"
  },

  "team": {
    "eyebrow": "<e.g. 'The team'>",
    "heading": "<e.g. 'Meet the people.'>",
    "members": [
      {
        "name": "...",
        "role": "<e.g. 'Senior barber', 'Dentist'>",
        "bio": "<optional 1-2 sentence bio>",
        "credentials": "<optional, e.g. 'BDS, MFDS RCSI'>",
        "specialties": ["<up to 5 chips>"],
        "photoIndex": <index from AVAILABLE IMAGES, if any match>
      }
    ]
  },

  "schedule": {
    "eyebrow": "<e.g. 'Schedule', 'Hours'>",
    "heading": "<e.g. 'This week.'>",
    "days": ["Mo","Tu","We","Th","Fr","Sa","Su"],
    "entries": [
      { "day": "Mo", "time": "18:00", "title": "HIIT", "detail": "45 min · Maria", "featured": false }
    ],
    "footnote": "<optional>"
  },

  "serviceAreas": {
    "eyebrow": "<e.g. 'Where we work'>",
    "heading": "<e.g. 'Serving these areas.'>",
    "areas": ["<town or region names — up to 20>"],
    "footnote": "<optional, e.g. 'Free quote within 20km. Call-out fee outside zone.'>"
  },

  "beforeAfter": {
    "eyebrow": "<e.g. 'Our work'>",
    "heading": "<e.g. 'Before and after.'>",
    "pairs": [
      { "beforeIndex": <image index>, "afterIndex": <image index>, "caption": "<optional>" }
    ]
  },

  "trustBadges": {
    "eyebrow": "<e.g. 'Credentials'>",
    "heading": "<e.g. 'Qualified and insured.'>",
    "badges": [
      { "label": "<e.g. 'RGI Registered', 'Fully insured to €5M'>", "detail": "<optional>", "href": "<optional link to authority register>", "icon": "<optional icon name>" }
    ]
  },

  "cta": {
    "heading": "<e.g. 'Ready to book?'>",
    "body": "<optional supporting line>",
    "buttonLabel": "<e.g. 'Book now'>",
    "buttonHref": "#contact",
    "secondaryLabel": "<optional — often 'Call' or 'WhatsApp'>",
    "secondaryHref": "<tel: or mailto: or wa.me URL>"
  },
  "customSections": [
    {
      "variant": "<image-strip|image-text-split|feature-row|pull-quote>",
      "eyebrow": "<optional>",
      "heading": "<optional>",
      "body": "<optional — REQUIRED for pull-quote and image-text-split>",
      "background": "<white|slate|brand>",
      "imageSide": "<left|right — only for image-text-split>",
      "caption": "<only for pull-quote, attribution line>",
      "items": [
        { "imageIndex": <number>, "caption": "<optional>" },
        { "icon": "<name>", "title": "...", "description": "..." }
      ]
    }
  ],

  "products": {
    "eyebrow": "<e.g. 'Shop'>",
    "heading": "<e.g. 'The shop.'>",
    "currency": "<€|$|£>",
    "categories": ["<optional filter tabs>"],
    "items": [
      {
        "name": "...",
        "description": "<optional>",
        "price": "<string — '4.50'>",
        "category": "<matches a categories entry>",
        "imageIndex": <image index>,
        "href": "<optional buy link>",
        "ctaLabel": "<e.g. 'Order', 'Buy now'>",
        "badge": "<optional — 'New', 'Sale'>",
        "featured": false
      }
    ],
    "footnote": "<optional>"
  },

  "portfolio": {
    "eyebrow": "<e.g. 'Examples', 'Recent work'>",
    "heading": "<e.g. 'Some of what we've done.'>",
    "projects": [
      {
        "title": "...",
        "summary": "<1-sentence teaser for the card>",
        "description": "<longer paragraph shown in the lightbox>",
        "imageIndices": [<indices into AVAILABLE IMAGES>],
        "tags": ["<up to 4 metadata chips>"]
      }
    ]
  },

  "process": {
    "eyebrow": "<e.g. 'How it works'>",
    "heading": "<e.g. 'Simple, every time.'>",
    "steps": [
      { "title": "Step name", "description": "<short>", "icon": "<optional icon name>" }
    ],
    "footnote": "<optional>"
  },

  "pricingTiers": {
    "eyebrow": "<e.g. 'Pricing'>",
    "heading": "<e.g. 'Plans that fit.'>",
    "currency": "<€|$|£>",
    "tiers": [
      {
        "name": "Bronze",
        "price": "49",
        "period": "/month",
        "description": "<1 line>",
        "features": ["Feature A","Feature B","Feature C"],
        "ctaLabel": "Choose Bronze",
        "ctaHref": "#contact",
        "highlighted": false
      }
    ],
    "footnote": "<optional>"
  },

  "announcement": {
    "message": "<e.g. 'Open extra hours for Christmas — book early.'>",
    "linkLabel": "<optional CTA>",
    "linkHref": "<optional>",
    "tone": "<brand|success|warning>",
    "nonDismissible": false
  },

  "logoStrip": {
    "eyebrow": "<e.g. 'Featured in'>",
    "heading": "<optional line>",
    "logos": [
      { "name": "Irish Times", "imageIndex": <index>, "href": "<optional>" }
    ]
  },

  "video": {
    "eyebrow": "<e.g. 'See it in action'>",
    "heading": "<optional>",
    "body": "<optional>",
    "url": "<YouTube / Vimeo / MP4 URL>",
    "posterUrl": "<optional, for MP4>",
    "autoplay": false
  },

  "newsletter": {
    "eyebrow": "<optional>",
    "heading": "<e.g. 'Stay in the loop.'>",
    "body": "<what subscribers get>",
    "placeholder": "<input placeholder>",
    "buttonLabel": "<e.g. 'Subscribe'>",
    "consent": "<optional one-liner>"
  },
  "pages": [
    {
      "slug": "home",
      "title": "Home",
      "layout": ["nav","hero","stats","services","about","reviews","contact","footer"]
    }
  ]
}

PAGES — SINGLE-PAGE vs MULTI-PAGE:
You MUST decide whether this business needs 1 page or 2–3 pages and populate the "pages" array accordingly. Rules of thumb:

- 1 page (just "home"): small local service businesses, single-location fitness studios, solo beauty professionals, small retail shops, most creative studios. Their whole story fits on one scrolling page.

- 2 pages: hospitality and realestate benefit from a separate dedicated page. Examples:
  * Hotel → Home + Rooms
  * Realestate agent → Home + Listings
  * Cafe with a menu worth showing off → Home + Menu
  * Gym with a class schedule → Home + Classes
  * Barber/salon with a full price list → Home + Prices
  * Tradesman covering many areas → Home + Service areas (with the areas block)
  * Retail shop with a catalog → Home + Shop (products block)
  * Tradesman with a body of work → Home + Examples (portfolio block)
  * Gym or agency with tiered packages → Home + Pricing (pricingTiers block)

- 3 pages: legal, professional, medical, and larger practices. Examples:
  * Law firm → Home + Practice Areas + About
  * Dental clinic → Home + Services + About
  * Consulting firm → Home + Services + Team

NEVER more than 4 pages total. A "Contact" page is usually unnecessary because every page has a footer with contact info AND the top-right CTA goes to the contact section.

PAGES SHAPE — each entry in "pages" looks like:
{
  "slug": "<lowercase-dashed url slug, use 'home' for the homepage>",
  "title": "<Human title for the nav, e.g. 'Our Menu'>",
  "meta": { "title": "<optional SEO override>", "description": "<optional>" },
  "layout": ["nav","hero","services","gallery","contact","footer"],
  "hero": {
    "eyebrow": "<optional, different from home>",
    "headline": "<page-specific headline>",
    "subheadline": "<page-specific subhead>"
  },
  "blocks": {
    "services": [<page-specific services if different from the home featured list>]
  }
}

When you include multiple pages:
- The HOME page layout normally includes hero + stats + services (featured) + about + reviews + contact sections to give an overview.
- Sub-pages are more focused: e.g. a Menu page is typically ["nav","hero","menu","gallery","contact","footer"] for a cafe. An About page is ["nav","hero","about","stats","team","reviews","footer"]. A Practice Areas page is ["nav","hero","services","team","faq","contact","footer"] for a law firm. A Prices page is ["nav","hero","priceList","reviews","contact","footer"] for a barber. A Schedule page is ["nav","hero","schedule","cta","contact","footer"] for a gym. A Shop page is ["nav","hero","products","faq","contact","footer"] for a retailer. An Examples / Portfolio page is ["nav","hero","portfolio","cta","contact","footer"] for a tradesman or creative. A Pricing page is ["nav","hero","pricingTiers","faq","contact","footer"].
- Sub-page hero headlines must match the page topic. "Our Menu." for a menu page, "About the team." for an about page — never recycle the homepage hero.
- Sub-page "blocks" can override services/gallery/etc. with page-specific content. Example: a law firm's homepage services list shows 4 featured practice areas; the Practice Areas sub-page's services list shows all 8. A cafe's home shows featured menu items in "services"; the Menu page has the full "menu" block.
- If a sub-page doesn't need a hero, omit it from the layout.

RULES:
- Detect the real template from the business description — don't blindly follow the TEMPLATE HINT if another fits better.
- Write everything in the client's voice, not generic marketing speak.
- 3-6 services max. Pick icon names ONLY from the list above.
- Include 3-4 stats, pick whatever's credible for the industry (years in business, customers served, response time, rating).
- 3 reviews minimum, 5 max. Make them specific (mention the service).
- 4-6 FAQ items, based on what a real customer would ask.
- Colours should fit the industry:
  * food → warm terracotta/amber
  * beauty → soft rose/magenta
  * fitness → bold blue/green (often dark hero)
  * service → teal/green
  * professional → slate/teal
  * retail → purple/gold
  * medical → calm cyan/teal
  * creative → bold red/orange
  * realestate → navy/green
  * education → indigo/violet
  * automotive → dark slate/red (often dark hero, bold)
  * hospitality → warm brown/amber
  * legal → deep navy/gold
  * nonprofit → emerald/amber
  * tech → indigo/cyan
- No placeholder text like "Lorem ipsum", always write real copy.
- If AGENCY SUGGESTIONS are provided, follow them closely — they override defaults.
- Last 2 words of the hero headline get auto-highlighted in a brand gradient. Write the headline so the last 2 words form a natural punchy phrase.
- Section eyebrows (the tiny uppercase kicker above each section heading) should feel natural for the business. Prefer short, specific kickers over generic ones:
  * services → "What we do" / "Services" / "The menu" / "Our practice areas"
  * reviews → "Reviews" / "Loved locally" / "Client stories"
  * faq → "FAQ" / "Common questions" / "Before you book"
  * about → "About us" / "Our story" / "Meet the team"
  * contact → "Contact" / "Get in touch" / "Stop by"
  * gallery → "Gallery" / "Recent work" / "Behind the scenes"
  Omit the field entirely (or use an empty string) if the default ("What we do" / "Reviews" / etc.) is already perfect for the business.
- Section headings should be short, warm, and specific. Not "Our Services" — prefer "Every job, done properly." or "Small menu, done well.".

MOBILE CTA — the sticky bottom bar on phones:
- ALWAYS populate mobileCta. For local businesses, mobile is 70%+ of traffic.
- Pick a primaryLabel that matches the business's main conversion action:
  * Barber/salon → "Book now"
  * Restaurant/cafe → "View menu" or "Reserve a table"
  * Tradesman (plumber, electrician) → "Get a quote" or "Call now"
  * Gym/fitness → "Start free trial" or "Join now"
  * Professional (lawyer, accountant) → "Book consultation"
- showCall should be true whenever a phone number is provided.
- showWhatsApp should be true when whatsapp is set — common for barbers, restaurants, and trades in Ireland/UK/Europe.

SOCIAL LINKS:
- Only include socials if the business description or existing site mentions them.
- Don't invent social URLs. If you don't know them, omit the socials object entirely.
- Google Business Profile is especially important for local businesses — include it if mentioned.

INDUSTRY-SPECIFIC BLOCKS — the whole point. Pick what actually fits:

- "menu" → cafes, restaurants, bars, pubs, bakeries, ice cream shops, food trucks. Structure as 3–6 categories (e.g. "Breakfast", "Brunch", "Drinks", "Coffee"). Include prices where reasonable — a cafe hides prices, a restaurant shows them. Use "V", "VG", "GF" tags on relevant items. Feature 1–2 signature dishes per category.

- "priceList" → barbers, hair salons, nail techs, aesthetics, tradesmen (fixed-price common jobs like "Boiler service"), mechanics (MOT, service, tyres). Group similar services ("Cuts", "Colour", "Beard"). Include duration for appointment-based services. Add a footnote when prices are "from" or require a quote.

- "team" → multi-person businesses only. Barbers with 3+ barbers, salons, dental clinics, doctors' surgeries, law firms, agencies, gyms. SKIP for solo traders (one plumber, one barber working alone) — the About section is enough. Credentials matter for medical/legal/dental. Specialties matter for barbers/stylists.

- "schedule" → gyms (class timetable), fitness studios (yoga, pilates classes), clinics (doctor availability windows), ongoing events. SKIP when the business works by appointment without a fixed weekly grid.

- "serviceAreas" → mobile / callout businesses: plumbers, electricians, mobile beauticians, dog groomers, cleaning services, delivery-focused restaurants, mobile mechanics. Critical for local SEO — include real town names from the business description or existing site. SKIP for fixed-location businesses (a cafe, a salon with one shop).

- "beforeAfter" → trades with visual results (plumbers doing bathroom refits, painters, decorators, landscapers, roofers, builders), beauty businesses (hair colour transformations, lash/brow services, aesthetics, nails). SKIP when there's no visual transformation (a lawyer, an accountant).

- "trustBadges" → any regulated trade: gas engineers (RGI, Gas Safe), electricians (Safe Electric, NICEIC), plumbers, builders (CIF, FMB), medical (GMC, IMC, Medical Council), dental (Dental Council, GDC), legal (Law Society), insurance references (Fully insured, Public liability to €X). Also good for high-trust services like childcare and cleaning.

- "cta" → MID-PAGE conversion strip. Use once between sections on the home page, typically after the "reviews" block to capture social-proof-primed visitors before they scroll past. SKIP if the page is already short (<5 sections).

When you add an industry block, put the block key in "layout" AND populate its data. The block renders nothing if the data is missing, so including the key without data is harmless but pointless.

EXTRA SMALL-BUSINESS BLOCKS — pick when they actually fit:

- "products" → small retail: gift shops, boutiques, bakeries selling whole cakes, florists with signature bouquets, candle makers. Show 4–12 items with price + "Order" link. Use categories only when the shop has clearly distinct ranges (e.g. Cakes / Bread / Pastries). SKIP for pure service businesses.

- "portfolio" → tradesmen showing completed jobs (full kitchen refits, extensions, landscaping), photographers, designers, architects, event planners. 4–6 projects with multiple photos and a short story each. Different from "beforeAfter" (which is single pair comparisons) and from "gallery" (which is a flat photo grid).

- "process" → any service business where customers wonder "what happens if I call?". 3–4 numbered steps max. Tradesmen ("Call us / Free visit / Quote / Job done"), consultants ("Discovery call / Proposal / Kickoff / Delivery"), clinics ("Book / Consultation / Treatment / Follow-up"). SKIP for retail, food, fast-service businesses where it's obvious.

- "pricingTiers" → ONLY when the business genuinely has tiered packages: gym memberships (Bronze / Silver / Gold), beauty packages (Basic / Premium facials), agency retainers, online courses. NEVER for per-service businesses — those use "priceList". Highlight the middle tier as "Most popular" usually.

- "announcement" → only when there's something time-sensitive mentioned in the description. Christmas hours, grand opening, summer promo, new location. Omit if nothing is time-specific — a permanently-visible bar trains visitors to ignore it.

- "logoStrip" → when the business mentions press ("Featured in the Irish Times"), partners, awards, or certification bodies with recognisable logos. Requires actual logo images in AVAILABLE IMAGES. Don't invent logo URLs.

- "video" → when the client provides a video URL (YouTube, Vimeo, MP4). Especially good for restaurants (interior tour), fitness (class taster), trades (project walkthrough). Only include when a URL is actually known.

- "newsletter" → content businesses (cafes with seasonal menus, shops with monthly new stock, personal trainers with weekly tips). Skip for one-off transaction businesses (plumbers, locksmiths) where a newsletter doesn't fit.

HERO CUTOUTS:
- Only include "cutouts" if the client has provided a transparent PNG in their uploaded images (check AVAILABLE IMAGES — e.g. "coffee cup cutout, transparent bg"). Do NOT invent cutout URLs.
- When you do include one, position it opposite the copy: for left-aligned heroes put the cutout at x=80 y=50; for centered heroes put it at x=50 y=85 or x=15 y=20.
- Pick animation to fit the subject: float for drinks / food, tilt for tools or props, orbit for logos / badges, pulse for stars or highlights.
- Shadow 1 is usually right. Use 2 only for bold, poster-style heroes.
- Layer 0 (behind copy) is the default — only use layer 1 when the cutout is meant to "cover" a corner of the copy (e.g. a coffee cup drifting in from the edge).

CUSTOM SECTIONS — use sparingly. They're the escape hatch for when the prebuilt blocks don't fit.
- Include "custom" in the layout AND populate "customSections" with one or more entries.
- Use "image-strip" when the business wants to show 2–5 photos with short captions that don't warrant a full gallery (e.g. "A few of our favourite cakes", "The team on a day out").
- Use "image-text-split" for a story/heritage section with one strong photo and a paragraph of copy ("From a Dublin kitchen to your cup").
- Use "feature-row" for a values/benefits strip that doesn't belong in services (e.g. "Why we source locally — Three things we care about").
- Use "pull-quote" for founder's words, press quotes, or a manifesto line. Different from reviews — reviews are customers, pull-quotes are statements of the brand.
- Most businesses don't need custom sections. Default to zero. Add one ONLY when the business description mentions something that clearly doesn't fit any prebuilt block.
- Never put a custom section on the home page's layout if it duplicates content that's already in a prebuilt block.

HERO VARIANT GUIDE — pick the one that matches the business personality:
- "spotlight": Centered copy with a mouse-following glow. Premium, confident, minimal. Best for professional services, medical, consultancies, high-end brands.
- "beams": Animated SVG beams sweeping across in brand colors. Energetic, forward-moving. Best for fitness, coaching, creative studios, education, tech-adjacent trades.
- "floating-icons": Left copy with parallax icons/emojis drifting behind it. Playful, warm. Best for food (coffee icon + utensils + emojis), beauty (scissors + sparkles), retail. When you pick this variant you MUST populate floatingIcons with 6-8 entries — mix of Lucide icon names from the services list and emojis relevant to the business.
- "parallax-layers": Split layout with hero image parallaxing deeper than copy. Classic, works with photography. Best for service trades, real estate, beauty with good photos.
- "gradient-mesh": Slow-shifting gradient mesh, no image needed. Bold, minimal, confident. Best for retail, creative, or any client without great photography.
- "aurora": Aceternity aurora sheets sweep behind centered copy. Modern, premium, dreamy. Best for wellness, creative agencies, yoga studios, lifestyle brands. No photo needed.
- "wavy": Flowing noise-waves in brand colors. Smooth and modern. Best for salons, wellness, creative services. No photo needed.
- "sparkles": Drifting particle field on deep black. Celebratory, premium, night-sky energy. Best for event venues, photographers, launches, gala businesses.
- "hero-highlight": Dot-grid background with a highlighted phrase. Minimal, text-first, professional. Best for consultants, law firms, accountants — anywhere the message dominates and motion stays subtle.
- "dither": Retro stippled pattern on dark with a brand-color wash. Tech-adjacent, modern, slightly nostalgic. Best for photography, design studios, tech-adjacent trades.
- "multicolor": Soft color orbs in brand palette. Bold and playful without feeling childish. Best for creative agencies, kids brands, playful retail.
- "full-bg-image": Full-bleed client photo with a dark overlay and copy overlaid. Immersive, mood-heavy. Best for restaurants, hotels, event venues, anywhere a strong photo sells the experience.
- "two-column-image": Copy + CTAs on the left, photo on the right. The cleanest "local business" hero — plumbers, cafes, dentists, salons. Works well with standard portrait photos.
- "meteors": Falling meteor trails on a dark canvas. Event / launch / nightlife energy. Best for gyms, event venues, photographers, anything night-oriented.
- "vortex": Swirling colored particles behind centered copy. Premium and dynamic. Best for creative agencies, tech-adjacent trades, modern restaurants.
- "lamp": Dramatic overhead spotlight that fades up as the page loads. Luxury and cinematic. Best for high-end services, boutique hotels, event venues, luxury retail.
- "shooting-stars": Starry night sky with occasional meteors streaking across. Dreamy and premium. Best for observatories, rooftop venues, night photography, night-oriented businesses.
- "boxes": Animated 3D-tilted grid of boxes that color-shift on hover. Tech-forward and interactive. Best for design studios, creative agencies, modern retail.
- "ripple": Subtle radial ripple pattern behind centered copy on a light background. Calm and modern. Best for wellness, spas, tech-adjacent trades.

IMAGE GUIDANCE:
- Set hero.imageIndex to a number ONLY if an AVAILABLE IMAGE looks like a strong hero (wide, high-quality, representative). Otherwise null — the system will generate a custom AI illustration.
- Prefer "parallax-layers" when a hero image IS set.
- Prefer "gradient-mesh", "beams", "spotlight", "aurora", or "wavy" when no hero image is set.
- Prefer "floating-icons" for warm, personality-driven businesses regardless of image availability.
- Prefer "sparkles" only for celebratory / event / night-oriented businesses.
- Prefer "hero-highlight" for text-first B2B / professional services.

LOGO PLACEMENT (critical — don't send logos as hero images):
- Logos are small, square or close-to-square, often on white or transparent backgrounds, and usually contain the business name. Signs of a logo: "logo", "brand mark", "symbol", "icon" in the label, aspect ratio close to 1:1, simple graphic.
- Logos go in brand.logoIndex, NOT hero.imageIndex. The nav renders brand.logoIndex at ~32px high — a wide landscape photo there looks broken.
- Photos of the storefront, team, food, work-in-progress, or finished projects are hero candidates (hero.imageIndex). They're usually wide landscape and detail-rich.
- If multiple images qualify as logos, pick the cleanest / most square one.
- If no clear logo exists, leave brand.logoIndex null — the nav falls back to a colored circle with the business initial, which looks fine.
- Team member headshots go on members[].photoIndex, never on hero.imageIndex or brand.logoIndex.
- Product shots go on products.items[].imageIndex, never on hero.
- Gallery / portfolio images go in gallery.imageIndices[] or portfolio.projects[].imageIndices[].`;
}

/**
 * Video script planner. Given a client's brand voice and the pool of
 * available media (with AI subject descriptions), produce a sequenced
 * script for a 15–25 second Reels-style short. Each clip includes:
 *   - which media item to use (by index) OR a Flux prompt for a
 *     generated still + motion treatment
 *   - a short eyebrow and a punchy caption in the brand voice
 *   - a focal point so the Ken Burns zoom stays on subject
 *   - a duration in seconds
 *
 * The planner is opinionated about story arc: open with a hook clip,
 * build through a middle, land with a payoff. Without this, Claude
 * defaults to a list of "nice shots" with no narrative.
 */
export function videoScriptPrompt(vars: {
  businessName: string;
  industry: string;
  brandVoice: string;
  mediaDescriptions: string;
  knownFacts?: string;
  videoIntent: string;
  clipCount: number;
  headline?: string;
  cta?: string;
  platform?: string;
  /** Additional style controls from the advanced UI form. */
  pacing?: 'slow' | 'balanced' | 'fast';
  musicMood?: string;
  captionStyle?: 'minimal' | 'bold' | 'magazine' | 'handwritten' | 'subtitle';
  aspectRatio?: '9:16' | '1:1' | '16:9';
  openingFrame?: 'hook_headline' | 'wide_shot' | 'close_up' | 'logo_reveal';
  closingFrame?: 'cta_card' | 'logo_only' | 'contact_info' | 'fade_to_black';
}) {
  return `You are directing a ${vars.clipCount}-clip ${vars.aspectRatio ?? '9:16'} short-form video for "${vars.businessName}" (${vars.industry}). ${vars.platform ?? 'Instagram Reels / TikTok'}. Sound off by default — on-screen captions do the talking.

════════════════════════════════════════════════════════════════════
ANTI-HALLUCINATION RULES — NON-NEGOTIABLE
════════════════════════════════════════════════════════════════════

- Never invent names of staff, customers, events, products, awards, tenure, dates, stats.
- Captions must describe what the clip's media ACTUALLY shows (see media description), OR state a generic truth about the service.
- If you cannot write a clip without fabricating, mark it "skip": true.
- If the overall video cannot be honestly built from the inputs, return {"cannotBuild": true, "reason": "<one sentence>"}.

════════════════════════════════════════════════════════════════════
INPUTS
════════════════════════════════════════════════════════════════════

BRAND VOICE (style only — not facts):
${vars.brandVoice}

KNOWN FACTS (safe to reference in captions, outro, CTA):
${vars.knownFacts || '(none — keep all copy generic-factual; do not invent)'}

AVAILABLE MEDIA (index · kind · what it actually shows):
${vars.mediaDescriptions || '(no media — see INTENT below to decide if a video can be built at all)'}

INTENT: ${vars.videoIntent}
${vars.headline ? `HEADLINE (forced): ${vars.headline}` : ''}
${vars.cta ? `CTA (forced): ${vars.cta}` : ''}
PACING: ${vars.pacing ?? 'balanced'}
${vars.musicMood ? `MUSIC MOOD: ${vars.musicMood}` : ''}
CAPTION STYLE: ${vars.captionStyle ?? 'minimal'}
OPENING FRAME: ${vars.openingFrame ?? 'hook_headline'}
CLOSING FRAME: ${vars.closingFrame ?? 'cta_card'}

════════════════════════════════════════════════════════════════════
OUTPUT
════════════════════════════════════════════════════════════════════

EITHER:
  { "cannotBuild": true, "reason": "<why>" }

OR:
{
  "hookHeadline": "<4-7 words, honest. If no headline is forced and inputs are thin, use a generic-factual line like '[Industry] in [Location]' only if location is in KNOWN FACTS, otherwise just the service.>",
  "outroHeadline": "<4-7 words, landing. Must not state unproven claims.>",
  "suggestedCta": "<only use CTA styles present in KNOWN FACTS — e.g. 'Call [phone]', 'Book online', 'DM to book'. Generic 'Learn more' is always safe.>",
  "clips": [
    {
      "order": <integer 0-based>,
      "skip": <true if this slot cannot be filled honestly>,
      "skipReason": "<required when skip=true>",
      "mediaIndex": <integer from AVAILABLE MEDIA — REQUIRED when skip=false; synthesis is OFF in truthful mode unless the user explicitly enabled AI fills>,
      "eyebrow": "<optional 2-3 word kicker, only if factually safe>",
      "caption": "<6-12 words. Must describe what the media shows OR state a generic-true service line.>",
      "durationSeconds": <2.0-4.5; tuned for pacing (${vars.pacing ?? 'balanced'})>,
      "focalX": <0-1>,
      "focalY": <0-1>,
      "groundingSource": "<which input this clip draws from — 'media index 3' or 'known fact: <which>'>"
    }
  ]
}

════════════════════════════════════════════════════════════════════
STORY ARC
════════════════════════════════════════════════════════════════════

Shape the kept clips into: HOOK (attention) → PROOF (what the business does) → PAYOFF (CTA earn). Skipped clips don't count — build the arc from what you actually have.

════════════════════════════════════════════════════════════════════
MEDIA MATCHING
════════════════════════════════════════════════════════════════════

- mediaIndex is REQUIRED for non-skipped clips. No synthesis in truthful mode.
- Caption must match what the media description says is in the frame.
- Don't reuse the same mediaIndex unless the pool is too small — in which case skip the extra slots instead.

════════════════════════════════════════════════════════════════════
PACING PRESETS
════════════════════════════════════════════════════════════════════

- slow: 3.5-5.0s per clip. Calm, premium, B2B.
- balanced: 2.5-3.5s per clip. Default.
- fast: 1.8-2.5s per clip. High-energy, TikTok, young audiences.

First clip in 'fast' mode: under 2s. Last clip in any mode: 0.5-1s longer than the middle (let the CTA land).

════════════════════════════════════════════════════════════════════
CAPTION STYLE
════════════════════════════════════════════════════════════════════

- minimal: short sans-serif, low-key. Default.
- bold: large uppercase, high-impact. Fits fitness / automotive / launches.
- magazine: serif, editorial, slow cadence. Fits food / premium services.
- handwritten: script-style, warm. Fits wellness / crafts.
- subtitle: accurate transcription-style bottom-caption. Fits talking-to-camera clips.

Write the caption TEXT the same way regardless — style is a visual treatment handled downstream.

════════════════════════════════════════════════════════════════════
FINAL CHECK
════════════════════════════════════════════════════════════════════

Before returning, for each kept clip: can every word in the caption be traced to the media description or KNOWN FACTS? If not, switch that clip to skip.

Target up to ${vars.clipCount} clips. Return fewer if that's all you can honestly fill.`;
}

/**
 * Quality gate. Given a draft caption, return a structured critique and
 * (when needed) a rewrite. Used as a second pass after the main
 * calendar/regenerate prompts.
 *
 * We keep the critique machine-readable so the UI can show exactly
 * what changed and why. The downstream worker runs this at most twice
 * before accepting or flagging the draft for human attention.
 */
export function qualityGatePrompt(vars: {
  businessName: string;
  industry: string;
  brandVoice: string;
  knownFacts: string;
  imageSubject?: string;
  platform: string;
  draftCaption: string;
  draftHashtags: string[];
}) {
  return `You are a senior social media editor auditing a draft post before it goes live.

BUSINESS: "${vars.businessName}" (${vars.industry})
BRAND VOICE GUIDE:
${vars.brandVoice}

KNOWN FACTS (the only allowable factual basis for the post):
${vars.knownFacts || '(none — post must be factually generic)'}

${vars.imageSubject ? `IMAGE THE POST GOES WITH: ${vars.imageSubject}` : 'NO IMAGE'}

PLATFORM: ${vars.platform}

DRAFT CAPTION:
${vars.draftCaption}

DRAFT HASHTAGS: ${vars.draftHashtags.join(' ')}

Score the draft against these criteria (1-5 each, 5 = excellent):
- factualIntegrity: Does the caption avoid inventing names, dates, events, tenure, stats? Must be 5 — anything less requires rewriting.
- brandVoiceFit: Does it match the brand voice guide's tone and sentence style?
- hookStrength: Does the first 4-7 words make someone stop scrolling?
- imageAlignment: Does the caption clearly relate to the image? (Or N/A if no image — score 5.)
- aiTellFreedom: Does it avoid "dive into", "elevate", "seamless", "journey", "unlock", "curate", "craft" (verb), "passion", "harness", "ever wondered"?
- platformFit: Character count matches platform target (IG 150-300, LI 400-800, FB 100-250, TT 50-150, X <270)?
- specificity: Would removing the business name break the post, or could it be any business?

Return ONLY JSON:
{
  "scores": {
    "factualIntegrity": <1-5>,
    "brandVoiceFit": <1-5>,
    "hookStrength": <1-5>,
    "imageAlignment": <1-5>,
    "aiTellFreedom": <1-5>,
    "platformFit": <1-5>,
    "specificity": <1-5>
  },
  "overall": <1-5 weighted: factualIntegrity counts double>,
  "issues": ["<specific issue with the current draft>"],
  "verdict": "<accept|rewrite|reject>",
  "rewrittenCaption": "<only when verdict is 'rewrite': a fully rewritten caption fixing every issue above. Must still be factually grounded in KNOWN FACTS and IMAGE; same platform length rules.>",
  "rewrittenHashtags": ["<only when verdict is 'rewrite': fresh, cleaner hashtags>"]
}

VERDICT RULES:
- "accept" only when overall >= 4 AND factualIntegrity == 5 AND aiTellFreedom == 5.
- "rewrite" when issues are fixable without new inputs (AI tells, off-brand tone, weak hook, length).
- "reject" when the post needs inputs we don't have (e.g. it relies on a name/date we can't confirm). In this case provide a clear issues list and don't rewrite.`;
}
