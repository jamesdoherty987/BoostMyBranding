/**
 * Public /api/v1/system/status — reports which integrations are live so the
 * dashboard can show which automation features are active.
 *
 * Only integration *presence* leaks (yes/no); never keys or secrets.
 */

import { Router } from 'express';
import { features } from '../env.js';
import { isDbConfigured } from '@boost/database';

export const systemRouter = Router();

systemRouter.get('/status', (_req, res) => {
  res.json({
    data: {
      database: isDbConfigured(),
      claude: features.claude,
      fal: features.fal,
      r2: features.r2,
      stripe: features.stripe,
      resend: features.resend,
      contentStudio: features.contentStudio,
    },
  });
});
