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
import type { OnChatCtx, OnCommandCtx } from '@/engine/types/middleware.types.js';
import { findSimilarCommand } from '@/engine/utils/command-suggest.util.js';
import { OptionsMap } from '@/engine/lib/options-map.lib.js';
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
  const args = body.trim().split(/\s+/).filter(Boolean);

  let isCommandInvocation = false;
  let parsed: import('@/engine/types/controller.types.js').ParsedCommand | undefined;
  let mod: import('@/engine/types/controller.types.js').CommandModule | undefined;

  // Prefix commands vs. Prefix-less commands
  if (body.startsWith(prefix)) {
    isCommandInvocation = true;
    parsed = parseCommand(args, prefix) ?? undefined;
    if (parsed) mod = commands.get(parsed.name);
  } else if (args.length > 0) {
    const firstToken = args[0]!.toLowerCase();
    const noPrefixMod = commands.get(firstToken);
    const noPrefixCfg = noPrefixMod?.['config'] as Record<string, unknown> | undefined;
    if (noPrefixCfg?.['hasPrefix'] === false) {
      isCommandInvocation = true;
      parsed = { name: firstToken, args: args.slice(1) };
      mod = noPrefixMod;
    }
  }

  // Intercept valid invocations and unrecognized prefix sequences for onCommand middleware execution
  if (isCommandInvocation) {
    const commandCtx: OnCommandCtx = {
      ...baseCtx,
      parsed,
      prefix,
      mod,
      options: OptionsMap.empty(),
    };

    await runMiddlewareChain<OnCommandCtx>(
      middlewareRegistry.getOnCommand(),
      commandCtx,
      async () => {
        // Handle raw prefixes that result in no resolvable command after parsing
        if (!commandCtx.parsed && body.startsWith(prefix)) {
          await chat.replyMessage({ message: `Type ${prefix}help for available commands.` });
          return;
        }
        if (!commandCtx.parsed) return;

        const p = commandCtx.parsed;
        const m = commandCtx.mod;

        if (!m) {
          const disabledNames = await getDisabledNamesForSession(native);
          const suggestion = findSimilarCommand(p.name, commands, disabledNames);
          await chat.replyMessage({
            message: suggestion
              ? `No command "${p.name}" found. Did you mean "${suggestion}"?`
              : `No command "${p.name}" found. Type ${prefix}help for available commands.`,
          });
          return;
        }

        const matchedCfg = m['config'] as { name?: string } | undefined;
        const canonicalName = (matchedCfg?.name ?? p.name).toLowerCase();
        const sessionUserId = native.userId ?? '';
        const sessionId = native.sessionId ?? '';

        if (sessionUserId && sessionId) {
          const enabled = await isCommandEnabled(sessionUserId, native.platform, sessionId, canonicalName);
          if (!enabled) {
            const disabledNames = await getDisabledNamesForSession(native);
            disabledNames.add(canonicalName);
            const suggestion = findSimilarCommand(p.name, commands, disabledNames);
            await chat.replyMessage({
              message: suggestion
                ? `No command "${p.name}" found. Did you mean "${suggestion}"?`
                : `No command "${p.name}" found. Type ${prefix}help for available commands.`,
            });
            return;
          }
        }

        await dispatchCommand(commands, p, commandCtx, api, event['threadID'] as string, prefix);
      }
    );
  }
}
