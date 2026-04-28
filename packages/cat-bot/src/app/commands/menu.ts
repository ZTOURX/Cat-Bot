/**
 * /menu — Category-Based Command Browser
 *
 * Alternative to /help. Presents all commands grouped by category.
 *
 * Flow — button platforms (Discord, Telegram):
 *   1. /menu → Category list with one button per category in a 2-column grid
 *   2. [Category button] → Category detail with a ◀️ Back button
 *   3. [Back button] → Returns to category list in-place
 *
 * Flow — reply platforms (Facebook Messenger, Facebook Page):
 *   1. /menu → Numbered category list; bot message ID is registered with state
 *   2. User replies to bot's message with a number → Category detail is sent
 *      and a NEW numbered category list is sent with its own state registered
 *   3. User can reply to the latest numbered list at any time (unlimited)
 *
 * Filtering: mirrors /help exactly —
 *   • Commands disabled via the dashboard are hidden
 *   • Commands restricted to other platforms are hidden
 *   • Commands whose role level exceeds the invoker's privileges are hidden
 *
 * prefix is always sourced from AppCtx — it is the live session prefix set by
 * the bot admin and is never hardcoded.
 */

import type { CommandMap, AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { findSessionCommands } from '@/engine/modules/session/bot-session-commands.repo.js';
import { isPlatformAllowed } from '@/engine/modules/platform/platform-filter.util.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';
import { hasNativeButtons } from '@/engine/utils/ui-capabilities.util.js';
import { Platforms } from '@/engine/modules/platform/platform.constants.js';
import { isThreadAdmin } from '@/engine/repos/threads.repo.js';
import { isBotAdmin, isBotPremium } from '@/engine/repos/credentials.repo.js';
import { isSystemAdmin } from '@/engine/repos/system-admin.repo.js';
import type { CommandConfig } from '@/engine/types/module-config.types.js';

// ── Config ────────────────────────────────────────────────────────────────────

export const config: CommandConfig = {
  name: 'menu',
  aliases: ['commands', 'cmds'] as string[],
  version: '2.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Browse all commands by category.',
  category: 'Info',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
};

// ── State keys (reply-nav platforms only) ─────────────────────────────────────

const STATE = {
  awaiting_category: 'awaiting_category',
} as const;

// ── Platform helper ───────────────────────────────────────────────────────────

/**
 * Returns true for platforms that do not support native buttons and must use
 * the numbered-reply navigation flow instead.
 */
function isReplyNavPlatform(platform: string): boolean {
  return (
    platform === Platforms.FacebookMessenger ||
    platform === Platforms.FacebookPage
  );
}

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Converts any category text into a clean Title Case display label. */
function formatCategory(value: string): string {
  const cleaned = String(value ?? 'Uncategorized')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return 'Uncategorized';
  return cleaned
    .split(' ')
    .map((word) =>
      word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word,
    )
    .join(' ');
}

/** Normalized key for case-insensitive category grouping. */
function categoryKey(value: string): string {
  return String(value ?? 'Uncategorized')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Chunks a flat array into rows of `size` for the 2-column button grid. */
function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    rows.push(arr.slice(i, i + size));
  }
  return rows;
}

// ── Filtering ─────────────────────────────────────────────────────────────────

