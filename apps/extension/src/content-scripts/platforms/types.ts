import type { Platform } from '@kindwords/types';

export interface ExtractedComment {
  id: string;
  text: string;
  author: string;
  domNode: Element;
  platform: Platform;
}

export type OnCommentsDetected = (comments: ExtractedComment[]) => void;

export interface PlatformObserver {
  start(onDetected: OnCommentsDetected): void;
  stop(): void;
}
