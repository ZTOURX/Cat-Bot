/**
 * /imdb — IMDb Movie / Show Lookup
 *
 * Fetches film or series data from the PopCat /v2/imdb endpoint and displays
 * it as a formatted card. The poster is sent as an attachment_url so the
 * engine downloads it before sending.
 *
 * Usage: !imdb <title>
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImdbRating {
  source: string;
  value: string;
}

interface ImdbMessage {
  title: string;
  year: number;
  rated: string;
  released: string;
  runtime: string;
  genres: string;
  director: string;
  writer: string;
  actors: string;
  plot: string;
  languages: string;
  country: string;
  awards: string;
  poster: string;
  rating: number;
  votes: string;
  imdbid: string;
  type: string;
  boxoffice: string;
  imdburl: string;
  ratings: ImdbRating[];
  series: boolean;
}

// ── Command Config ────────────────────────────────────────────────────────────

export const config: CommandConfig = {
  name: 'imdb',
  aliases: ['movie', 'film'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Look up a movie or show on IMDb.',
  category: 'utility',
  usage: '<title>',
  cooldown: 5,
  hasPrefix: true,
};

// ── Command Handler ───────────────────────────────────────────────────────────

export const onCommand = async ({
  chat,
  args,
  usage,
}: AppCtx): Promise<void> => {
  const query = args.join(' ').trim();
  if (!query) return usage();

  try {
    const base = createUrl('popcat', '/v2/imdb');
    if (!base) throw new Error('Failed to build IMDb API URL.');

    const res = await fetch(`${base}?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const json = (await res.json()) as { error: boolean; message: ImdbMessage };
    if (json.error)
      throw new Error('Title not found or API returned an error.');

    const m = json.message;

    const released = m.released ? new Date(m.released).toDateString() : 'N/A';

    // Build ratings line from the ratings array
    const ratingsLine = m.ratings
      .map((r) => `${r.source}: **${r.value}**`)
      .join(' · ');

    const lines = [
      `🎬 **${m.title}** (${m.year}) · _${m.type.charAt(0).toUpperCase() + m.type.slice(1)}_`,
      ``,
      `📝 ${m.plot}`,
      ``,
      `⭐ ${ratingsLine}`,
      `🗳️ IMDb Votes: **${m.votes}**`,
      ``,
      `🎭 Genre: **${m.genres}**`,
      `⏱️ Runtime: **${m.runtime}**`,
      `📅 Released: **${released}**`,
      `🔞 Rated: **${m.rated}**`,
      ``,
      `🎬 Director: **${m.director}**`,
      `✍️ Writer: **${m.writer}**`,
      `🌟 Actors: **${m.actors}**`,
      ``,
      m.boxoffice && m.boxoffice !== 'N/A'
        ? `💰 Box Office: **${m.boxoffice}**`
        : null,
      m.awards && m.awards !== 'N/A' ? `🏆 ${m.awards}` : null,
      `🔗 ${m.imdburl}`,
    ]
      .filter((l) => l !== null)
      .join('\n');

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: lines,
      attachment_url: [{ name: `${m.title}.jpg`, url: m.poster }],
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};
