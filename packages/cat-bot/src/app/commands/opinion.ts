/**
 * /opinion — Opinion Card
 *
 * Fetches the target user's avatar (mention → replied-to user → self) and
 * overlays the supplied text using the PopCat /v2/opinion endpoint. The API
 * returns an image which is sent as a Buffer attachment.
 *
 * Usage: !opinion <text> [@user]
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

export const config: CommandConfig = {
  name: 'opinion',
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: "Generate an opinion card with a user's avatar and your text.",
  category: 'fun',
  usage: '<text> [@user]',
  cooldown: 5,
  hasPrefix: true,
};

export const onCommand = async ({
  chat,
  user,
  event,
  args,
  usage,
}: AppCtx): Promise<void> => {
  const senderID = event['senderID'] as string;
  const mentions = event['mentions'] as Record<string, string> | undefined;
  const mentionIDs = Object.keys(mentions ?? {});
  const messageReply = event['messageReply'] as
    | Record<string, unknown>
    | null
    | undefined;
  const repliedSenderID = messageReply?.['senderID'] as string | undefined;

  // Priority: @mention → replied-to user → self
  const targetID = mentionIDs[0] ?? repliedSenderID ?? senderID;

  // Strip mention tokens from args to isolate the opinion text
  const mentionTexts = Object.values(mentions ?? {});
  const text = args
    .join(' ')
    .replace(
      new RegExp(
        mentionTexts
          .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|'),
        'g',
      ),
      '',
    )
    .trim();

  if (!text) return usage();

  try {
    const avatarUrl = await user.getAvatarUrl(targetID);
    if (!avatarUrl) throw new Error('Could not fetch user avatar.');

    const base = createUrl('popcat', '/v2/opinion');
    if (!base) throw new Error('Failed to build Opinion API URL.');

    const params = new URLSearchParams({ image: avatarUrl, text });
    const res = await fetch(`${base}?${params.toString()}`);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const imageBuffer = Buffer.from(await res.arrayBuffer());

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '💬 **Opinion**',
      attachment: [{ name: 'opinion.png', stream: imageBuffer }],
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};
