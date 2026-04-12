import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';
import { Platforms } from '@/engine/modules/platform/platform.constants.js';

export const config = {
  name: 'ping',
  aliases: [] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'John Lester',
  description: 'Check if bot is alive',
  category: '',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
};

const ACTION_ID = { refresh: 'refresh' } as const;

// Refresh re-measures round-trip latency on button click so the user gets a
// fresh reading without re-typing the command — common for network spot-checks.
export const menu = {
  [ACTION_ID.refresh]: {
    label: '🔄 Refresh',
    button_style: ButtonStyle.SECONDARY,
    run: async ({ chat, startTime, event, native }: AppCtx) => {
      // FB Messenger has no native button components — it renders a numbered text-menu
      // fallback which clutters a simple one-liner response. Skip buttons there.
      const hasNativeButtons =
        native.platform === Platforms.Discord ||
        native.platform === Platforms.Telegram ||
        native.platform === Platforms.FacebookPage;
      await chat.editMessage({
        style: MessageStyle.MARKDOWN,
        message_id_to_edit: event.messageID as string,
        message: `🏓 Pong! Latency: \`${Date.now() - startTime}ms\``,
        ...(hasNativeButtons ? { button: [ACTION_ID.refresh] } : {}),
      });
    },
  },
};

export const onCommand = async ({ chat, startTime, native }: AppCtx) => {
  // FB Messenger has no native button components — it renders a numbered text-menu
  // fallback which clutters a simple one-liner response. Skip buttons there.
  const hasNativeButtons =
    native.platform === Platforms.Discord ||
    native.platform === Platforms.Telegram ||
    native.platform === Platforms.FacebookPage;
  await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: `🏓 Pong! Latency: \`${Date.now() - startTime}ms\``,
    ...(hasNativeButtons ? { button: [ACTION_ID.refresh] } : {}),
  });
};
