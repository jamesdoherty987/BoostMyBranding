/**
 * Personal content theme library.
 *
 * Each theme is a pre-tuned recipe for a viral-ready short-form niche.
 * It locks the generator to a consistent voice, visual style, preferred
 * template, media sourcing strategy, and hook formulas — so every video
 * an account produces feels part of one consistent channel, while the
 * specific topic, hook, and beat sheet are freshly written each time.
 *
 * Sources considered when designing this catalog:
 *   - High-CPM faceless YouTube niches (finance, tech, history, sleep, etc.)
 *   - TikTok/Reels formats that consistently hit 1M+ views
 *   - Language-learning micro-lesson format (Duolingo, Babbel-style Reels)
 *   - News-reel format (quick cuts, bold chyron, B-roll)
 *   - "Brainrot" subway-surfers / gameplay + AI voice format
 *
 * Adding a theme: append to THEMES and it appears in the UI and
 * generator immediately. No DB migration needed — themes live in code.
 */

import type { Platform } from '@boost/core';

/** How media is sourced for a given theme. */
export type MediaSource =
  | 'pexels'        // stock photos + video
  | 'unsplash'      // high-quality photos
  | 'pixabay'       // photos + music
  | 'wikipedia'     // encyclopedia-grade images (commons)
  | 'news'          // Google News RSS + image scrape
  | 'ai'            // Flux / fal.ai generation
  | 'gameplay';     // loopable gameplay backgrounds (Minecraft/Subway)

/** Visual template (Remotion composition id) a theme renders with. */
export type PersonalTemplateId =
  | 'viral-text'         // bold text cards over B-roll + VO
  | 'news-reel'          // news chyron + photos + VO
  | 'fact-drop'          // single fact per beat, big text + image bg
  | 'quote-card'         // quote + attribution, minimal motion
  | 'language-card'      // foreign word → translation → example, with audio
  | 'listicle'           // "Top 5 X" count-up with images
  | 'brainrot'           // gameplay bg + captioned AI VO
  | 'story-narration'    // long-form story with image ken burns
  | 'slideshow'          // pure image carousel with beat transitions
  | 'satisfying-loop'    // hypnotic loop with minimal text
  | 'scripture-card'     // verse-centric with cinematic wide shot
  | 'animated-explainer'; // long-form (1–8 min) animated narration with
                          // cartoon / stick-figure / storyboard style
                          // AI imagery and chapter-based storyboard

export interface PersonalTheme {
  id: string;
  /** Shown in the UI. */
  name: string;
  /** One-liner for the picker. */
  tagline: string;
  /** Long description for the detail panel. */
  description: string;
  /** Relative popularity / monetization for sorting the picker. */
  viralityScore: number; // 1–10
  cpmTier: 'low' | 'medium' | 'high' | 'premium';
  /** Emoji for quick visual identity. */
  emoji: string;
  /** Default accent color (dashboard badge, in-video). */
  accentColor: string;
  /** Platforms this theme is tuned for. */
  preferredPlatforms: Platform[];
  /** Remotion template id to render with. */
  template: PersonalTemplateId;
  /** Ordered media providers (first that returns is used). */
  mediaSources: MediaSource[];
  /** Whether we generate a TTS voiceover for this theme. */
  useVoiceover: boolean;
  /** Whether we mix background music. */
  useMusic: boolean;
  /**
   * Hook formulas the concept engine rotates through.
   * Each one is a sentence template with {slots} the LLM fills.
   */
  hookFormulas: string[];
  /**
   * Pre-seeded topic examples — used when the account has no
   * custom seeds of its own. The engine picks one and asks Claude
   * to generate a fresh angle every time.
   */
  topicSeeds: string[];
  /**
   * Voice guide injected into Claude's script prompt. Keep terse.
   */
  voiceGuide: string;
  /**
   * Visual direction hint used when generating AI images for this theme.
   */
  visualStyle: string;
  /**
   * Music mood query sent to the music source.
   */
  musicMood: string;
  /** Target video length in seconds. */
  targetDurationSeconds: number;
  /** Hashtag blocks appended to captions, platform-agnostic. */
  defaultHashtags: string[];
  /**
   * When true, scraped real-world images are *required* (e.g. news).
   * Generator will fail the post rather than fall back to stock when
   * no grounded images are available.
   */
  requiresGroundedImages?: boolean;
  /**
   * Default format when the user doesn't override on the account.
   *
   *   video        — full narrated short with VO + music
   *   slideshow    — image carousel with transitions (works without VO)
   *   static_image — single still post (no video)
   */
  defaultFormat?: 'video' | 'slideshow' | 'static_image';
}

