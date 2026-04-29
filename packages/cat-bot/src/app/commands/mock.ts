/**
 * /mock — Mock Text (No API)
 *
 * Converts the input text into alternating-caps mocking style entirely
 * locally — no external API call is made. Punctuation, spaces, and numbers
 * are preserved as-is; only alphabetic characters alternate between lower
 * and upper case.
 *
 * The alternation counter only advances on letters so that spaces and
 * punctuation don't disrupt the pattern (e.g. "hello world" →
 * "hElLo wOrLd" rather than "hElLo WoRlD").
 *
 * Usage: !mock <text>
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

// ── Command Config ────────────────────────────────────────────────────────────

export const config: CommandConfig = {
  name: 'mock',
  aliases: ['mocking'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Convert text into alternating-caps mocking style.',
  category: 'fun',
  usage: '<text>',
  cooldown: 3,
  hasPrefix: true,
};

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Converts a string to alternating-caps mock style.
 * Only alphabetic characters advance the alternation counter,
 * so spaces and punctuation never break the pattern.
 */
function toMockText(input: string): string {
  let letterIndex = 0;
  return input
    .split('')
    .map((char) => {
      if (!/[a-zA-Z]/.test(char)) return char;
      const mocked =
        letterIndex % 2 === 0 ? char.toLowerCase() : char.toUpperCase();
      letterIndex++;
      return mocked;
    })
    .join('');
}

// ── Command Handler ───────────────────────────────────────────────────────────

export const onCommand = async ({
  chat,
  args,
  usage,
}: AppCtx): Promise<void> => {
  const text = args.join(' ').trim();
  if (!text) return usage();

  const mocked = toMockText(text);

  await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: `${mocked}`,
  });
};
