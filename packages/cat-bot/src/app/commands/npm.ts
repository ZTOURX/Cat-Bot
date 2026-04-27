/**
 * /npm — NPM Package Lookup
 *
 * Fetches package data from the PopCat /v2/npm endpoint and displays it
 * as a formatted info card.
 *
 * Usage: !npm <package name>
 *
 * ⚠️  `createUrl` registry name 'popcat' is assumed.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

export const config: CommandConfig = {
  name: 'npm',
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Look up an NPM package.',
  category: 'utility',
  usage: '<package name>',
  cooldown: 5,
  hasPrefix: true,
};

export const onCommand = async ({ chat, args, usage }: AppCtx): Promise<void> => {
  const query = args.join(' ').trim();
  if (!query) return usage();

  try {
    const base = createUrl('popcat', '/v2/npm');
    if (!base) throw new Error('Failed to build NPM API URL.');

    const res = await fetch(`${base}?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const json = await res.json() as {
      error: boolean;
      message: {
        name: string;
        version: string;
        description: string;
        keywords: string;
        author: string;
        author_email: string;
        last_published: string;
        maintainers: string;
        repository: string;
        downloads_this_year: string;
      };
    };

    if (json.error) throw new Error('Package not found or API returned an error.');

    const m = json.message;

    const lines = [
      `📦 **${m.name}** v${m.version}`,
      ``,
      `📝 ${m.description}`,
      m.keywords !== 'None' ? `🏷️ Keywords: \`${m.keywords}\`` : null,
      ``,
      `👤 Author: **${m.author}**${m.author_email !== 'None' ? ` (${m.author_email})` : ''}`,
      `🔧 Maintainers: **${m.maintainers}**`,
      `📅 Last Published: **${m.last_published}**`,
      `📥 Downloads (year): **${m.downloads_this_year}**`,
      m.repository !== 'None' ? `🔗 ${m.repository}` : null,
    ].filter(l => l !== null).join('\n');

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: lines,
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};