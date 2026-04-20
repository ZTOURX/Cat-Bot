/**
 * Admin Routes — v1
 *
 * Mounted at /api/v1/admin by routes/v1/index.ts.
 * Every handler in adminController verifies adminAuth session + role === 'admin'
 * before executing — no additional middleware guard is needed here.
 */

import { Router } from 'express';
import { adminController } from '@/server/controllers/admin.controller.js';

const adminRouter = Router();

// GET /api/v1/admin/bots — all bot sessions across all users (admin overview)
adminRouter.get('/bots', (req, res) => {
  void adminController.listBots(req, res);
});

// GET /api/v1/admin/system-admins — list all global system admin IDs
adminRouter.get('/system-admins', (req, res) => {
  void adminController.getSystemAdmins(req, res);
});

// POST /api/v1/admin/system-admins — register a new global system admin ID
adminRouter.post('/system-admins', (req, res) => {
  void adminController.addSystemAdmin(req, res);
});

// DELETE /api/v1/admin/system-admins/:adminId — revoke global system admin privileges
adminRouter.delete('/system-admins/:adminId', (req, res) => {
  void adminController.removeSystemAdmin(req, res);
});

export default adminRouter;