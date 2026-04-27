/**
 * /shoti — Random TikTok Girl Video
 *
 * Fetches a random TikTok girl video from the BetaDash Shoti API and sends
 * it as a Buffer attachment. A "More Shoti" button swaps the video in-place
 * on every click without spamming new messages.
 *
 * ⚠️  `createUrl` registry name 'betadash' is assumed — confirm with the
 *     Cat Bot engine team that this registry key exists.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';
import { createUrl } from '@/engine/utils/api.util.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShotiResult {
  author: string;
  title: string;
  cover_image: string;
  shotiurl: string;
  cover: string;
  username: string;
  nickname: string;
  duration: number;
  region: string;
  total_vids: number;
}

interface ShotiResponse {
  status: boolean;
  result: ShotiResult;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchShoti(): Promise<{ data: ShotiResult; buffer: Buffer }> {
  const base = createUrl('betadash', '/shoti');
  if (!base) throw new Error('Failed to build Shoti API URL.');

  const metaRes = await fetch(base);
  if (!metaRes.ok) throw new Error(`Shoti API responded with status ${metaRes.status}`);

  const json = (await metaRes.json()) as ShotiResponse;
  if (!json.status || !json.result) {
    throw new Error('Shoti API returned an unsuccessful response.');
  }

  const data = json.result;

  const videoRes = await fetch(data.shotiurl);
  if (!videoRes.ok) throw new Error(`Failed to download video (status ${videoRes.status})`);

  const buffer = Buffer.from(await videoRes.arrayBuffer());
  return { data, buffer };
}

function buildCaption(data: ShotiResult, count: number): string {
  const title = data.title?.trim() || 'TikTok Shoti';
  return [
    `🎬 **${title}**`,
    ``,
    `👤 **${data.nickname}** (@${data.username})`,
    `⏱️ Duration: **${data.duration}s**`,
    `🌏 Region: **${data.region}**`,
    `🎞️ Total Videos: **${data.total_vids.toLocaleString()}**`,
    ``,
    `_Shoti #${count}_`,
  ].join('\n');
}

// ── Command Config ────────────────────────────────────────────────────────────

export const config: CommandConfig = {
  name: 'shoti',
  aliases: ['sg', 'tiktokgirl'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Get a random TikTok girl video.',
  category: 'fun',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
};

// ── Button Definitions ────────────────────────────────────────────────────────

const BUTTON_ID = { more: 'more' } as const;

export const button = {
  [BUTTON_ID.more]: {
    label: '🔁 More Shoti',
    style: ButtonStyle.PRIMARY,

    onClick: async ({ chat, event, button: btn, session }: AppCtx): Promise<void> => {
      const prevCount = (session.context['count'] as number | undefined) ?? 1;
      const newCount = prevCount + 1;

      try {
        const { data, buffer } = await fetchShoti();

        btn.update({ id: session.id, label: `🔁 More Shoti (${newCount})` });
        btn.createContext({ id: session.id, context: { count: newCount } });

        await chat.editMessage({
          message_id_to_edit: event['messageID'] as string,
          style: MessageStyle.MARKDOWN,
          message: buildCaption(data, newCount),
          attachment: [{ name: 'shoti.mp4', stream: buffer }],
          button: [session.id],
        });
      } catch (err) {
        const error = err as { message?: string };
        await chat.replyMessage({
          style: MessageStyle.MARKDOWN,
          message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
        });
      }
    },
  },
};

// ── Command Handler ───────────────────────────────────────────────────────────

export const onCommand = async ({ chat, button: btn }: AppCtx): Promise<void> => {
  try {
    const { data, buffer } = await fetchShoti();

    const moreId = btn.generateID({ id: BUTTON_ID.more, public: true });
    btn.update({ id: moreId, label: '🔁 More Shoti' });
    btn.createContext({ id: moreId, context: { count: 1 } });

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: buildCaption(data, 1),
      attachment: [{ name: 'shoti.mp4', stream: buffer }],
      button: [moreId],
    });
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};