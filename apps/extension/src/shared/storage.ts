import type { ExtensionConfig } from '@kindwords/types';
import { DEFAULT_CONFIG, STORAGE_KEYS } from './constants';

export async function getConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
  return { ...DEFAULT_CONFIG, ...result[STORAGE_KEYS.CONFIG] };
}

export async function setConfig(config: Partial<ExtensionConfig>): Promise<void> {
  const current = await getConfig();
  await chrome.storage.local.set({
    [STORAGE_KEYS.CONFIG]: { ...current, ...config },
  });
}

export async function getClientId(): Promise<string> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLIENT_ID);
  if (result[STORAGE_KEYS.CLIENT_ID]) {
    return result[STORAGE_KEYS.CLIENT_ID];
  }

  const clientId = crypto.randomUUID();
  await chrome.storage.local.set({ [STORAGE_KEYS.CLIENT_ID]: clientId });
  return clientId;
}

export async function getLocalStats(): Promise<{
  todayReframed: number;
  totalReframed: number;
}> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
  return result[STORAGE_KEYS.STATS] ?? { todayReframed: 0, totalReframed: 0 };
}

export async function incrementLocalStats(count: number): Promise<void> {
  const stats = await getLocalStats();
  const today = new Date().toISOString().split('T')[0];
  const storedDate = await chrome.storage.local.get('kindwords_stats_date');

  const todayReframed =
    storedDate['kindwords_stats_date'] === today ? stats.todayReframed + count : count;

  await chrome.storage.local.set({
    [STORAGE_KEYS.STATS]: {
      todayReframed,
      totalReframed: stats.totalReframed + count,
    },
    kindwords_stats_date: today,
  });
}
