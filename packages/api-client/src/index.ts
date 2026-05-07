/**
 * Thin, typed fetch wrapper shared by web/portal/dashboard so each app speaks
 * to the API with the same contract and cookie handling.
 */

import type { ApiResponse, Client, Post, Message, ClientImage } from '@boost/core';
import type { WebsiteConfig, SiteTemplate } from '@boost/core';

/**
 * Per-template overrides the renderer understands. Mirrors
 * `VideoOptions` in @boost/video so the dashboard doesn't need a
 * direct dependency on the video package.
 */
export interface VideoRenderOptions {
  /** Preset id from the template's `availablePresets` list. */
  presetId?: string;
  headlineSize?: number;
  headlineFont?: 'serif' | 'display';
  duration?: number;
  intensity?: number;
  accentStyle?: 'underline' | 'dot' | 'bar' | 'ring' | 'none';
  mood?: 'calm' | 'balanced' | 'energetic';
  showBrandMark?: boolean;
  showCta?: boolean;
}

export interface ApiConfig {
  baseUrl: string;
}

/**
 * Error thrown by the API client. Carries the HTTP status and app-level error
 * code so callers can distinguish 401 (redirect to login) from 5xx (retry) etc.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
  get isNetworkError() {
    return this.status === 0;
  }
}

export class BoostApi {
  constructor(private config: ApiConfig) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.config.baseUrl + path, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        ...init,
      });
    } catch (e) {
      // Network-level failure (DNS, offline, CORS preflight blocked, etc).
      throw new ApiError((e as Error).message || 'Network error', 0);
    }
    const payload = (await res.json().catch(() => ({}))) as ApiResponse<T>;
    if (!res.ok || payload.error) {
      const msg = payload.error?.message ?? `Request failed (${res.status})`;
      throw new ApiError(msg, res.status, payload.error?.code);
    }
    return payload.data as T;
  }

  // ----- System -----
  systemStatus() {
    return this.request<{
      database: boolean;
      claude: boolean;
      fal: boolean;
      r2: boolean;
      stripe: boolean;
      resend: boolean;
      contentStudio: boolean;
    }>('/api/v1/system/status');
  }

  // ----- Auth -----
  sendMagicLink(email: string, redirectTo?: string) {
    return this.request<{ sent: boolean; devLink?: string }>('/api/v1/auth/send', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo }),
    });
  }

  /** Email + password login. Sets the session cookie on success. */
  login(email: string, password: string) {
    return this.request<{ ok: true }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  /**
   * Create a client-role account with a password. No payment needed — they
   * land with `subscription_status: 'none'` and pick a tier in-portal.
   */
  register(args: {
    email: string;
    password: string;
    businessName: string;
    contactName: string;
    industry?: string;
  }) {
    return this.request<{ ok: true; clientId: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /** Create an agency team account. Domain-gated server-side. */
  registerTeam(args: { email: string; password: string; name: string }) {
    return this.request<{ ok: true }>('/api/v1/auth/register-team', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /**
   * Legacy magic-link signup. Creates a user + client record, emails a
   * magic link. Retained for callers that don't want to collect passwords.
   */
  signup(args: {
    email: string;
    businessName: string;
    contactName: string;
    industry?: string;
    websiteUrl?: string;
    tier?: 'social_only' | 'website_only' | 'full_package';
    redirectTo?: string;
  }) {
    return this.request<{ sent: boolean; devLink?: string }>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }
  me() {
    return this.request<{ id: string; email: string; role: string; name?: string; clientId?: string }>(
      '/api/v1/auth/me',
    );
  }
  logout() {
    return this.request<{ ok: true }>('/api/v1/auth/logout', { method: 'POST' });
  }

  // ----- Clients -----
  listClients() {
    return this.request<Client[]>('/api/v1/clients');
  }
  getClient(id: string) {
    return this.request<Client>(`/api/v1/clients/${id}`);
  }
  getMyClient() {
    return this.request<Client>('/api/v1/clients/me');
  }
  /**
   * Everything the AI knows about a client: palette, logo, contact,
   * services, team, past hashtags, top media, + a completeness score.
   * Used by the Brand Readiness panel in the dashboard.
   */
  getBrandContext(id: string) {
    return this.request<{
      businessName: string;
      industry?: string;
      brandVoiceGuide?: string;
      websiteUrl?: string;
      palette: {
        primary?: string;
        secondary?: string;
        accent?: string;
        pop?: string;
        dark?: string;
        paper?: string;
      };
      logoUrl?: string;
      contact: {
        address?: string;
        phone?: string;
        email?: string;
        whatsapp?: string;
        hours?: string;
      };
      socials: Record<string, string>;
      services: Array<{ title: string; description?: string }>;
      team: Array<{ name: string; role: string; bio?: string }>;
      serviceAreas: string[];
      credentials: Array<{ label: string; detail?: string }>;
      pastHashtags: string[];
      topMedia: Array<{
        id: string;
        fileUrl: string;
        mimeType?: string | null;
        aiDescription?: string | null;
        qualityScore?: number | null;
      }>;
      inspirationProfiles?: InspirationProfile[];
      tonePairs?: TonePair[];
      products?: Product[];
      completeness: {
        hasVoice: boolean;
        hasPalette: boolean;
        hasLogo: boolean;
        hasContact: boolean;
        hasServices: boolean;
        hasTeam: boolean;
        hasMedia: boolean;
        hasInspiration?: boolean;
        hasTonePairs?: boolean;
        hasProducts?: boolean;
        score: number;
      };
    }>(`/api/v1/clients/${id}/brand-context`);
  }
  /**
   * Agency-side: create a new client record. Returns the created row so
   * the UI can route to its detail page.
   */
  createClient(body: {
    businessName: string;
    contactName: string;
    email: string;
    industry?: string;
    websiteUrl?: string;
    subscriptionTier?: 'social_only' | 'website_only' | 'full_package';
  }) {
    return this.request<Client>('/api/v1/clients', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  /**
   * Agency-side: send the client an email invite with a pre-filled signup
   * link. Idempotent — safe to re-send. Returns `sent: false` with a
   * copy-pasteable `link` when email isn't configured (dev / paste-it-
   * yourself fallback).
   */
  inviteClient(id: string, body: { agencyName?: string } = {}) {
    return this.request<{ sent: boolean; link: string; email: string }>(
      `/api/v1/clients/${id}/invite`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  }
  updateMyClient(patch: {
    industry?: string;
    websiteUrl?: string;
    socialAccounts?: Record<string, string>;
    brandColors?: { primary: string; secondary: string; accent: string };
  }) {
    return this.request<Client>('/api/v1/clients/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  /** Agency-side update of any client field. */
  updateClient(
    id: string,
    patch: {
      businessName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      industry?: string;
      websiteUrl?: string;
      brandVoice?: string;
      logoUrl?: string;
      subscriptionTier?: 'social_only' | 'website_only' | 'full_package';
      isActive?: boolean;
    },
  ) {
    return this.request<Client>(`/api/v1/clients/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  /** Delete a client and all associated data. Agency admin only. */
  deleteClient(id: string) {
    return this.request<{ id: string; deleted: boolean }>(
      `/api/v1/clients/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  }

  /** Clear a client's website config (reverts to "coming soon"). */
  deleteWebsiteConfig(clientId: string) {
    return this.request<{ id: string; cleared: boolean }>(
      `/api/v1/clients/${encodeURIComponent(clientId)}/website`,
      { method: 'DELETE' },
    );
  }

  // ----- Posts -----
  listPosts(params: { clientId?: string; status?: string; batchId?: string } = {}) {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][],
    ).toString();
    return this.request<Post[]>(`/api/v1/posts${q ? `?${q}` : ''}`);
  }
  approvePost(id: string) {
    return this.request<Post>(`/api/v1/posts/${id}/approve`, { method: 'PATCH' });
  }
  rejectPost(id: string, feedback: string) {
    return this.request<Post>(`/api/v1/posts/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback }),
    });
  }
  updatePost(id: string, patch: Partial<Pick<Post, 'caption' | 'hashtags'>> & { scheduledAt?: string; status?: string }) {
    return this.request<Post>(`/api/v1/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
  deletePost(id: string) {
    return this.request<{ id: string; deleted: boolean }>(`/api/v1/posts/${id}`, {
      method: 'DELETE',
    });
  }
  /**
   * Compose a net-new post (agency only). Lets the team write a manual
   * post without running the full pipeline. Lands in `pending_internal`.
   */
  createPost(args: {
    clientId: string;
    caption: string;
    hashtags?: string[];
    platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'x' | 'pinterest' | 'bluesky';
    imageUrl?: string;
    imageId?: string;
    scheduledAt?: string;
  }) {
    return this.request<Post>('/api/v1/posts', {
      method: 'POST',
      body: JSON.stringify({ hashtags: [], ...args }),
    });
  }
  /** Duplicate a post — new row, +1 day schedule, pending_internal. */
  duplicatePost(id: string) {
    return this.request<Post>(`/api/v1/posts/${id}/duplicate`, { method: 'POST' });
  }
  batchApprove(postIds: string[]) {
    return this.request<{ approved: number }>('/api/v1/posts/batch-approve', {
      method: 'POST',
      body: JSON.stringify({ postIds }),
    });
  }

  // ----- Images -----
  listImages(clientId: string) {
    return this.request<ClientImage[]>(`/api/v1/images?clientId=${clientId}`);
  }
  /** Agency-side delete (or client deleting their own). */
  deleteImage(id: string) {
    return this.request<{ id: string; deleted: boolean }>(`/api/v1/images/${id}`, {
      method: 'DELETE',
    });
  }
  /**
   * Update editable metadata on a single image. Currently the AI-generated
   * description (label) and the approval status.
   */
  updateImage(
    id: string,
    patch: { aiDescription?: string | null; status?: 'pending' | 'approved' | 'rejected' },
  ) {
    return this.request<ClientImage>(`/api/v1/images/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
  async uploadImages(clientId: string, files: File[], tags: string[] = []) {
    const form = new FormData();
    form.append('clientId', clientId);
    form.append('tags', tags.join(','));
    files.forEach((f) => form.append('files', f));
    const res = await fetch(`${this.config.baseUrl}/api/v1/images/upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const payload = (await res.json()) as ApiResponse<ClientImage[]>;
    if (!res.ok || payload.error) throw new Error(payload.error?.message ?? 'Upload failed');
    return payload.data!;
  }

  /**
   * Upload with real progress events — XHR because `fetch` doesn't expose
   * upload progress natively in browsers. Resolves to the created rows.
   */
  uploadImagesWithProgress(
    clientId: string,
    files: File[],
    tags: string[] = [],
    onProgress?: (percent: number) => void,
  ): Promise<ClientImage[]> {
    const form = new FormData();
    form.append('clientId', clientId);
    form.append('tags', tags.join(','));
    files.forEach((f) => form.append('files', f));

    return new Promise<ClientImage[]>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.config.baseUrl}/api/v1/images/upload`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        }
      };
      xhr.onload = () => {
        try {
          const payload = JSON.parse(xhr.responseText || '{}') as ApiResponse<ClientImage[]>;
          if (xhr.status >= 200 && xhr.status < 300 && !payload.error) {
            onProgress?.(100);
            resolve(payload.data ?? []);
          } else {
            reject(
              new ApiError(
                payload.error?.message ?? `Upload failed (${xhr.status})`,
                xhr.status,
                payload.error?.code,
              ),
            );
          }
        } catch (e) {
          reject(new ApiError('Invalid server response', xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
      xhr.onabort = () => reject(new ApiError('Upload cancelled', 0));
      xhr.send(form);
    });
  }

  /**
   * Combined media upload — accepts images AND videos. Same XHR-based progress
   * reporting, but hits `/media/upload` which permits mp4/mov/webm uploads.
   */
  uploadMediaWithProgress(
    clientId: string,
    files: File[],
    tags: string[] = [],
    onProgress?: (percent: number) => void,
  ): Promise<ClientImage[]> {
    const form = new FormData();
    form.append('clientId', clientId);
    form.append('tags', tags.join(','));
    files.forEach((f) => form.append('files', f));

    return new Promise<ClientImage[]>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.config.baseUrl}/api/v1/images/media/upload`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        }
      };
      xhr.onload = () => {
        try {
          const payload = JSON.parse(xhr.responseText || '{}') as ApiResponse<ClientImage[]>;
          if (xhr.status >= 200 && xhr.status < 300 && !payload.error) {
            onProgress?.(100);
            resolve(payload.data ?? []);
          } else {
            reject(
              new ApiError(
                payload.error?.message ?? `Upload failed (${xhr.status})`,
                xhr.status,
                payload.error?.code,
              ),
            );
          }
        } catch (e) {
          reject(new ApiError('Invalid server response', xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
      xhr.onabort = () => reject(new ApiError('Upload cancelled', 0));
      xhr.send(form);
    });
  }

  // ----- Messages -----
  listMessages(clientId: string) {
    return this.request<Message[]>(`/api/v1/messages?clientId=${clientId}`);
  }
  sendMessage(clientId: string, body: string) {
    return this.request<Message>('/api/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ clientId, body }),
    });
  }

  // ----- Automation -----
  generate(args: {
    clientId: string;
    month: string;
    postsCount: number;
    platforms?: string[];
    direction?: string;
  }) {
    return this.request<{
      batchId: string;
      postsGenerated: number;
      postsRequested: number;
      postsSkipped: number;
      skipReasons: string[];
      steps: Array<{ key: string; durationMs: number; ok: boolean; note?: string }>;
      costCents: number;
    }>('/api/v1/automation/generate', { method: 'POST', body: JSON.stringify(args) });
  }

  /**
   * Rewrite a single post's caption + hashtags. Uses the brand voice +
   * (optionally) user feedback to produce a sharper take. Server persists
   * the result so the next `listPosts` call returns the new copy.
   */
  regeneratePost(args: { postId: string; instruction?: string }) {
    return this.request<{
      caption: string;
      hashtags: string[];
      hook: string;
      rationale: string;
    }>('/api/v1/automation/regenerate-post', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /**
   * Regenerate the image on a single post via Flux. Uses the post's
   * caption as the subject brief; `overridePrompt` lets the agency fine-tune.
   */
  regeneratePostImage(args: { postId: string; overridePrompt?: string }) {
    return this.request<{ imageUrl: string; prompt: string }>(
      '/api/v1/automation/regenerate-post-image',
      {
        method: 'POST',
        body: JSON.stringify(args),
      },
    );
  }

  generateWebsite(args: {
    clientId: string;
    description?: string;
    services?: string[];
    hasBooking?: boolean;
    hasHours?: boolean;
    template?: SiteTemplate;
    suggestions?: string;
    /* Seeded business facts — see apps/api/src/services/websites.ts */
    address?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    hours?: string;
    socials?: {
      facebook?: string;
      instagram?: string;
      tiktok?: string;
      linkedin?: string;
      x?: string;
      youtube?: string;
      google?: string;
    };
    team?: Array<{
      name: string;
      role: string;
      bio?: string;
      credentials?: string;
      specialties?: string[];
      photoUrl?: string;
    }>;
    serviceAreas?: string[];
    trustBadges?: Array<{
      label: string;
      detail?: string;
      href?: string;
    }>;
  }) {
    return this.request<{
      config: WebsiteConfig;
      imagesUsed?: number;
      fromMock?: boolean;
      slug?: string;
      clientId?: string;
    }>('/api/v1/automation/generate-website', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  editWebsiteWithAI(args: {
    clientId: string;
    currentConfig: Record<string, any>;
    instruction: string;
  }) {
    return this.request<{
      config: WebsiteConfig;
      summary: string;
    }>('/api/v1/automation/edit-website', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /**
   * Targeted single-field update. Used by the inline editor — a headline
   * tweak shouldn't round-trip through Claude. `path` is dotted
   * (e.g. `hero.headline`, `services.0.title`).
   */
  updateWebsiteField(args: {
    clientId: string;
    path: string;
    value: unknown;
  }) {
    return this.request<{ config: WebsiteConfig }>(
      '/api/v1/automation/update-website-field',
      {
        method: 'POST',
        body: JSON.stringify(args),
      },
    );
  }

  /**
   * Atomic full-config save. Use this for editor saves so parallel
   * JSONB writes can't race. Sends the entire WebsiteConfig in one
   * request — the server overwrites the blob in a single UPDATE.
   */
  saveWebsiteConfig(args: { clientId: string; config: WebsiteConfig }) {
    return this.request<{ config: WebsiteConfig }>(
      '/api/v1/automation/save-website-config',
      {
        method: 'POST',
        body: JSON.stringify(args),
      },
    );
  }

  /** Regenerate (or first-generate) the AI hero image for a client. */
  generateHeroImage(args: { clientId: string; overridePrompt?: string }) {
    return this.request<{ imageUrl: string; prompt: string; fromMock?: boolean }>(
      '/api/v1/automation/generate-hero-image',
      {
        method: 'POST',
        body: JSON.stringify(args),
      },
    );
  }

  /**
   * Public, unauthenticated: fetch a generated site by slug to render it
   * at /sites/[slug]. Returns null config when no site has been generated yet.
   */
  getPublicSite(slug: string) {
    return this.request<{
      businessName: string;
      slug: string;
      config: WebsiteConfig | null;
      images: string[];
    }>(`/api/v1/clients/public/by-slug/${encodeURIComponent(slug)}/site`);
  }

  // ----- Custom Domains -----
  /**
   * Public, unauthenticated: resolve a host (e.g. `murphysplumbing.com`) to
   * the internal slug. Called by the apps/web middleware for every custom-
   * domain request, so the response is intentionally minimal.
   */
  resolveHost(host: string) {
    return this.request<{ slug: string; clientId: string; verified: boolean }>(
      `/api/v1/clients/public/by-host/${encodeURIComponent(host)}`,
    );
  }

  attachDomain(clientId: string, domain: string) {
    return this.request<{
      clientId: string;
      customDomain: string;
      status: 'pending' | 'provisioning' | 'verified' | 'failed';
      verification: {
        name: string;
        verified: boolean;
        requiredRecords: Array<{ type: string; name: string; value: string }>;
        error?: string;
      };
    }>(`/api/v1/domains/${encodeURIComponent(clientId)}`, {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
  }

  getDomain(clientId: string) {
    return this.request<{
      clientId: string;
      customDomain: string;
      status: string;
      error: string | null;
      verifiedAt: string | null;
      verification: {
        name: string;
        verified: boolean;
        requiredRecords: Array<{ type: string; name: string; value: string }>;
        error?: string;
      };
    } | null>(`/api/v1/domains/${encodeURIComponent(clientId)}`);
  }

  verifyDomain(clientId: string) {
    return this.request<{
      status: 'provisioning' | 'verified';
      verification: {
        name: string;
        verified: boolean;
        requiredRecords: Array<{ type: string; name: string; value: string }>;
        error?: string;
      };
    }>(`/api/v1/domains/${encodeURIComponent(clientId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  detachDomain(clientId: string) {
    return this.request<{ removed: true }>(
      `/api/v1/domains/${encodeURIComponent(clientId)}`,
      { method: 'DELETE' },
    );
  }

  // ----- Billing -----
  /**
   * Kick off a Stripe Checkout session for the signed-in client. Server
   * looks up the customer email and clientId from the session — the caller
   * just picks the tier.
   */
  checkout(tier: 'social_only' | 'website_only' | 'full_package') {
    return this.request<{ url: string; id: string }>('/api/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  }

  /** Open the Stripe-hosted customer portal for managing billing. */
  openBillingPortal() {
    return this.request<{ url: string }>('/api/v1/billing/portal', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /**
   * Finalize a Stripe Checkout session after the user returns from hosted
   * checkout. Looks the session up server-side, verifies ownership, and
   * flips the client row to `active`. Exists so local dev / delayed
   * webhooks don't leave the user staring at a "Not subscribed" screen.
   */
  finalizeCheckout(sessionId: string) {
    return this.request<{ active: boolean; status?: string; mocked?: boolean }>(
      '/api/v1/billing/finalize',
      {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      },
    );
  }

  /** Current subscription state for the signed-in client. */
  getSubscription() {
    return this.request<{
      tier: 'social_only' | 'website_only' | 'full_package';
      tierName: string;
      priceCents: number;
      status: 'none' | 'active' | 'past_due' | 'canceled';
      statusMeta: { label: string; tone: 'success' | 'warn' | 'danger' | 'default'; description: string };
      startedAt: string | null;
      active: boolean;
      hasCustomer: boolean;
    }>('/api/v1/billing/subscription');
  }

  // ----- Videos -----
  listVideoTemplates() {
    return this.request<
      Array<{
        id: string;
        name: string;
        description: string;
        durationFrames: number;
        usesImage: boolean;
        bestFor: readonly string[];
        /**
         * Optional preset roster the template exposes. Each preset is a
         * palette + options bundle the dashboard can surface as a
         * thumbnail picker. Undefined on templates that don't support
         * presets yet.
         */
        availablePresets?: ReadonlyArray<{
          id: string;
          name: string;
          description?: string;
          palette?: Partial<{
            primary: string;
            accent: string;
            pop: string;
            dark: string;
            paper: string;
          }>;
          options?: Partial<VideoRenderOptions>;
          thumbnailSeed?: string;
        }>;
      }>
    >('/api/v1/videos/templates');
  }

  renderVideo(args: {
    templateId: string;
    clientId: string;
    businessName: string;
    headline: string;
    subheadline?: string;
    cta?: string;
    domain?: string;
    imageUrl?: string;
    /**
     * Ordered media clips for templates that sequence multiple photos/videos
     * (the MediaStory template). Each clip has a url, kind, optional
     * duration/caption/eyebrow and Ken-Burns focal point.
     */
    mediaClips?: Array<{
      url: string;
      kind: 'image' | 'video';
      durationSeconds?: number;
      caption?: string;
      eyebrow?: string;
      focalX?: number;
      focalY?: number;
    }>;
    brand?: {
      primary?: string;
      accent?: string;
      pop?: string;
      dark?: string;
      paper?: string;
    };
    /**
     * Per-template overrides — preset id, mood, accent style, headline
     * size. Send `{ presetId: 'sunset' }` to swap the Liquid Gradient
     * into warm corals without touching the client's brand palette.
     */
    options?: VideoRenderOptions;
  }) {
    return this.request<{
      videoUrl: string;
      templateId: string;
      templateName: string;
      durationSeconds: number;
      fromMock?: boolean;
    }>('/api/v1/videos/render', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /** Render N videos in one request. Returns per-item success/failure. */
  batchRenderVideos(args: {
    templateId: string;
    clientId: string;
    businessName: string;
    headline: string;
    subheadline?: string;
    cta?: string;
    domain?: string;
    imageUrl?: string;
    count: number;
    /** Optional per-item headlines; falls back to the shared `headline`. */
    headlines?: string[];
    brand?: {
      primary?: string;
      accent?: string;
      pop?: string;
      dark?: string;
      paper?: string;
    };
    options?: VideoRenderOptions;
  }) {
    return this.request<{
      total: number;
      succeeded: number;
      items: Array<{
        index: number;
        ok: boolean;
        headline: string;
        videoUrl?: string;
        error?: string;
      }>;
    }>('/api/v1/videos/batch', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /** List all videos saved to a client's media library. */
  listClientVideos(clientId: string) {
    return this.request<ClientImage[]>(`/api/v1/videos?clientId=${encodeURIComponent(clientId)}`);
  }

  /**
   * Personalized video: Claude plans a 3–6 clip reel from the client's
   * uploaded media (or synthesized stills when the library is thin),
   * optionally animates a few of the clips, and renders the MediaStory
   * template. Takes 30–60s — show a proper loading state.
   */
  generatePersonalizedVideo(args: {
    clientId: string;
    intent?:
      | 'brand_story'
      | 'promo'
      | 'team_intro'
      | 'menu_reveal'
      | 'before_after'
      | 'location_tour';
    clipCount?: number;
    headline?: string;
    cta?: string;
    direction?: string;
    selectedMediaIds?: string[];
    enableMotion?: boolean;
    aspectRatio?: '9:16' | '1:1' | '16:9';
    pacing?: 'slow' | 'balanced' | 'fast';
    musicMood?: string;
    captionStyle?: 'minimal' | 'bold' | 'magazine' | 'handwritten' | 'subtitle';
    openingFrame?: 'hook_headline' | 'wide_shot' | 'close_up' | 'logo_reveal';
    closingFrame?: 'cta_card' | 'logo_only' | 'contact_info' | 'fade_to_black';
    allowSynthesis?: boolean;
    minimumClips?: number;
  }) {
    return this.request<{
      videoUrl: string;
      templateId: 'media-story';
      durationSeconds: number;
      clips: Array<{
        order: number;
        caption?: string;
        eyebrow?: string;
        sourceKind: 'upload' | 'synthesis' | 'motion';
        sourceUrl: string;
        durationSeconds: number;
      }>;
      skippedClips: Array<{ order: number; reason: string }>;
      fromMock: boolean;
    }>('/api/v1/videos/personalized', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  // ----- Canva -----

  canvaStatus(clientId: string) {
    return this.request<{
      configured: boolean;
      connected: boolean;
      canvaUserId?: string | null;
      canvaTeamId?: string | null;
      scopes?: string | null;
      expiresAt?: string | null;
    }>(`/api/v1/canva/status?clientId=${encodeURIComponent(clientId)}`);
  }

  /**
   * Build the Canva connect URL. We don't redirect here — we return the
   * URL so the UI can open it in a new window. That way the dashboard
   * page doesn't lose unsaved state while the user authorises.
   */
  canvaConnectUrl(clientId: string) {
    return `${this.config.baseUrl}/api/v1/canva/connect?clientId=${encodeURIComponent(clientId)}`;
  }

  canvaDisconnect(clientId: string) {
    return this.request<{ disconnected: boolean }>(
      `/api/v1/canva/connection?clientId=${encodeURIComponent(clientId)}`,
      { method: 'DELETE' },
    );
  }

  canvaListDesigns(clientId: string) {
    return this.request<
      Array<{
        id: string;
        title?: string;
        thumbnailUrl?: string;
        updatedAt?: string;
        editUrl?: string;
      }>
    >(`/api/v1/canva/designs?clientId=${encodeURIComponent(clientId)}`);
  }

  canvaListBrandTemplates(clientId: string) {
    return this.request<
      Array<{ id: string; title: string; thumbnailUrl?: string }>
    >(`/api/v1/canva/brand-templates?clientId=${encodeURIComponent(clientId)}`);
  }

  canvaAutofill(args: {
    clientId: string;
    brandTemplateId: string;
    headline?: string;
    subheadline?: string;
    extra?: Record<string, string>;
    imageUrl?: string;
    imageName?: string;
  }) {
    return this.request<{ designId: string; editUrl?: string; viewUrl?: string }>(
      '/api/v1/canva/autofill',
      { method: 'POST', body: JSON.stringify(args) },
    );
  }

  canvaImportDesign(args: {
    clientId: string;
    designId: string;
    format?: 'png' | 'jpg' | 'mp4';
    caption?: string;
  }) {
    return this.request<ClientImage[]>('/api/v1/canva/import-design', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  // ----- Inspiration-driven generation -----

  /** Public catalog of available image + video models with pricing. */
  listInspirationModels() {
    return this.request<
      Array<{
        id: string;
        displayName: string;
        mediaType: 'image' | 'video';
        supportsReference: boolean;
        maxReferenceCount: number;
        maxDurationSeconds?: number;
        pricePerUnitCents: number;
        unit: 'second' | 'image';
        recommendation: 'quality' | 'speed' | 'price' | null;
        supportedAspectRatios: Array<'9:16' | '1:1' | '16:9' | '4:5'>;
        available: boolean;
        provider: 'fal' | 'gemini' | 'vertex';
        notes?: string;
      }>
    >('/api/v1/inspiration/models');
  }

  /**
   * Upload raw inspiration files. These are stored under a short-lived
   * `inspiration/` prefix and are NOT added to the client's media
   * library automatically. Returns public URLs the generation flow can
   * reference.
   */
  async uploadInspirationFiles(clientId: string, files: File[]) {
    const fd = new FormData();
    fd.append('clientId', clientId);
    for (const f of files) fd.append('files', f);
    let res: Response;
    try {
      res = await fetch(this.config.baseUrl + '/api/v1/inspiration/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
    } catch (e) {
      throw new ApiError((e as Error).message || 'Network error', 0);
    }
    const payload = (await res.json().catch(() => ({}))) as ApiResponse<
      Array<{ url: string; mimeType: string; fileName: string; sizeBytes: number }>
    >;
    if (!res.ok || payload.error) {
      throw new ApiError(payload.error?.message ?? `Upload failed (${res.status})`, res.status, payload.error?.code);
    }
    return payload.data ?? [];
  }

  /** Run Claude Vision on a prepared inspiration set. */
  analyzeInspiration(args: {
    items: Array<{ id: string; url: string; mimeType: string; label?: string }>;
    direction?: string;
  }) {
    return this.request<{
      style: string;
      mood: string;
      composition: string;
      colorPalette: string[];
      subjectType: string;
      suggestedOutputTypes: Array<'image' | 'video'>;
      suggestedPrompt: string;
      reasoning: string;
      fromMock: boolean;
    }>('/api/v1/inspiration/analyze', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /** Live cost estimate for a proposed plan. Under 200ms round-trip. */
  estimateInspirationCost(args: {
    imageModelId?: string;
    videoModelId?: string;
    videoDurationSeconds?: number;
    outputType?: 'image' | 'video' | 'both';
  }) {
    return this.request<{ costCents: number }>('/api/v1/inspiration/estimate', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /**
   * End-to-end generation. Optional analysis → plan → generate → persist.
   * Times out over a minute for video — show a proper loading state.
   */
  generateFromInspiration(args: {
    clientId: string;
    inspiration: Array<
      | { kind: 'library'; id: string }
      | { kind: 'upload'; url: string; mimeType: string; label?: string }
    >;
    runAnalysis: boolean;
    directBrief?: string;
    outputType?: 'image' | 'video' | 'both';
    imageModelId?: string;
    videoModelId?: string;
    imageAspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
    videoAspectRatio?: '9:16' | '1:1' | '16:9';
    videoDurationSeconds?: number;
    useInspirationAsVideoSeed?: boolean;
    inspirationProfileIds?: string[];
  }) {
    return this.request<{
      analysis: {
        style: string;
        mood: string;
        composition: string;
        colorPalette: string[];
        subjectType: string;
        suggestedOutputTypes: Array<'image' | 'video'>;
        suggestedPrompt: string;
        reasoning: string;
        fromMock: boolean;
      } | null;
      outputs: Array<{
        assetId: string;
        mediaType: 'image' | 'video';
        url: string;
        modelId: string;
        modelDisplayName: string;
        prompt: string;
        costCents: number;
        fromMock: boolean;
      }>;
      totalCostCents: number;
      fromMock: boolean;
    }>('/api/v1/inspiration/generate', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /* ─── Inspiration profiles (brand intelligence) ──────────────── */

  listInspirationProfiles(clientId: string) {
    return this.request<InspirationProfile[]>(
      `/api/v1/clients/${clientId}/inspiration-profiles`,
    );
  }

  createInspirationProfile(
    clientId: string,
    body: { name: string; referenceUrl?: string; description?: string },
  ) {
    return this.request<InspirationProfile>(
      `/api/v1/clients/${clientId}/inspiration-profiles`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  updateInspirationProfile(
    clientId: string,
    profileId: string,
    patch: {
      name?: string;
      description?: string;
      referenceUrl?: string | null;
      isEnabled?: boolean;
    },
  ) {
    return this.request<InspirationProfile>(
      `/api/v1/clients/${clientId}/inspiration-profiles/${profileId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    );
  }

  deleteInspirationProfile(clientId: string, profileId: string) {
    return this.request<{ ok: true }>(
      `/api/v1/clients/${clientId}/inspiration-profiles/${profileId}`,
      { method: 'DELETE' },
    );
  }

  /**
   * Kick off a scrape of the profile's reference URL. Synchronous —
   * the response carries the fully populated profile when done, or a
   * `failed` status with `scrapeError` when something went wrong.
   */
  scrapeInspirationProfile(clientId: string, profileId: string) {
    return this.request<InspirationProfile>(
      `/api/v1/clients/${clientId}/inspiration-profiles/${profileId}/scrape`,
      { method: 'POST' },
    );
  }

  /** Upload one or more reference files to a profile. */
  uploadInspirationProfileMedia(
    clientId: string,
    profileId: string,
    files: File[],
  ): Promise<Array<{ id: string; url: string; mimeType: string; fileName: string }>> {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    return fetch(
      `${this.config.baseUrl}/api/v1/clients/${clientId}/inspiration-profiles/${profileId}/media`,
      { method: 'POST', body: form, credentials: 'include' },
    )
      .then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as ApiResponse<any>;
        if (!res.ok || payload.error) {
          throw new ApiError(
            payload.error?.message ?? `Upload failed (${res.status})`,
            res.status,
            payload.error?.code,
          );
        }
        return payload.data;
      });
  }

  deleteInspirationProfileMedia(
    clientId: string,
    profileId: string,
    mediaId: string,
  ) {
    return this.request<{ ok: true }>(
      `/api/v1/clients/${clientId}/inspiration-profiles/${profileId}/media/${mediaId}`,
      { method: 'DELETE' },
    );
  }

  /* ─── Tone-of-voice pairs ───────────────────────────────────── */

  listTonePairs(clientId: string) {
    return this.request<TonePair[]>(`/api/v1/clients/${clientId}/tone-pairs`);
  }

  createTonePair(
    clientId: string,
    body: {
      category?: string;
      goodExample: string;
      badExample?: string;
      explanation?: string;
    },
  ) {
    return this.request<TonePair>(`/api/v1/clients/${clientId}/tone-pairs`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  updateTonePair(
    clientId: string,
    pairId: string,
    patch: {
      category?: string | null;
      goodExample?: string;
      badExample?: string | null;
      explanation?: string | null;
      isEnabled?: boolean;
    },
  ) {
    return this.request<TonePair>(
      `/api/v1/clients/${clientId}/tone-pairs/${pairId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    );
  }

  deleteTonePair(clientId: string, pairId: string) {
    return this.request<{ ok: true }>(
      `/api/v1/clients/${clientId}/tone-pairs/${pairId}`,
      { method: 'DELETE' },
    );
  }

  /* ─── Products ──────────────────────────────────────────────── */

  listProducts(clientId: string, status?: 'draft' | 'active' | 'archived') {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<Product[]>(`/api/v1/clients/${clientId}/products${qs}`);
  }

  createProduct(
    clientId: string,
    body: {
      name: string;
      description?: string;
      sku?: string;
      priceCents?: number;
      currency?: string;
      tags?: string[];
      status?: 'draft' | 'active' | 'archived';
      primaryImageUrl?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.request<Product>(`/api/v1/clients/${clientId}/products`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  updateProduct(
    clientId: string,
    productId: string,
    patch: Partial<{
      name: string;
      description: string | null;
      sku: string | null;
      priceCents: number | null;
      currency: string;
      tags: string[];
      status: 'draft' | 'active' | 'archived';
      primaryImageUrl: string | null;
      metadata: Record<string, unknown> | null;
    }>,
  ) {
    return this.request<Product>(
      `/api/v1/clients/${clientId}/products/${productId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    );
  }

  deleteProduct(clientId: string, productId: string) {
    return this.request<{ ok: true }>(
      `/api/v1/clients/${clientId}/products/${productId}`,
      { method: 'DELETE' },
    );
  }

  linkMediaToProduct(clientId: string, productId: string, imageId: string) {
    return this.request<{ ok: true }>(
      `/api/v1/clients/${clientId}/products/${productId}/media/${imageId}`,
      { method: 'POST' },
    );
  }

  unlinkMediaFromProduct(clientId: string, productId: string, imageId: string) {
    return this.request<{ ok: true }>(
      `/api/v1/clients/${clientId}/products/${productId}/media/${imageId}`,
      { method: 'DELETE' },
    );
  }

  /* ─── Talking-head video ────────────────────────────────────── */

  talkingHeadOptions() {
    return this.request<{
      avatars: Array<{
        id: string;
        displayName: string;
        gender: string;
        ageRange: string;
        vibe: string;
        aspectRatio: '9:16' | '16:9';
        thumbnailUrl?: string;
      }>;
      voices: Array<{
        id: string;
        displayName: string;
        gender: string;
        accent: string;
      }>;
      models: Array<{
        id: string;
        displayName: string;
        pricePerSecondCents: number;
        maxDurationSeconds?: number;
        supportedAspectRatios: string[];
        available: boolean;
        notes?: string;
      }>;
    }>('/api/v1/talking-head/options');
  }

  generateTalkingHeadScript(args: {
    clientId: string;
    brief: string;
    platform?: 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'generic';
    durationSeconds?: number;
    productId?: string;
    inspirationProfileIds?: string[];
  }) {
    return this.request<{
      script: string;
      estimatedDurationSeconds: number;
      fromMock: boolean;
    }>('/api/v1/talking-head/script', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  renderTalkingHead(args: {
    clientId: string;
    modelId: string;
    avatarId: string;
    voiceId?: string;
    script: string;
    aspectRatio?: '9:16' | '1:1' | '16:9';
    backgroundUrl?: string;
    persist?: boolean;
  }) {
    return this.request<{
      assetId: string | null;
      videoUrl: string;
      durationSeconds: number;
      modelId: string;
      modelDisplayName: string;
      avatarId: string;
      voiceId: string | null;
      costCents: number;
      fromMock: boolean;
    }>('/api/v1/talking-head/render', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  /* ─── Personal content automation ────────────────────────────── */

  personalThemes() {
    return this.request<PersonalThemeSummary[]>('/api/v1/personal/themes');
  }

  personalFeatures() {
    return this.request<{
      db: boolean;
      claude: boolean;
      contentStudio: boolean;
      fal: boolean;
      scrapers: {
        pexels: boolean;
        unsplash: boolean;
        pixabay: boolean;
        wikipedia: boolean;
        googleNews: boolean;
      };
      voice: { elevenlabs: boolean; openai: boolean };
    }>('/api/v1/personal/features');
  }

  listPersonalAccounts() {
    return this.request<PersonalAccount[]>('/api/v1/personal/accounts');
  }

  getPersonalAccount(id: string) {
    return this.request<PersonalAccount>(`/api/v1/personal/accounts/${id}`);
  }

  createPersonalAccount(body: CreatePersonalAccountBody) {
    return this.request<PersonalAccount>('/api/v1/personal/accounts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  updatePersonalAccount(id: string, patch: UpdatePersonalAccountBody) {
    return this.request<PersonalAccount>(`/api/v1/personal/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  deletePersonalAccount(id: string) {
    return this.request<{ ok: true }>(`/api/v1/personal/accounts/${id}`, {
      method: 'DELETE',
    });
  }

  generatePersonalPost(
    id: string,
    args: { topic?: string; autoSchedule?: boolean; scheduledAt?: string; dryRun?: boolean } = {},
  ) {
    return this.request<{
      kicked: boolean;
      pending?: boolean;
      postId?: string;
      videoUrl?: string | null;
      status?: string;
      durationSeconds?: number;
      costCents?: number;
    }>(`/api/v1/personal/accounts/${id}/generate`, {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  listPersonalPosts(id: string) {
    return this.request<PersonalPost[]>(`/api/v1/personal/accounts/${id}/posts`);
  }

  /* ─── Personal account media library ─────────────────────── */

  listPersonalMedia(
    accountId: string,
    opts: { role?: string; characterId?: string } = {},
  ) {
    const q = new URLSearchParams();
    if (opts.role) q.set('role', opts.role);
    if (opts.characterId) q.set('characterId', opts.characterId);
    const qs = q.toString();
    return this.request<PersonalAccountMediaItem[]>(
      `/api/v1/personal/accounts/${accountId}/media${qs ? `?${qs}` : ''}`,
    );
  }

  uploadPersonalMedia(
    accountId: string,
    files: File[],
    meta: {
      role: string;
      description?: string;
      tags?: string[];
      characterId?: string;
      pinned?: boolean;
    },
    onProgress?: (pct: number) => void,
  ): Promise<PersonalAccountMediaItem[]> {
    const form = new FormData();
    form.append('role', meta.role);
    if (meta.description) form.append('description', meta.description);
    if (meta.tags) form.append('tags', meta.tags.join(','));
    if (meta.characterId) form.append('characterId', meta.characterId);
    if (meta.pinned) form.append('pinned', 'true');
    files.forEach((f) => form.append('files', f));

    return new Promise<PersonalAccountMediaItem[]>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.config.baseUrl}/api/v1/personal/accounts/${accountId}/media`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress)
          onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      xhr.onload = () => {
        try {
          const payload = JSON.parse(xhr.responseText || '{}') as ApiResponse<
            PersonalAccountMediaItem[]
          >;
          if (xhr.status >= 200 && xhr.status < 300 && !payload.error) {
            onProgress?.(100);
            resolve(payload.data ?? []);
          } else {
            reject(
              new ApiError(
                payload.error?.message ?? `Upload failed (${xhr.status})`,
                xhr.status,
                payload.error?.code,
              ),
            );
          }
        } catch (e) {
          reject(new ApiError('Invalid server response', xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError('Network error', 0));
      xhr.send(form);
    });
  }

  updatePersonalMedia(
    mediaId: string,
    patch: Partial<{
      description: string | null;
      tags: string[];
      role: string;
      characterId: string | null;
      isPinned: boolean;
      isArchived: boolean;
    }>,
  ) {
    return this.request<PersonalAccountMediaItem>(
      `/api/v1/personal/media/${mediaId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    );
  }

  deletePersonalMedia(mediaId: string) {
    return this.request<{ ok: true }>(`/api/v1/personal/media/${mediaId}`, {
      method: 'DELETE',
    });
  }

  /* ─── AI-influencer characters ───────────────────────────── */

  listCharacters() {
    return this.request<PersonalCharacter[]>('/api/v1/personal/characters');
  }
  getCharacter(id: string) {
    return this.request<PersonalCharacter>(`/api/v1/personal/characters/${id}`);
  }
  createCharacter(body: {
    name: string;
    tagline?: string;
    backstory?: string;
    voiceId?: string;
    locale?: string;
  }) {
    return this.request<PersonalCharacter>('/api/v1/personal/characters', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  updateCharacter(
    id: string,
    patch: Partial<{
      name: string;
      tagline: string | null;
      backstory: string | null;
      promptFragment: string | null;
      negativePrompt: string | null;
      voiceId: string | null;
      locale: string | null;
    }>,
  ) {
    return this.request<PersonalCharacter>(`/api/v1/personal/characters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
  deleteCharacter(id: string) {
    return this.request<{ ok: true }>(`/api/v1/personal/characters/${id}`, {
      method: 'DELETE',
    });
  }
  analyzeCharacter(id: string) {
    return this.request<PersonalCharacter>(
      `/api/v1/personal/characters/${id}/analyze`,
      { method: 'POST', body: JSON.stringify({}) },
    );
  }

  /* ─── AI model catalog ───────────────────────────────────── */

  listPersonalModels() {
    return this.request<PersonalAiModel[]>('/api/v1/personal/models');
  }

  /* ─── Custom themes (user-editable library) ──────────────── */

  listCustomThemes() {
    return this.request<PersonalCustomTheme[]>('/api/v1/personal/custom-themes');
  }
  createCustomTheme(body: CreateCustomThemeBody) {
    return this.request<PersonalCustomTheme>('/api/v1/personal/custom-themes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  updateCustomTheme(id: string, patch: Partial<CreateCustomThemeBody>) {
    return this.request<PersonalCustomTheme>(`/api/v1/personal/custom-themes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
  deleteCustomTheme(id: string) {
    return this.request<{ ok: true }>(`/api/v1/personal/custom-themes/${id}`, {
      method: 'DELETE',
    });
  }
  cloneBuiltinTheme(args: { builtinId: string; mode?: 'override' | 'duplicate' }) {
    return this.request<PersonalCustomTheme>('/api/v1/personal/custom-themes/clone', {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Brand-intelligence type exports                                      */
/* ═══════════════════════════════════════════════════════════════════ */

export interface VisualAnalysis {
  style: string;
  mood: string;
  composition: string;
  typographyNotes: string;
  visualMotifs: string[];
}

export interface CopyVoice {
  toneDescriptors: string[];
  sentenceShape: string;
  vocabulary: string[];
  thingsToDo: string[];
  thingsToAvoid: string[];
}

export interface InspirationProfile {
  id: string;
  clientId: string;
  name: string;
  referenceUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  isEnabled: boolean;
  visualAnalysis: VisualAnalysis | null;
  copyVoice: CopyVoice | null;
  colorPalette: string[] | null;
  copySamples: string[] | null;
  status: 'idle' | 'scraping' | 'ready' | 'failed';
  scrapeError: string | null;
  lastScrapedAt: string | null;
  media: Array<{
    id: string;
    fileUrl: string;
    fileName: string | null;
    mimeType: string | null;
    source: string;
    aiDescription: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TonePair {
  id: string;
  clientId: string;
  category: string | null;
  goodExample: string;
  badExample: string | null;
  explanation: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  sku: string | null;
  priceCents: number | null;
  currency: string | null;
  primaryImageUrl: string | null;
  tags: string[];
  status: 'draft' | 'active' | 'archived';
  metadata: Record<string, unknown> | null;
  media: Array<{
    id: string;
    fileUrl: string;
    mimeType: string | null;
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export function createApi(baseUrl: string) {
  return new BoostApi({ baseUrl });
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Personal content automation types                                   */
/* ═══════════════════════════════════════════════════════════════════ */

export interface PersonalThemeSummary {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accentColor: string;
  viralityScore: number;
  cpmTier: 'low' | 'medium' | 'high' | 'premium';
  preferredPlatforms: string[];
  template: string;
  targetDurationSeconds: number;
  defaultHashtags: string[];
  useVoiceover: boolean;
  useMusic: boolean;
  mediaSources: string[];
  topicSeedExamples: string[];
}

export type PersonalPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'pinterest'
  | 'bluesky'
  | 'youtube'
  | 'google_business';

export interface PersonalAccount {
  id: string;
  userId: string;
  accountName: string;
  platform: PersonalPlatform;
  handle: string | null;
  contentStudioWorkspaceId: string | null;
  themeId: string;
  themeName: string;
  themeEmoji: string;
  customDirection: string | null;
  topicSeeds: string[];
  topicBlacklist: string[];
  language: string;
  voiceId: string | null;
  locale: string | null;
  postsPerDay: number;
  postingHourUtc: number;
  postingMinuteUtc: number;
  postSpacingMinutes: number;
  autoApprove: boolean;
  autoSchedule: boolean;
  accentColor: string | null;
  logoUrl: string | null;
  watermarkHandle: string | null;
  status: 'active' | 'paused' | 'archived';
  lastGeneratedAt: string | null;
  nextRunAt: string | null;
  totalPosts: number;
  styleBible: PersonalAccountStyleBible | null;
  generatorConfig: PersonalGeneratorConfig | null;
  characterId: string | null;
  formatKind: 'video' | 'slideshow' | 'static_image';
  customAudioUrl: string | null;
  customAudioAttribution: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonalAccountBody {
  accountName: string;
  platform: PersonalPlatform;
  themeId: string;
  handle?: string;
  contentStudioWorkspaceId?: string;
  customDirection?: string;
  topicSeeds?: string[];
  topicBlacklist?: string[];
  language?: string;
  voiceId?: string;
  locale?: string;
  postsPerDay?: number;
  postingHourUtc?: number;
  postingMinuteUtc?: number;
  postSpacingMinutes?: number;
  autoApprove?: boolean;
  autoSchedule?: boolean;
  accentColor?: string;
  logoUrl?: string;
  watermarkHandle?: string;
  characterId?: string | null;
  styleBible?: PersonalAccountStyleBible;
  generatorConfig?: PersonalGeneratorConfig;
  formatKind?: 'video' | 'slideshow' | 'static_image';
  customAudioUrl?: string | null;
  customAudioAttribution?: string | null;
}

export type UpdatePersonalAccountBody = Partial<CreatePersonalAccountBody> & {
  status?: 'active' | 'paused' | 'archived';
};

export interface PersonalPost {
  id: string;
  accountId: string;
  templateId: string;
  topic: string;
  title: string;
  hook: string;
  videoUrl: string | null;
  voiceoverUrl: string | null;
  musicUrl: string | null;
  caption: string | null;
  hashtags: string[];
  durationSeconds: number | null;
  qualityScore: number | null;
  status: string;
  errorMessage: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishUrl: string | null;
  mediaAssets: Array<{
    url: string;
    kind: 'image' | 'video';
    source: string;
    attribution?: string;
    creditUrl?: string;
  }>;
  costCents: number;
  createdAt: string;
}

/* ─── Account media library ──────────────────────────────── */

export type PersonalMediaRole =
  | 'style_reference'
  | 'avatar_reference'
  | 'brand_asset'
  | 'broll'
  | 'voice_sample'
  | 'music'
  | 'inspiration'
  | 'location'
  | 'product';

export interface PersonalAccountMediaItem {
  id: string;
  accountId: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  kind: string;
  role: PersonalMediaRole;
  description: string | null;
  tags: string[];
  aiDescription: string | null;
  isPinned: boolean;
  isArchived: boolean;
  characterId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ─── AI influencer characters ───────────────────────────── */

export interface PersonalCharacter {
  id: string;
  userId: string;
  name: string;
  tagline: string | null;
  backstory: string | null;
  characterSheet: Record<string, unknown> | null;
  promptFragment: string | null;
  negativePrompt: string | null;
  voiceId: string | null;
  locale: string | null;
  status: 'draft' | 'analyzing' | 'ready' | 'failed';
  error: string | null;
  referenceImageCount: number;
  createdAt: string;
  updatedAt: string;
}

/* ─── AI model catalog ───────────────────────────────────── */

export interface PersonalAiModel {
  id: string;
  displayName: string;
  provider: 'fal' | 'openai' | 'google' | 'runway' | 'replicate';
  kind: 'image' | 'video';
  qualityTier: 'max' | 'balanced' | 'budget';
  supportsReference: boolean;
  maxReferenceImages: number;
  maxDurationSeconds?: number;
  supportedAspectRatios: Array<'9:16' | '1:1' | '16:9' | '4:5'>;
  pricePerUnitCents: number;
  available: boolean;
  notes: string;
}

/* ─── Extended account payload ───────────────────────────── */

export interface PersonalAccountStyleBible {
  vibe?: string;
  dos?: string[];
  donts?: string[];
  palette?: string[];
  typography?: string;
  motifs?: string[];
  copySamples?: string[];
  bannedPhrases?: string[];
}

export interface PersonalGeneratorConfig {
  imageModelId?: string;
  videoModelId?: string;
  ttsProvider?: 'elevenlabs' | 'openai' | 'cartesia' | 'none';
  ttsVoiceId?: string;
  useVoiceover?: boolean;
  useMusic?: boolean;
  useSubtitles?: boolean;
  useAiVideo?: boolean;
  useAiImages?: boolean;
  useScrapedMedia?: boolean;
  useCharacter?: boolean;
  qualityTier?: 'max' | 'balanced' | 'budget';
  aspectRatio?: '9:16' | '1:1' | '16:9' | '4:5';
  clipMinSeconds?: number;
  clipMaxSeconds?: number;
  minQualityScore?: number;
  allowWebResearch?: boolean;
  scriptModel?: 'sonnet' | 'opus';
  useDirector?: boolean;
  colourGrade?:
    | 'natural'
    | 'warm'
    | 'cool'
    | 'teal_orange'
    | 'film'
    | 'bw'
    | 'high_contrast';
  letterbox?: boolean;
  filmGrain?: boolean;
}

/* ─── Custom themes (user-editable library) ──────────────── */

export interface PersonalCustomTheme {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accentColor: string;
  viralityScore: number;
  cpmTier: string;
  preferredPlatforms: string[];
  template: string;
  mediaSources: string[];
  useVoiceover: boolean;
  useMusic: boolean;
  hookFormulas: string[];
  topicSeeds: string[];
  voiceGuide: string;
  visualStyle: string;
  musicMood: string;
  targetDurationSeconds: number;
  defaultHashtags: string[];
  requiresGroundedImages: boolean;
  defaultFormat: 'video' | 'slideshow' | 'static_image' | null;
  overridesBuiltin: boolean;
  derivedFrom: string | null;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomThemeBody {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  emoji?: string;
  accentColor?: string;
  viralityScore?: number;
  cpmTier?: 'low' | 'medium' | 'high' | 'premium';
  preferredPlatforms?: PersonalPlatform[];
  template?: string;
  mediaSources?: Array<'pexels' | 'unsplash' | 'pixabay' | 'wikipedia' | 'news' | 'ai' | 'gameplay'>;
  useVoiceover?: boolean;
  useMusic?: boolean;
  hookFormulas?: string[];
  topicSeeds?: string[];
  voiceGuide?: string;
  visualStyle?: string;
  musicMood?: string;
  targetDurationSeconds?: number;
  defaultHashtags?: string[];
  requiresGroundedImages?: boolean;
  defaultFormat?: 'video' | 'slideshow' | 'static_image';
  overridesBuiltin?: boolean;
}
