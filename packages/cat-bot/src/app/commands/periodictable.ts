/**
 * /periodictable — Periodic Table Element Lookup
 *
 * Fetches element data from the PopCat /v2/periodic-table endpoint by name
 * or symbol, then displays an info card with the element image.
 *
 * Usage: !periodictable <element name or symbol>
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ElementMessage {
  name: string;
  symbol: string;
  atomic_number: number;
  atomic_mass: number;
  period: number;
  phase: string;
  discovered_by: string;
  image: string;
  summary: string;
}

// ── Command Config ────────────────────────────────────────────────────────────

export const config: CommandConfig = {
  name: 'periodictable',
  aliases: ['element', 'pt'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Look up an element on the periodic table.',
  category: 'utility',
  usage: '<element name or symbol>',
  cooldown: 5,
  hasPrefix: true,
};

// ── Formatter ─────────────────────────────────────────────────────────────────

function buildElementCard(m: ElementMessage): string {
  return [
    `⚗️ **${m.name} (${m.symbol})**`,
    ``,
    `🔢 Atomic Number: **${m.atomic_number}**`,
    `⚖️ Atomic Mass: **${m.atomic_mass}**`,
    `📅 Period: **${m.period}**`,
    `🧪 Phase: **${m.phase}**`,
    `🔍 Discovered By: **${m.discovered_by}**`,
    ``,
    `📝 ${m.summary}`,
  ].join('\n');
}

// ── Command Handler ───────────────────────────────────────────────────────────

export const onCommand = async ({ chat, args, usage }: AppCtx): Promise<void> => {
  const element = args.join(' ').trim();
  if (!element) return usage();

  try {
    const base = createUrl('popcat', '/v2/periodic-table');
    if (!base) throw new Error('Failed to build Periodic Table API URL.');

    const res = await fetch(`${base}?element=${encodeURIComponent(element)}`);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const json = await res.json() as { error: boolean; message: ElementMessage };
    if (json.error) throw new Error('Element not found or API returned an error.');

    const m = json.message;

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: buildElementCard(m),
      attachment_url: [{ name: `${m.name}.png`, url: m.image }],
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};