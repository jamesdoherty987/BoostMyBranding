/**
 * Inspiration-driven generation routes.
 *
 *   GET  /api/v1/inspiration/models       — public catalog of available models + pricing
 *   POST /api/v1/inspiration/upload       — upload 1..N raw inspiration files; returns URLs
 *   POST /api/v1/inspiration/analyze      — run Claude Vision on a resolved inspiration set
 *   POST /api/v1/inspiration/generate     — end-to-end: analyse (optional) + generate
 *   POST /api/v1/inspiration/estimate     — compute cost estimate for a plan before running
 *
 * Inspiration uploads are ephemeral — they are NOT added to the client's
 * media library automatically. They're stored on R2 (or local disk in
 * dev) under a short-lived `inspiration/` prefix so the AI can fetch
 * them while generating. The user can promote one to the library later
 * if they want to keep it.
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { uploadFile } from '../services/r2.js';
import { publicCatalog, estimateCostCents, getModel } from '../services/modelCatalog.js';
import { analyzeInspiration } from '../services/inspirationAnalysis.js';
import { generateFromInspiration } from '../services/inspirationGeneration.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { requireAuth, requireRole } from '../services/auth.js';

export const inspirationRouter = Router();

/* ── Config ─────────────────────────────────────────────────────── */

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
const MAX_FILES = 14; // matches Nano Banana 2 Pro's reference ceiling
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Supported: JPG, PNG, WEBP, MP4, MOV'));
  },
});

/* ── Models ─────────────────────────────────────────────────────── */

inspirationRouter.get('/models', requireAuth, (_req, res) => {
  res.json({ data: publicCatalog() });
});

/* ── Upload inspiration (ephemeral) ──────────────────────────────── */

const uploadBodySchema = z.object({
  clientId: z.string().uuid(),
});

inspirationRouter.post(
  '/upload',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  uploadLimiter,
  upload.array('files', MAX_FILES),
  async (req, res, next) => {
    try {
      const { clientId } = uploadBodySchema.parse(req.body);
      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) {
        return res.status(400).json({ error: { message: 'No files uploaded', code: 'NO_FILES' } });
      }

      const uploaded: Array<{
        url: string;
        mimeType: string;
        fileName: string;
        sizeBytes: number;
      }> = [];

      for (const file of files) {
        if (file.size > MAX_FILE_BYTES || !ALLOWED_MIME.has(file.mimetype)) {
          return res
            .status(400)
            .json({ error: { message: 'Unsupported file', code: 'BAD_FILE' } });
        }
        const { url } = await uploadFile(
          `${clientId}/inspiration`,
          file.buffer,
          file.originalname,
          file.mimetype,
        );
        uploaded.push({
          url,
          mimeType: file.mimetype,
          fileName: file.originalname,
          sizeBytes: file.size,
        });
      }

      res.status(201).json({ data: uploaded });
    } catch (e) {
      next(e);
    }
  },
);

/* ── Analyse inspiration ────────────────────────────────────────── */

const analyzeSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().max(200),
        url: z.string().url().max(1500),
        mimeType: z.string().max(100),
        label: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(MAX_FILES),
  direction: z.string().max(1000).optional(),
});

inspirationRouter.post(
  '/analyze',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = analyzeSchema.parse(req.body);
      const analysis = await analyzeInspiration(args.items, args.direction);
      res.json({ data: analysis });
    } catch (e) {
      next(e);
    }
  },
);

/* ── Estimate cost ──────────────────────────────────────────────── */

const estimateSchema = z.object({
  imageModelId: z.string().max(100).optional(),
  videoModelId: z.string().max(100).optional(),
  videoDurationSeconds: z.number().int().min(2).max(20).optional(),
  outputType: z.enum(['image', 'video', 'both']).optional(),
});

inspirationRouter.post(
  '/estimate',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  (req, res, next) => {
    try {
      const args = estimateSchema.parse(req.body);
      const cents = estimateCostCents({
        imageModelId:
          args.outputType !== 'video' && args.imageModelId ? args.imageModelId : undefined,
        videoModelId:
          args.outputType !== 'image' && args.videoModelId ? args.videoModelId : undefined,
        videoDurationSeconds: args.videoDurationSeconds,
        imageCount: 1,
        videoCount: 1,
      });
      res.json({ data: { costCents: cents } });
    } catch (e) {
      next(e);
    }
  },
);

/* ── Generate (orchestrator) ────────────────────────────────────── */

const generateSchema = z.object({
  clientId: z.string().uuid(),
  inspiration: z
    .array(
      z.union([
        z.object({
          kind: z.literal('library'),
          id: z.string().uuid(),
        }),
        z.object({
          kind: z.literal('upload'),
          url: z.string().url().max(1500),
          mimeType: z.string().max(100),
          label: z.string().max(300).optional(),
        }),
      ]),
    )
    .max(MAX_FILES)
    .default([]),
  runAnalysis: z.boolean().default(true),
  directBrief: z.string().max(2000).optional(),
  outputType: z.enum(['image', 'video', 'both']).optional(),
  imageModelId: z.string().max(100).optional(),
  videoModelId: z.string().max(100).optional(),
  imageAspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']).optional(),
  videoAspectRatio: z.enum(['9:16', '1:1', '16:9']).optional(),
  videoDurationSeconds: z.number().int().min(2).max(20).optional(),
  useInspirationAsVideoSeed: z.boolean().optional(),
});

inspirationRouter.post(
  '/generate',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = generateSchema.parse(req.body);

      // Validate model compatibility up front so we don't waste a
      // round-trip on an obviously bad plan.
      if (args.imageModelId) {
        const m = getModel(args.imageModelId);
        if (!m) return res.status(400).json({ error: { message: `Unknown image model: ${args.imageModelId}`, code: 'UNKNOWN_MODEL' } });
        if (m.mediaType !== 'image') return res.status(400).json({ error: { message: `${m.displayName} is not an image model`, code: 'MODEL_TYPE_MISMATCH' } });
      }
      if (args.videoModelId) {
        const m = getModel(args.videoModelId);
        if (!m) return res.status(400).json({ error: { message: `Unknown video model: ${args.videoModelId}`, code: 'UNKNOWN_MODEL' } });
        if (m.mediaType !== 'video') return res.status(400).json({ error: { message: `${m.displayName} is not a video model`, code: 'MODEL_TYPE_MISMATCH' } });
      }

      const result = await generateFromInspiration(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);
