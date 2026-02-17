const MAX_REQUESTS_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

export class ClientRateLimiter {
  private timestamps: number[] = [];

  isAllowed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => t > now - WINDOW_MS);

    if (this.timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }
}