export const THEMES: PersonalTheme[] = [
  /* ═══ Finance & money ═══════════════════════════════════════════ */
  {
    id: 'finance-bite',
    name: 'Finance Bite',
    tagline: 'Personal finance and investing explainers.',
    description:
      'Short, sharp finance lessons. Index funds, compound interest, budgeting, and "how money works" angles. Premium CPM niche.',
    viralityScore: 9,
    cpmTier: 'premium',
    emoji: '📈',
    accentColor: '#16A34A',
    preferredPlatforms: ['instagram', 'tiktok', 'linkedin'],
    template: 'fact-drop',
    mediaSources: ['pexels', 'unsplash', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'If you had invested {amount} into {asset} {years} years ago…',
      '{number} money mistakes I wish I had avoided at {age}.',
      'This {concept} chart will change how you think about {topic}.',
      'The {adjective} reason most people never get rich.',
      'Compound interest turned {smallAmount} into {bigAmount}. Here is how.',
    ],
    topicSeeds: [
      'The rule of 72 explained',
      'Why index funds beat most stock pickers',
      'Dollar-cost averaging in plain English',
      'What an emergency fund should actually cover',
      'Roth IRA vs. Traditional in one minute',
      'How inflation quietly eats your savings',
      'The 50/30/20 budget and why it often fails',
    ],
    voiceGuide:
      'Plainspoken, non-salesy, numbers-first. No hype words like "insane" or "crazy". Confident but not smug. Respect the viewer.',
    visualStyle:
      'Clean editorial data charts, minimal color palette (deep green, off-white, graphite), upward-trending graphs, stacks of coins in soft light. Avoid stock-photo cliches like hands holding dollar bills.',
    musicMood: 'corporate minimal piano ambient',
    targetDurationSeconds: 35,
    defaultHashtags: [
      '#personalfinance', '#money', '#investing', '#finance', '#financialfreedom',
      '#moneytips', '#budget', '#wealth',
    ],
  },

  /* ═══ Educational / mega-facts ═════════════════════════════════ */
  {
    id: 'mega-facts',
    name: 'Mega Facts',
    tagline: 'Did-you-know facts that stop the scroll.',
    description:
      'One surprising fact per video, explained with a hook, visual, and takeaway. Universal appeal — performs well on every platform.',
    viralityScore: 10,
    cpmTier: 'medium',
    emoji: '🤯',
    accentColor: '#6366F1',
    preferredPlatforms: ['instagram', 'tiktok', 'facebook'],
    template: 'fact-drop',
    mediaSources: ['pexels', 'wikipedia', 'unsplash', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      '{subject} can actually {surprising} — here is why.',
      'This is why {familiar} works the way it does.',
      '{number} things you never noticed about {everyday}.',
      'The reason {thing} exists is not what you think.',
      '{Year}: the year we learned that {discovery}.',
    ],
    topicSeeds: [
      'Why the ocean is salty',
      'How bees know which flowers are best',
      'Why airplane windows are round',
      'The reason we get goosebumps',
      'How your brain rewrites memories',
      'Why cats purr when injured',
      'How the speed of light was first measured',
    ],
    voiceGuide:
      'Curious, conversational, "did you know?" energy. Short sentences. No filler. End with a gentle twist or takeaway.',
    visualStyle:
      'Vivid macro photography, cinematic lighting, unusual angles. Rich textures. Saturation slightly boosted.',
    musicMood: 'curious upbeat ambient',
    targetDurationSeconds: 30,
    defaultHashtags: [
      '#didyouknow', '#facts', '#learnontiktok', '#interesting', '#education',
      '#mindblown', '#factsdaily',
    ],
  },

  /* ═══ Language learning ═════════════════════════════════════════ */
  {
    id: 'language-a-day',
    name: 'Language a Day',
    tagline: 'One foreign word with pronunciation, meaning, and use.',
    description:
      'Micro-lesson format. Foreign word displayed large, phonetic breakdown, example sentence, native-speaker voice. Very repeatable format.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '🌍',
    accentColor: '#F59E0B',
    preferredPlatforms: ['instagram', 'tiktok'],
    template: 'language-card',
    mediaSources: ['pexels', 'unsplash', 'ai'],
    useVoiceover: true,
    useMusic: false,
    hookFormulas: [
      'Your {language} word of the day: {word}',
      '{word} — can you guess what it means?',
      'This one {language} word means {concept}',
      'Natives use {word} all the time. Do you know it?',
      'Learn {word} in 30 seconds.',
    ],
    topicSeeds: [
      'Spanish: sobremesa',
      'French: dépaysement',
      'Japanese: komorebi',
      'German: Fernweh',
      'Italian: abbiocco',
      'Portuguese: saudade',
      'Arabic: habibi',
    ],
    voiceGuide:
      'Friendly language teacher. Clear, slow pronunciation on the target word, conversational English around it. Encourage practice.',
    visualStyle:
      'Clean card layout, country-flag accent, calm scenes from the country of origin. Soft gradient backgrounds.',
    musicMood: 'soft bossa nova lofi',
    targetDurationSeconds: 25,
    defaultHashtags: [
      '#learnlanguages', '#languagelearning', '#polyglot', '#wordoftheday',
    ],
  },

  /* ═══ Daily news ════════════════════════════════════════════════ */
  {
    id: 'news-in-60',
    name: 'News in 60',
    tagline: 'A single news story told in 60 seconds with real footage.',
    description:
      'Pulls a live story from Google News, grabs real imagery with web scraping, and narrates it with a bold chyron. Real-world grounded — no AI imagery.',
    viralityScore: 9,
    cpmTier: 'high',
    emoji: '📰',
    accentColor: '#DC2626',
    preferredPlatforms: ['tiktok', 'instagram', 'facebook', 'x'],
    template: 'news-reel',
    mediaSources: ['news', 'wikipedia', 'pexels'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'Breaking: {headline}',
      'Here is what just happened with {subject}.',
      '{subject} is making headlines again. Here is why.',
      'You need to know about {topic}.',
    ],
    topicSeeds: [
      'tech',
      'space',
      'AI',
      'science breakthroughs',
      'world news',
      'sports highlights',
    ],
    voiceGuide:
      'Newsroom-neutral. Factual, no editorializing, no snark. Attribute claims. Avoid loaded adjectives.',
    visualStyle:
      'Real-world press photography. Do NOT generate AI images for this theme. Wide shots, slight desaturation, bottom-third chyron.',
    musicMood: 'news intro urgent minimal',
    targetDurationSeconds: 60,
    defaultHashtags: [
      '#news', '#breakingnews', '#dailynews', '#worldnews',
    ],
    requiresGroundedImages: true,
  },

  /* ═══ AI news ═══════════════════════════════════════════════════ */
  {
    id: 'ai-edge',
    name: 'AI Edge',
    tagline: 'Latest AI news and tools explained.',
    description:
      'New models, new products, research highlights. Scrapes recent AI news and pairs with real screenshots / product shots.',
    viralityScore: 9,
    cpmTier: 'high',
    emoji: '🤖',
    accentColor: '#0EA5E9',
    preferredPlatforms: ['tiktok', 'instagram', 'linkedin', 'x'],
    template: 'news-reel',
    mediaSources: ['news', 'pexels', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      '{model} just launched and it does {thing}.',
      'The AI tool everyone is talking about this week.',
      '{company} just changed the game with {product}.',
      'How to use {tool} in under a minute.',
    ],
    topicSeeds: [
      'new frontier model release',
      'AI coding tool',
      'image generation update',
      'voice AI news',
      'AI agents',
      'open-source models',
    ],
    voiceGuide:
      'Tech-savvy, calm, skeptical-of-hype. Acknowledge limitations. Concrete examples, not marketing copy.',
    visualStyle:
      'Dark UI product screenshots, neon accents, terminal windows, clean typography. Avoid glowing brain and robot stock photography.',
    musicMood: 'synthwave ambient tech',
    targetDurationSeconds: 45,
    defaultHashtags: [
      '#ai', '#artificialintelligence', '#tech', '#technews', '#machinelearning',
    ],
    requiresGroundedImages: true,
  },

  /* ═══ Motivation / mindset ══════════════════════════════════════ */
  {
    id: 'stoic-daily',
    name: 'Stoic Daily',
    tagline: 'Ancient-wisdom quotes and reflections.',
    description:
      'Stoic / Zen / philosophical quotes with cinematic imagery. High save rate. Evergreen.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '🗿',
    accentColor: '#78716C',
    preferredPlatforms: ['instagram', 'facebook', 'tiktok'],
    template: 'quote-card',
    mediaSources: ['pexels', 'unsplash', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'The one line from {philosopher} I think about every day.',
      'Read this when you feel {emotion}.',
      '{philosopher} on {virtue}, in two sentences.',
      "The hard part about {virtue} nobody warns you about.",
      "A quieter way to think about {subject}.",
    ],
    topicSeeds: [
      'Marcus Aurelius on mornings',
      'Seneca on time',
      'Epictetus on control',
      'Zen on impermanence',
      'Taoism on effortless action',
      'Viktor Frankl on meaning',
    ],
    voiceGuide:
      'Low, calm, deliberate. Long pauses. Read as if meant for the listener alone.',
    visualStyle:
      'Cinematic wide shots. Mountains, oceans, cathedral light, marble statues, weathered hands. Muted earth tones.',
    musicMood: 'cinematic orchestral ambient',
    targetDurationSeconds: 35,
    defaultHashtags: [
      '#stoicism', '#motivation', '#mindset', '#philosophy', '#wisdom',
    ],
  },

  /* ═══ History deep-dive ═════════════════════════════════════════ */
  {
    id: 'history-unboxed',
    name: 'History Unboxed',
    tagline: 'Lesser-known history moments told in under a minute.',
    description:
      'One historical figure, event, or mystery per clip. Real archival imagery from Wikipedia Commons, dramatic narration.',
    viralityScore: 8,
    cpmTier: 'high',
    emoji: '🏛️',
    accentColor: '#92400E',
    preferredPlatforms: ['tiktok', 'instagram', 'facebook'],
    template: 'story-narration',
    mediaSources: ['wikipedia', 'pexels', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'The story of {figure} — you will not have heard this part.',
      'Why {event} changed everything, in one minute.',
      '{year}: the day {figure} {did thing}.',
      'The letter / diary / photograph that rewrote what we knew about {event}.',
    ],
    topicSeeds: [
      'Pompeii last day',
      'the lost Roanoke colony',
      'Ada Lovelace',
      'the Library of Alexandria',
      'the Tunguska event',
      'Ching Shih pirate queen',
      'the Dancing Plague of 1518',
    ],
    voiceGuide:
      'Documentary narrator. Measured pacing, vivid specifics (names, dates, numbers). No anachronistic slang.',
    visualStyle:
      'Sepia-tinted archival photography. Wikimedia Commons imagery. Paintings, old maps, handwritten letters. Candlelight tone.',
    musicMood: 'cinematic historical score orchestral',
    targetDurationSeconds: 55,
    defaultHashtags: [
      '#history', '#historytok', '#historyfacts', '#ancienthistory',
    ],
    requiresGroundedImages: true,
  },

  /* ═══ Science explained ═════════════════════════════════════════ */
  {
    id: 'lab-notes',
    name: 'Lab Notes',
    tagline: 'Science concepts and discoveries in under a minute.',
    description:
      'Curiosity-driven science explainers. Real photography of phenomena, labs, telescopes, specimens.',
    viralityScore: 7,
    cpmTier: 'high',
    emoji: '🔬',
    accentColor: '#0D9488',
    preferredPlatforms: ['instagram', 'tiktok'],
    template: 'fact-drop',
    mediaSources: ['wikipedia', 'pexels', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'How does {phenomenon} actually work?',
      "We just figured out why {thing}. Here is the paper.",
      'The physics behind {everyday}, explained without equations.',
      'What happens inside a {thing} in {time}?',
    ],
    topicSeeds: [
      'why the sky is blue',
      'how vaccines train the immune system',
      'what a black hole actually is',
      'how fireflies glow',
      'what causes lightning',
      'why ice floats',
    ],
    voiceGuide:
      'Science communicator. Accurate, accessible, precise with units. Acknowledge uncertainty. No dumbing down.',
    visualStyle:
      'Laboratory photography, telescope imagery, high-contrast microscopic detail, clean infographics.',
    musicMood: 'curious electronic ambient',
    targetDurationSeconds: 40,
    defaultHashtags: [
      '#science', '#stem', '#physics', '#biology', '#learnontiktok',
    ],
  },

  /* ═══ Psychology / productivity ═════════════════════════════════ */
  {
    id: 'mind-hacks',
    name: 'Mind Hacks',
    tagline: 'Psychology tricks, cognitive biases, and productivity.',
    description:
      'Explains one mental model or bias per clip. Huge save rate. Broad cross-platform reach.',
    viralityScore: 9,
    cpmTier: 'high',
    emoji: '🧠',
    accentColor: '#A855F7',
    preferredPlatforms: ['instagram', 'tiktok', 'linkedin'],
    template: 'fact-drop',
    mediaSources: ['pexels', 'unsplash', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'The {bias} is quietly running your life.',
      'Why your brain {behavior}.',
      '{trick} will change how you {activity}.',
      'This one psychology trick works every time.',
    ],
    topicSeeds: [
      'the Zeigarnik effect',
      'Parkinson\'s law',
      'the sunk cost fallacy',
      'the spotlight effect',
      'the 2-minute rule',
      'the Pareto principle',
      'loss aversion',
    ],
    voiceGuide:
      'Warm, curious, non-preachy. Concrete examples from everyday life. Never "life hack bro" energy.',
    visualStyle:
      'Cinematic portraits of people in thought, journaling, walking, reading. Soft natural light.',
    musicMood: 'lofi chill study beats',
    targetDurationSeconds: 35,
    defaultHashtags: [
      '#psychology', '#mindset', '#productivity', '#selfimprovement',
    ],
  },

  /* ═══ Brainrot (AI-voice over gameplay) ═════════════════════════ */
  {
    id: 'brainrot-explainer',
    name: 'Brainrot Explainer',
    tagline: 'AI-voice over Subway Surfers / Minecraft B-roll.',
    description:
      'The format teens cannot stop watching. Split-screen: your topic + parkour / gameplay. Real engagement hack for under-25 reach.',
    viralityScore: 10,
    cpmTier: 'low',
    emoji: '🎮',
    accentColor: '#EC4899',
    preferredPlatforms: ['tiktok', 'instagram'],
    template: 'brainrot',
    mediaSources: ['gameplay'],
    useVoiceover: true,
    useMusic: false,
    hookFormulas: [
      'POV: you finally learn {topic}.',
      'So basically {subject} is…',
      'They never taught you this in school.',
      '{fact} — no cap.',
      'This is genuinely unserious.',
    ],
    topicSeeds: [
      'how compound interest works',
      'the fall of Rome in 30 seconds',
      'what a hedge fund actually does',
      'how the brain encodes memory',
      'what causes jet lag',
    ],
    voiceGuide:
      'Late-2025 / 2026 Gen Z & Gen Alpha idiom — fast, dry, casually confident. Allowed, used sparingly: "no cap", "it\'s giving", "low-key", "actually", "genuinely", "not the…", "unserious", "the way…". Avoid: "mad", "real talk", "slaps", "lit", "it\'s lit", "big yikes" — all dated. Never "let\'s dive in", never narrator voice.',
    visualStyle:
      'Vertical split: top 60% is your content, bottom 40% is gameplay (Subway Surfers / Minecraft parkour). Caption burned in.',
    musicMood: '',
    targetDurationSeconds: 35,
    defaultHashtags: [
      '#brainrot', '#fyp', '#foryou', '#subwaysurfers', '#learnontiktok',
    ],
  },

  /* ═══ Listicles ═════════════════════════════════════════════════ */
  {
    id: 'top-five',
    name: 'Top Five',
    tagline: 'Listicle videos — Top 5 X, ranked.',
    description:
      'Numbered countdown format. Works for every niche. Easy to batch — define the list, generate 5 assets.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '🏆',
    accentColor: '#FACC15',
    preferredPlatforms: ['tiktok', 'instagram', 'facebook'],
    template: 'listicle',
    mediaSources: ['pexels', 'unsplash', 'wikipedia', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'Top {number} {subject} you did not know.',
      'The {number} most {adjective} {things} ever.',
      '{number} things {audience} should know about {topic}.',
    ],
    topicSeeds: [
      '5 richest self-made people',
      '5 most remote places on earth',
      '5 hidden productivity apps',
      '5 animals that should not exist',
      '5 famous scientists who never finished school',
    ],
    voiceGuide:
      'Count-up energy. Numbered beats. Each item gets a single-sentence hook, one-sentence body.',
    visualStyle:
      'Clean numbered graphics, strong hero image per item, bold gradient backgrounds.',
    musicMood: 'energetic pop build',
    targetDurationSeconds: 45,
    defaultHashtags: [
      '#top5', '#ranked', '#fyp',
    ],
  },

  /* ═══ Health & fitness ═════════════════════════════════════════ */
  {
    id: 'health-bite',
    name: 'Health Bite',
    tagline: 'Evidence-based health tips without the BS.',
    description:
      'Research-based health content. Cites studies (briefly). No wellness woo. Solid engagement.',
    viralityScore: 8,
    cpmTier: 'high',
    emoji: '💪',
    accentColor: '#22C55E',
    preferredPlatforms: ['instagram', 'tiktok'],
    template: 'fact-drop',
    mediaSources: ['pexels', 'unsplash', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      '{number} things most people get wrong about {topic}.',
      'What the research actually says about {subject}.',
      'The truth about {thing}.',
      'A {time}-minute habit with big returns.',
    ],
    topicSeeds: [
      'Zone 2 cardio',
      'protein timing',
      'sleep and memory',
      'creatine for over-40s',
      'cold exposure',
      'sunlight and circadian rhythm',
    ],
    voiceGuide:
      'Evidence-first, no hype. Cite the study briefly ("a 2024 meta-analysis…"). Acknowledge trade-offs.',
    visualStyle:
      'Athletes mid-motion, close-ups of whole foods, daylight interiors. Avoid stock-photo gym cliches.',
    musicMood: 'uplifting acoustic indie',
    targetDurationSeconds: 35,
    defaultHashtags: [
      '#health', '#fitness', '#wellness', '#nutrition',
    ],
  },

  /* ═══ Travel ═══════════════════════════════════════════════════ */
  {
    id: 'hidden-places',
    name: 'Hidden Places',
    tagline: 'Underrated travel destinations and facts.',
    description:
      'One surprising destination or cultural fact per clip. Uses real travel photography.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '✈️',
    accentColor: '#06B6D4',
    preferredPlatforms: ['instagram', 'tiktok'],
    template: 'listicle',
    mediaSources: ['unsplash', 'pexels', 'wikipedia'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'You have never heard of this place.',
      'This tiny {country} town feels like {comparison}.',
      '{number} places in {region} most tourists miss.',
      'Would you visit {place}?',
    ],
    topicSeeds: [
      'Svalbard archipelago',
      'Faroe Islands',
      'Matera Italy',
      'Bukchon Hanok village',
      'Chefchaouen Morocco',
      'Hokkaido snow festivals',
    ],
    voiceGuide:
      'Warm, invitational, specific (street names, viewpoints, best month). Never "bucket list" cliches.',
    visualStyle:
      'Wide golden-hour landscape photography, drone shots, street-level portraits.',
    musicMood: 'cinematic travel orchestral',
    targetDurationSeconds: 40,
    defaultHashtags: [
      '#travel', '#hiddengems', '#travelgram', '#wanderlust',
    ],
  },

  /* ═══ Entertainment / pop culture ═══════════════════════════════ */
  {
    id: 'pop-explained',
    name: 'Pop Explained',
    tagline: 'Movies, music, and pop-culture moments decoded.',
    description:
      'Why did that scene hit? What does that lyric actually mean? Works as a "smart" alternative to gossip content.',
    viralityScore: 9,
    cpmTier: 'medium',
    emoji: '🎬',
    accentColor: '#F97316',
    preferredPlatforms: ['tiktok', 'instagram'],
    template: 'viral-text',
    mediaSources: ['pexels', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'The {adjective} reason {movie} works.',
      'Why {song} hits different.',
      'Everybody missed this in {scene}.',
      'This {moment} changed {medium} forever.',
    ],
    topicSeeds: [
      'why the Goodfellas restaurant shot works',
      'the meaning behind Bohemian Rhapsody',
      'why Pixar intros make you cry',
      'the sound design of Dune',
    ],
    voiceGuide:
      'Enthusiast, film-school-lite. Specific, not pretentious.',
    visualStyle:
      'Cinematic stills, warm color grade, behind-the-scenes style.',
    musicMood: 'cinematic score emotional',
    targetDurationSeconds: 45,
    defaultHashtags: [
      '#movies', '#film', '#musictok', '#popculture',
    ],
  },

  /* ═══ Memes — format parodies ═══════════════════════════════════ */
  {
    id: 'meme-remix',
    name: 'Meme Remix',
    tagline: 'Current meme formats with your own twist.',
    description:
      'Rides trending audio and formats. Works because it is legible at a glance. Pair with minimal on-screen text.',
    viralityScore: 10,
    cpmTier: 'low',
    emoji: '😂',
    accentColor: '#F472B6',
    preferredPlatforms: ['tiktok', 'instagram'],
    template: 'viral-text',
    mediaSources: ['pexels', 'pixabay', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      'POV: {setup}',
      'Me explaining {thing} to {audience}:',
      'Nobody: / Literally no one: / {subject}:',
      'Tell me you are {trait} without telling me.',
    ],
    topicSeeds: [
      'POV: new job on day one',
      'me refreshing my email',
      'when the barista calls my name',
      'side character energy',
    ],
    voiceGuide:
      'Meme-literate, zero earnestness, one-line payoffs. Let the format do the work.',
    visualStyle:
      'Big bold captions, high-contrast. Minimal visual noise — memes live and die by legibility.',
    musicMood: 'trending tiktok beat',
    targetDurationSeconds: 15,
    defaultHashtags: ['#meme', '#pov', '#fyp', '#relatable'],
  },

  /* ═══ Cooking / recipes ═════════════════════════════════════════ */
  {
    id: 'kitchen-one-minute',
    name: 'Kitchen in a Minute',
    tagline: 'One recipe in 60 seconds, no filler.',
    description:
      'Fast-paced recipe clips — ingredients card, method beats, money shot plate. Use real cooking footage, not AI slop.',
    viralityScore: 9,
    cpmTier: 'high',
    emoji: '🍳',
    accentColor: '#F97316',
    preferredPlatforms: ['instagram', 'tiktok', 'facebook'],
    template: 'listicle',
    mediaSources: ['pexels', 'unsplash', 'pixabay'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'I made {dish} in {time}. Here is how.',
      '{dish} — but better.',
      'The secret to perfect {dish}.',
      '{number}-ingredient {dish} nobody talks about.',
    ],
    topicSeeds: [
      'viral crispy rice salmon bowl',
      'one-pan lemon chicken',
      '10-minute noodles',
      'brown butter chocolate chip cookies',
      'street-food style tacos',
    ],
    voiceGuide:
      'Warm home-cook energy. Specific measurements. Shortcuts that actually work. Never condescending.',
    visualStyle:
      'Top-down food shots, natural light, steam, texture close-ups. Avoid cartoon food or over-bright AI renders.',
    musicMood: 'upbeat acoustic chill',
    targetDurationSeconds: 45,
    defaultHashtags: ['#foodtok', '#recipe', '#easyrecipe', '#cooking'],
  },

  /* ═══ Aesthetic / lifestyle vignette ═══════════════════════════ */
  {
    id: 'aesthetic-slice',
    name: 'Aesthetic Slice',
    tagline: 'Cinematic lifestyle vignettes — morning routine, workspace, reading nook.',
    description:
      'Image-led, low-narration. Heavy on vibe. Great for building a "feel" around an account before monetization.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '🌿',
    accentColor: '#64748B',
    preferredPlatforms: ['instagram', 'tiktok', 'pinterest'],
    template: 'quote-card',
    mediaSources: ['unsplash', 'pexels', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      'A {time} morning in {place}.',
      'Slow {activity} for the soul.',
      'Things that make {subject} feel like {comparison}.',
    ],
    topicSeeds: [
      'slow sunday morning',
      'coffee shop writing hour',
      'autumn wardrobe basics',
      'minimalist desk setup',
      'forest bathing walk',
    ],
    voiceGuide:
      'Very few words. Let imagery and music lead. On-screen copy only for chapter titles.',
    visualStyle:
      'Film grain, natural light, muted earth tones. Hands in frame, coffee steam, book pages, plants.',
    musicMood: 'bossa lofi ambient',
    targetDurationSeconds: 30,
    defaultHashtags: ['#aesthetic', '#slowliving', '#moodboard'],
  },

  /* ═══ Life hacks / productivity ═════════════════════════════════ */
  {
    id: 'quick-hacks',
    name: 'Quick Hacks',
    tagline: 'One useful micro-hack per clip.',
    description:
      'Small actionable tips — keyboard shortcuts, life fixes, productivity wins. High save rate.',
    viralityScore: 9,
    cpmTier: 'medium',
    emoji: '💡',
    accentColor: '#F59E0B',
    preferredPlatforms: ['tiktok', 'instagram', 'linkedin'],
    template: 'fact-drop',
    mediaSources: ['pexels', 'pixabay', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'You have been {doing} wrong your whole life.',
      'A {adjective} trick I wish I learnt at {age}.',
      'Do this once and {benefit} forever.',
    ],
    topicSeeds: [
      'how to fold a fitted sheet',
      'iPhone shortcut nobody uses',
      'fix a squeaky door in 10 seconds',
      'budget method that actually works',
      'fastest way to boil water (no, really)',
    ],
    voiceGuide:
      'Direct, practical, low-ego. Show the before/after if possible.',
    visualStyle:
      'Hands demonstrating the fix, close-up. Clean desk or kitchen lighting.',
    musicMood: 'upbeat productive',
    targetDurationSeconds: 30,
    defaultHashtags: ['#lifehacks', '#productivity', '#learnontiktok'],
  },

  /* ═══ Comedy / observational ═══════════════════════════════════ */
  {
    id: 'dry-takes',
    name: 'Dry Takes',
    tagline: 'Observational comedy, one-liners, slow-burn humour.',
    description:
      'Short, punchy, zero hype. Relies entirely on timing and specifics. Pair with deadpan delivery.',
    viralityScore: 9,
    cpmTier: 'low',
    emoji: '🎤',
    accentColor: '#FACC15',
    preferredPlatforms: ['tiktok', 'instagram', 'x'],
    template: 'viral-text',
    mediaSources: ['pexels', 'ai'],
    useVoiceover: true,
    useMusic: false,
    hookFormulas: [
      'The difference between {a} and {b}.',
      'Reasons I will {action} at {age}.',
      '{Object} in movies vs {object} in real life.',
    ],
    topicSeeds: [
      'corporate email translations',
      'things only oldest siblings notice',
      'airport behaviours explained',
      'group chat archetypes',
    ],
    voiceGuide:
      'Deadpan, specific, never "funny voice". Trust the joke.',
    visualStyle:
      'Neutral backgrounds, one cut per joke, minimal captions.',
    musicMood: '',
    targetDurationSeconds: 25,
    defaultHashtags: ['#comedy', '#standup', '#relatable'],
  },

  /* ═══ Sports takes ═════════════════════════════════════════════ */
  {
    id: 'sports-take',
    name: 'Sports Take',
    tagline: 'Hot (but defensible) sports takes with stats.',
    description:
      'One take per clip. Backed by one stat. Works because viewers love to disagree in the comments.',
    viralityScore: 9,
    cpmTier: 'high',
    emoji: '🏀',
    accentColor: '#EA580C',
    preferredPlatforms: ['tiktok', 'instagram', 'x', 'facebook'],
    template: 'fact-drop',
    mediaSources: ['news', 'pexels', 'wikipedia'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      '{Player} is the most {adjective} {position} alive. Here is why.',
      'The {stat} nobody talks about.',
      '{Team} should actually {action}.',
    ],
    topicSeeds: [
      'NBA MVP race',
      'Premier League top scorer',
      'F1 rookie of the year',
      'UEFA Champions League preview',
    ],
    voiceGuide:
      'Confident, stat-first, never trolly. Cite the number, frame the implication, stop.',
    visualStyle:
      'Real match photography. Stat overlays. Team colors as accents.',
    musicMood: 'sports highlight intense',
    targetDurationSeconds: 40,
    defaultHashtags: ['#sports', '#nba', '#football', '#soccer'],
    requiresGroundedImages: true,
  },

  /* ═══ Music deep-dives ═════════════════════════════════════════ */
  {
    id: 'liner-notes',
    name: 'Liner Notes',
    tagline: 'Songs and albums dissected in a minute.',
    description:
      'Why does this song work? Production breakdowns, lyric deep-dives, music-history moments.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '🎧',
    accentColor: '#8B5CF6',
    preferredPlatforms: ['tiktok', 'instagram'],
    template: 'viral-text',
    mediaSources: ['pexels', 'wikipedia', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'Why {song} slaps, explained.',
      'The production trick hiding in {song}.',
      '{artist} changed {genre} with this one sound.',
    ],
    topicSeeds: [
      'the bassline in Billie Jean',
      'how Bohemian Rhapsody was recorded',
      'why Frank Ocean uses that reverb',
      'the layered harmonies in Fleet Foxes',
    ],
    voiceGuide:
      'Music-nerd but accessible. Name the instrument, the technique, the artist. Play the clip.',
    visualStyle:
      'Analog gear, vinyl, studio shots. Spectrogram overlays.',
    musicMood: 'lofi soft piano',
    targetDurationSeconds: 45,
    defaultHashtags: ['#musictok', '#producer', '#musicfacts'],
  },

  /* ═══ Pets & animals ═══════════════════════════════════════════ */
  {
    id: 'animal-kingdom',
    name: 'Animal Kingdom',
    tagline: 'Wild / weird animal facts with real footage.',
    description:
      'Evergreen, universally appealing. Real nature photography + a surprising fact.',
    viralityScore: 10,
    cpmTier: 'medium',
    emoji: '🦊',
    accentColor: '#15803D',
    preferredPlatforms: ['tiktok', 'instagram', 'facebook'],
    template: 'fact-drop',
    mediaSources: ['pexels', 'unsplash', 'wikipedia'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'Meet the {animal}.',
      'This is how {animal} actually {behavior}.',
      'Did you know {animal} can {surprising}?',
    ],
    topicSeeds: [
      'the mimic octopus',
      'why elephants mourn',
      'how bees navigate',
      'the pistol shrimp',
      'axolotl regeneration',
    ],
    voiceGuide:
      'David Attenborough-lite. Specific. Awe without saccharine.',
    visualStyle:
      'Crisp wildlife photography, macro detail, natural habitats.',
    musicMood: 'nature documentary ambient',
    targetDurationSeconds: 35,
    defaultHashtags: ['#animals', '#wildlife', '#naturetok'],
    requiresGroundedImages: true,
  },

  /* ═══ Gaming news / reviews ════════════════════════════════════ */
  {
    id: 'gaming-bulletin',
    name: 'Gaming Bulletin',
    tagline: 'This week in gaming, one headline per clip.',
    description:
      'Release news, patch notes, esports highlights. Real in-game screenshots + bold chyron.',
    viralityScore: 9,
    cpmTier: 'medium',
    emoji: '🎮',
    accentColor: '#DB2777',
    preferredPlatforms: ['tiktok', 'instagram', 'x'],
    template: 'news-reel',
    mediaSources: ['news', 'pexels', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      '{Game} just dropped {thing}.',
      'Breaking: {studio} is cooking.',
      'The {patch} changed everything.',
    ],
    topicSeeds: [
      'latest AAA release',
      'esports championship recap',
      'indie game breakout',
      'Nintendo direct recap',
    ],
    voiceGuide:
      'Hype but not childish. Respects the viewer knows what a DLC is.',
    visualStyle:
      'In-game screenshots, bold color accents, chyron.',
    musicMood: 'synthwave tech',
    targetDurationSeconds: 35,
    defaultHashtags: ['#gaming', '#esports', '#fyp'],
    requiresGroundedImages: true,
  },

  /* ═══ Luxury / aspirational ════════════════════════════════════ */
  {
    id: 'wealth-room',
    name: 'Wealth Room',
    tagline: 'Luxury watches, cars, and "how the 1% live" content.',
    description:
      'Aspirational imagery + a grounded fact (price, history, why it matters). High watch time.',
    viralityScore: 9,
    cpmTier: 'premium',
    emoji: '💎',
    accentColor: '#B45309',
    preferredPlatforms: ['instagram', 'tiktok', 'facebook'],
    template: 'fact-drop',
    mediaSources: ['pexels', 'unsplash', 'pixabay', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'This {object} costs {amount} and here is why.',
      'The {adjective} secret of {brand}.',
      'What a {amount} {object} actually gets you.',
    ],
    topicSeeds: [
      'the Patek Philippe Nautilus',
      'why Hermès Birkin bags appreciate',
      'custom Rolls-Royce bespoke',
      'Yachting off Saint-Tropez',
    ],
    voiceGuide:
      'Calm, informed, never envious. Respect the craft.',
    visualStyle:
      'Cinematic product shots, golden hour interiors, marble, metal, leather.',
    musicMood: 'cinematic piano elegant',
    targetDurationSeconds: 40,
    defaultHashtags: ['#luxury', '#wealth', '#luxurylifestyle'],
  },

  /* ═══ AI-influencer channel ═════════════════════════════════════ */
  {
    id: 'ai-influencer',
    name: 'AI Influencer',
    tagline: 'A persistent AI-persona — lifestyle, commentary, or niche content.',
    description:
      'Uses an AI-generated character (from your reference images) as the on-camera presence. Pair with Sora/Veo/Kling video gen + Nano Banana for stills.',
    viralityScore: 9,
    cpmTier: 'medium',
    emoji: '👩',
    accentColor: '#D946EF',
    preferredPlatforms: ['instagram', 'tiktok'],
    template: 'viral-text',
    mediaSources: ['ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'A day in my life as {character}.',
      '{character} reacts to {topic}.',
      'Morning routine as a {character.role}.',
      '{character} tries {activity} for the first time.',
    ],
    topicSeeds: [
      'Get ready with me',
      'My honest opinion on {topic}',
      'Morning routine',
      'My favorite places in {city}',
    ],
    voiceGuide:
      'First-person, casual, personal. Use the character voice guide verbatim.',
    visualStyle:
      'Character-consistent stills and short video clips — use the attached character sheet on every generation.',
    musicMood: 'lofi chill',
    targetDurationSeconds: 30,
    defaultHashtags: ['#aiinfluencer', '#dailyvlog', '#lifestyle'],
  },

  /* ═══ Satisfying / ASMR loops ═══════════════════════════════════ */
  {
    id: 'oddly-satisfying',
    name: 'Oddly Satisfying',
    tagline: 'Hypnotic repetitive loops — sand cuts, soap slicing, kinetic sand.',
    description:
      'Pure visual addiction. Minimal text. Low VO or none. Scrapes high-quality close-up footage and loops it with subtle transitions.',
    viralityScore: 10,
    cpmTier: 'low',
    emoji: '✨',
    accentColor: '#22D3EE',
    preferredPlatforms: ['tiktok', 'instagram', 'facebook'],
    template: 'satisfying-loop',
    mediaSources: ['pexels', 'pixabay', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      'POV: you need this right now.',
      'Watch until the end.',
      'Rewind this one.',
      'The calmest 20 seconds of your day.',
    ],
    topicSeeds: [
      'kinetic sand slicing',
      'honey drip close-up',
      'soap cutting',
      'latte art pour',
      'paint mixing',
      'bread dough stretching',
      'hydraulic press crushing',
      'glass blowing',
    ],
    voiceGuide:
      'Zero narration. If any text appears, 3-5 words max per slide.',
    visualStyle:
      'Tight macro close-ups, 120fps slow motion feel, soft daylight, uncluttered backgrounds.',
    musicMood: 'ambient lofi tranquil',
    targetDurationSeconds: 20,
    defaultHashtags: ['#oddlysatisfying', '#asmr', '#satisfying', '#fyp'],
    defaultFormat: 'video',
  },

  /* ═══ Fashion / outfit inspiration ══════════════════════════════ */
  {
    id: 'fit-check',
    name: 'Fit Check',
    tagline: 'Daily outfit rotations — streetwear, workwear, seasonal looks.',
    description:
      'Head-to-toe outfit posts. Works best as a slideshow with bold numbered cards ("look 1 of 5") set to upbeat audio. Huge save rate on Pinterest + Reels.',
    viralityScore: 10,
    cpmTier: 'high',
    emoji: '👔',
    accentColor: '#0F172A',
    preferredPlatforms: ['instagram', 'tiktok', 'pinterest'],
    template: 'slideshow',
    mediaSources: ['unsplash', 'pexels', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      '{number} outfits for {season}.',
      'Which one would you wear?',
      'Fit of the day, {weekday}.',
      'How to style {item} {number} ways.',
    ],
    topicSeeds: [
      'five minimalist fall fits',
      'streetwear under $300',
      'office-to-dinner outfits',
      'neutral tone capsule',
      'blazer outfit rotation',
      'sneakers + tailoring',
    ],
    voiceGuide:
      'Very few words. Captions: item name + one style note. "Matte black derby — grounds the whole look."',
    visualStyle:
      'Full-body editorial crops, clean neutral backgrounds, daylight, crisp textures. Shoes visible. No distracting props.',
    musicMood: 'upbeat fashion runway',
    targetDurationSeconds: 25,
    defaultHashtags: ['#ootd', '#fitcheck', '#mensfashion', '#streetwear', '#styleinspo'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Fashion hauls / lookbooks ═════════════════════════════════ */
  {
    id: 'lookbook',
    name: 'Lookbook',
    tagline: 'Magazine-style slow reveals of curated outfits.',
    description:
      'Slow, cinematic. Each slide a full look with text-overlay commentary. Premium vibe. Great for aesthetic / luxury brands.',
    viralityScore: 8,
    cpmTier: 'premium',
    emoji: '🧥',
    accentColor: '#78350F',
    preferredPlatforms: ['instagram', 'pinterest', 'tiktok'],
    template: 'slideshow',
    mediaSources: ['unsplash', 'pexels', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      '{season} lookbook.',
      'Stories in {number} outfits.',
      'A week in {palette}.',
    ],
    topicSeeds: [
      'rainy day Copenhagen',
      'wedding guest capsule',
      'all-black editorial',
      'monochrome beige',
      'old-money autumn',
    ],
    voiceGuide:
      'Editorial-adjacent captions. Sentence fragments. "Trench, camel. Silk scarf, muted olive."',
    visualStyle:
      'Film grain, warm white balance, golden hour or soft window light. Full-length plus one detail shot per look.',
    musicMood: 'cinematic indie piano',
    targetDurationSeconds: 30,
    defaultHashtags: ['#lookbook', '#ootd', '#fashioninspo', '#style'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Looksmaxxing ══════════════════════════════════════════════ */
  {
    id: 'looksmaxxing',
    name: 'Looksmaxxing',
    tagline: 'Men\'s appearance optimization — grooming, posture, style habits.',
    description:
      'High-engagement niche. Focus on evidence-based habits (haircut, skincare, posture). Keep it healthy — skip surgical content. Slideshows with bold text work best.',
    viralityScore: 10,
    cpmTier: 'medium',
    emoji: '💪',
    accentColor: '#0EA5E9',
    preferredPlatforms: ['tiktok', 'instagram', 'x'],
    template: 'slideshow',
    mediaSources: ['pexels', 'unsplash', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      '{number} habits that {benefit} in {time}.',
      'Stop doing {thing}. Start doing {other}.',
      'The {adjective} {habit} nobody talks about.',
      'Looksmaxxing tier list: {category}.',
    ],
    topicSeeds: [
      'posture fixes that actually work',
      'skincare for men in their 20s',
      'haircut types by face shape',
      'mewing controversy explained',
      'sleep and skin quality',
      'deep work and looks',
      'gym for aesthetics not strength',
    ],
    voiceGuide:
      'Confident, direct, evidence-first. No misogyny, no toxic shortcuts. Cite a study when making claims. Skip anything surgical or extreme.',
    visualStyle:
      'Before/after splits, tight portraits with good lighting, gym + skincare product close-ups, minimalist masculine palette.',
    musicMood: 'phonk workout cinematic',
    targetDurationSeconds: 35,
    defaultHashtags: ['#looksmaxxing', '#grooming', '#mensadvice', '#selfimprovement'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Biblical / scripture ══════════════════════════════════════ */
  {
    id: 'daily-verse',
    name: 'Daily Verse',
    tagline: 'Scripture verses with cinematic imagery and reflections.',
    description:
      'One verse, one image, one reflection. Works on Reels and Pinterest. Respectful, evergreen, high save rate.',
    viralityScore: 9,
    cpmTier: 'medium',
    emoji: '✝️',
    accentColor: '#78716C',
    preferredPlatforms: ['instagram', 'facebook', 'pinterest'],
    template: 'scripture-card',
    mediaSources: ['unsplash', 'pexels', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      '"{verse}" — {reference}',
      'A verse for {emotion}.',
      'If you are feeling {feeling}, read this.',
      'The promise in {book} {chapter}.',
    ],
    topicSeeds: [
      'Psalm 23 for anxiety',
      'Philippians 4:6-7 on worry',
      'Romans 8:28 on hard seasons',
      'Isaiah 41:10 on fear',
      'Matthew 6:33 on priorities',
      'Proverbs 3:5-6 on trust',
      'Joshua 1:9 on courage',
    ],
    voiceGuide:
      'Warm, reverent, pastoral. Never preachy or judgmental. Read the verse slowly; reflection is brief and personal.',
    visualStyle:
      'Cinematic landscapes at golden hour, cathedral light, open skies, hands in prayer, open Bibles on wood. Muted warm palette.',
    musicMood: 'cinematic worship ambient',
    targetDurationSeconds: 30,
    defaultHashtags: ['#bibleverse', '#dailyverse', '#faith', '#scripture', '#christian'],
  },

  /* ═══ Religious teaching (broader) ══════════════════════════════ */
  {
    id: 'faith-teachings',
    name: 'Faith Teachings',
    tagline: 'Short explainers on religious concepts across traditions.',
    description:
      'Explains a concept, parable, or practice in under a minute. Broader than scripture — includes comparative religion, history, practices. Tone is educational and respectful.',
    viralityScore: 7,
    cpmTier: 'medium',
    emoji: '🛐',
    accentColor: '#B45309',
    preferredPlatforms: ['instagram', 'tiktok', 'facebook'],
    template: 'story-narration',
    mediaSources: ['wikipedia', 'unsplash', 'pexels'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'What does {tradition} say about {topic}?',
      'The meaning of {ritual}, explained.',
      'One parable, one minute: {name}.',
      'Why {practice} matters in {tradition}.',
    ],
    topicSeeds: [
      'the Parable of the Prodigal Son',
      'the five pillars of Islam',
      'the noble eightfold path',
      'Shabbat in Judaism',
      'the story of Job',
      'karma vs grace',
      'lent and fasting',
    ],
    voiceGuide:
      'Educational, neutral, warm. Respects every tradition. Presents beliefs from the tradition\'s own perspective without mocking or proselytizing.',
    visualStyle:
      'Sacred architecture, manuscripts, candles, ceremonial objects. Earthy tones.',
    musicMood: 'ambient reflective orchestral',
    targetDurationSeconds: 50,
    defaultHashtags: ['#faith', '#religion', '#spirituality', '#teachings'],
  },

  /* ═══ Larping / medieval worldbuilding ═════════════════════════ */
  {
    id: 'larp-life',
    name: 'LARP & Lore',
    tagline: 'Medieval / fantasy worldbuilding, larp diaries, kit reveals.',
    description:
      'A niche with extremely loyal fandom. Slideshow kit reveals, character introductions, behind-the-scenes of larp events. Strong aesthetic.',
    viralityScore: 7,
    cpmTier: 'medium',
    emoji: '⚔️',
    accentColor: '#166534',
    preferredPlatforms: ['tiktok', 'instagram'],
    template: 'slideshow',
    mediaSources: ['unsplash', 'pexels', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'Meet {character} of {faction}.',
      'Kit reveal: {role}.',
      'A day at {event}.',
      'How I built this {object} for larp.',
    ],
    topicSeeds: [
      'ranger kit reveal',
      'medieval tavern night',
      'how I made my gambeson',
      'first time larping advice',
      'viking age camp setup',
      'wizard robes evolution',
    ],
    voiceGuide:
      'In-character or gently docu-narrator. Respect the craft — props, stitching, lore.',
    visualStyle:
      'Forest / castle / campfire settings, natural fabric textures, candlelight, weathered leather.',
    musicMood: 'medieval folk cinematic',
    targetDurationSeconds: 35,
    defaultHashtags: ['#larp', '#medieval', '#fantasy', '#cosplay', '#livingsteel'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Rich-person slideshow (luxury lifestyle cards) ═══════════ */
  {
    id: 'quiet-luxury',
    name: 'Quiet Luxury',
    tagline: 'Aspirational slideshows — yachts, watches, interiors, Amalfi light.',
    description:
      'Pure image-carousel luxury. Zero narration. One image per beat with a single-word caption or curated quote. Pair with emotive music. Massive save rate.',
    viralityScore: 10,
    cpmTier: 'premium',
    emoji: '🥂',
    accentColor: '#854D0E',
    preferredPlatforms: ['instagram', 'pinterest', 'tiktok'],
    template: 'slideshow',
    mediaSources: ['unsplash', 'pexels', 'pixabay', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      'A {season} in {place}.',
      'Old money, {setting}.',
      'A {time} in the life.',
      'Quiet luxury, mood.',
    ],
    topicSeeds: [
      'Amalfi coast summer',
      'Hamptons weekend',
      'Parisian apartment',
      'Aspen winter',
      'Capri boat day',
      'Swiss chalet evening',
      'Tokyo omakase',
    ],
    voiceGuide:
      'No VO. On-screen text: one-word chapter markers ("Morning", "Sail", "Return").',
    visualStyle:
      'Warm film grain, Mediterranean light, architectural detail, hands holding crystal, linen, teak, marble. Never logos or price tags.',
    musicMood: 'cinematic piano sentimental',
    targetDurationSeconds: 22,
    defaultHashtags: ['#quietluxury', '#oldmoney', '#luxurylifestyle', '#aesthetic'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Card-collection / trading-card slideshows ════════════════ */
  {
    id: 'card-collector',
    name: 'Card Collector',
    tagline: 'Trading cards, art cards, tarot, collectibles — image reveal carousels.',
    description:
      'Each slide reveals one card with a short note. Works for sports cards, Pokemon, Magic, tarot, or custom art. Satisfying to scroll.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '🎴',
    accentColor: '#7C3AED',
    preferredPlatforms: ['instagram', 'tiktok', 'pinterest'],
    template: 'slideshow',
    mediaSources: ['pixabay', 'pexels', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      'Top {number} {category} cards in my collection.',
      'Daily pull: {item}.',
      'Rare {category}: {item}.',
      'Tarot for {theme}: {card}.',
    ],
    topicSeeds: [
      'PSA 10 rookies',
      'vintage Pokemon rares',
      'Black Lotus Alpha',
      'daily tarot: The Fool',
      'art cards by {artist}',
    ],
    voiceGuide:
      'Minimal text. Card name + grade + price or meaning. That\'s it.',
    visualStyle:
      'High-resolution card scans on plain or wood backgrounds. Dramatic side lighting.',
    musicMood: 'mysterious lofi',
    targetDurationSeconds: 25,
    defaultHashtags: ['#tradingcards', '#cardcollector', '#tarot'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Clothes / ecommerce-style catalog slideshow ══════════════ */
  {
    id: 'catalog-drop',
    name: 'Catalog Drop',
    tagline: 'Product grid slideshows — shoes, bags, accessories, tech.',
    description:
      'Each slide is a single SKU with name + price overlay. Perfect for dropshipping, resale, or curation accounts.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '🛍️',
    accentColor: '#0284C7',
    preferredPlatforms: ['instagram', 'tiktok', 'pinterest'],
    template: 'slideshow',
    mediaSources: ['unsplash', 'pexels', 'pixabay', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      '{number} picks for {audience}.',
      'Under ${price}: {category}.',
      'Drop {number}: {theme}.',
      'This week\'s favorites.',
    ],
    topicSeeds: [
      'five sneakers under $200',
      'minimalist watches',
      'leather bags for fall',
      'desk accessories round-up',
    ],
    voiceGuide:
      'Product-card style captions. Brand · name · price · one detail.',
    visualStyle:
      'Clean product photography, soft drop shadows, neutral backdrops, one hero detail per item.',
    musicMood: 'upbeat modern synth',
    targetDurationSeconds: 22,
    defaultHashtags: ['#shopping', '#newdrop', '#shoppingideas'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Religious art slideshow (icons + hymns) ══════════════════ */
  {
    id: 'sacred-art',
    name: 'Sacred Art',
    tagline: 'Cinematic slideshows of icons, cathedrals, mosques, temples.',
    description:
      'Image-only slideshows pairing sacred art with one-line reflections or verses. Very high save rate.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '🕊️',
    accentColor: '#92400E',
    preferredPlatforms: ['instagram', 'pinterest', 'facebook'],
    template: 'slideshow',
    mediaSources: ['wikipedia', 'unsplash', 'pexels'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      '{theme} — a visual reflection.',
      'The beauty of {tradition}.',
      '{location}, in light.',
    ],
    topicSeeds: [
      'Ethiopian Orthodox icons',
      'Gothic cathedrals of Europe',
      'Islamic geometric tiling',
      'Thai temple interiors',
      'Russian iconography',
    ],
    voiceGuide:
      'Silent. On-screen text: location + date + one verse or aphorism.',
    visualStyle:
      'High-resolution architectural + iconographic photography. Natural light. Preserve detail in stained glass and gold leaf.',
    musicMood: 'ambient choral sacred',
    targetDurationSeconds: 30,
    defaultHashtags: ['#sacredart', '#cathedrals', '#iconography', '#beauty'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Workout / form breakdown ═════════════════════════════════ */
  {
    id: 'form-check',
    name: 'Form Check',
    tagline: 'One exercise, proper form breakdown, common mistakes.',
    description:
      'Real-looking training footage + text cues. High save rate with fitness audiences. Works best with a calm authoritative voice.',
    viralityScore: 8,
    cpmTier: 'high',
    emoji: '🏋️',
    accentColor: '#DC2626',
    preferredPlatforms: ['tiktok', 'instagram', 'youtube'],
    template: 'fact-drop',
    mediaSources: ['pexels', 'unsplash'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'You are doing the {exercise} wrong.',
      '{exercise} — form in 60 seconds.',
      'The {cue} fix that saves your {body-part}.',
    ],
    topicSeeds: [
      'Romanian deadlift cues',
      'squat depth myths',
      'push-up tempo',
      'lat pulldown grip',
      'hip hinge basics',
    ],
    voiceGuide:
      'Coach-like, calm, authoritative. Cue + reason + common mistake.',
    visualStyle:
      'Gym footage, clean form, athletic subjects, neutral palette.',
    musicMood: 'phonk workout driven',
    targetDurationSeconds: 40,
    defaultHashtags: ['#fitness', '#workout', '#gymtok'],
  },

  /* ═══ Mindfulness / meditation ═════════════════════════════════ */
  {
    id: 'breath-minute',
    name: 'Breath Minute',
    tagline: 'Guided 60-second mindfulness resets.',
    description:
      'One-minute box-breathing, grounding, or gratitude practice. High save rate. Very low production cost.',
    viralityScore: 7,
    cpmTier: 'medium',
    emoji: '🧘',
    accentColor: '#64748B',
    preferredPlatforms: ['instagram', 'tiktok', 'facebook'],
    template: 'quote-card',
    mediaSources: ['unsplash', 'pexels', 'ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'A minute to reset.',
      'Try this when {emotion}.',
      'Breathe with me.',
    ],
    topicSeeds: [
      '4-7-8 breathing',
      'box breathing',
      '5-4-3-2-1 grounding',
      'body scan',
      'morning intention',
    ],
    voiceGuide:
      'Low, slow, deliberate. Use the second person. Generous pauses.',
    visualStyle:
      'Ocean, forest, morning light. Minimal on-screen text. Breath-cue ring when applicable.',
    musicMood: 'ambient soft piano',
    targetDurationSeconds: 60,
    defaultHashtags: ['#mindfulness', '#meditation', '#breathwork'],
  },

  /* ═══ Car / gear porn ══════════════════════════════════════════ */
  {
    id: 'garage-drop',
    name: 'Garage Drop',
    tagline: 'Car, bike, and gear walk-arounds — hero shots + specs.',
    description:
      'Single-subject gear content. Photorealistic or real footage. Specs on-screen. Great for motor and EDC accounts.',
    viralityScore: 9,
    cpmTier: 'high',
    emoji: '🏎️',
    accentColor: '#1E293B',
    preferredPlatforms: ['instagram', 'tiktok', 'pinterest'],
    template: 'slideshow',
    mediaSources: ['unsplash', 'pexels', 'ai'],
    useVoiceover: false,
    useMusic: true,
    hookFormulas: [
      '{year} {make} {model} — specs.',
      'Inside the new {thing}.',
      'This or that: {a} vs {b}.',
    ],
    topicSeeds: [
      'Porsche 911 GT3 RS',
      'Ducati Panigale V4',
      'Defender 110 build',
      'mechanical watch dial macro',
      'EDC knife round-up',
    ],
    voiceGuide:
      'Spec-sheet prose. Numbers do the talking. Horsepower, torque, 0-60, price.',
    visualStyle:
      'Low-angle hero shots, rim reflections, garage lighting, oil and metal textures.',
    musicMood: 'cinematic drum orchestral',
    targetDurationSeconds: 25,
    defaultHashtags: ['#cars', '#supercars', '#edc', '#gearporn'],
    defaultFormat: 'slideshow',
  },

  /* ═══ Storytelling / reddit-style ═══════════════════════════════ */
  {
    id: 'story-time',
    name: 'Story Time',
    tagline: 'Reddit-style short stories narrated.',
    description:
      'True-story or anonymized anecdotes. Huge retention. Pair with subtle gameplay or cinematic B-roll.',
    viralityScore: 10,
    cpmTier: 'medium',
    emoji: '🎙️',
    accentColor: '#EF4444',
    preferredPlatforms: ['tiktok', 'instagram'],
    template: 'brainrot',
    mediaSources: ['gameplay', 'pexels'],
    useVoiceover: true,
    useMusic: false,
    hookFormulas: [
      'So this just happened to me.',
      'I had never seen anything like this until {scenario}.',
      'You will not believe what my {person} did.',
      '{question}? Here is my story.',
    ],
    topicSeeds: [
      'weirdest job interview ever',
      'flight next to a stranger',
      'neighbor drama',
      'airport chaos',
      'restaurant rage moment',
    ],
    voiceGuide:
      'First-person, casual, suspenseful. Build tension. Reveal the punchline late. Keep it believable.',
    visualStyle:
      'Full-screen subtitles. Bottom gameplay. Minimal distraction from the story.',
    musicMood: '',
    targetDurationSeconds: 60,
    defaultHashtags: ['#storytime', '#reddit', '#fyp'],
  },

  /* ═══════════════════════════════════════════════════════════════════
   * LONG-FORM ANIMATED EXPLAINERS (1–8 min)
   *
   * These themes are tuned for longer-form, narrated videos with
   * AI-generated animated imagery (cartoon, stick-figure, storybook).
   * They render through the director pipeline with chapter-structured
   * storyboards (5-8 chapters × 3-5 shots each).
   *
   * The user can attach an inspiration character image (e.g. a
   * hunter-gatherer sketch, a scientist-style drawing) in the media
   * library under `inspiration` or `avatar_reference` — the director
   * automatically passes those to every AI shot so the look stays
   * consistent across all 30–60+ shots.
   * ═══════════════════════════════════════════════════════════════════ */

  /* ═══ Hunter-gatherer documentary animation ══════════════════════ */
  {
    id: 'ancient-origins',
    name: 'Ancient Origins',
    tagline: 'Long-form animated documentaries about humanity’s earliest days.',
    description:
      'Cartoon / storybook-style animated shorts (1–8 min) about hunter-gatherers, neolithic villages, cave art, early farming. Narrated like a BBC documentary over richly illustrated scenes. Upload inspiration drawings of your characters and the animation style will follow.',
    viralityScore: 7,
    cpmTier: 'high',
    emoji: '🔥',
    accentColor: '#B45309',
    preferredPlatforms: ['youtube', 'tiktok', 'instagram'],
    template: 'animated-explainer',
    mediaSources: ['ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'Imagine it is {year} years ago, and you are {action}.',
      'This is how our ancestors {activity} — long before {modernThing}.',
      'Long before cities, long before writing — there was this.',
      'A single {object} can tell us {insight} about {era}.',
    ],
    topicSeeds: [
      'a day in the life of a Palaeolithic hunter-gatherer',
      'how early humans first controlled fire',
      'the cave paintings at Lascaux, 17,000 years ago',
      'Ötzi the Iceman — a 5,000-year-old murder mystery',
      'Çatalhöyük, the first proto-city in Neolithic Turkey',
      'Blombos Cave, 75,000 years ago — the oldest known abstract drawing',
      'flint knapping: how stone-age toolmakers shaped obsidian blades',
      'how hunter-gatherer bands shared food and survived lean seasons',
      'the Dolní Věstonice burial, 26,000 years ago',
      'the Bronze Age collapse of 1177 BCE',
    ],
    voiceGuide:
      'Calm, curious, documentary narrator — Attenborough without the flourishes. Measured pacing. Specific numbers, place names, and plausible sensory detail. Never anachronistic slang, never "mind-blowing".',
    visualStyle:
      'Warm, hand-drawn storybook animation. Earthy palette — ochre, burnt sienna, forest green, charcoal. Characters drawn consistently across shots — short, sturdy builds, furs and animal hide, weathered faces. Wide natural landscapes (savannah, steppe, forest). Firelight for dusk scenes, blue-grey for dawn. Treat every frame like an illustrated children’s history book page, not a photoreal render.',
    musicMood: 'cinematic tribal percussion low orchestral strings',
    targetDurationSeconds: 240,
    defaultHashtags: [
      '#history', '#ancienthistory', '#prehistory', '#archaeology',
      '#documentary', '#huntergatherer', '#neolithic', '#learnontiktok',
    ],
  },

  /* ═══ Science cartoon explainer ═════════════════════════════════ */
  {
    id: 'science-cartoon',
    name: 'Science Cartoon',
    tagline: 'Cartoon-style science explainers, 1–5 min. Cells, planets, forces.',
    description:
      'Friendly animated cartoons that teach one science concept per video — how a cell divides, why the sky is blue, how vaccines actually work, what happens inside a black hole. Think "Kurzgesagt meets a patient tutor". Upload character drawings (a scientist, a mascot, a little bird) and the same character will host every video.',
    viralityScore: 8,
    cpmTier: 'high',
    emoji: '🧪',
    accentColor: '#0EA5E9',
    preferredPlatforms: ['youtube', 'tiktok', 'instagram'],
    template: 'animated-explainer',
    mediaSources: ['ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'How does {phenomenon} actually work? Let’s zoom in.',
      'In the next {minutes} minutes you’ll understand {concept} better than most people ever do.',
      'What if I told you {counterIntuitive}?',
      'Inside every {thing}, something incredible is happening right now.',
    ],
    topicSeeds: [
      'how your immune system fights off a virus',
      'what happens inside a star when it dies',
      'why time slows down near a black hole',
      'how DNA copies itself during cell division',
      'what atoms are actually made of',
      'why sunsets turn red — Rayleigh scattering in one minute',
      'how ants coordinate without a leader',
      'what the Higgs boson really is, explained without maths',
      'why antibiotics stop working — resistance in 3 minutes',
      'how mRNA vaccines actually work',
    ],
    voiceGuide:
      'Friendly science communicator — warm, precise, occasionally playful. Use analogies that hold up. Never dumb down. Acknowledge uncertainty. No hype words.',
    visualStyle:
      'Flat-shaded 2D cartoon with bold outlines, soft gradients, bright but not neon palette (teal, coral, cream, deep navy). Consistent mascot / character across every shot. Simple backgrounds so the concept stays legible — labelled diagrams, abstracted cells / planets / particles. Think Kurzgesagt illustration style: clean vectors, clear shapes, tiny visual jokes in corners.',
    musicMood: 'curious playful electronic orchestral build',
    targetDurationSeconds: 240,
    defaultHashtags: [
      '#science', '#stem', '#physics', '#biology', '#education',
      '#learnontiktok', '#scienceforkids', '#cartoon',
    ],
  },

  /* ═══ Stick-figure whiteboard explainer ═════════════════════════ */
  {
    id: 'stick-figure-explainer',
    name: 'Stick Figure Explainer',
    tagline: 'Whiteboard / stick-figure animations for any topic, 1–6 min.',
    description:
      'Minimalist stick-figure animations on a clean notebook background. Works for any topic — finance, psychology, philosophy, startups, "how things work". Cheap to render and ridiculously effective — looks hand-drawn and personal. Upload sketches of your stick figure and it will keep the same style.',
    viralityScore: 8,
    cpmTier: 'medium',
    emoji: '✏️',
    accentColor: '#1F2937',
    preferredPlatforms: ['youtube', 'tiktok', 'instagram', 'linkedin'],
    template: 'animated-explainer',
    mediaSources: ['ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'Let me draw you something that changed how I think about {topic}.',
      'Here is {concept} — explained in stick figures.',
      'If I only had a whiteboard and {minutes} minutes to teach you {idea}, here is what I would draw.',
      'Everyone overcomplicates {topic}. Here it is in {number} drawings.',
    ],
    topicSeeds: [
      'how compound interest really works',
      'the prisoner’s dilemma in under 3 minutes',
      'how to actually think in systems',
      'why your brain procrastinates',
      'the idea of opportunity cost',
      'supply and demand without the jargon',
      'Bayes theorem for normal people',
      'what negotiation actually is',
    ],
    voiceGuide:
      'Warm, patient teacher. Conversational. Thinks out loud. Says "let me draw this" and "watch what happens". Never condescending.',
    visualStyle:
      'Hand-drawn stick figures on warm off-white paper or whiteboard. Black ink lines, occasional single accent colour (yellow highlighter or red marker). Arrows, labels, speech bubbles. Imperfect — wobble is welcome. Think RSA Animate meets Sal Khan’s napkin sketches.',
    musicMood: 'calm acoustic piano lofi',
    targetDurationSeconds: 180,
    defaultHashtags: [
      '#education', '#learnontiktok', '#explainer', '#whiteboard',
      '#stickfigure', '#financialliteracy', '#psychology',
    ],
  },

  /* ═══ Storybook folk-tale / myth animation ═════════════════════ */
  {
    id: 'storybook-myth',
    name: 'Storybook Myth',
    tagline: 'Illustrated folk tales, myths, and fables, 2–8 min.',
    description:
      'Long-form animated folk tales, mythology retellings, and fables — Greek myths, Norse sagas, African folk stories, Japanese yokai tales. Fully narrated in a storybook-animation style. Upload inspiration illustrations of your hero and the director will keep the same character look across chapters.',
    viralityScore: 7,
    cpmTier: 'medium',
    emoji: '📖',
    accentColor: '#7C3AED',
    preferredPlatforms: ['youtube', 'tiktok', 'instagram', 'facebook'],
    template: 'animated-explainer',
    mediaSources: ['ai'],
    useVoiceover: true,
    useMusic: true,
    hookFormulas: [
      'Long ago, in the {place}, {character} faced a choice no one had faced before.',
      'They say {subject} was once {transformation} — and this is how.',
      'Every {culture} child grows up hearing this story. Here is why it still matters.',
      'Before there was {modernThing}, there was a story about {subject}.',
    ],
    topicSeeds: [
      'the Norse myth of Ragnarok',
      'the tale of Anansi the spider',
      'how Prometheus stole fire',
      'the legend of Momotaro the peach boy',
      'the story of the Monkey King',
      'Baba Yaga and the lost child',
      'the Epic of Gilgamesh in one sitting',
      'the Ramayana for beginners',
    ],
    voiceGuide:
      'Warm storyteller by a fire. Measured, unhurried. Long sentences welcome. Repeats names for rhythm. Lets silence breathe between chapters.',
    visualStyle:
      'Painterly storybook illustration — think Studio Ghibli meets classic Grimm fairy-tale books. Rich textured backgrounds, hand-painted look, soft lighting. Characters drawn consistently across shots with clear silhouettes. Chapter title cards in ornate serif type.',
    musicMood: 'cinematic celtic orchestral folk ambient',
    targetDurationSeconds: 300,
    defaultHashtags: [
      '#mythology', '#folktales', '#storytime', '#animation',
      '#history', '#bedtimestory', '#fairytale',
    ],
  },
];

export function getTheme(id: string): PersonalTheme | undefined {
  return THEMES.find((t) => t.id === id);
}

export function listThemes(): PersonalTheme[] {
  return [...THEMES].sort((a, b) => b.viralityScore - a.viralityScore);
}

/**
 * Public-safe theme summary for the dashboard picker. Strips prompt
 * bits like voiceGuide/visualStyle so they don't leak to the client.
 * (Not secret, just noisy.)
 */
export function themeSummary(t: PersonalTheme) {
  return {
    id: t.id,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    emoji: t.emoji,
    accentColor: t.accentColor,
    viralityScore: t.viralityScore,
    cpmTier: t.cpmTier,
    preferredPlatforms: t.preferredPlatforms,
    template: t.template,
    targetDurationSeconds: t.targetDurationSeconds,
    defaultHashtags: t.defaultHashtags,
    useVoiceover: t.useVoiceover,
    useMusic: t.useMusic,
    mediaSources: t.mediaSources,
    topicSeedExamples: t.topicSeeds.slice(0, 5),
  };
}

export type ThemeSummary = ReturnType<typeof themeSummary>;
