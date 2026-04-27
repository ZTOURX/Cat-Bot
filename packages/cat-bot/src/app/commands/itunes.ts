/**
 * /itunes — iTunes Track Lookup
 *
 * Fetches track data from the PopCat /v2/itunes endpoint and displays it
 * as a formatted card. The album thumbnail is sent as an attachment_url.
 *
 * Usage: !itunes <song or artist name>
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

export const config: CommandConfig = {
  name: 'itunes',
  aliases: ['apple', 'applemusic'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Look up a track on iTunes / Apple Music.',
  category: 'utility',
  usage: '<track or artist name>',
  cooldown: 5,
  hasPrefix: true,
};

export const onCommand = async ({ chat, args, usage }: AppCtx): Promise<void> => {
  const query = args.join(' ').trim();
  if (!query) return usage();

  try {
    const base = createUrl('popcat', '/v2/itunes');
    if (!base) throw new Error('Failed to build iTunes API URL.');

    const res = await fetch(`${base}?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const json = await res.json() as {
      error: boolean;
      message: {
        url: string;
        name: string;
        artist: string;
        album: string;
        release_date: string;
        price: string;
        length: string;
        genre: string;
        thumbnail: string;
      };
    };

    if (json.error) throw new Error('Track not found or API returned an error.');

    const m = json.message;

    // Convert raw seconds string (e.g. "352s") to mm:ss
    const rawSeconds = parseInt(m.length, 10);
    const duration = isNaN(rawSeconds)
      ? m.length
      : `${Math.floor(rawSeconds / 60)}:${String(rawSeconds % 60).padStart(2, '0')}`;

    const lines = [
      `🎵 **${m.name}**`,
      `👤 ${m.artist}  ·  💿 ${m.album}`,
      ``,
      `🎼 Genre: **${m.genre}**`,
      `📅 Released: **${m.release_date}**`,
      `⏱️ Duration: **${duration}**`,
      `💰 Price: **${m.price}**`,
      `🔗 ${m.url}`,
    ].join('\n');

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: lines,
      attachment_url: [{ name: `${m.name}.jpg`, url: m.thumbnail }],
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};