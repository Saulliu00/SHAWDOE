import type { PlatformObserver, OnCommentsDetected, ExtractedComment } from './types';

const CHAT_CONTAINER_SELECTOR = '.chat-scrollable-area__message-container';
const CHAT_MESSAGE_SELECTOR = '.chat-line__message';
const MESSAGE_TEXT_SELECTOR = '[data-a-target="chat-message-text"], .text-fragment';
const MESSAGE_AUTHOR_SELECTOR =
  '[data-a-target="chat-message-username"], .chat-author__display-name';

export class TwitchObserver implements PlatformObserver {
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
      const container = document.querySelector(CHAT_CONTAINER_SELECTOR);
      if (container) {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
        this.attachObserver(container, onDetected);
      }
    };

    tryAttach();
    if (!this.observer) {
      this.pollTimer = window.setInterval(tryAttach, 1000);
    }
  }

  private attachObserver(container: Element, onDetected: OnCommentsDetected): void {
    this.observer = new MutationObserver((mutations) => {
      const newMessages: ExtractedComment[] = [];

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (node.matches(CHAT_MESSAGE_SELECTOR)) {
            const msg = this.extractMessage(node);
            if (msg) newMessages.push(msg);
          }

          const messages = node.querySelectorAll(CHAT_MESSAGE_SELECTOR);
          for (const msgNode of messages) {
            const msg = this.extractMessage(msgNode);
            if (msg) newMessages.push(msg);
          }
        }
      }

      if (newMessages.length > 0) {
        onDetected(newMessages);
      }
    });

    this.observer.observe(container, { childList: true });
  }

  private extractMessage(node: Element): ExtractedComment | null {
    if (this.processedNodes.has(node)) return null;

    const textEls = node.querySelectorAll(MESSAGE_TEXT_SELECTOR);
    const authorEl = node.querySelector(MESSAGE_AUTHOR_SELECTOR);

    const textParts: string[] = [];
    for (const el of textEls) {
      if (el.textContent) textParts.push(el.textContent.trim());
    }

    const text = textParts.join(' ').trim();
    if (!text) return null;

    this.processedNodes.add(node);

    return {
      id: `tw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      author: authorEl?.textContent?.trim() ?? 'Unknown',
      domNode: node,
      platform: 'twitch',
    };
  }
}