async function buildDisabledNames(
  commands: CommandMap,
  native: AppCtx['native'],
  event: Record<string, unknown>,
): Promise<Set<string>> {
  const disabledNames = new Set<string>();
  const sessionUserId = native.userId ?? '';
  const sessionId = native.sessionId ?? '';

  // 1 — Dashboard-disabled commands
  if (sessionUserId && sessionId) {
    try {
      const rows = await findSessionCommands(
        sessionUserId,
        native.platform,
        sessionId,
      );
      for (const r of rows as { isEnable: boolean; commandName: string }[]) {
        if (!r.isEnable) disabledNames.add(r.commandName);
      }
    } catch {
      // Fail-open: DB unreachable — show everything
    }
  }

  // 2 — Platform-restricted commands
  for (const mod of commands.values()) {
    const cfg = mod['config'] as Record<string, unknown> | undefined;
    const name = (cfg?.['name'] as string | undefined)?.toLowerCase();
    if (name && !isPlatformAllowed(mod, native.platform)) {
      disabledNames.add(name);
    }
  }

  // 3 — Role-gated commands
  const senderID = (event['senderID'] ?? event['userID'] ?? '') as string;
  const threadID = (event['threadID'] ?? '') as string;
  const accessibleRoles = new Set<number>([Role.ANYONE]);

  if (sessionUserId && sessionId && senderID) {
    try {
      const isSysAdmin = await isSystemAdmin(senderID);
      if (isSysAdmin) {
        accessibleRoles.add(Role.THREAD_ADMIN);
        accessibleRoles.add(Role.BOT_ADMIN);
        accessibleRoles.add(Role.PREMIUM);
        accessibleRoles.add(Role.SYSTEM_ADMIN);
      } else {
        const isAdmin = await isBotAdmin(sessionUserId, native.platform, sessionId, senderID);
        if (isAdmin) {
          accessibleRoles.add(Role.THREAD_ADMIN);
          accessibleRoles.add(Role.BOT_ADMIN);
          accessibleRoles.add(Role.PREMIUM);
        } else {
          const isPremium = await isBotPremium(sessionUserId, native.platform, sessionId, senderID);
          if (isPremium) {
            accessibleRoles.add(Role.THREAD_ADMIN);
            accessibleRoles.add(Role.PREMIUM);
          } else if (threadID) {
            const isThreadAdm = await isThreadAdmin(threadID, senderID);
            if (isThreadAdm) accessibleRoles.add(Role.THREAD_ADMIN);
          }
        }
      }
    } catch {
      // Fail-open: default to ANYONE access
    }
  }

  for (const mod of commands.values()) {
    const cfg = mod['config'] as Record<string, unknown> | undefined;
    const name = (cfg?.['name'] as string | undefined)?.toLowerCase();
    const cmdRole = Number((cfg?.['role'] as number | undefined) ?? Role.ANYONE);
    if (name && !accessibleRoles.has(cmdRole)) disabledNames.add(name);
  }

  return disabledNames;
}

/** Deduplicated, alphabetically-sorted visible command modules. */
function getVisibleMods(
  commands: CommandMap,
  disabledNames: Set<string>,
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const result: Array<Record<string, unknown>> = [];

  for (const mod of commands.values()) {
    const cfg = mod['config'] as Record<string, unknown> | undefined;
    const name = (cfg?.['name'] as string | undefined)?.toLowerCase();
    if (!name || seen.has(name) || disabledNames.has(name)) continue;
    seen.add(name);
    result.push(mod);
  }

  result.sort((a, b) => {
    const an = String((a['config'] as Record<string, unknown> | undefined)?.['name'] ?? '');
    const bn = String((b['config'] as Record<string, unknown> | undefined)?.['name'] ?? '');
    return an.localeCompare(bn);
  });

  return result;
}

/** Groups visible modules by category, case-insensitive. */
function groupByCategory(
  mods: Array<Record<string, unknown>>,
): Array<[string, Array<Record<string, unknown>>]> {
  const map = new Map<string, { label: string; mods: Array<Record<string, unknown>> }>();

  for (const mod of mods) {
    const cfg = mod['config'] as Record<string, unknown> | undefined;
    const rawCategory = String(cfg?.['category'] ?? 'Uncategorized');
    const key = categoryKey(rawCategory);
    const label = formatCategory(rawCategory);
    const entry = map.get(key);
    if (!entry) {
      map.set(key, { label, mods: [mod] });
    } else {
      entry.mods.push(mod);
    }
  }

  return [...map.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ label, mods }) => [label, mods]);
}

// ── View: Category Detail (shared by both flows) ──────────────────────────────

/**
 * Builds the category detail lines used by both the button flow and the
 * reply-nav flow. Pure function — no side effects.
 */
