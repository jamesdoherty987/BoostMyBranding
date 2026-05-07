import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many requests', code: 'RATE_LIMIT' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many auth attempts', code: 'RATE_LIMIT' } },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Upload rate limit exceeded', code: 'RATE_LIMIT' } },
});

/**
 * Limiter for public, unauthenticated endpoints. Tighter than the general
 * limiter because there's no user attribution.
 */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many requests', code: 'RATE_LIMIT' } },
});

/**
 * Limiter for lead-form submissions. Tighter still to deter spam bots.
 */
export const leadsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many submissions. Try again later.', code: 'RATE_LIMIT' } },
});


/**
 * Per-user limiter for expensive generation endpoints.
 *
 * Each generate call costs real money (Claude + fal + TTS + render
 * time). Without a per-user cap, a compromised token or a buggy
 * client loop could rack up thousands of dollars in a few minutes.
 * We key on `req.user.id` when available so different agency members
 * each get their own quota; unauthenticated hits fall through to IP.
 *
 * Limits:
 *   - 15 generation runs per hour per user
 *   - ~250 regenerations per hour per user (lighter single-post calls)
 */
export const generationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id as string | undefined;
    // Fallback to IP so unauthenticated traffic still gets limited.
    return userId ? `user:${userId}` : `ip:${(req as any).ip ?? 'unknown'}`;
  },
  message: {
    error: {
      message:
        'Generation rate limit reached (15/hour). Take a breather, then try again.',
      code: 'GEN_RATE_LIMIT',
    },
  },
});

export const regenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 250,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id as string | undefined;
    return userId ? `user:${userId}` : `ip:${(req as any).ip ?? 'unknown'}`;
  },
  message: {
    error: {
      message: 'Regeneration rate limit reached.',
      code: 'REGEN_RATE_LIMIT',
    },
  },
});
