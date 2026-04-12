/**
 * Edits the body of a bot-sent Discord message.
 * Only the bot's own messages are editable — attempting to edit another user's
 * message will throw a DiscordAPIError with code 50005.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  escapeMarkdown,
  type MessageEditOptions,
  type TextChannel,
} from 'discord.js';
import type { EditMessageOptions } from '@/engine/adapters/models/api.model.js';

export async function editMessage(
  channel: TextChannel,
  messageID: string,
  options: string | EditMessageOptions,
): Promise<void> {
  if (!channel) throw new Error('Channel not available for editing.');
  // No direct channel.editMessage() in discord.js — must fetch the Message object first
  const msg = await channel.messages.fetch(messageID);

  // Safely extract the text string from both string and unified SendPayload shapes —
  // SendPayload.message may itself be a nested object when callers forward raw payloads.
  let content: string;
  if (typeof options === 'string') {
    content = options;
  } else {
    const rawMsg = options.message;
    content =
      typeof rawMsg === 'string'
        ? rawMsg
        : ((rawMsg as { message?: string } | undefined)?.message ??
          (rawMsg as { body?: string } | undefined)?.body ??
          '');
  }

  const style = typeof options === 'object' ? options.style : undefined;
  const finalContent = style === 'text' ? escapeMarkdown(content) : content;

  // Use discord.js MessageEditOptions for type-safe payload construction —
  // replaces the previous Record<string,unknown> cast to Parameters<typeof msg.edit>[0]
  // which silently bypassed TypeScript's structural checks on the discord.js API surface.
  const payload: MessageEditOptions = { content: finalContent };
  const button = typeof options === 'object' ? options.button : undefined;

  // Convert Unified ButtonItems into Discord ActionRowBuilders.
  // Explicit undefined check (not truthiness) so an empty array [] correctly clears
  // all components — `if ([])` is truthy but the intent is "caller provided buttons".
  if (button !== undefined) {
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (button.length > 0) {
      const STYLE_MAP: Record<string, ButtonStyle> = {
        primary: ButtonStyle.Primary,
        secondary: ButtonStyle.Secondary,
        success: ButtonStyle.Success,
        danger: ButtonStyle.Danger,
      };
      for (let i = 0; i < button.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (const btn of button.slice(i, i + 5)) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(btn.id)
              .setLabel(btn.label)
              .setStyle(
                STYLE_MAP[btn.style ?? 'secondary'] ?? ButtonStyle.Secondary,
              ),
          );
        }
        components.push(row);
      }
    }
    payload.components = components;
  }

  await msg.edit(payload);
}
