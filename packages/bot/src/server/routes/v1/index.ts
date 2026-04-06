import { Router } from 'express';
import botRouter from './bot.routes.js';
import webhookRouter from './webhook.routes.js';
import validationRouter from './validation.routes.js';

const v1Router = Router();

// Mount domain routers here — adding new resources requires one line; app.ts stays stable.
v1Router.use('/bots', botRouter);
v1Router.use('/webhooks', webhookRouter);
// Credential validation before DB write — Discord/Telegram/FbMessenger REST; FB Page via Socket.IO
v1Router.use('/validate', validationRouter);

export default v1Router;
