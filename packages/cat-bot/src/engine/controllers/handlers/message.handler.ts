/**
 * Message Handler — main entry point for all incoming messages.
 *
 * Orchestrates the message pipeline in strict order:
 *   1. onChat fan-out (passive middleware like logging)
 *   2. onReply state check (continuing a conversation flow)
 *   3. Prefix parsing + command dispatch (new command execution)
 *
 * Steps 1–2 run before any prefix check so reply flows are never blocked
 * by a user forgetting the prefix.
 */

import type {
  BaseCtx,
  CommandMap,
  EventModuleMap,
  NativeContext,
} from '@/engine/types/controller.types.js';
import type { UnifiedApi } from '@/engine/adapters/models/api.model.js';
import {
  createThreadContext,
  createChatContext,
  createBotContext,
  createUserContext,
} from '@/engine/adapters/models/context.model.js';
import { createLogger } from '@/engine/lib/logger.lib.js';
import { runOnChat } from '../on-chat-runner.js';
import { dispatchOnReply } from '../dispatchers/reply.dispatcher.js';
import { dispatchCommand } from '../dispatchers/command.dispatcher.js';
import { parseCommand } from '@/engine/utils/command-parser.util.js';
import {
  middlewareRegistry,
  runMiddlewareChain,
} from '@/engine/lib/middleware.lib.js';
import type { OnChatCtx } from '@/engine/types/middleware.types.js';
import { findSimilarCommand } from '@/engine/utils/command-suggest.util.js';
import { isCommandEnabled, findSessionCommands } from '@/engine/repos/bot-session-commands.repo.js';
import { PLATFORM_TO_ID } from '@/engine/constants/platform.constants.js';

/**
 * Returns the set of command names disabled by the bot admin for this session.
 *
 * Only invoked on the rare "unknown / disabled command" code path — never on every
 * message. An empty set is returned on DB error (fail-open) so "did you mean?"
 * suggestions continue to function even when the DB is temporarily unreachable.
 */
async function getDisabledNamesForSession(native: NativeContext): Promise<Set<string>> {
  const sessionUserId = native.userId ?? '';
  const sessionId = native.sessionId ?? '';
  if (!sessionUserId || !sessionId) return new Set();
  try {
    const rows = await findSessionCommands(sessionUserId, native.platform, sessionId);
    return new Set(rows.filter((r: { isEnable: boolean; commandName: string }) => !r.isEnable).map((r: { commandName: string }) => r.commandName));
  } catch {
    // Fail-open: suggestions still function without disabled-command filtering on DB error
    return new Set();
  }
}

/**
 * Main entry point for incoming messages.
 * - Runs onChat for all commands (passive middleware)
 * - Checks for pending onReply states before command dispatch
 * - If message starts with prefix, parses and dispatches command
 */
export async function handleMessage(
  api: UnifiedApi,
  event: Record<string, unknown>,
  commands: CommandMap,
  eventModules: EventModuleMap,
  prefix: string,
  native: NativeContext = { platform: 'unknown' },
): Promise<void> {
  const thread = createThreadContext(api, event);
  const chat = createChatContext(api, event);
  const bot = createBotContext(api);
  const user = createUserContext(api);
  // Inject session-scoped logger so command modules have direct access to correlation context
  const logger = createLogger({
    userId: native.userId ?? '',
    platformId: (PLATFORM_TO_ID as Record<string, number>)[native.platform] ?? native.platform,
    sessionId: native.sessionId ?? '',
  });
  const baseCtx: BaseCtx = {
    api,
    event,
    commands,
    prefix,
    thread,
    chat,
    bot,
    user,
    native,
    logger,
  };

  // Run global onChat middleware chain before the module fan-out — cross-cutting
  // concerns (rate limiting, audit logging, spam detection) intercept every message
  // here before individual command modules' onChat handlers process it.
  await runMiddlewareChain<OnChatCtx>(
    middlewareRegistry.getOnChat(),
    baseCtx,
    () => runOnChat(commands, baseCtx),
  );

  // Check for a registered onReply state BEFORE prefix parsing — a user quoting a pending
  // bot message is continuing a conversation flow, not issuing a new command.
  const messageReply = event['messageReply'] as
    | Record<string, unknown>
    | undefined;
  if (messageReply?.['messageID']) {
    const handled = await dispatchOnReply(commands, event, baseCtx);
    if (handled) return;
  }

  const body = (event['message'] ?? event['body'] ?? '') as string;
  if (!body.startsWith(prefix)) {
    // hasPrefix: false — allows a command to be invoked without the prefix character.
    // The prefix check lives here at the routing layer because the early return fires
    // before the dispatcher is ever reached; there is nowhere inside on-command.middleware
    // that could intercept a no-prefix message that has already been discarded.
    const tokens = body.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const firstToken = tokens[0]!.toLowerCase();
      const noPrefixMod = commands.get(firstToken);
      const noPrefixCfg = noPrefixMod?.['config'] as
        | Record<string, unknown>
        | undefined;
      if (noPrefixCfg?.['hasPrefix'] === false) {
        await dispatchCommand(
          commands,
          { name: firstToken, args: tokens.slice(1) },
          baseCtx,
          api,
          event['threadID'] as string,
          prefix,
        );
      }
    }
    return;
  }

  const args = body.trim().split(/\s+/).filter(Boolean);
  const parsed = parseCommand(args, prefix);
  if (!parsed) {
    await chat.replyMessage({
      message: `Type ${prefix}help for available commands.`,
    });
    return;
  }

  // Exact-match check. Disabled commands are excluded from the suggestion pool
  // so they are invisible to users — same UX as a command that was never installed.
  if (!commands.has(parsed.name)) {
    const disabledNames = await getDisabledNamesForSession(native);
    const suggestion = findSimilarCommand(parsed.name, commands, disabledNames);
    await chat.replyMessage({
      message: suggestion
        ? `No command "${parsed.name}" found. Did you mean "${suggestion}"?`
        : `No command "${parsed.name}" found. Type ${prefix}help for available commands.`,
    });
    return;
  }

  // Disabled commands are treated as non-existent: bot admins can hide commands without
  // surfacing an explicit "disabled" error that would reveal the command's existence.
  // The disabled-names set is fetched here so suggestions exclude both the typed command
  // and any other hidden commands the admin has suppressed for this session.
  const matchedMod = commands.get(parsed.name)!;
  const matchedCfg = matchedMod['config'] as { name?: string } | undefined;
  const canonicalName = (matchedCfg?.name ?? parsed.name).toLowerCase();
  const sessionUserId = native.userId ?? '';
  const sessionId = native.sessionId ?? '';
  if (sessionUserId && sessionId) {
    const enabled = await isCommandEnabled(sessionUserId, native.platform, sessionId, canonicalName);
    if (!enabled) {
      const disabledNames = await getDisabledNamesForSession(native);
      // Always add the typed command itself — isCommandEnabled may race with findSessionCommands
      disabledNames.add(canonicalName);
      const suggestion = findSimilarCommand(parsed.name, commands, disabledNames);
      await chat.replyMessage({
        message: suggestion
          ? `No command "${parsed.name}" found. Did you mean "${suggestion}"?`
          : `No command "${parsed.name}" found. Type ${prefix}help for available commands.`,
      });
      return;
    }
  }

  await dispatchCommand(
    commands,
    parsed,
    baseCtx,
    api,
    event['threadID'] as string,
    prefix,
  );
}
