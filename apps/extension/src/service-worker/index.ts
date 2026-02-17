import { ApiClient } from './api-client';
import { CacheManager } from './cache-manager';
import { ClientRateLimiter } from './rate-limiter';
import { MessageRouter } from './message-router';
import { getClientId } from '../shared/storage';

// Initialize dependencies
const apiClient = new ApiClient();
const cache = new CacheManager();
const rateLimiter = new ClientRateLimiter();
const router = new MessageRouter(apiClient, cache, rateLimiter);

// All event listeners MUST be registered synchronously at top level (MV3 requirement)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  router.handle(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Generate anonymous client ID on first install
    await getClientId();
    console.log('[KindWords] Extension installed');
  }
});

// Periodic cache cleanup
chrome.alarms.create('cache-cleanup', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cache-cleanup') {
    cache.evictExpired();
  }
});
