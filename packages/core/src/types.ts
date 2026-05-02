/**
 * Shared domain types across apps. Mirrors the Drizzle schema in
 * packages/database/src/schema.ts, plus the lightweight shape used by mock
 * fixtures (`scheduledFor`, `imageUrl`). UIs normalize both via helpers in
 * this package.
 */

export type Platform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'pinterest'
  | 'bluesky';

export type PostStatus =
  | 'draft'
  | 'pending_internal'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rejected';

export type ImageStatus = 'pending' | 'analyzing' | 'approved' | 'rejected' | 'enhanced' | 'used';

export type SubscriptionTier = 'social_only' | 'website_only' | 'full_package';

/**
 * Lifecycle state of a client's Stripe subscription.
 * - `none`: signed up but never paid — features locked
 * - `active`: paying in good standing
 * - `past_due`: payment failed, grace period
 * - `canceled`: previously paid, no longer — features locked
 */
export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled';

export interface Client {
  id: string;
  businessName: string;
  /** URL-safe slug used for public site URLs (/sites/[slug]). Optional on the
   *  mock shape; present on all real DB rows. */
  slug?: string;
  contactName: string;
  email: string;
  industry: string;
  logoUrl?: string;
  brandColors: { primary: string; secondary: string; accent: string };
  subscriptionTier: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartedAt?: string | null;
  stripeCustomerId?: string | null;
  monthlyPriceCents: number;
  isActive: boolean;
  onboardedAt: string;
  websiteUrl?: string;
  socialAccounts?: Record<string, string>;
  stats: {
    postsThisMonth: number;
    pendingApproval: number;
    imagesUploaded: number;
    engagementRate: number;
  };
}

/** True when a client has paid and is in good standing. */
export function hasActiveSubscription(
  c: Pick<Client, 'subscriptionStatus'> | null | undefined,
): boolean {
  if (!c) return false;
  return c.subscriptionStatus === 'active' || c.subscriptionStatus === 'past_due';
}

export interface ClientImage {
  id: string;
  clientId: string;
  fileUrl: string;
  fileName: string;
  tags: string[];
  aiDescription?: string;
  qualityScore?: number;
  status: ImageStatus;
  uploadedAt: string;
}

export interface Post {
  id: string;
  clientId: string;
  clientName?: string;
  /** Mock data uses `imageUrl`; DB rows use `generatedImageUrl`. Helpers below normalize. */
  imageUrl?: string;
  generatedImageUrl?: string | null;
  caption: string;
  platform: Platform;
  hashtags: string[];
  /** Mock data uses `scheduledFor`; DB rows use `scheduledAt`. */
  scheduledFor?: string;
  scheduledAt?: string | Date | null;
  status: PostStatus;
  clientFeedback?: string | null;
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
  } | null;
}

/** Pull the image URL off a Post regardless of which format it's in. */
export function postImageUrl(p: Post): string {
  return p.imageUrl ?? p.generatedImageUrl ?? '';
}

/** Pull the scheduled time off a Post as a Date. */
export function postScheduledAt(p: Post): Date {
  const raw = p.scheduledFor ?? p.scheduledAt;
  if (!raw) return new Date();
  return raw instanceof Date ? raw : new Date(raw);
}

export interface Message {
  id: string;
  clientId: string;
  sender: 'client' | 'agency';
  senderName: string;
  body: string;
  attachmentUrl?: string;
  createdAt: string;
  isRead: boolean;
}

export interface WebsiteRequest {
  id: string;
  clientId: string;
  description: string;
  priority: 'low' | 'normal' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: { message: string; code: string };
}
