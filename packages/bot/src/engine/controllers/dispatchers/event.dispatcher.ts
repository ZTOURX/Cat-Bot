/**
 * Event Dispatcher — fans out to registered event handlers for a given type.
 *
 * Simple, reusable pattern: any module that registers for an event type via
 * config.eventType[] gets its onEvent handler called in registration order.
 */

import type { EventModuleMap } from '@/engine/types/controller.types.js';
// Platform filter — enforces config.platform[] declared by each event module
import { isPlatformAllowed } from '@/engine/utils/platform-filter.util.js';
// Event registry check — honours bot admin toggle decisions in bot_session_events
import { isEventEnabled } from '@/engine/repos/bot-session-events.repo.js';

/**
 * Fires every registered handler for the given unified event type.
 */
export async function dispatchEvent(
  eventModules: EventModuleMap,
  eventType: string,
  ctx: Record<string, unknown>,
): Promise<void> {
  // Extract platform once — avoids a repeated cast inside the handler loop
  const platform =
    ((ctx['native'] as Record<string, unknown> | undefined)?.[
      'platform'
    ] as string) ?? 'unknown';
  // Hoist session identity outside the loop — same cost regardless of handler count
  const sessionUserId = ((ctx['native'] as Record<string, unknown> | undefined)?.['userId'] ?? '') as string;
  const sessionId = ((ctx['native'] as Record<string, unknown> | undefined)?.['sessionId'] ?? '') as string;
  const handlers = eventModules.get(eventType) ?? [];
  for (const mod of handlers) {
    if (typeof mod['onEvent'] === 'function') {
      // Skip modules that explicitly exclude this platform via config.platform[]
      if (!isPlatformAllowed(mod, platform)) continue;
      // Skip modules disabled by the bot admin — keyed by config.name, not eventType,
      // so the dashboard label matches the module name the user recognises ('join', 'leave').
      if (sessionUserId && sessionId) {
        const modName = ((mod['config'] as { name?: string } | undefined)?.name ?? '').toLowerCase();
        if (modName && !(await isEventEnabled(sessionUserId, platform, sessionId, modName))) continue;
      }
      try {
        // Await handles both sync and async returns safely; catch blocks capture any rejections without assuming a .catch() method exists on the return value
        await (mod['onEvent'] as (ctx: unknown) => unknown)(ctx);
      } catch (err: unknown) {
        console.error(`❌ Event handler "${eventType}" failed`, err);
      }
    }
  }
}
