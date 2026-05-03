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
  return `You are a brand strategist. Analyze the following website content and create a comprehensive brand voice guide.

WEBSITE CONTENT:
${vars.websiteMarkdown}

BUSINESS NAME: ${vars.businessName}
INDUSTRY: ${vars.industry}

Generate a brand voice guide in this exact JSON format:
{
  "tone": "2-3 word description (e.g., 'warm and professional')",
  "personality": "One sentence describing the brand as a person",
  "vocabulary": {
    "use": ["list of words/phrases to use"],
    "avoid": ["list of words/phrases to avoid"]
  },
  "sentenceStyle": "short|medium|long, describe preferred sentence length",
  "emojiUsage": "none|minimal|moderate|heavy",
  "hashtagStyle": "describe hashtag approach",
  "callToAction": "preferred CTA style and examples",
  "targetAudience": "describe the ideal customer",
  "contentPillars": ["3-5 content themes"],
  "examplePosts": {
    "instagram": "Write one example Instagram post in this brand's voice",
    "linkedin": "Write one example LinkedIn post",
    "facebook": "Write one example Facebook post"
  }
}`;
}

export function imageAnalysisPrompt(vars: { industry: string; businessName: string }) {
  return `Analyze this image for social media suitability. You are evaluating for "${vars.businessName}", a ${vars.industry} business.

Return ONLY valid JSON:
{
  "qualityScore": <1-10>,
  "usable": <boolean>,
  "issues": [...],
  "subject": "<description>",
  "mood": "<professional|casual|energetic|warm|luxurious|rustic|modern>",
  "bestPlatforms": [...],
  "suggestedCrop": "<portrait|landscape|square>",
  "captionAngle": "<suggested content angle>",
  "needsEditing": <boolean>,
  "editingSuggestions": [...],
  "fluxKontextPrompt": "<prompt for Flux Kontext if editing is needed, otherwise empty>"
}`;
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
  return `You are a social media manager for "${vars.businessName}", a ${vars.industry} business.

BRAND VOICE GUIDE:
${vars.brandVoice}

AVAILABLE IMAGES THIS MONTH:
${vars.imageDescriptions}

MONTH: ${vars.month} ${vars.year}
POSTS TO GENERATE: ${vars.postsCount}
PLATFORMS: ${vars.platforms.join(', ')}
${vars.direction ? `\nEXTRA DIRECTION: ${vars.direction}` : ''}

Generate a content calendar. Return JSON array:
[
  {
    "dayOfMonth": <1-31>,
    "platform": "<one of the platforms above>",
    "caption": "<full caption in brand voice>",
    "hashtags": [...],
    "imageIndex": <index or null>,
    "imageGenerationPrompt": "<prompt if imageIndex null>",
    "contentType": "<educational|promotional|behind-the-scenes|testimonial|seasonal|engagement>",
    "timeOfDay": "<morning|afternoon|evening>"
  }
]

RULES:
- Use real images (imageIndex) for at least 60% of posts. Match the image subject to the caption — don't pair a food photo with a team post.
- When no suitable image exists for a post, set imageIndex to null and write a detailed imageGenerationPrompt that describes exactly what the AI should generate (subject, style, mood, colors, composition). Be specific: "A flat-lay of fresh coffee beans on a marble counter, warm morning light, shot from above, minimal style" not "coffee photo".
- For behind-the-scenes and team posts, prefer real images. For promotional and seasonal posts, AI-generated images are fine.
- Mix content types; no more than 2 promotional in a row.
- Vary platforms, don't post identically on all same day.
- Seasonal references for ${vars.month} where appropriate.
- Instagram: 150-300 chars + hashtags. LinkedIn: 200-500 chars, professional. TikTok: 50-150 chars, casual. X: under 280 chars.
- Generate exactly ${vars.postsCount} posts.`;
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
    "heroStyle": "<light|dark>"
  },
  "hero": {
    "eyebrow": "<optional 2-4 word kicker, e.g. 'Family-run since 1998'>",
    "headline": "<8-14 words, benefit-led. Last 2 words are auto-highlighted.>",
    "subheadline": "<1-2 sentences>",
    "ctaPrimary": { "label": "<action verb>", "href": "<#section or url>" },
    "ctaSecondary": { "label": "...", "href": "..." },
    "imageIndex": <index from AVAILABLE IMAGES, or null if none suit the hero>,
    "variant": "<spotlight|beams|floating-icons|parallax-layers|gradient-mesh>",
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
- "floating-icons": Left copy with parallax icons/emojis drifting behind it. Playful, warm. Best for food (coffee ☕ utensils 🍴), beauty (scissors ✂️ sparkles ✨), retail. When you pick this variant you MUST populate floatingIcons with 6–8 entries — mix of Lucide icon names from the services list and emojis relevant to the business.
- "parallax-layers": Split layout with hero image parallaxing deeper than copy. Classic, works with photography. Best for service trades, real estate, beauty with good photos.
- "gradient-mesh": Slow-shifting gradient mesh, no image needed. Bold, minimal, confident. Best for retail, creative, or any client without great photography.

IMAGE GUIDANCE:
- Set hero.imageIndex to a number ONLY if an AVAILABLE IMAGE looks like a strong hero (wide, high-quality, representative). Otherwise null — the system will generate a custom AI illustration.
- Prefer the "parallax-layers" variant when a hero image IS set.
- Prefer "gradient-mesh", "beams", or "spotlight" when no hero image is set.
- Prefer "floating-icons" for warm, personality-driven businesses regardless of image availability.`;
}
