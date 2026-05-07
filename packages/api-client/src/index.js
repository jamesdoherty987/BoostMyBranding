/**
 * Thin, typed fetch wrapper shared by web/portal/dashboard so each app speaks
 * to the API with the same contract and cookie handling.
 */
/**
 * Error thrown by the API client. Carries the HTTP status and app-level error
 * code so callers can distinguish 401 (redirect to login) from 5xx (retry) etc.
 */
export class ApiError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
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
    config;
    constructor(config) {
        this.config = config;
    }
    async request(path, init = {}) {
        let res;
        try {
            res = await fetch(this.config.baseUrl + path, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(init.headers ?? {}),
                },
                ...init,
            });
        }
        catch (e) {
            // Network-level failure (DNS, offline, CORS preflight blocked, etc).
            throw new ApiError(e.message || 'Network error', 0);
        }
        const payload = (await res.json().catch(() => ({})));
        if (!res.ok || payload.error) {
            const msg = payload.error?.message ?? `Request failed (${res.status})`;
            throw new ApiError(msg, res.status, payload.error?.code);
        }
        return payload.data;
    }
    // ----- System -----
    systemStatus() {
        return this.request('/api/v1/system/status');
    }
    // ----- Auth -----
    sendMagicLink(email, redirectTo) {
        return this.request('/api/v1/auth/send', {
            method: 'POST',
            body: JSON.stringify({ email, redirectTo }),
        });
    }
    /** Email + password login. Sets the session cookie on success. */
    login(email, password) {
        return this.request('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }
    /**
     * Create a client-role account with a password. No payment needed — they
     * land with `subscription_status: 'none'` and pick a tier in-portal.
     */
    register(args) {
        return this.request('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /** Create an agency team account. Domain-gated server-side. */
    registerTeam(args) {
        return this.request('/api/v1/auth/register-team', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /**
     * Legacy magic-link signup. Creates a user + client record, emails a
     * magic link. Retained for callers that don't want to collect passwords.
     */
    signup(args) {
        return this.request('/api/v1/auth/signup', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    me() {
        return this.request('/api/v1/auth/me');
    }
    logout() {
        return this.request('/api/v1/auth/logout', { method: 'POST' });
    }
    // ----- Clients -----
    listClients() {
        return this.request('/api/v1/clients');
    }
    getClient(id) {
        return this.request(`/api/v1/clients/${id}`);
    }
    getMyClient() {
        return this.request('/api/v1/clients/me');
    }
    /**
     * Everything the AI knows about a client: palette, logo, contact,
     * services, team, past hashtags, top media, + a completeness score.
     * Used by the Brand Readiness panel in the dashboard.
     */
    getBrandContext(id) {
        return this.request(`/api/v1/clients/${id}/brand-context`);
    }
    /**
     * Agency-side: create a new client record. Returns the created row so
     * the UI can route to its detail page.
     */
    createClient(body) {
        return this.request('/api/v1/clients', {
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
    inviteClient(id, body = {}) {
        return this.request(`/api/v1/clients/${id}/invite`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
    updateMyClient(patch) {
        return this.request('/api/v1/clients/me', {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    }
    /** Agency-side update of any client field. */
    updateClient(id, patch) {
        return this.request(`/api/v1/clients/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    }
    /** Delete a client and all associated data. Agency admin only. */
    deleteClient(id) {
        return this.request(`/api/v1/clients/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
    /** Clear a client's website config (reverts to "coming soon"). */
    deleteWebsiteConfig(clientId) {
        return this.request(`/api/v1/clients/${encodeURIComponent(clientId)}/website`, { method: 'DELETE' });
    }
    // ----- Posts -----
    listPosts(params = {}) {
        const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
        return this.request(`/api/v1/posts${q ? `?${q}` : ''}`);
    }
    approvePost(id) {
        return this.request(`/api/v1/posts/${id}/approve`, { method: 'PATCH' });
    }
    rejectPost(id, feedback) {
        return this.request(`/api/v1/posts/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ feedback }),
        });
    }
    updatePost(id, patch) {
        return this.request(`/api/v1/posts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    }
    deletePost(id) {
        return this.request(`/api/v1/posts/${id}`, {
            method: 'DELETE',
        });
    }
    /**
     * Compose a net-new post (agency only). Lets the team write a manual
     * post without running the full pipeline. Lands in `pending_internal`.
     */
    createPost(args) {
        return this.request('/api/v1/posts', {
            method: 'POST',
            body: JSON.stringify({ hashtags: [], ...args }),
        });
    }
    /** Duplicate a post — new row, +1 day schedule, pending_internal. */
    duplicatePost(id) {
        return this.request(`/api/v1/posts/${id}/duplicate`, { method: 'POST' });
    }
    batchApprove(postIds) {
        return this.request('/api/v1/posts/batch-approve', {
            method: 'POST',
            body: JSON.stringify({ postIds }),
        });
    }
    // ----- Images -----
    listImages(clientId) {
        return this.request(`/api/v1/images?clientId=${clientId}`);
    }
    /** Agency-side delete (or client deleting their own). */
    deleteImage(id) {
        return this.request(`/api/v1/images/${id}`, {
            method: 'DELETE',
        });
    }
    /**
     * Update editable metadata on a single image. Currently the AI-generated
     * description (label) and the approval status.
     */
    updateImage(id, patch) {
        return this.request(`/api/v1/images/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    }
    async uploadImages(clientId, files, tags = []) {
        const form = new FormData();
        form.append('clientId', clientId);
        form.append('tags', tags.join(','));
        files.forEach((f) => form.append('files', f));
        const res = await fetch(`${this.config.baseUrl}/api/v1/images/upload`, {
            method: 'POST',
            credentials: 'include',
            body: form,
        });
        const payload = (await res.json());
        if (!res.ok || payload.error)
            throw new Error(payload.error?.message ?? 'Upload failed');
        return payload.data;
    }
    /**
     * Upload with real progress events — XHR because `fetch` doesn't expose
     * upload progress natively in browsers. Resolves to the created rows.
     */
    uploadImagesWithProgress(clientId, files, tags = [], onProgress) {
        const form = new FormData();
        form.append('clientId', clientId);
        form.append('tags', tags.join(','));
        files.forEach((f) => form.append('files', f));
        return new Promise((resolve, reject) => {
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
                    const payload = JSON.parse(xhr.responseText || '{}');
                    if (xhr.status >= 200 && xhr.status < 300 && !payload.error) {
                        onProgress?.(100);
                        resolve(payload.data ?? []);
                    }
                    else {
                        reject(new ApiError(payload.error?.message ?? `Upload failed (${xhr.status})`, xhr.status, payload.error?.code));
                    }
                }
                catch (e) {
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
    uploadMediaWithProgress(clientId, files, tags = [], onProgress) {
        const form = new FormData();
        form.append('clientId', clientId);
        form.append('tags', tags.join(','));
        files.forEach((f) => form.append('files', f));
        return new Promise((resolve, reject) => {
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
                    const payload = JSON.parse(xhr.responseText || '{}');
                    if (xhr.status >= 200 && xhr.status < 300 && !payload.error) {
                        onProgress?.(100);
                        resolve(payload.data ?? []);
                    }
                    else {
                        reject(new ApiError(payload.error?.message ?? `Upload failed (${xhr.status})`, xhr.status, payload.error?.code));
                    }
                }
                catch (e) {
                    reject(new ApiError('Invalid server response', xhr.status));
                }
            };
            xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
            xhr.onabort = () => reject(new ApiError('Upload cancelled', 0));
            xhr.send(form);
        });
    }
    // ----- Messages -----
    listMessages(clientId) {
        return this.request(`/api/v1/messages?clientId=${clientId}`);
    }
    sendMessage(clientId, body) {
        return this.request('/api/v1/messages', {
            method: 'POST',
            body: JSON.stringify({ clientId, body }),
        });
    }
    // ----- Automation -----
    generate(args) {
        return this.request('/api/v1/automation/generate', { method: 'POST', body: JSON.stringify(args) });
    }
    /**
     * Rewrite a single post's caption + hashtags. Uses the brand voice +
     * (optionally) user feedback to produce a sharper take. Server persists
     * the result so the next `listPosts` call returns the new copy.
     */
    regeneratePost(args) {
        return this.request('/api/v1/automation/regenerate-post', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /**
     * Regenerate the image on a single post via Flux. Uses the post's
     * caption as the subject brief; `overridePrompt` lets the agency fine-tune.
     */
    regeneratePostImage(args) {
        return this.request('/api/v1/automation/regenerate-post-image', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    generateWebsite(args) {
        return this.request('/api/v1/automation/generate-website', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    editWebsiteWithAI(args) {
        return this.request('/api/v1/automation/edit-website', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /**
     * Targeted single-field update. Used by the inline editor — a headline
     * tweak shouldn't round-trip through Claude. `path` is dotted
     * (e.g. `hero.headline`, `services.0.title`).
     */
    updateWebsiteField(args) {
        return this.request('/api/v1/automation/update-website-field', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /**
     * Atomic full-config save. Use this for editor saves so parallel
     * JSONB writes can't race. Sends the entire WebsiteConfig in one
     * request — the server overwrites the blob in a single UPDATE.
     */
    saveWebsiteConfig(args) {
        return this.request('/api/v1/automation/save-website-config', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /** Regenerate (or first-generate) the AI hero image for a client. */
    generateHeroImage(args) {
        return this.request('/api/v1/automation/generate-hero-image', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /**
     * Public, unauthenticated: fetch a generated site by slug to render it
     * at /sites/[slug]. Returns null config when no site has been generated yet.
     */
    getPublicSite(slug) {
        return this.request(`/api/v1/clients/public/by-slug/${encodeURIComponent(slug)}/site`);
    }
    // ----- Custom Domains -----
    /**
     * Public, unauthenticated: resolve a host (e.g. `murphysplumbing.com`) to
     * the internal slug. Called by the apps/web middleware for every custom-
     * domain request, so the response is intentionally minimal.
     */
    resolveHost(host) {
        return this.request(`/api/v1/clients/public/by-host/${encodeURIComponent(host)}`);
    }
    attachDomain(clientId, domain) {
        return this.request(`/api/v1/domains/${encodeURIComponent(clientId)}`, {
            method: 'POST',
            body: JSON.stringify({ domain }),
        });
    }
    getDomain(clientId) {
        return this.request(`/api/v1/domains/${encodeURIComponent(clientId)}`);
    }
    verifyDomain(clientId) {
        return this.request(`/api/v1/domains/${encodeURIComponent(clientId)}/verify`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    }
    detachDomain(clientId) {
        return this.request(`/api/v1/domains/${encodeURIComponent(clientId)}`, { method: 'DELETE' });
    }
    // ----- Billing -----
    /**
     * Kick off a Stripe Checkout session for the signed-in client. Server
     * looks up the customer email and clientId from the session — the caller
     * just picks the tier.
     */
    checkout(tier) {
        return this.request('/api/v1/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ tier }),
        });
    }
    /** Open the Stripe-hosted customer portal for managing billing. */
    openBillingPortal() {
        return this.request('/api/v1/billing/portal', {
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
    finalizeCheckout(sessionId) {
        return this.request('/api/v1/billing/finalize', {
            method: 'POST',
            body: JSON.stringify({ sessionId }),
        });
    }
    /** Current subscription state for the signed-in client. */
    getSubscription() {
        return this.request('/api/v1/billing/subscription');
    }
    // ----- Videos -----
    listVideoTemplates() {
        return this.request('/api/v1/videos/templates');
    }
    renderVideo(args) {
        return this.request('/api/v1/videos/render', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /** Render N videos in one request. Returns per-item success/failure. */
    batchRenderVideos(args) {
        return this.request('/api/v1/videos/batch', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /** List all videos saved to a client's media library. */
    listClientVideos(clientId) {
        return this.request(`/api/v1/videos?clientId=${encodeURIComponent(clientId)}`);
    }
    /**
     * Personalized video: Claude plans a 3–6 clip reel from the client's
     * uploaded media (or synthesized stills when the library is thin),
     * optionally animates a few of the clips, and renders the MediaStory
     * template. Takes 30–60s — show a proper loading state.
     */
    generatePersonalizedVideo(args) {
        return this.request('/api/v1/videos/personalized', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    // ----- Canva -----
    canvaStatus(clientId) {
        return this.request(`/api/v1/canva/status?clientId=${encodeURIComponent(clientId)}`);
    }
    /**
     * Build the Canva connect URL. We don't redirect here — we return the
     * URL so the UI can open it in a new window. That way the dashboard
     * page doesn't lose unsaved state while the user authorises.
     */
    canvaConnectUrl(clientId) {
        return `${this.config.baseUrl}/api/v1/canva/connect?clientId=${encodeURIComponent(clientId)}`;
    }
    canvaDisconnect(clientId) {
        return this.request(`/api/v1/canva/connection?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' });
    }
    canvaListDesigns(clientId) {
        return this.request(`/api/v1/canva/designs?clientId=${encodeURIComponent(clientId)}`);
    }
    canvaListBrandTemplates(clientId) {
        return this.request(`/api/v1/canva/brand-templates?clientId=${encodeURIComponent(clientId)}`);
    }
    canvaAutofill(args) {
        return this.request('/api/v1/canva/autofill', { method: 'POST', body: JSON.stringify(args) });
    }
    canvaImportDesign(args) {
        return this.request('/api/v1/canva/import-design', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    // ----- Inspiration-driven generation -----
    /** Public catalog of available image + video models with pricing. */
    listInspirationModels() {
        return this.request('/api/v1/inspiration/models');
    }
    /**
     * Upload raw inspiration files. These are stored under a short-lived
     * `inspiration/` prefix and are NOT added to the client's media
     * library automatically. Returns public URLs the generation flow can
     * reference.
     */
    async uploadInspirationFiles(clientId, files) {
        const fd = new FormData();
        fd.append('clientId', clientId);
        for (const f of files)
            fd.append('files', f);
        let res;
        try {
            res = await fetch(this.config.baseUrl + '/api/v1/inspiration/upload', {
                method: 'POST',
                body: fd,
                credentials: 'include',
            });
        }
        catch (e) {
            throw new ApiError(e.message || 'Network error', 0);
        }
        const payload = (await res.json().catch(() => ({})));
        if (!res.ok || payload.error) {
            throw new ApiError(payload.error?.message ?? `Upload failed (${res.status})`, res.status, payload.error?.code);
        }
        return payload.data ?? [];
    }
    /** Run Claude Vision on a prepared inspiration set. */
    analyzeInspiration(args) {
        return this.request('/api/v1/inspiration/analyze', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /** Live cost estimate for a proposed plan. Under 200ms round-trip. */
    estimateInspirationCost(args) {
        return this.request('/api/v1/inspiration/estimate', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /**
     * End-to-end generation. Optional analysis → plan → generate → persist.
     * Times out over a minute for video — show a proper loading state.
     */
    generateFromInspiration(args) {
        return this.request('/api/v1/inspiration/generate', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /* ─── Inspiration profiles (brand intelligence) ──────────────── */
    listInspirationProfiles(clientId) {
        return this.request(`/api/v1/clients/${clientId}/inspiration-profiles`);
    }
    createInspirationProfile(clientId, body) {
        return this.request(`/api/v1/clients/${clientId}/inspiration-profiles`, { method: 'POST', body: JSON.stringify(body) });
    }
    updateInspirationProfile(clientId, profileId, patch) {
        return this.request(`/api/v1/clients/${clientId}/inspiration-profiles/${profileId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    }
    deleteInspirationProfile(clientId, profileId) {
        return this.request(`/api/v1/clients/${clientId}/inspiration-profiles/${profileId}`, { method: 'DELETE' });
    }
    /**
     * Kick off a scrape of the profile's reference URL. Synchronous —
     * the response carries the fully populated profile when done, or a
     * `failed` status with `scrapeError` when something went wrong.
     */
    scrapeInspirationProfile(clientId, profileId) {
        return this.request(`/api/v1/clients/${clientId}/inspiration-profiles/${profileId}/scrape`, { method: 'POST' });
    }
    /** Upload one or more reference files to a profile. */
    uploadInspirationProfileMedia(clientId, profileId, files) {
        const form = new FormData();
        for (const f of files)
            form.append('files', f);
        return fetch(`${this.config.baseUrl}/api/v1/clients/${clientId}/inspiration-profiles/${profileId}/media`, { method: 'POST', body: form, credentials: 'include' })
            .then(async (res) => {
            const payload = (await res.json().catch(() => ({})));
            if (!res.ok || payload.error) {
                throw new ApiError(payload.error?.message ?? `Upload failed (${res.status})`, res.status, payload.error?.code);
            }
            return payload.data;
        });
    }
    deleteInspirationProfileMedia(clientId, profileId, mediaId) {
        return this.request(`/api/v1/clients/${clientId}/inspiration-profiles/${profileId}/media/${mediaId}`, { method: 'DELETE' });
    }
    /* ─── Tone-of-voice pairs ───────────────────────────────────── */
    listTonePairs(clientId) {
        return this.request(`/api/v1/clients/${clientId}/tone-pairs`);
    }
    createTonePair(clientId, body) {
        return this.request(`/api/v1/clients/${clientId}/tone-pairs`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
    updateTonePair(clientId, pairId, patch) {
        return this.request(`/api/v1/clients/${clientId}/tone-pairs/${pairId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    }
    deleteTonePair(clientId, pairId) {
        return this.request(`/api/v1/clients/${clientId}/tone-pairs/${pairId}`, { method: 'DELETE' });
    }
    /* ─── Products ──────────────────────────────────────────────── */
    listProducts(clientId, status) {
        const qs = status ? `?status=${encodeURIComponent(status)}` : '';
        return this.request(`/api/v1/clients/${clientId}/products${qs}`);
    }
    createProduct(clientId, body) {
        return this.request(`/api/v1/clients/${clientId}/products`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
    updateProduct(clientId, productId, patch) {
        return this.request(`/api/v1/clients/${clientId}/products/${productId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    }
    deleteProduct(clientId, productId) {
        return this.request(`/api/v1/clients/${clientId}/products/${productId}`, { method: 'DELETE' });
    }
    linkMediaToProduct(clientId, productId, imageId) {
        return this.request(`/api/v1/clients/${clientId}/products/${productId}/media/${imageId}`, { method: 'POST' });
    }
    unlinkMediaFromProduct(clientId, productId, imageId) {
        return this.request(`/api/v1/clients/${clientId}/products/${productId}/media/${imageId}`, { method: 'DELETE' });
    }
    /* ─── Talking-head video ────────────────────────────────────── */
    talkingHeadOptions() {
        return this.request('/api/v1/talking-head/options');
    }
    generateTalkingHeadScript(args) {
        return this.request('/api/v1/talking-head/script', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    renderTalkingHead(args) {
        return this.request('/api/v1/talking-head/render', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    /* ─── Personal content automation ────────────────────────────── */
    personalThemes() {
        return this.request('/api/v1/personal/themes');
    }
    personalFeatures() {
        return this.request('/api/v1/personal/features');
    }
    listPersonalAccounts() {
        return this.request('/api/v1/personal/accounts');
    }
    getPersonalAccount(id) {
        return this.request(`/api/v1/personal/accounts/${id}`);
    }
    createPersonalAccount(body) {
        return this.request('/api/v1/personal/accounts', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
    updatePersonalAccount(id, patch) {
        return this.request(`/api/v1/personal/accounts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    }
    deletePersonalAccount(id) {
        return this.request(`/api/v1/personal/accounts/${id}`, {
            method: 'DELETE',
        });
    }
    generatePersonalPost(id, args = {}) {
        return this.request(`/api/v1/personal/accounts/${id}/generate`, {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
    listPersonalPosts(id) {
        return this.request(`/api/v1/personal/accounts/${id}/posts`);
    }
    /* ─── Personal account media library ─────────────────────── */
    listPersonalMedia(accountId, opts = {}) {
        const q = new URLSearchParams();
        if (opts.role)
            q.set('role', opts.role);
        if (opts.characterId)
            q.set('characterId', opts.characterId);
        const qs = q.toString();
        return this.request(`/api/v1/personal/accounts/${accountId}/media${qs ? `?${qs}` : ''}`);
    }
    uploadPersonalMedia(accountId, files, meta, onProgress) {
        const form = new FormData();
        form.append('role', meta.role);
        if (meta.description)
            form.append('description', meta.description);
        if (meta.tags)
            form.append('tags', meta.tags.join(','));
        if (meta.characterId)
            form.append('characterId', meta.characterId);
        if (meta.pinned)
            form.append('pinned', 'true');
        files.forEach((f) => form.append('files', f));
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.config.baseUrl}/api/v1/personal/accounts/${accountId}/media`);
            xhr.withCredentials = true;
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress)
                    onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
            };
            xhr.onload = () => {
                try {
                    const payload = JSON.parse(xhr.responseText || '{}');
                    if (xhr.status >= 200 && xhr.status < 300 && !payload.error) {
                        onProgress?.(100);
                        resolve(payload.data ?? []);
                    }
                    else {
                        reject(new ApiError(payload.error?.message ?? `Upload failed (${xhr.status})`, xhr.status, payload.error?.code));
                    }
                }
                catch (e) {
                    reject(new ApiError('Invalid server response', xhr.status));
                }
            };
            xhr.onerror = () => reject(new ApiError('Network error', 0));
            xhr.send(form);
        });
    }
    updatePersonalMedia(mediaId, patch) {
        return this.request(`/api/v1/personal/media/${mediaId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    }
    deletePersonalMedia(mediaId) {
        return this.request(`/api/v1/personal/media/${mediaId}`, {
            method: 'DELETE',
        });
    }
    /* ─── AI-influencer characters ───────────────────────────── */
    listCharacters() {
        return this.request('/api/v1/personal/characters');
    }
    getCharacter(id) {
        return this.request(`/api/v1/personal/characters/${id}`);
    }
    createCharacter(body) {
        return this.request('/api/v1/personal/characters', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
    updateCharacter(id, patch) {
        return this.request(`/api/v1/personal/characters/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    }
    deleteCharacter(id) {
        return this.request(`/api/v1/personal/characters/${id}`, {
            method: 'DELETE',
        });
    }
    analyzeCharacter(id) {
        return this.request(`/api/v1/personal/characters/${id}/analyze`, { method: 'POST', body: JSON.stringify({}) });
    }
    /* ─── AI model catalog ───────────────────────────────────── */
    listPersonalModels() {
        return this.request('/api/v1/personal/models');
    }
    /* ─── Custom themes (user-editable library) ──────────────── */
    listCustomThemes() {
        return this.request('/api/v1/personal/custom-themes');
    }
    createCustomTheme(body) {
        return this.request('/api/v1/personal/custom-themes', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
    updateCustomTheme(id, patch) {
        return this.request(`/api/v1/personal/custom-themes/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    }
    deleteCustomTheme(id) {
        return this.request(`/api/v1/personal/custom-themes/${id}`, {
            method: 'DELETE',
        });
    }
    cloneBuiltinTheme(args) {
        return this.request('/api/v1/personal/custom-themes/clone', {
            method: 'POST',
            body: JSON.stringify(args),
        });
    }
}
export function createApi(baseUrl) {
    return new BoostApi({ baseUrl });
}
