/**
 * Prompt templates for the content pipeline. Kept as pure strings with
 * mustache-style slots so they can be fed into Claude verbatim.
 */

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
  "sentenceStyle": "short|medium|long — describe preferred sentence length",
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
- Mix content types; no more than 2 promotional in a row
- Use real images (imageIndex) for at least 60% of posts
- Vary platforms — don't post identically on all same day
- Seasonal references for ${vars.month} where appropriate
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
