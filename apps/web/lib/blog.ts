/**
 * Blog post data. Stored as a simple array for now. When the blog grows past
 * ~20 posts, move to MDX files or a headless CMS. Each post has a slug, title,
 * excerpt, body (plain paragraphs), and metadata for SEO.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  author: string;
  publishedAt: string;
  readingTime: string;
  tags: string[];
  /** SEO meta description. Falls back to excerpt if omitted. */
  metaDescription?: string;
}

export const posts: BlogPost[] = [
  {
    slug: 'why-local-businesses-need-social-media',
    title: 'Why local businesses need social media in 2026',
    excerpt:
      'Your customers are scrolling before they search. Here is why showing up consistently on social media is the single best investment a local business can make this year.',
    body: [
      'Five years ago, a local business could get by with a Google listing and word of mouth. That still matters, but the way people discover new places has shifted. They scroll Instagram before they search Google. They check a cafe\'s feed before they check the menu. They look at a plumber\'s reviews on Facebook before they call.',
      'The businesses that show up consistently on social media are the ones that stay top of mind. Not because they post the most, but because they post the right things at the right time. A well-timed photo of a finished job, a quick tip that saves someone a call, a behind-the-scenes look at the team. These small moments build trust faster than any ad.',
      'The challenge for most local businesses is time. You are already running the business. Finding an hour to plan, write, and schedule posts every week is hard. That is exactly why done-for-you social media services exist. You hand over the raw material, photos, updates, and a team handles the rest.',
      'The ROI is not always immediate, but it compounds. A cafe that posts three times a week for six months builds a library of content that works for them around the clock. A plumber who shares tips and finished jobs becomes the obvious choice when someone has a burst pipe at 2am.',
      'If you are a local business owner and you are not on social media yet, the best time to start was last year. The second best time is this week.',
    ],
    author: 'BoostMyBranding',
    publishedAt: '2026-04-15',
    readingTime: '4 min read',
    tags: ['social media', 'local business', 'marketing'],
    metaDescription:
      'Why local businesses need social media in 2026. How consistent posting builds trust, drives bookings, and keeps your brand top of mind.',
  },
  {
    slug: 'how-many-posts-per-month',
    title: 'How many social media posts does a small business actually need?',
    excerpt:
      'The answer is not "as many as possible." Here is how to find the right posting frequency for your business without burning out.',
    body: [
      'There is a lot of advice out there about posting frequency. Some say daily. Some say three times a day. The truth is simpler: consistency matters more than volume.',
      'For most local businesses, 20 to 30 posts per month across two or three platforms is the sweet spot. That is roughly one post per day, spread across Instagram, Facebook, and LinkedIn. Enough to stay visible without flooding your audience.',
      'The key is variety. Mix educational posts (tips your customers actually use), behind-the-scenes content (your team, your process), social proof (reviews, finished work), and the occasional promotion. A good content calendar rotates through these types so your feed never feels repetitive.',
      'What about Reels and Stories? They are worth doing, but only if the quality is there. A shaky, poorly lit Reel does more harm than good. If you have good footage, use it. If not, stick to strong static posts and carousels until you do.',
      'The businesses that get the best results are not the ones posting the most. They are the ones posting the right content, on the right platforms, at the right time. That is what a good social media team figures out for you.',
    ],
    author: 'BoostMyBranding',
    publishedAt: '2026-04-08',
    readingTime: '3 min read',
    tags: ['social media', 'content strategy', 'small business'],
    metaDescription:
      'How many social media posts does a small business need per month? Find the right posting frequency without burning out.',
  },
  {
    slug: 'what-makes-a-good-social-media-photo',
    title: 'What makes a good social media photo (and you probably already have one)',
    excerpt:
      'You do not need a professional photographer. Here is what actually makes a photo perform well on Instagram and Facebook.',
    body: [
      'The most common thing we hear from new clients is "I do not have good enough photos." Almost every time, they are wrong. The photos on their phone are better than they think.',
      'What makes a social media photo work is not technical perfection. It is authenticity and context. A slightly imperfect photo of a real finished job outperforms a stock image every time. A candid shot of your team at work builds more trust than a posed studio portrait.',
      'That said, there are a few things that make a real difference. Natural light is the biggest one. Photos taken near a window or outdoors almost always look better than photos taken under fluorescent lights. Second, composition. The rule of thirds still works. Put the subject slightly off-centre and leave some breathing room.',
      'Third, and this is the one most people miss, context. A photo of a coffee cup is fine. A photo of a coffee cup on a wooden counter with morning light and a newspaper in the background tells a story. That story is what stops the scroll.',
      'If you are a local business owner, start by taking five photos this week. Your workspace, your product, your team, a happy customer (with permission), and one detail shot. That is enough for a week of content. Your social media team can handle the rest.',
    ],
    author: 'BoostMyBranding',
    publishedAt: '2026-03-25',
    readingTime: '3 min read',
    tags: ['photography', 'Instagram', 'content creation'],
    metaDescription:
      'What makes a good social media photo for business? Tips on lighting, composition, and why your phone photos are better than you think.',
  },
  {
    slug: 'social-media-vs-website-which-first',
    title: 'Social media or website first? Where to spend your marketing budget',
    excerpt:
      'If you can only pick one, here is how to decide between investing in social media or a website for your local business.',
    body: [
      'This is one of the most common questions we get from new businesses. Should I invest in social media first, or get a website up? The honest answer depends on your business, but here is a framework that works for most.',
      'If your business is discovery-driven, meaning people find you by browsing rather than searching, social media comes first. Cafes, beauty salons, fitness studios, and retail shops all fall into this category. Your Instagram feed is your storefront. People want to see what you do before they visit.',
      'If your business is search-driven, meaning people look for you when they have a specific need, a website comes first. Plumbers, electricians, accountants, and solicitors fall here. When someone has a burst pipe, they Google "plumber near me," not scroll Instagram.',
      'The ideal setup is both, working together. Your social media drives awareness and keeps you top of mind. Your website converts that awareness into bookings, calls, and enquiries. The social feed shows personality and proof. The website shows credibility and makes it easy to take action.',
      'If budget is tight, start with whichever channel matches how your customers find you. Then add the other within three to six months. The compounding effect of both running together is where the real growth happens.',
    ],
    author: 'BoostMyBranding',
    publishedAt: '2026-03-18',
    readingTime: '4 min read',
    tags: ['marketing strategy', 'website', 'social media', 'local business'],
    metaDescription:
      'Social media or website first for your local business? A practical framework for deciding where to invest your marketing budget.',
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug);
}
