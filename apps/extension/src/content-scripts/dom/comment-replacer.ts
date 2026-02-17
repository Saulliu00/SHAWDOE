import type { CommentResult } from '@kindwords/types';
import { REFRAMED_CLASS } from '../../shared/constants';
import type { ExtractedComment } from '../platforms/types';
import { renderOverlay } from './overlay-renderer';

export function replaceComment(
  extracted: ExtractedComment,
  result: CommentResult,
): void {
  if (!result.toxicity.isToxic || !result.reframed) return;

  const { domNode } = extracted;
  if (domNode.classList.contains(REFRAMED_CLASS)) return;

  // Store original text
  const originalText = domNode.textContent ?? '';

  // Replace text
  domNode.textContent = result.reframed;
  domNode.classList.add(REFRAMED_CLASS);

  // Add overlay badge
  renderOverlay(domNode, originalText, result);
}

export function replaceBatch(
  comments: ExtractedComment[],
  results: CommentResult[],
): number {
  let replacedCount = 0;

  for (let i = 0; i < comments.length; i++) {
    if (results[i]?.toxicity.isToxic && results[i]?.reframed) {
      replaceComment(comments[i], results[i]);
      replacedCount++;
    }
  }

  return replacedCount;
}
