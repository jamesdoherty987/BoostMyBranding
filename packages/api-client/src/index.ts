/**
 * Thin, typed fetch wrapper shared by web/portal/dashboard so each app speaks
 * to the API with the same contract and cookie handling.
 */

import type { ApiResponse, Client, Post, Message, ClientImage } from '@boost/core';
import type { WebsiteConfig } from '@boost/core';

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
  updateMyClient(patch: {
    industry?: string;
    websiteUrl?: string;
    socialAccounts?: Record<string, string>;
  }) {
    return this.request<Client>('/api/v1/clients/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // ----- Posts -----
  listPosts(params: { clientId?: string; status?: string } = {}) {
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
      steps: Array<{ key: string; durationMs: number; ok: boolean; note?: string }>;
      costCents: number;
    }>('/api/v1/automation/generate', { method: 'POST', body: JSON.stringify(args) });
  }

  generateWebsite(args: {
    clientId: string;
    description?: string;
    services?: string[];
    hasBooking?: boolean;
    hasHours?: boolean;
    template?: 'service' | 'food' | 'beauty' | 'fitness' | 'professional' | 'retail' | 'medical' | 'creative' | 'realestate' | 'education';
    suggestions?: string;
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

  // ----- Billing -----
  checkout(tier: 'social_only' | 'website_only' | 'full_package', email: string) {
    return this.request<{ url: string; id: string }>('/api/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier, email }),
    });
  }
}

export function createApi(baseUrl: string) {
  return new BoostApi({ baseUrl });
}
