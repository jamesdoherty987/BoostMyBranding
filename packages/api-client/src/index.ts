/**
 * Thin, typed fetch wrapper shared by web/portal/dashboard so each app speaks
 * to the API with the same contract and cookie handling.
 */

import type { ApiResponse, Client, Post, Message, ClientImage } from '@boost/core';

export interface ApiConfig {
  baseUrl: string;
}

export class BoostApi {
  constructor(private config: ApiConfig) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(this.config.baseUrl + path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      ...init,
    });
    const payload = (await res.json().catch(() => ({}))) as ApiResponse<T>;
    if (!res.ok || payload.error) {
      const msg = payload.error?.message ?? `Request failed (${res.status})`;
      throw new Error(msg);
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
