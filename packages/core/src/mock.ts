/**
 * Deterministic mock dataset used by portal, dashboard, and API in dev mode.
 * Replace with real DB queries once backend is wired up.
 */

import type { Client, ClientImage, Message, Post, WebsiteRequest } from './types.js';
import { getTier } from './config.js';

const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * 86400000).toISOString();

export const mockClients: Client[] = [
  {
    id: 'c_murphy',
    businessName: "Murphy's Plumbing",
    contactName: 'Sean Murphy',
    email: 'sean@murphysplumbing.ie',
    industry: 'Home Services',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=murphy&backgroundColor=48D886',
    brandColors: { primary: '#0EA5E9', secondary: '#0B1220', accent: '#F59E0B' },
    subscriptionTier: 'full_package',
    monthlyPriceCents: getTier('full_package').priceCents,
    isActive: true,
    onboardedAt: iso(-120),
    stats: { postsThisMonth: 28, pendingApproval: 6, imagesUploaded: 22, engagementRate: 4.2 },
  },
  {
    id: 'c_atlas',
    businessName: 'Atlas Fitness',
    contactName: 'Nora Kelly',
    email: 'nora@atlasfitness.co',
    industry: 'Health & Fitness',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=atlas&backgroundColor=1D9CA1',
    brandColors: { primary: '#EF4444', secondary: '#111827', accent: '#FBBF24' },
    subscriptionTier: 'social_only',
    monthlyPriceCents: getTier('social_only').priceCents,
    isActive: true,
    onboardedAt: iso(-60),
    stats: { postsThisMonth: 30, pendingApproval: 4, imagesUploaded: 35, engagementRate: 6.8 },
  },
  {
    id: 'c_verde',
    businessName: 'Verde Cafe',
    contactName: 'Luca Romano',
    email: 'luca@verdecafe.com',
    industry: 'Food & Beverage',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=verde&backgroundColor=FFEC3D',
    brandColors: { primary: '#22C55E', secondary: '#1F2937', accent: '#F97316' },
    subscriptionTier: 'full_package',
    monthlyPriceCents: getTier('full_package').priceCents,
    isActive: true,
    onboardedAt: iso(-30),
    stats: { postsThisMonth: 24, pendingApproval: 9, imagesUploaded: 41, engagementRate: 5.4 },
  },
  {
    id: 'c_nova',
    businessName: 'Nova Beauty Studio',
    contactName: 'Amelia Chen',
    email: 'amelia@novabeauty.co',
    industry: 'Beauty & Wellness',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=nova&backgroundColor=48D886',
    brandColors: { primary: '#EC4899', secondary: '#0F172A', accent: '#FBCFE8' },
    subscriptionTier: 'website_only',
    monthlyPriceCents: getTier('website_only').priceCents,
    isActive: true,
    onboardedAt: iso(-15),
    stats: { postsThisMonth: 0, pendingApproval: 0, imagesUploaded: 12, engagementRate: 0 },
  },
];

const sampleImage = (seed: string, w = 800, h = 800) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const captions = [
  "Morning routines built different ☕️ Drop your go-to below.",
  "Behind every reliable service is a team that shows up. Meet the crew.",
  "Small details, big impact. Here's what we shipped this week.",
  "Steam, smiles, and specialty beans. Weekend plans sorted.",
  "Before vs after - the glow-up nobody talks about.",
  "5-star review of the week 💛 Thanks for trusting us.",
  "New drop incoming. Tap the link to get on the list.",
  "Did you know? Fun fact in the caption, saved for later.",
];

const platforms: Post['platform'][] = ['instagram', 'facebook', 'linkedin', 'tiktok', 'x'];

export const mockPosts: Post[] = Array.from({ length: 40 }, (_, i) => {
  const client = mockClients[i % mockClients.length]!;
  const platform = platforms[i % platforms.length]!;
  const statusCycle: Post['status'][] = [
    'pending_approval',
    'pending_approval',
    'approved',
    'scheduled',
    'published',
    'draft',
  ];
  const status = statusCycle[i % statusCycle.length]!;
  return {
    id: `p_${i + 1}`,
    clientId: client.id,
    clientName: client.businessName,
    imageUrl: sampleImage(`${client.id}-${i}`),
    caption: captions[i % captions.length]!,
    platform,
    hashtags: ['#smallbusiness', `#${client.industry.toLowerCase().replace(/\s+/g, '')}`, '#daily'],
    scheduledFor: iso(i - 10),
    status,
    engagement:
      status === 'published'
        ? {
            likes: 120 + i * 9,
            comments: 8 + (i % 20),
            shares: 3 + (i % 10),
            reach: 1800 + i * 75,
          }
        : undefined,
  };
});

export const mockImages: ClientImage[] = Array.from({ length: 16 }, (_, i) => {
  const client = mockClients[i % mockClients.length]!;
  return {
    id: `img_${i + 1}`,
    clientId: client.id,
    fileUrl: sampleImage(`img-${client.id}-${i}`, 1200, 1200),
    fileName: `upload-${i + 1}.jpg`,
    tags: ['product', 'team', 'workspace', 'event'].slice(0, 1 + (i % 3)),
    aiDescription: 'Bright, warm subject in natural light. Good composition, minor crop needed.',
    qualityScore: 6 + (i % 4),
    status: i % 5 === 0 ? 'enhanced' : 'approved',
    uploadedAt: iso(-i - 1),
  };
});

export const mockMessages: Message[] = [
  {
    id: 'm1',
    clientId: 'c_murphy',
    sender: 'agency',
    senderName: 'Jamie (BoostMyBranding)',
    body: 'Hey Sean! Your April calendar is live. 6 new posts going out this week.',
    createdAt: iso(-2),
    isRead: true,
  },
  {
    id: 'm2',
    clientId: 'c_murphy',
    sender: 'client',
    senderName: 'Sean Murphy',
    body: 'Love them. Can we push the emergency callout one to Friday?',
    createdAt: iso(-2),
    isRead: true,
  },
  {
    id: 'm3',
    clientId: 'c_murphy',
    sender: 'agency',
    senderName: 'Jamie (BoostMyBranding)',
    body: 'Done. Also added 2 new testimonials from your Trustpilot.',
    createdAt: iso(-1),
    isRead: false,
  },
];

export const mockWebsiteRequests: WebsiteRequest[] = [
  {
    id: 'w1',
    clientId: 'c_murphy',
    description: 'Update hero photo with the new van wrap.',
    priority: 'normal',
    status: 'in_progress',
    createdAt: iso(-3),
  },
  {
    id: 'w2',
    clientId: 'c_verde',
    description: 'Add online ordering link to the menu page.',
    priority: 'urgent',
    status: 'pending',
    createdAt: iso(-1),
  },
];

export const getClient = (id: string) => mockClients.find((c) => c.id === id);
export const getPostsForClient = (id: string) => mockPosts.filter((p) => p.clientId === id);
export const getMessagesForClient = (id: string) => mockMessages.filter((m) => m.clientId === id);
