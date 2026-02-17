import type { PlatformObserver, OnCommentsDetected, ExtractedComment } from './types';

const COMMENTS_CONTAINER_SELECTOR = '#comments #sections #contents';
const COMMENT_THREAD_SELECTOR = 'ytd-comment-thread-renderer';
const COMMENT_TEXT_SELECTOR = '#content-text';
const COMMENT_AUTHOR_SELECTOR = '#author-text';

export class YouTubeObserver implements PlatformObserver {
  private observer: MutationObserver | null = null;
  private pollTimer: number | null = null;
  private processedNodes = new WeakSet<Element>();

  start(onDetected: OnCommentsDetected): void {
    this.pollForContainer(onDetected);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private pollForContainer(onDetected: OnCommentsDetected): void {
    const tryAttach = () => {
      const container = document.querySelector(COMMENTS_CONTAINER_SELECTOR);
      if (container) {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
        this.attachObserver(container, onDetected);
        // Process any comments already in DOM
        this.processExistingComments(container, onDetected);
      }
    };

    tryAttach();
    if (!this.observer) {
      this.pollTimer = window.setInterval(tryAttach, 1000);
    }
  }

  private attachObserver(container: Element, onDetected: OnCommentsDetected): void {
    this.observer = new MutationObserver((mutations) => {
      const newComments: ExtractedComment[] = [];

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;

          // Direct comment thread added
          if (node.matches(COMMENT_THREAD_SELECTOR)) {
            const comment = this.extractComment(node);
            if (comment) newComments.push(comment);
          }

          // Nested comment threads
          const threads = node.querySelectorAll(COMMENT_THREAD_SELECTOR);
          for (const thread of threads) {
            const comment = this.extractComment(thread);
            if (comment) newComments.push(comment);
          }
        }
      }

      if (newComments.length > 0) {
        onDetected(newComments);
      }
    });

    this.observer.observe(container, { childList: true, subtree: true });
  }

  private processExistingComments(container: Element, onDetected: OnCommentsDetected): void {
    const threads = container.querySelectorAll(COMMENT_THREAD_SELECTOR);
    const comments: ExtractedComment[] = [];

    for (const thread of threads) {
      const comment = this.extractComment(thread);
      if (comment) comments.push(comment);
    }

    if (comments.length > 0) {
      onDetected(comments);
    }
  }

  private extractComment(node: Element): ExtractedComment | null {
    if (this.processedNodes.has(node)) return null;

    const textEl = node.querySelector(COMMENT_TEXT_SELECTOR);
    const authorEl = node.querySelector(COMMENT_AUTHOR_SELECTOR);

    if (!textEl?.textContent) return null;

    this.processedNodes.add(node);

    return {
      id: `yt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: textEl.textContent.trim(),
      author: authorEl?.textContent?.trim() ?? 'Unknown',
      domNode: textEl,
      platform: 'youtube',
    };
  }
}
