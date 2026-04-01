/**
 * Platform Retry Utility — Exponential Backoff with Jitter
 *
 * Shared retry primitive consumed by all platform listeners for:
 *   - Startup failures (bad token, network down, rate-limited login)
 *   - Runtime reconnects (MQTT disconnect, polling error)
 *
 * Algorithm: delay(attempt) = min(initialDelayMs × backoffFactor^(attempt-1), maxDelayMs) ± 10% jitter.
 * Jitter prevents thundering-herd when multiple sessions restart simultaneously after a network outage.
 *
 * WHY: Centralising retry logic here prevents each platform from duplicating
 * ad-hoc setTimeout loops with different backoff constants and no logging,
 * and gives a single place to tune retry behavior for the whole system.
 */

import { logger } from '@/lib/logger.lib.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of attempts before giving up. Default: 5 */
  maxAttempts?: number;
  /** Initial delay in ms before the first retry. Default: 2000 */
  initialDelayMs?: number;
  /** Multiplier applied to delay on each retry. Default: 2 */
  backoffFactor?: number;
  /** Hard cap on delay regardless of backoff growth. Default: 60000 (1 min) */
  maxDelayMs?: number;
  /** Called just before each retry sleep; receives attempt number and the error. */
  onRetry?: (attempt: number, err: unknown) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Adds ±10% random jitter to avoid thundering-herd when multiple sessions
 * all fail at the same time and would otherwise retry in perfect lock-step.
 */
function jitter(ms: number): number {
  return ms * (0.9 + Math.random() * 0.2);
}

// ── Core retry primitive ──────────────────────────────────────────────────────

/**
 * Calls `fn()` repeatedly until it resolves or `maxAttempts` is exhausted.
 * Uses exponential backoff with jitter between attempts.
 *
 * @throws The last error encountered if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const initialDelayMs = options?.initialDelayMs ?? 2000;
  const backoffFactor = options?.backoffFactor ?? 2;
  const maxDelayMs = options?.maxDelayMs ?? 60_000;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (attempt === maxAttempts) break;

      const baseDelay = Math.min(
        initialDelayMs * Math.pow(backoffFactor, attempt - 1),
        maxDelayMs,
      );
      const delay = Math.round(jitter(baseDelay));

      if (options?.onRetry) {
        options.onRetry(attempt, err);
      } else {
        logger.warn(
          `[retry] Attempt ${attempt}/${maxAttempts} failed — retrying in ${delay}ms`,
          { error: err },
        );
      }

      await sleep(delay);
    }
  }

  throw lastErr;
}