/**
 * Telegram Platform Listener — Factory
 *
 * Creates an EventEmitter-based platform listener that wraps Telegraf.
 * Delegates each lifecycle step to a focused module:
 *   - types.ts          → TelegramConfig, TelegramEmitter, PLATFORM_ID
 *   - slash-commands.ts → Command menu registration across broadcast scopes
 *   - handlers.ts       → All Telegraf update handler registrations
 *
 * Lifecycle (per Telegraf docs — all handlers must be registered BEFORE launch):
 *   1. Construct Telegraf instance
 *   2. Register or clear slash command menu across all broadcast scopes
 *   3. Attach all update handlers (they emit typed events on the returned emitter)
 *   4. Call bot.launch() with allowedUpdates — polling starts here
 */
import { EventEmitter } from 'events';
import { Telegraf } from 'telegraf';
import { createLogger } from '@/engine/lib/logger.lib.js';
import type { TelegramConfig, TelegramEmitter } from './types.js';
import { registerSlashMenu } from './slash-commands.js';
import { attachHandlers } from './handlers.js';
import { sessionManager } from '@/engine/lib/session-manager.lib.js';
import { isAuthError } from '@/engine/lib/retry.lib.js';
import { PLATFORM_TO_ID, Platforms } from '@/engine/constants/platform.constants.js';

// Slash sync: register a re-registration callback so the dashboard toggle can update the live '/' menu
import { registerSlashSync, unregisterSlashSync } from '@/engine/lib/slash-sync.lib.js';
// Read enabled/disabled state from DB when the dashboard triggers a sync
import { findSessionCommands } from '@/engine/repos/bot-session-commands.repo.js';
import { prefixManager } from '@/engine/lib/prefix-manager.lib.js';

/**
 * Creates a Telegram platform listener.
 * Register .on() handlers on the returned emitter BEFORE calling start().
 */
export function createTelegramListener(
  config: TelegramConfig,
): TelegramEmitter {
  const emitter = new EventEmitter() as TelegramEmitter;
  let activeBot: Telegraf | null = null;

  // Retained across start() calls so the slash-sync closure always references the current commands Map
  let activeCommands: Map<string, Record<string, unknown>> | null = null;

  const sessionLogger = createLogger({
    userId: config.userId,
    platformId: PLATFORM_TO_ID[Platforms.Telegram],
    sessionId: config.sessionId,
  });

  emitter.start = async (
    commands: Map<string, Record<string, unknown>>,
  ): Promise<void> => {
    // Store for the slash-sync closure — captured by reference so restarts see the new commands Map
    activeCommands = commands;

    sessionLogger.info('[telegram] Starting Listener...');

    activeBot = new Telegraf(config.botToken);

    // Validate bot token with an explicit getMe() call before registering handlers or launching.
    // bot.launch() calls getMe internally as a fire-and-forget Promise — if it times out or returns
    // 401, the rejection escapes to app.ts's process.once('unhandledRejection') which crashes every
    // session. Calling getMe() here surfaces the error inside start() where withRetry can classify it:
    //   - ETIMEDOUT / network → rethrow → withRetry retries with backoff
    //   - HTTP 401 Unauthorized → rethrow → shouldRetry returns false → session goes offline
    try {
      await activeBot.telegram.getMe();
    } catch (err) {
      activeBot = null; // Release the instance — a fresh one is created on the next attempt
      throw err;        // Propagate so startSessionWithRetry's shouldRetry can classify it
    }

    // Step 1: Register or clear slash command menu across all broadcast scopes
    await registerSlashMenu(activeBot, commands, config.prefix, config.userId, config.sessionId, sessionLogger);

    // Step 2: Attach all update handlers — must happen before bot.launch()
    attachHandlers(
      activeBot,
      emitter,
      config.prefix,
      config.userId,
      config.sessionId,
    );

    // Catch errors thrown inside any Telegraf middleware or handler.
    // Without this, handler rejections surface as unhandled promise rejections
    // which crash Node ≥15 and take down every other platform session.
    // _ctx typed as unknown because callback_query / message contexts have different shapes.
    activeBot.catch((err: unknown, _ctx: unknown) => {
      sessionLogger.error('[telegram] Handler error (session continues)', { error: err });
    });

    // Step 3: Launch polling — starts only after all handlers are registered
    // Per https://telegraf.js.org/: "this should ideally be written before bot.launch()"
    activeBot.launch({
      // message_reaction and message_reaction_count are opt-in since Bot API 7.0 —
      // Telegram does not deliver them unless explicitly requested here.
      allowedUpdates: [
        'message',
        'message_reaction',
        'message_reaction_count',
        'callback_query',
      ],
    }).catch((err: unknown) => {
      // "Bot is stopped!" is emitted during graceful stop() — not an error condition.
      // All other errors are logged per-session so one failing account never brings down others.
      if (err instanceof Error && err.message === 'Bot is stopped!') return;
      if (isAuthError(err)) {
        sessionLogger.error('[telegram] Session offline — bot token revoked during active polling', { error: err });
        // Alert UI proactively if token dies mid-session
        sessionManager.markInactive(`${config.userId}:${Platforms.Telegram}:${config.sessionId}`);
      } else {
        sessionLogger.warn('[telegram] Polling interrupted (non-fatal; will recover if network restores)', { error: err });
      }
    });
    sessionLogger.info('[telegram] Bot running.');

    sessionLogger.info('[telegram] Listener active');

    // Register the slash sync callback AFTER launch succeeds.
    // The closure captures activeBot and activeCommands by variable reference so restarts automatically
    // bind to the new Telegraf instance without needing to re-register.
    const smKey = `${config.userId}:${Platforms.Telegram}:${config.sessionId}`;
    registerSlashSync(smKey, async () => {
      if (!activeBot || !activeCommands) return;
      const livePrefix = prefixManager.getPrefix(config.userId, Platforms.Telegram, config.sessionId);
      // Fetch current enabled/disabled state from DB to filter the command menu accurately
      const rows = await findSessionCommands(config.userId, Platforms.Telegram, config.sessionId);
      const disabledNames = new Set(
        rows.filter((r) => !r.isEnable).map((r) => r.commandName),
      );
      await registerSlashMenu(
        activeBot,
        activeCommands,
        livePrefix,
        config.userId,
        config.sessionId,
        sessionLogger,
        disabledNames,
        true, // forceRegister — dashboard toggle changes enabled-set, not the config hash
      );
    });
  };

  emitter.stop = async (signal?: string): Promise<void> => {
    sessionLogger.info('[telegram] Stopping Listener...');
    // Clean up before stopping the bot so stale callbacks don't fire on a dead session
    unregisterSlashSync(`${config.userId}:${Platforms.Telegram}:${config.sessionId}`);
    activeCommands = null;
    if (activeBot) {
      try {
        activeBot.stop(signal || 'Restarting');
      } catch {
        // Suppress "Bot is not running!" — start() may have set activeBot but aborted before launch()
      }
      activeBot = null;
    }
  };

  return emitter;
}
