import type { ExtractedComment } from '../platforms/types';

export function getCommentText(comment: ExtractedComment): string {
  return comment.text;
}

export function getCommentId(comment: ExtractedComment): string {
  return comment.id;
}