function buildCategoryLines(
  catMods: Array<Record<string, unknown>>,
  targetCategory: string,
  prefix: string,
): string[] {
  const lines: string[] = [
    `**${targetCategory.toUpperCase()} COMMAND CENTER**`,
    ``,
  ];

  for (const mod of catMods) {
    const cfg = mod['config'] as Record<string, unknown> | undefined;
    const name = String(cfg?.['name'] ?? '');
    const desc = String(cfg?.['description'] ?? '');
    lines.push(`▫️ ${prefix}${name}`);
    lines.push(`  ↳ ${desc}`);
    lines.push(``);
  }

  lines.push(`💡 ${prefix}help <command> for details`);
  return lines;
}

// ── View: Category List — Button Platforms ────────────────────────────────────

async function renderCategoryList(ctx: AppCtx): Promise<void> {
  const { chat, commands, native, event, button, prefix = '' } = ctx;

  const disabledNames = await buildDisabledNames(commands, native, event);
  const visibleMods = getVisibleMods(commands, disabledNames);
  const categories = groupByCategory(visibleMods);

  const flatButtonIds: string[] = [];
  for (const [cat] of categories) {
    const catId = button.generateID({ id: BUTTON_ID.cat, public: true });
    button.createContext({ id: catId, context: { category: cat } });
    button.update({
      id: catId,
      label: cat,
      style: ButtonStyle.PRIMARY,
    });
    flatButtonIds.push(catId);
  }

  const buttonGrid: string[][] = chunk(flatButtonIds, 2);

  const message = [
    `▫️ **Command Menu**`,
    ``,
    `Select a category below`,
    `💡 ${prefix}help <command> for command details`,
  ].join('\n');

  const payload = {
    style: MessageStyle.MARKDOWN,
    message,
    ...(buttonGrid.length > 0 ? { button: buttonGrid } : {}),
  };

  if (event['type'] === 'button_action') {
    await chat.editMessage({
      ...payload,
      message_id_to_edit: event['messageID'] as string,
    });
  } else {
    await chat.replyMessage(payload);
  }
}

// ── View: Category Commands — Button Platforms ────────────────────────────────

async function renderCategoryCommands(
  ctx: AppCtx,
  category: string,
): Promise<void> {
  const { chat, commands, native, event, button, prefix = '' } = ctx;

  const disabledNames = await buildDisabledNames(commands, native, event);
  const visibleMods = getVisibleMods(commands, disabledNames);
  const grouped = groupByCategory(visibleMods);

  const targetCategory = formatCategory(category);
  const catEntry = grouped.find(([cat]) => cat === targetCategory);

  if (!catEntry || catEntry[1].length === 0) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `**${targetCategory} COMMAND CENTER**\nNo visible commands in this category.`,
    });
    return;
  }

  const [, catMods] = catEntry;
  const lines = buildCategoryLines(catMods, targetCategory, prefix);

  const backId = button.generateID({ id: BUTTON_ID.back, public: true });
  const backGrid: string[][] = [[backId]];

  const payload = {
    style: MessageStyle.MARKDOWN,
    message: lines.join('\n'),
    button: backGrid,
  };

  if (event['type'] === 'button_action') {
    await chat.editMessage({
      ...payload,
      message_id_to_edit: event['messageID'] as string,
    });
  } else {
    await chat.replyMessage(payload);
  }
}

// ── View: Numbered Category List — Reply-Nav Platforms ────────────────────────

/**
 * Sends a numbered category list and registers a reply state keyed to the
 * returned message ID. The state context stores the ordered category name
 * array so onReply can map a user-typed number directly to a category.
 *
 * Called both from onCommand (first invocation) and from onReply (re-send
 * after each category selection) to create the unlimited-reply loop.
 */
async function sendNumberedCategoryList(ctx: AppCtx): Promise<void> {
  const { chat, commands, native, event, state, prefix = '' } = ctx;

  const disabledNames = await buildDisabledNames(commands, native, event);
  const visibleMods = getVisibleMods(commands, disabledNames);
  const categories = groupByCategory(visibleMods);

  const categoryNames = categories.map(([cat]) => cat);

  const lines: string[] = [
    `▫️ **Command Menu**`,
    ``,
    `Reply with a number to choose a category:`,
    ``,
    ...categoryNames.map((cat, i) => `${i + 1}. ${cat}`),
    ``,
    `💡 ${prefix}help <command> for details`,
  ];

  const messageID = await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: lines.join('\n'),
  });

  if (!messageID) return;

  // Register state so the user's reply to this specific message is routed here.
  // context.categories carries the ordered list so onReply can resolve the number
  // without re-computing the full category list.
  state.create({
    id: state.generateID({ id: String(messageID) }),
    state: STATE.awaiting_category,
    context: { categories: categoryNames },
  });
}

