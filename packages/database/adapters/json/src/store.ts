import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbRoot = path.resolve(__dirname, '../../..');
// If compiled into dist/database/adapters/..., go up two more levels to exit dist/
if (path.basename(dbRoot) === 'database' && path.basename(path.dirname(dbRoot)) === 'dist') {
  dbRoot = path.resolve(dbRoot, '../..');
}
const DB_FILE = path.resolve(dbRoot, 'database/database.json');

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
