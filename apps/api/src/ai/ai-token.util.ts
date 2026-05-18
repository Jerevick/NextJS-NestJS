/** Rough token estimate when provider usage metadata is unavailable. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateMessagesTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}
