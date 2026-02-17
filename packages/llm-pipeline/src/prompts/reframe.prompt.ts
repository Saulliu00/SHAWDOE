import type { ToxicityClassification } from '@kindwords/types';

export function buildReframePrompt(
  text: string,
  classification: ToxicityClassification,
): string {
  return `You are an empathy translator. Your job is to take a toxic online comment and rewrite it to express the likely underlying feeling or concern in a warm, constructive way.

Guidelines:
- Preserve the core opinion or concern behind the comment
- Remove all insults, hostility, and harmful language
- Use empathetic, warm tone while keeping the message authentic
- Do NOT make it sound robotic, overly polite, or condescending
- Keep it roughly the same length as the original
- If the comment has a valid point buried under toxicity, surface that point kindly
- Match the casual register of online comments (not formal essay tone)

Toxicity context:
- Level: ${classification.level}
- Categories: ${classification.categories.join(', ')}

Original toxic comment: "${text}"

Reframed version (just the rewritten text, no explanation):`;
}

export function buildBatchReframePrompt(
  inputs: Array<{ text: string; classification: ToxicityClassification }>,
): string {
  const numbered = inputs
    .map(
      (input, i) =>
        `${i + 1}. "${input.text}" [${input.classification.level}, ${input.classification.categories.join('/')}]`,
    )
    .join('\n');

  return `You are an empathy translator. Rewrite each toxic comment below to express the likely underlying feeling in a warm, constructive way.

Guidelines:
- Preserve the core opinion or concern
- Remove all insults, hostility, and harmful language
- Use empathetic, warm tone while keeping the message authentic
- Keep each roughly the same length as the original
- Match casual online comment register

Comments:
${numbered}

Respond with a JSON array of reframed strings (same order):
["reframed text 1", "reframed text 2", ...]`;
}
