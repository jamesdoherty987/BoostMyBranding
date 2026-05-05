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
  return `You are a brand strategist writing a voice guide that will be fed verbatim into a social-media content generator. The quality of every caption for the next month depends on how specific and useful this guide is. Generic answers ("warm and professional") produce generic captions — DO NOT default to them.

BUSINESS: "${vars.businessName}" (${vars.industry})

SOURCE CONTENT (scraped from their website):
${vars.websiteMarkdown || '(no website provided — infer from business name and industry)'}

Return ONLY valid JSON in this exact shape:
{
  "tone": "<two adjectives that could ONLY describe this business, not any business. Bad: 'warm and professional'. Good: 'old-school and deadpan' for a traditional barber; 'no-bullshit and helpful' for a plumber; 'gentle and granola' for a yoga studio.>",
  "personality": "<one sentence, as if describing a real person. Include age range, a quirk, and what they'd never do. Example: 'A 52-year-old barber from Cork who keeps a kettle in the back, remembers your last cut, and won't do fades just because they're trending.'>",
  "vocabulary": {
    "use": ["<8-12 specific words/phrases. Pull from the source if possible. Avoid generic words like 'quality' or 'passionate'. Prefer regional or craft-specific language.>"],
    "avoid": ["<6-10 words this brand would never use. Be specific — not just 'corporate' but actual words like 'synergy', 'disrupt', 'journey', 'curate'.>"]
  },
  "sentenceStyle": "<short|medium|long>: <specific rule. Example: 'short — 6-12 words per sentence. Fragments are OK. One idea per sentence.'>",
  "emojiUsage": "<none|minimal|moderate|heavy>: <specific guidance. Example: 'minimal — max 1 per post, and only ☕️ 🥐 ✂️ 🔧 (never 😂 or 🔥).' List allowed emojis if any.>",
  "hashtagStyle": "<specific rule. Example: '5-8 hashtags, lowercase, mix of location (#corkcity #corkbarbers) and craft (#hottowelshave #straightrazor). Never brand-marketing hashtags like #mondaymotivation.'>",
  "callToAction": "<preferred CTA phrasing + 2 example lines. Example: 'Soft CTAs, never pushy. Good: \\'Walk-ins welcome Tues-Sat\\'. Good: \\'Book via DM or call 021 555 0100\\'. Bad: \\'DON\\'T MISS OUT!\\''>",
  "targetAudience": "<one sentence, specific. Example: 'Men 30-55 in Cork who want a traditional cut without chat, and younger guys bringing their Dad.'>",
  "contentPillars": [
    "<4-5 pillars with a target % distribution. Each pillar should be about something real this business does or knows, not generic categories. Example: 'Craft (how cuts are done, tools we use) — 30%' / 'Shop life (kettle on, staff banter, the dog) — 25%' / 'Customer moments (before/after with permission) — 25%' / 'Local Cork (events, collabs, other shops) — 20%'.>"
  ],
  "dontDoList": ["<5-7 things this brand would never post about. Example: 'Motivational quotes', 'Generic holiday posts (Happy Monday!)', 'Trending dances', 'AI-sounding copy'>"],
  "examplePosts": {
    "instagram": "<Write a full Instagram post (caption + hashtags) as this brand. Must reference something specific — a product, a local place, a named staff member, a real situation. 150-300 chars for the caption.>",
    "linkedin": "<Write a full LinkedIn post. Professional but still this brand's voice. 200-500 chars.>",
    "facebook": "<Write a full Facebook post. More conversational. 100-250 chars.>"
  }
}

CRITICAL RULES:
- Ground every field in actual evidence from the source content when possible. If the source mentions "family-run since 1987", that shapes the personality. If it mentions specific products, those belong in the vocabulary.
- If source content is sparse, use the business name + industry to make grounded, specific choices — but never default to generic marketing speak.
- The examplePosts must sound like a real post from this business. If you can swap the business name for a competitor and the post still works, it's too generic — rewrite it.
- Do NOT include pricing, fabricated statistics, or claims the business has not made. Invent names of products, staff or events only if clearly implied by the source.`;
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
  month: string;
  year: string | number;
  postsCount: number;
  platforms: string[];
  direction?: string;
}) {
  return `You are the in-house social media manager for "${vars.businessName}" (${vars.industry}). You write captions that sound like the business wrote them — not like an agency or an AI. Every post should feel like it came from a specific moment in the shop/site/practice, not a content template.

BRAND VOICE GUIDE (follow this verbatim — this is the voice, not a suggestion):
${vars.brandVoice}

AVAILABLE IMAGES THIS MONTH:
${vars.imageDescriptions}

MONTH: ${vars.month} ${vars.year}
POSTS TO GENERATE: ${vars.postsCount}
PLATFORMS: ${vars.platforms.join(', ')}
${vars.direction ? `\nSPECIAL DIRECTION FROM AGENCY (honor this closely):\n${vars.direction}` : ''}

Return ONLY a JSON array:
[
  {
    "dayOfMonth": <1-28>,
    "platform": "<one of the platforms above>",
    "caption": "<the full caption, written in the brand voice above>",
    "hashtags": ["<relevant tags per platform rules below>"],
    "imageIndex": <index from AVAILABLE IMAGES, or null when no suitable photo exists>,
    "imageGenerationPrompt": "<only when imageIndex is null — see rules>",
    "contentType": "<educational|promotional|behind-the-scenes|testimonial|seasonal|engagement|product|team>",
    "timeOfDay": "<morning|afternoon|evening>",
    "hook": "<the first line of the caption, pulled out so it can be evaluated independently. Must stop a scroll.>",
    "imageMatchRationale": "<one sentence explaining why this image fits this caption. If imageIndex is null, explain what the generated image needs to show and why.>"
  }
]

CAPTION CRAFT RULES — the difference between "good" and "publishable":

1. HOOKS. The first 5-7 words decide whether the post is read. Bad hook: "We love what we do 💛". Good hook: "We broke our coffee grinder at 07:15 this morning." Every caption starts with something specific — a time, a name, a number, a sensory detail, a small problem, a surprise.

2. SPECIFICITY. Name things. Not "a delicious coffee" → "a Honduras Santa Barbara as a flat white". Not "our team" → "Mark, Sarah, and the new apprentice Cian". Not "great service" → "a callout to Drumcondra at 19:00 on a Friday". If the business voice guide mentions specific products, locations, or people, use them.

3. ONE IDEA PER POST. No post does two things. Pick: inform, amuse, prove, remind, sell. Stick to it.

4. END ON A SOFT CTA, not a hard one. Follow the brand voice CTA style. Never "DON'T MISS OUT" or "LINK IN BIO 👀👀👀".

5. PLATFORM LENGTH RULES (enforce strictly):
   - Instagram feed: 150-300 chars caption, 15-25 hashtags at the end separated by a line break.
   - LinkedIn: 400-800 chars, NO hashtags in the body (put 3-5 professional tags at the end on a new line). Professional register but still the brand's voice.
   - Facebook: 100-250 chars, 2-5 hashtags. Conversational.
   - TikTok: 50-150 chars, 5-10 hashtags. Punchy hook in the first 4 words.
   - X: under 270 chars TOTAL including 1-3 hashtags.

6. HASHTAG QUALITY. No generic hashtags (#love, #instagood, #mondaymotivation, #inspiration). Mix: location (#corkcity, #dublin8, #northdublin), craft (#hottowelshave, #flatlay, #emergencyplumber), and 1-2 community tags (#corkbarbers, #supportlocal). Lowercase only. No spaces, no more than 3 words per tag.

7. NO AI TELLS. Do NOT write: "Ever wondered...", "We've got you covered!", "dive into", "elevate", "seamless", "game-changer", "journey", "unlock", "curate", "craft" (as a verb), "passion", "harness". If the caption has one of these words, rewrite it.

8. NO HOLIDAY FILLER. Do not post "Happy Monday" or generic day-of-the-week posts. Seasonal references must be grounded in what the business is actually doing (a seasonal menu item, a seasonal service, a real event).

IMAGE MATCHING — this is where 90% of AI calendars fail:

- Read every AVAILABLE IMAGE description carefully. The subject MUST match the caption.
- A food photo goes with a food caption. A team photo goes with a team/shop-life caption. A product shot goes with a product caption.
- If the best-matching caption for an image reads as a stretch, pick a different image or set imageIndex to null and generate one.
- Use real images (imageIndex from AVAILABLE IMAGES) for at least 65% of posts. Real photos outperform generated ones almost everywhere.
- Do NOT reuse the same imageIndex more than twice across the whole month.
- For behind-the-scenes, team, testimonial, and location posts: always use a real image if one exists. Set imageIndex to null only if nothing in AVAILABLE IMAGES fits.
- For promotional, seasonal, and educational posts: real images preferred, but a generated image is acceptable when needed.

IMAGE GENERATION PROMPTS — when imageIndex is null:

- Write a PHOTOGRAPHIC, specific, composed prompt. Not "coffee photo" but:
  "Flat-lay of an espresso in a stoneware cup on a weathered wooden counter, warm morning window light from the upper left, a few scattered coffee beans, shallow depth of field, minimal warm color palette of cream browns and terracotta, 45mm lens, shot from directly above, magazine-editorial feel."
- Describe: subject, setting, lighting direction, palette, angle/lens, mood. Reference real lighting types ("golden hour", "overcast daylight", "window light") not "nice lighting".
- Match the brand's aesthetic from the voice guide — don't suddenly shift style.
- NEVER generate images of people's faces unless explicitly described in the voice guide's content pillars (and even then, prefer silhouettes or "hands visible").
- NEVER generate logos or text in images.

CONTENT MIX OVER THE MONTH — aim for this distribution:
- 25% behind-the-scenes / shop life (highest engagement)
- 20% educational / how-to / tips
- 20% product / service / menu highlights
- 15% testimonials / customer moments / results
- 10% team spotlights
- 10% seasonal / local / community

NO MORE THAN 2 promotional posts in a row. SPREAD content types across the month.

PLATFORM DIVERSITY:
- Rotate platforms day-to-day. Don't post Instagram for 5 days straight then LinkedIn for 5.
- Don't post on every platform every day — that looks automated.
- LinkedIn gets 2-3 posts a week max. Daily LinkedIn burns the feed.
- TikTok captions must sound like TikTok, not Instagram. Different platform, different hook.

FINAL CHECK before returning:
- Every hook passes the "would a human stop scrolling?" test.
- Every caption passes the "could this be any business?" test — if yes, rewrite with more specificity.
- Every image-caption pair passes the "does this image support this specific caption?" test.
- Every contentType distribution matches the percentages above.

Generate exactly ${vars.postsCount} posts.`;
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
  instruction?: string;
}) {
  return `You are the in-house social media writer for "${vars.businessName}" (${vars.industry}). Rewrite the post below. Keep what was working (platform, subject, angle) and fix what wasn't.

BRAND VOICE GUIDE:
${vars.brandVoice}

PLATFORM: ${vars.platform}
CONTENT TYPE: ${vars.contentType ?? 'general'}
${vars.imageSubject ? `IMAGE IN THE POST: ${vars.imageSubject}` : ''}

CURRENT CAPTION:
${vars.currentCaption}

CURRENT HASHTAGS: ${vars.currentHashtags.join(' ')}

${vars.instruction ? `USER FEEDBACK: ${vars.instruction}\n` : ''}

Return ONLY JSON:
{
  "caption": "<the rewritten caption>",
  "hashtags": ["<fresh hashtags>"],
  "hook": "<the first 5-7 words, pulled out>",
  "rationale": "<one sentence on what you changed and why>"
}

RULES:
- The rewrite must sound different from the original, not a reshuffle.
- Start with a real hook: a time, a name, a number, a sensory detail, a small moment. Never "Ever wondered..." or "We love...".
- Honor the brand voice guide exactly (tone, vocabulary, sentence style, emoji rules, CTA style).
- NO AI TELLS: avoid "dive into", "elevate", "seamless", "game-changer", "journey", "unlock", "curate", "craft" as a verb, "passion", "harness".
- Match platform length: Instagram 150-300, LinkedIn 400-800, Facebook 100-250, TikTok 50-150, X under 270.
- Hashtags: lowercase, specific to location + craft + community. No #love, #instagood, #mondaymotivation.
- If imageSubject is provided, the caption MUST reference the image naturally — not force-match it.
- If the user gave instruction feedback, that overrides everything else except the brand voice.`;
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
  videoIntent: string; // 'brand_story' | 'promo' | 'team_intro' | 'menu_reveal' | ...
  clipCount: number; // 3-6
  headline?: string;
  cta?: string;
  platform?: string; // 'instagram_reel' | 'tiktok' | 'youtube_short' | ...
}) {
  return `You are a short-form video director planning a ${vars.clipCount}-clip vertical reel for "${vars.businessName}" (${vars.industry}). This will play on ${vars.platform ?? 'Instagram Reels and TikTok'} — sound off by default, captions on-screen doing the talking.

BRAND VOICE:
${vars.brandVoice}

AVAILABLE MEDIA (index, kind, description):
${vars.mediaDescriptions || '(no media — plan a synthesis script using AI-generated stills)'}

INTENT: ${vars.videoIntent}
${vars.headline ? `HEADLINE (already agreed): ${vars.headline}` : ''}
${vars.cta ? `CTA: ${vars.cta}` : ''}

Return ONLY valid JSON:
{
  "hookHeadline": "<the top-of-video 4-7 word hook. This is NOT the outro headline — it's the first thing the viewer sees and it must stop a scroll.>",
  "outroHeadline": "<4-7 words for the end card. Quieter, landing line.>",
  "suggestedCta": "<a single verb phrase, e.g. 'Book now', 'Try it this week'. Match the brand voice's CTA style.>",
  "clips": [
    {
      "order": <0-based integer>,
      "mediaIndex": <index from AVAILABLE MEDIA, or null if this clip should be synthesized>,
      "synthesisPrompt": "<if mediaIndex is null, a fully-composed Flux image prompt for this shot. Describe subject, lighting, palette, angle, mood. NO generic stuff.>",
      "wantsMotion": <true if this should be animated via image-to-video, false to keep it as a Ken Burns still>,
      "motionPrompt": "<only when wantsMotion is true. A 1-sentence instruction like 'Slow pan left across the counter, steam rising from the cup'. Keep motion subtle so the subject doesn't distort.>",
      "eyebrow": "<2-3 word uppercase kicker, e.g. 'Behind the scenes', 'Tuesday 07:14', 'The team'. Optional — use null if the caption stands alone.>",
      "caption": "<6-12 words. On-screen only, must be readable in 2 seconds. No ending punctuation. Example: 'Four grinders already running and we\\'re still tuning'>",
      "durationSeconds": <2.0-4.5, integer or half-step; faster clips for early-scroll energy, slower for the last clip so the CTA lands>,
      "focalX": <0-1 decimal, horizontal focal point for the zoom>,
      "focalY": <0-1 decimal, vertical focal point for the zoom>,
      "rationale": "<one sentence on why this clip belongs here and why this media was chosen>"
    }
  ]
}

STORY ARC (enforce this):
1. HOOK (clip 0): surprise, specificity, or intrigue. Not "Welcome to X" — something that makes someone stop.
2. PROOF (middle clips): show the thing. Specific moments, not stock-feeling.
3. PAYOFF (last clip): emotional landing that earns the outro headline and CTA.

MEDIA MATCHING:
- Prefer real client media over synthesis. Use mediaIndex whenever a clip in AVAILABLE MEDIA fits.
- Do NOT reuse the same mediaIndex more than once unless there are literally no other options.
- A food shot goes with a food caption. A team shot goes with a people caption. Mismatches destroy the personalization.
- Only synthesize (mediaIndex null) when no existing media fits the story slot. When you synthesize, the prompt must match the brand's existing aesthetic (read the media descriptions to infer palette and mood).

MOTION:
- Set wantsMotion true only when motion genuinely adds value: a team pouring coffee, a door opening, a car arriving, a stylist finishing a cut. Static product shots, headshots, menu boards should stay as Ken Burns stills (cheaper, sharper, more reliable).
- Keep motionPrompts slow and small. Violent motion on a still photo distorts faces and subjects.

CAPTIONS:
- Short, specific, lowercase-first when the brand voice allows. No AI tells ("dive into", "elevate", "seamless", "craft" as a verb).
- Must reference the on-screen subject so the caption and visual feel married.
- Each caption should read as a complete thought so clips aren't sentence fragments stretched across seconds.

FOCAL POINTS:
- For face-forward headshots: focalY ~ 0.35 (so the zoom tightens on eyes, not forehead).
- For wide storefronts: focalY ~ 0.6, focalX near where the subject lives.
- For tabletop/flat-lays: focalX/focalY 0.5.

DURATIONS:
- Total reel time (sum of clips + 2.8s outro) should be 15–25s. Shorter feels too fast, longer loses the viewer.
- First 2 clips: 2.0–2.6s each (scroll-energy). Last clip: 3.5–4.5s (landing).

Return the JSON array ordered by clip.order ascending. Generate exactly ${vars.clipCount} clips.`;
}
