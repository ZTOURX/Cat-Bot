/**
 * onButtonClick Middleware — Button Action Scope Enforcement
 *
 * Runs BEFORE the button action handler executes. Responsible for:
 *   1. Parsing the full actionId into components (localActionId, baseActionId, scopeUserId)
 *   2. Extracting the platform-provided ack() callback from native context
 *   3. Enforcing per-user button ownership — rejecting non-owners privately via ack()
 *
 * ── Scope enforcement ──────────────────────────────────────────────────────────
 * Buttons scoped to the invoking user carry a "~userId" suffix on the action ID
 * (e.g. "ping~123456"). When a scoped button is clicked by a different user,
 * ack() is called with show_alert=true so the rejection is visible ONLY to the
 * non-owner (Telegram popup / Discord ephemeral) — never posted to the group/channel.
 *
 * ── Context population ────────────────────────────────────────────────────────
 * Before calling next(), this middleware writes onto ctx so the final handler and
 * any downstream middleware can read parsed components without re-parsing actionId:
 *   ctx.baseActionId — action ID without scope suffix
 *   ctx.scopeUserId  — scoped user ID or null for unscoped buttons
 *   ctx.ack          — platform acknowledgement callback
 *
 * Extension points: add additional button-level guards (role checks, per-command rate
 * limiting, feature flags) via use.onButtonClick([yourMiddleware]) in middleware/index.ts.
 */

import type {
  MiddlewareFn,
  OnButtonClickCtx,
} from '@/engine/types/middleware.types.js';

/**
 * Parses button action scope from event.actionId and enforces per-user ownership.
 * Non-owners receive a private rejection via ack() — the message is never
 * visible to other channel/group members. Populates ctx.baseActionId, ctx.scopeUserId,
 * and ctx.ack before calling next() so the final handler consumes ready-made values.
 */
export const enforceButtonScope: MiddlewareFn<OnButtonClickCtx> = async function (
  ctx,
  next,
): Promise<void> {
  const actionId = String(ctx.event['actionId'] ?? '');
  const colonIdx = actionId.indexOf(':');

  // actionId with no colon is malformed — halt chain without ack since there is no
  // registered handler to dismiss and no meaningful rejection to surface to the user.
  if (colonIdx === -1) return;

  const localActionId = actionId.slice(colonIdx + 1);

  const tildeIdx = localActionId.indexOf('~');
  const withoutScope = tildeIdx === -1 ? localActionId : localActionId.slice(0, tildeIdx);
  const hashIdx = withoutScope.indexOf('#');
  const baseActionId = hashIdx === -1 ? withoutScope : withoutScope.slice(0, hashIdx);
  const scopeUserId = tildeIdx === -1 ? null : localActionId.slice(tildeIdx + 1);
  // Extract the optional acknowledgement function injected by the platform event handlers.
  // Telegram (handlers.ts): answerCallbackQuery MUST be called to dismiss the loading spinner —
  //   the dispatcher owns the call so it can pass show_alert=true for unauthorized clicks,
  //   which renders a native modal popup visible ONLY to the user who pressed the button.
  // Discord (event-handlers.ts): after deferUpdate(), sends an ephemeral followUp visible
  //   ONLY to the interaction sender — never posted to the channel.
  const ack = (ctx.native as Record<string, unknown>)['ack'] as
    | ((text?: string, showAlert?: boolean) => Promise<unknown>)
    | undefined;
  if (scopeUserId !== null && ctx.event['senderID'] !== scopeUserId) {
    // Notify the non-owner privately — show_alert popup on Telegram, ephemeral on Discord.
    // The rejection message is never visible to other channel/group members.
    await ack?.('🔒 This button can only be used by the person who ran the command.', true).catch(
      () => {},
    );
    return;
  }

  // Populate derived fields on ctx so the final handler and any downstream middleware
  // can access parsed components without re-parsing the raw actionId string.
  ctx.baseActionId = baseActionId;
  ctx.scopeUserId = scopeUserId;
  ctx.ack = ack;

  await next();
};
