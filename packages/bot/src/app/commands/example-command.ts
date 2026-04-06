import type { ChatContext } from '@/engine/adapters/models/context.model.js';
import { Role } from '@/engine/constants/role.constants.js';

export const config = {
  name: 'example_command',
  aliases: [] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'John Lester',
  description: 'Example command',
  category: 'Example',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
};

export const onCommand = async ({ chat }: { chat: ChatContext }) => {
  // chat.replyMessage threads the response as a quote-reply to the triggering message
  await chat.replyMessage({
    message: 'Hello',
  });
};
