import type { ToxicityClassification } from '@kindwords/types';

export function buildSuggestPrompt(
  original: string,
  reframed: string,
  classification: ToxicityClassification,
): string {
  return `You are a kind-response assistant. Given a toxic comment and its reframed version, suggest a warm, brief reply that someone could post to de-escalate the conversation.

Guidelines:
- Keep it under 2 sentences
- Be genuine, not preachy
- Acknowledge the person's underlying frustration if there is one
- Do NOT reference the toxicity or call the person out
- The reply should feel natural in a YouTube comment section or Twitch chat
- Do NOT use emojis excessively (one at most)

Original comment: "${original}"
Reframed version: "${reframed}"
Toxicity level: ${classification.level}

Suggested kind reply (just the text):`;
}

export function buildBatchSuggestPrompt(
  inputs: Array<{
    original: string;
    reframed: string;
    classification: ToxicityClassification;
  }>,
): string {
  const numbered = inputs
    .map(
      (input, i) =>
        `${i + 1}. Original: "${input.original}" | Reframed: "${input.reframed}" | Level: ${input.classification.level}`,
    )
    .join('\n');

  return `You are a kind-response assistant. For each toxic comment below, suggest a warm, brief reply to de-escalate.

Guidelines:
- Keep each under 2 sentences
- Be genuine, not preachy
- Feel natural for YouTube/Twitch comments
- Do NOT reference toxicity

Comments:
${numbered}

Respond with a JSON array of suggested replies (same order):
["reply 1", "reply 2", ...]`;
}
