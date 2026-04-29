/**
 * /lyrics — Song Lyrics Lookup
 *
 * Fetches song lyrics from the PopCat /v2/lyrics endpoint. Displays the
 * album art alongside the title and artist. If the lyrics exceed the safe
 * message length threshold, the art card and lyrics are sent as two separate
 * messages to avoid truncation.
 *
 * Usage: !lyrics <song name>
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed — confirm with the
 *     Cat Bot engine team that this registry key exists.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Maximum character count for lyrics before they are split into a second
 * message. Keeps the combined payload under platform message size limits.
 */
const LYRICS_SPLIT_THRESHOLD = 1000;

// ── Command Config ────────────────────────────────────────────────────────────

export const config: CommandConfig = {
  name: 'lyrics',
  aliases: ['lyric'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Look up lyrics for a song.',
  category: 'utility',
  usage: '<song name>',
  cooldown: 5,
  hasPrefix: true,
};

// ── Command Handler ───────────────────────────────────────────────────────────

export const onCommand = async ({
  chat,
  args,
  usage,
}: AppCtx): Promise<void> => {
  const song = args.join(' ').trim();
  if (!song) return usage();

  try {
    const base = createUrl('popcat', '/v2/lyrics');
    if (!base) throw new Error('Failed to build Lyrics API URL.');

    const apiUrl = `${base}?song=${encodeURIComponent(song)}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const json = (await res.json()) as {
      error: boolean;
      message: {
        title: string;
        image: string;
        artist: string;
        lyrics: string;
        url: string;
      };
    };

    if (json.error) throw new Error('Song not found or API returned an error.');

    const { title, image, artist, lyrics, url } = json.message;

    // Strip the contributor prefix Genius prepends (e.g. "15 ContributorsNobela Lyrics")
    const cleanLyrics = lyrics
      .replace(/^\d+\s+Contributors.+?Lyrics/s, '')
      .trim();

    const header = [`🎵 **${title}**`, `👤 ${artist}`, `🔗 ${url}`].join('\n');

    if (cleanLyrics.length <= LYRICS_SPLIT_THRESHOLD) {
      // ── Short lyrics: single message with art + full lyrics ──────────────
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: `${header}\n\n${cleanLyrics}`,
        attachment_url: [{ name: `${title}.png`, url: image }],
      });
    } else {
      // ── Long lyrics: art card first, then lyrics as a follow-up ──────────
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: header,
        attachment_url: [{ name: `${title}.png`, url: image }],
      });

      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: cleanLyrics,
      });
    }
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};
