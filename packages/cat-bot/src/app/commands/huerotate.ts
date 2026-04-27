/**
 * /huerotate — Hue Rotate Avatar
 *
 * Fetches the target user's avatar (mention → replied-to user → self) and
 * applies a hue rotation in degrees using the PopCat /v2/hue-rotate endpoint.
 * Degree must be a number between 0 and 360.
 *
 * Note: this endpoint uses the param name `img` (not `image`).
 *
 * Usage: !huerotate <degrees> [@user]
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

export const config: CommandConfig = {
  name: 'huerotate',
  aliases: ['hue'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: "Rotate the hue of a user's avatar by degrees.",
  category: 'fun',
  usage: '<degrees 0-360> [@user]',
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

  // Strip mention tokens and find the degree value from remaining args
  const mentionTexts = Object.values(mentions ?? {});
  const cleanArgs = args
    .join(' ')
    .replace(new RegExp(mentionTexts.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'), '')
    .trim();

  const deg = parseInt(cleanArgs, 10);

  if (isNaN(deg) || deg < 0 || deg > 360) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '⚠️ Please provide a valid degree between **0** and **360**.',
    });
    return;
  }

  try {
    const avatarUrl = await user.getAvatarUrl(targetID);
    if (!avatarUrl) throw new Error('Could not fetch user avatar.');

    const base = createUrl('popcat', '/v2/hue-rotate');
    if (!base) throw new Error('Failed to build Hue Rotate API URL.');

    // Note: this endpoint uses `img` not `image`
    const params = new URLSearchParams({ img: avatarUrl, deg: String(deg) });
    const res = await fetch(`${base}?${params.toString()}`);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `🎨 **Hue Rotated (${deg}°)**`,
      attachment: [{ name: 'huerotate.png', stream: Buffer.from(await res.arrayBuffer()) }],
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};