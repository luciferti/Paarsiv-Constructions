/**
 * A token bucket, for keeping our own send rate under whatever Meta allows.
 *
 * Meta's Cloud API accepts 80 messages a second by default (raisable to 1000
 * on request). Going over gets requests rejected with a rate-limit error, and
 * a rejected message still counts as an attempt — so it is cheaper to pace
 * ourselves than to be told off.
 */
export class Throttle {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(private ratePerSecond: number, private burst = ratePerSecond) {
    this.tokens = burst;
  }

  /** Resolves when it's this caller's turn to send. */
  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      // Wait for roughly one token to become available.
      const waitMs = Math.max(5, Math.ceil(1000 / this.ratePerSecond));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  private refill(): void {
    const now = Date.now();
    const gained = ((now - this.lastRefill) / 1000) * this.ratePerSecond;
    if (gained > 0) {
      this.tokens = Math.min(this.burst, this.tokens + gained);
      this.lastRefill = now;
    }
  }
}

/**
 * Run `worker` over `items` with at most `concurrency` in flight. Keeps the
 * pipe full without building a promise per item up front.
 */
export async function pool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

/**
 * One bucket per workspace, shared by every campaign, journey and script.
 *
 * A per-campaign limit isn't enough on its own: two campaigns at 40/s each
 * would put 80/s through the same WhatsApp number and start collecting
 * rate-limit rejections. Everything that sends takes from here first.
 */
const orgBuckets = new Map<string, { throttle: Throttle; rate: number }>();

export function orgThrottle(tenantId: string, ratePerSecond: number): Throttle {
  const rate = Math.max(1, ratePerSecond);
  const existing = orgBuckets.get(tenantId);
  // Rebuild when the workspace changes its limit, so a save takes effect
  // on the next message rather than the next restart.
  if (!existing || existing.rate !== rate) {
    const throttle = new Throttle(rate);
    orgBuckets.set(tenantId, { throttle, rate });
    return throttle;
  }
  return existing.throttle;
}

/** Forget a workspace's bucket — used when its rate is reconfigured. */
export function resetOrgThrottle(tenantId: string): void {
  orgBuckets.delete(tenantId);
}
