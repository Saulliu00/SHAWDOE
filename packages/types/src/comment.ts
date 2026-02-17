export type Platform = 'youtube' | 'twitch';

export type ToxicityLevel = 'none' | 'mild' | 'moderate' | 'severe';

export type WarmthLevel = 'low' | 'medium' | 'high';

export type ToxicityCategory =
  | 'harassment'
  | 'hate_speech'
  | 'insult'
  | 'sarcasm_hostile'
  | 'threat'
  | 'dismissive'
  | 'trolling'
  | 'none';

export interface CommentInput {
  id: string;
  text: string;
  author?: string;
  timestamp?: string;
}

export interface ToxicityClassification {
  isToxic: boolean;
  level: ToxicityLevel;
  confidence: number;
  categories: ToxicityCategory[];
}

export interface CommentResult {
  id: string;
  original: string;
  toxicity: ToxicityClassification;
  reframed: string | null;
  suggestedResponse: string | null;
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