// ── View: Category Commands — Reply-Nav Platforms ─────────────────────────────

/**
 * Sends the category detail for reply-nav platforms (plain text, no buttons).
 * After sending the detail, re-sends the numbered category list and registers
 * a fresh state entry — this is the mechanism that makes the loop unlimited.
 */
async function sendCategoryCommandsForReplyNav(
  ctx: AppCtx,
  category: string,
): Promise<void> {
  const { chat, commands, native, event, prefix = '' } = ctx;

  const disabledNames = await buildDisabledNames(commands, native, event);
  const visibleMods = getVisibleMods(commands, disabledNames);
  const grouped = groupByCategory(visibleMods);

  const targetCategory = formatCategory(category);
  const catEntry = grouped.find(([cat]) => cat === targetCategory);

  if (!catEntry || catEntry[1].length === 0) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `**${targetCategory} COMMAND CENTER**\nNo visible commands in this category.`,
    });
  } else {
    const [, catMods] = catEntry;
    const lines = buildCategoryLines(catMods, targetCategory, prefix);
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: lines.join('\n'),
    });
  }

  // Re-send the numbered list and register new state — creates the unlimited loop.
  await sendNumberedCategoryList(ctx);
}

// ── Button definitions (button platforms only) ────────────────────────────────

const BUTTON_ID = { cat: 'cat', back: 'back' } as const;

export const button = {
  [BUTTON_ID.cat]: {
    label: 'Category',
    style: ButtonStyle.PRIMARY,
    onClick: async (ctx: AppCtx): Promise<void> => {
      const category = ctx.session.context['category'] as string | undefined;
      if (!category) return;
      await renderCategoryCommands(ctx, category);
    },
  },

  [BUTTON_ID.back]: {
    label: '◀️ Back',
    style: ButtonStyle.SECONDARY,
    onClick: async (ctx: AppCtx): Promise<void> => {
      await renderCategoryList(ctx);
    },
  },
};

// ── onReply (reply-nav platforms only) ───────────────────────────────────────

export const onReply = {
  /**
   * Fired when the user replies to the bot's numbered category list message.
   *
   * - Deletes the consumed state first so no stale entry remains.
   * - Parses the user's reply as a 1-based category index.
   * - Shows the category commands, then re-sends the numbered list with fresh
   *   state — this is what makes the loop unlimited.
   * - Invalid input (non-number, out-of-range) re-sends the menu with a hint
   *   rather than silently ignoring the reply.
   */
  [STATE.awaiting_category]: async (ctx: AppCtx): Promise<void> => {
    const { chat, event, state, session, prefix = '' } = ctx;

    const input = String(event['message'] ?? '').trim();
    const categoryNames = (session.context['categories'] as string[] | undefined) ?? [];

    // Consume the state before doing anything else — prevents a stale entry
    // from matching a second reply to the same message.
    state.delete(session.id);

    const num = parseInt(input, 10);

    if (isNaN(num) || num < 1 || num > categoryNames.length) {
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: `⚠️ Please reply with a number between 1 and ${categoryNames.length}.`,
      });
      // Re-send the menu so the user still has something to reply to.
      await sendNumberedCategoryList(ctx);
      return;
    }

    const selectedCategory = categoryNames[num - 1]!;
    await sendCategoryCommandsForReplyNav(ctx, selectedCategory);
  },
};

// ── Command entry point ───────────────────────────────────────────────────────

export const onCommand = async (ctx: AppCtx): Promise<void> => {
  try {
    if (isReplyNavPlatform(ctx.native.platform)) {
      await sendNumberedCategoryList(ctx);
    } else {
      await renderCategoryList(ctx);
    }
  } catch (err) {
    const error = err as { message?: string };
    await ctx.chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${error.message ?? 'Unknown error'}`,
    });
  }
};