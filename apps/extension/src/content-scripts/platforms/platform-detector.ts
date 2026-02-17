import type { Platform } from '@kindwords/types';

export function detectPlatform(): Platform | null {
  const hostname = window.location.hostname;

  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('twitch.tv')) return 'twitch';

  return null;
}
