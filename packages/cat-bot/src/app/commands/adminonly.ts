/**
 * adminonly.ts — Cat-Bot port of GoatBot adminonly by NTKhang
 *
 * Toggles a session-wide mode where only bot admins can use the bot
 * across all threads. Also toggles the blocked-user notification.
 *
 * ⚠️ GAP — global config file mutation:
 *   GoatBot mutated global.GoatBot.config in memory and persisted it with
 *   fs.writeFileSync. Cat-Bot documents no global config mutation API.
 *   Settings are stored in db.users.collection(native.userId) → 'session_settings',
 *   which is pre-scoped to (sessionOwnerUserId, platform, sessionId) — fully
 *   isolated between concurrent bot instances.
 *
 * DB schema (db.users.collection(native.userId) → 'session_settings'):
 *   adminOnlyEnabled:    boolean  — session-wide bot-admin-only enforcement
 *   adminOnlyHideNoti:   boolean  — suppress the blocked-user reply
 *   adminOnlyIgnoreList: string[] — commands exempt from enforcement
 *                                   (managed separately by ignoreonlyad)
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role }         from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';

export const config = {
  name:        'adminonly',
  aliases:     ['adonly', 'onlyad', 'onlyadmin'] as string[],
  version:     '1.5.0',
  role:        Role.BOT_ADMIN,
  author:      'NTKhang (Cat-Bot port)',
  description: 'Turn on/off the mode where only bot admins can use the bot (session-wide).',
  category:    'Admin',
  usage: [
    '[on | off] — Enable/disable bot-admin-only mode for this session',
    'noti [on | off] — Enable/disable the blocked-user notification',
  ],
  cooldown:  5,
  hasPrefix: true,
};

// ── DB helper ─────────────────────────────────────────────────────────────────

async function getSessionHandle(db: AppCtx['db'], ownerUserId: string) {
  const coll = db.users.collection(ownerUserId);
  if (!(await coll.isCollectionExist('session_settings'))) {
    await coll.createCollection('session_settings');
    const h = await coll.getCollection('session_settings');
    await h.set('adminOnlyEnabled',    false);
    await h.set('adminOnlyHideNoti',   false);
    await h.set('adminOnlyIgnoreList', []);
    return h;
  }
  return coll.getCollection('session_settings');
}

// ── onCommand ─────────────────────────────────────────────────────────────────

export const onCommand = async ({
  chat, args, db, native, usage,
}: AppCtx): Promise<void> => {
  const ownerUserId = native.userId ?? '';

  if (!ownerUserId) {
    await chat.replyMessage({
      style:   MessageStyle.MARKDOWN,
      message: '❌ Cannot resolve session identity — adminonly is unavailable.',
    });
    return;
  }

  let isNoti   = false;
  let argIndex = 0;

  if (args[0]?.toLowerCase() === 'noti') {
    isNoti   = true;
    argIndex = 1;
  }

  const toggle = args[argIndex]?.toLowerCase();
  if (toggle !== 'on' && toggle !== 'off') return usage();

  const value  = toggle === 'on';
  const handle = await getSessionHandle(db, ownerUserId);

  if (isNoti) {
    await handle.set('adminOnlyHideNoti', !value);
    await chat.replyMessage({
      style:   MessageStyle.MARKDOWN,
      message: value
        ? '✅ Notification **enabled** — non-admins will be told when they are blocked.'
        : '✅ Notification **disabled** — non-admins will be silently ignored.',
    });
  } else {
    await handle.set('adminOnlyEnabled', value);
    await chat.replyMessage({
      style:   MessageStyle.MARKDOWN,
      message: value
        ? '✅ Admin-only mode **enabled** — only bot admins can use the bot across all threads.'
        : '✅ Admin-only mode **disabled** — all users can use the bot.',
    });
  }
};