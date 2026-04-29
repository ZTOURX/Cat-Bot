/**
 * claude.ts — Claude AI Chat (Lexcode API)
 *
 * Chat with Claude 3 Haiku via the Lexcode API endpoint.
 * Supports direct text input and replying to a quoted message.
 *
 * Usage:
 *   !claude apa itu evangelion?
 *   (reply to any message) !claude
 *
 * API provider:
 *   lexcode  /api/ai/claude-3-haiku
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

// ── Config ────────────────────────────────────────────────────────────────────

export const config: CommandConfig = {
  name: 'claude',
  aliases: ['cl', 'claudeai'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Chat with Claude 3 Haiku via the Lexcode API.',
  category: 'AI Chat',
  usage: '<your message>',
  cooldown: 5,
  hasPrefix: true,
};

// ── Response shape ────────────────────────────────────────────────────────────

interface LexcodeClaudeResponse {
  result: string;
}

// ── Command ───────────────────────────────────────────────────────────────────

export const onCommand = async ({
  args,
  chat,
  event,
  usage,
}: AppCtx): Promise<void> => {
  const directText = args.join(' ').trim();
  const quotedText = (
    (event['messageReply'] as Record<string, unknown> | undefined)?.[
      'message'
    ] as string | undefined
  )?.trim();

  const input = directText || quotedText;

  if (!input) return usage();

  // ── API call ───────────────────────────────────────────────────────────────
  const url = createUrl('lexcode', '/api/ai/claude-3-haiku', { prompt: input });
  if (!url) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '❌ Failed to build the Claude API request URL.',
    });
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const data = (await res.json()) as LexcodeClaudeResponse;
    if (!data?.result) throw new Error('API returned an empty response.');

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: data.result,
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `❌ **Claude API error.**\n\`${error.message ?? 'Unknown error'}\``,
    });
  }
};