import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Three levels up from src/ lands at packages/database/ — keeps the JSON store
// alongside the SQLite file at the database package root instead of the repo root.
const DB_FILE = path.resolve(__dirname, '../../../database/database.json');

export let dbCache: any = null;

// WHY: Provides a fast in-memory document store fallback when SQLite is not used.
export const getDb = async () => {
  if (dbCache) return dbCache;
  try {
    const content = await fs.readFile(DB_FILE, 'utf-8');
    dbCache = JSON.parse(content);
  } catch {
    dbCache = {
      botSessionCommand: [], botSessionEvent: [], botCredentialDiscord: [],
      botCredentialTelegram: [], botCredentialFacebookPage: [],
      botCredentialFacebookMessenger: [], botSession: [], botAdmin: [],
      botThread: [], botUser: [], fbPageWebhook: [],
      botThreadSession: [], botUserSession: [],
      // better-auth core tables — required when DATABASE_TYPE=json so auth queries
      // find an initialised array instead of undefined on first boot.
      user: [], session: [], account: [], verification: [],
    };
  }
  return dbCache;
};

export const saveDb = async () => {
  if (!dbCache) return;
  await fs.writeFile(DB_FILE, JSON.stringify(dbCache, null, 2));
};
