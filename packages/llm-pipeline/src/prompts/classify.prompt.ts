export function buildClassifyPrompt(text: string): string {
  return `You are a toxicity classifier for online comments. Analyze the following comment and classify its toxicity.

Rules:
- "none": The comment is neutral, positive, or constructive criticism
- "mild": Slightly dismissive, passive-aggressive, or mildly rude
- "moderate": Clearly insulting, harassing, or hostile
- "severe": Extreme hate speech, threats, or targeted harassment

Categories (select all that apply):
- harassment: Targeting a specific person with repeated unwanted attention
- hate_speech: Attacking based on identity (race, gender, sexuality, etc.)
- insult: Direct name-calling or demeaning language
- sarcasm_hostile: Sarcasm used with hostile intent
- threat: Explicit or implied threats of harm
- dismissive: Belittling someone's ideas, work, or existence
- trolling: Intentionally provocative to cause disruption
- none: No toxicity detected

Comment: "${text}"

Respond in JSON only:
{
  "isToxic": boolean,
  "level": "none" | "mild" | "moderate" | "severe",
  "confidence": number (0.0-1.0),
  "categories": string[]
}`;
}

export function buildBatchClassifyPrompt(texts: string[]): string {
  const numbered = texts.map((t, i) => `${i + 1}. "${t}"`).join('\n');
  return `You are a toxicity classifier for online comments. Analyze each comment below and classify its toxicity.

Rules:
- "none": The comment is neutral, positive, or constructive criticism
- "mild": Slightly dismissive, passive-aggressive, or mildly rude
- "moderate": Clearly insulting, harassing, or hostile
- "severe": Extreme hate speech, threats, or targeted harassment

Categories: harassment, hate_speech, insult, sarcasm_hostile, threat, dismissive, trolling, none

Comments:
${numbered}

Respond with a JSON array (one object per comment, same order):
[{ "isToxic": boolean, "level": string, "confidence": number, "categories": string[] }, ...]`;
}
