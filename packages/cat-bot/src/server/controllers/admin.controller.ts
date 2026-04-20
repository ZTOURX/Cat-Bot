import type { Request, Response } from 'express';
import { adminAuth } from '@/server/lib/better-auth.lib.js';
import { botRepo } from '@/server/repos/bot.repo.js';
import {
  listSystemAdmins,
  addSystemAdmin,
  removeSystemAdmin,
} from 'database';
import type {
  AddSystemAdminRequestDto,
} from '@/server/dtos/admin.dto.js';

// Reusable header conversion — same pattern as bot.controller.ts.
// better-auth expects the browser Headers API, not Node IncomingHttpHeaders.
function toHeaders(req: Request): Headers {
  const h = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val === undefined) continue;
    h.set(key, Array.isArray(val) ? val.join(', ') : val);
  }
  return h;
}

// Verifies adminAuth session AND role === 'admin'.
// Using adminAuth (not auth) so the ba-admin.session_token cookie is checked — the
// user portal's better-auth.session_token is never accepted here, keeping the two
// auth surfaces strictly isolated.
async function requireAdmin(req: Request, res: Response): Promise<{ id: string } | null> {
  const sessionData = await adminAuth.api.getSession({ headers: toHeaders(req) });
  if (!sessionData) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (sessionData.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: admin role required' });
    return null;
  }
  return { id: sessionData.user.id };
}

export class AdminController {
  // GET /api/v1/admin/bots — all bot sessions across all owners
  async listBots(req: Request, res: Response): Promise<void> {
    if (!(await requireAdmin(req, res))) return;
    try {
      const result = await botRepo.listAll();
      res.status(200).json(result);
    } catch (error) {
      console.error('[AdminController.listBots]', error);
      res.status(500).json({ error: 'Failed to fetch all bot sessions' });
    }
  }

  // GET /api/v1/admin/system-admins
  async getSystemAdmins(req: Request, res: Response): Promise<void> {
    if (!(await requireAdmin(req, res))) return;
    try {
      const admins = await listSystemAdmins();
      res.status(200).json({ admins });
    } catch (error) {
      console.error('[AdminController.getSystemAdmins]', error);
      res.status(500).json({ error: 'Failed to fetch system admins' });
    }
  }

  // POST /api/v1/admin/system-admins
  async addSystemAdmin(req: Request, res: Response): Promise<void> {
    if (!(await requireAdmin(req, res))) return;
    const { adminId } = req.body as AddSystemAdminRequestDto;
    if (typeof adminId !== 'string' || !adminId.trim()) {
      res.status(400).json({ error: 'Missing required field: adminId' });
      return;
    }
    try {
      const admin = await addSystemAdmin(adminId.trim());
      res.status(201).json(admin);
    } catch (error) {
      console.error('[AdminController.addSystemAdmin]', error);
      res.status(500).json({ error: 'Failed to add system admin' });
    }
  }

  // DELETE /api/v1/admin/system-admins/:adminId
  async removeSystemAdmin(req: Request, res: Response): Promise<void> {
    if (!(await requireAdmin(req, res))) return;
    const adminId = String(req.params['adminId'] ?? '');
    if (!adminId) {
      res.status(400).json({ error: 'Missing adminId param' });
      return;
    }
    try {
      await removeSystemAdmin(adminId);
      res.status(200).json({ status: 'removed' });
    } catch (error) {
      console.error('[AdminController.removeSystemAdmin]', error);
      res.status(500).json({ error: 'Failed to remove system admin' });
    }
  }
}

export const adminController = new AdminController();