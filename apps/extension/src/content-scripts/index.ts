import { detectPlatform } from './platforms/platform-detector';
import { YouTubeObserver } from './platforms/youtube-observer';
import { TwitchObserver } from './platforms/twitch-observer';
import { CommentQueue } from './batch/comment-queue';
import type { PlatformObserver } from './platforms/types';

async function init(): Promise<void> {
  const platform = detectPlatform();
  if (!platform) return;

  // Check if extension is enabled
  const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
  if (!response?.payload?.enabled) return;

  const config = response.payload;
  if (!config.platforms[platform]) return;

  console.log(`[KindWords] Initializing on ${platform}`);

  const queue = new CommentQueue({
    maxBatchSize: config.batchSize ?? 25,
    flushIntervalMs: platform === 'twitch' ? 1000 : (config.batchFlushIntervalMs ?? 2000),
  });

  let observer: PlatformObserver;

  if (platform === 'youtube') {
    observer = new YouTubeObserver();
  } else {
    observer = new TwitchObserver();
  }

  observer.start((comments) => {
    queue.enqueue(comments);
  });

  // Listen for config changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.kindwords_config) {
      const newConfig = changes.kindwords_config.newValue;
      if (!newConfig?.enabled || !newConfig?.platforms?.[platform]) {
        observer.stop();
        queue.clear();
        console.log('[KindWords] Disabled');
      }
    }
  });
}

init().catch(console.error);
