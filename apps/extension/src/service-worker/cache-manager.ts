import type { CommentResult } from '@kindwords/types';
import { STORAGE_KEYS } from '../shared/constants';

interface CacheItem {
  result: CommentResult;
  expiry: number;
}

const MAX_CACHE_SIZE = 5000;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class CacheManager {
  private memoryCache = new Map<string, CacheItem>();

  async get(contentHash: string): Promise<CommentResult | null> {
    // Tier 1: Memory
    const memoryCached = this.memoryCache.get(contentHash);
    if (memoryCached && memoryCached.expiry > Date.now()) {
      return memoryCached.result;
    }

    // Tier 2: chrome.storage.local
    try {
      const storageData = await chrome.storage.local.get(STORAGE_KEYS.CACHE);
      const cache = storageData[STORAGE_KEYS.CACHE] as Record<string, CacheItem> | undefined;

      if (cache?.[contentHash] && cache[contentHash].expiry > Date.now()) {
        // Promote to memory cache
        this.memoryCache.set(contentHash, cache[contentHash]);
        return cache[contentHash].result;
      }
    } catch {
      // Storage access may fail
    }

    return null;
  }

  async set(contentHash: string, result: CommentResult): Promise<void> {
    const item: CacheItem = {
      result,
      expiry: Date.now() + TTL_MS,
    };

    // Tier 1: Memory
    this.memoryCache.set(contentHash, item);

    // Tier 2: chrome.storage.local
    try {
      const storageData = await chrome.storage.local.get(STORAGE_KEYS.CACHE);
      const cache = (storageData[STORAGE_KEYS.CACHE] as Record<string, CacheItem>) ?? {};

      cache[contentHash] = item;

      // LRU eviction if over size limit
      const keys = Object.keys(cache);
      if (keys.length > MAX_CACHE_SIZE) {
        const sortedKeys = keys.sort((a, b) => (cache[a].expiry ?? 0) - (cache[b].expiry ?? 0));
        const toRemove = sortedKeys.slice(0, keys.length - MAX_CACHE_SIZE);
        for (const key of toRemove) {
          delete cache[key];
        }
      }

      await chrome.storage.local.set({ [STORAGE_KEYS.CACHE]: cache });
    } catch {
      // Storage write may fail
    }
  }

  async evictExpired(): Promise<void> {
    const now = Date.now();

    // Tier 1: Memory
    for (const [key, item] of this.memoryCache) {
      if (item.expiry <= now) {
        this.memoryCache.delete(key);
      }
    }

    // Tier 2: Storage
    try {
      const storageData = await chrome.storage.local.get(STORAGE_KEYS.CACHE);
      const cache = (storageData[STORAGE_KEYS.CACHE] as Record<string, CacheItem>) ?? {};

      let changed = false;
      for (const key of Object.keys(cache)) {
        if (cache[key].expiry <= now) {
          delete cache[key];
          changed = true;
        }
      }

      if (changed) {
        await chrome.storage.local.set({ [STORAGE_KEYS.CACHE]: cache });
      }
    } catch {
      // Ignore storage errors
    }
  }
}
