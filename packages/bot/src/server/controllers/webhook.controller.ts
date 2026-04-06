import type { Request, Response } from 'express';
import { auth } from '@/server/lib/better-auth.lib.js';
import { getFbPageWebhookVerification } from '@/engine/repos/webhooks.repo.js';
import { generateVerifyToken } from '@/server/utils/hash.util.js';

export class WebhookController {
  async getFacebookInfo(req: Request, res: Response): Promise<void> {
    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val === undefined) continue;
      headers.set(key, Array.isArray(val) ? val.join(', ') : val);
    }

    const sessionData = await auth.api.getSession({ headers });
    if (!sessionData) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = sessionData.user.id;
    const verifyToken = generateVerifyToken(userId);

    // Dynamically generate the external webhook address using Express request context
    const botUrlBase = `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${botUrlBase}/api/v1/facebook-page/${userId}`;

    // Look up the verification handshake status managed by the Bot process
    const webhook = await getFbPageWebhookVerification(userId);

    res.status(200).json({
      webhookUrl,
      verifyToken,
      isVerified: webhook?.isVerified ?? false,
    });
  }
}

export const webhookController = new WebhookController();
