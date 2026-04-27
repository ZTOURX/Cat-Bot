/**
 * /gun — Gun Threat Image
 *
 * Fetches the target user's avatar (mention → replied-to user → self) and
 * overlays the supplied threat text using the PopCat /v2/gun endpoint.
 * The API returns an image which is sent as a Buffer attachment.
 *
 * Usage: !gun <text> [@user]
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

export const config: CommandConfig = {
  name: 'gun',
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: "Generate a gun threat image with a user's avatar and your text.",
  category: 'fun',
  usage: '<text> [@user]',
  cooldown: 5,
  hasPrefix: true,
};

export const onCommand = async ({ chat, user, event, args, usage }: AppCtx): Promise<void> => {
  const senderID = event['senderID'] as string;
  const mentions = event['mentions'] as Record<string, string> | undefined;
  const mentionIDs = Object.keys(mentions ?? {});
  const messageReply = event['messageReply'] as Record<string, unknown> | null | undefined;
  const repliedSenderID = messageReply?.['senderID'] as string | undefined;
  const targetID = mentionIDs[0] ?? repliedSenderID ?? senderID;

  // Strip mention tokens to isolate the text prompt
  const mentionTexts = Object.values(mentions ?? {});
  const text = args
    .join(' ')
    .replace(new RegExp(mentionTexts.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'), '')
    .trim();

  if (!text) return usage();

  try {
    const avatarUrl = await user.getAvatarUrl(targetID);
    if (!avatarUrl) throw new Error('Could not fetch user avatar.');

    const base = createUrl('popcat', '/v2/gun');
    if (!base) throw new Error('Failed to build Gun API URL.');

    const params = new URLSearchParams({ image: avatarUrl, text });
    const res = await fetch(`${base}?${params.toString()}`);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '🔫 **Gun**',
      attachment: [{ name: 'gun.png', stream: Buffer.from(await res.arrayBuffer()) }],
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};