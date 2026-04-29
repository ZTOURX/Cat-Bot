/**
 * /nokia — Nokia Screen Overlay
 *
 * Fetches the target user's avatar (mention → replied-to user → self) and
 * passes it to the PopCat /v2/nokia endpoint. The API returns an image
 * which is sent as a Buffer attachment.
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

export const config: CommandConfig = {
  name: 'nokia',
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: "Put a user's avatar on a Nokia screen.",
  category: 'fun',
  usage: '[@user]',
  cooldown: 5,
  hasPrefix: true,
};

export const onCommand = async ({
  chat,
  user,
  event,
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

  try {
    const avatarUrl = await user.getAvatarUrl(targetID);
    if (!avatarUrl) throw new Error('Could not fetch user avatar.');

    const base = createUrl('popcat', '/v2/nokia');
    if (!base) throw new Error('Failed to build Nokia API URL.');

    const res = await fetch(`${base}?image=${encodeURIComponent(avatarUrl)}`);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const imageBuffer = Buffer.from(await res.arrayBuffer());

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '📱 **Nokia**',
      attachment: [{ name: 'nokia.png', stream: imageBuffer }],
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};
