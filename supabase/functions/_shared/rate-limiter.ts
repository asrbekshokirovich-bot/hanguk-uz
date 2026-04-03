class RateLimiter {
  private requests = new Map<string, number[]>();

  async checkLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<boolean> {
    const now = Date.now();
    const requestsLog = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    const recentRequests = requestsLog.filter((time) => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    return true;
  }
}

// Export an active singleton instance for the Edge Function Isolate
// Note: This throttles traffic strictly within the current Deno isolate memory
export const ipLimiter = new RateLimiter();
