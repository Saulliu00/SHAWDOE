export class Debouncer {
  private timer: number | null = null;

  schedule(fn: () => void, delayMs: number): void {
    this.cancel();
    this.timer = window.setTimeout(fn, delayMs);
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
