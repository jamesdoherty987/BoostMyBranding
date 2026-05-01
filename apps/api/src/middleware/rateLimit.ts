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
