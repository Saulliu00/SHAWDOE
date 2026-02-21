export type Platform = 'youtube' | 'twitch';

export type WarmthLevel = 'low' | 'medium' | 'high';

export interface CommentInput {
  id: string;
  text: string;
  author?: string;
  timestamp?: string;
}

export interface CommentResult {
  id: string;
  original: string;
  reframed: string;
  suggestedResponse: string;
  fromCache: boolean;
}

export interface ExtractedComment<TNode = unknown> {
  id: string;
  text: string;
  author: string;
  domNode: TNode;
  platform: Platform;
  contentHash: string;
}
