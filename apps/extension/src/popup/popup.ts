import type { ExtensionConfig, WarmthLevel } from '@kindwords/types';

async function init(): Promise<void> {
  const mainToggle = document.getElementById('main-toggle') as HTMLInputElement;
  const youtubeToggle = document.getElementById('youtube-toggle') as HTMLInputElement;
  const twitchToggle = document.getElementById('twitch-toggle') as HTMLInputElement;
  const warmthSelect = document.getElementById('warmth-select') as HTMLSelectElement;
  const todayCount = document.getElementById('today-count')!;
  const totalCount = document.getElementById('total-count')!;
  const statusDot = document.getElementById('status-indicator')!;

  // Load current config
  const configResponse = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
  if (configResponse?.type === 'CONFIG') {
    const config = configResponse.payload as ExtensionConfig;
    mainToggle.checked = config.enabled;
    youtubeToggle.checked = config.platforms.youtube;
    twitchToggle.checked = config.platforms.twitch;
    warmthSelect.value = config.warmth ?? 'medium';
  }

  // Load stats
  const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
  if (statsResponse?.type === 'STATS') {
    todayCount.textContent = String(statsResponse.payload.todayReframed);
    totalCount.textContent = String(statsResponse.payload.totalReframed);
  }

  // Event listeners
  mainToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      payload: { enabled: mainToggle.checked },
    });
  });

  youtubeToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      payload: { platforms: { youtube: youtubeToggle.checked, twitch: twitchToggle.checked } },
    });
  });

  twitchToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      payload: { platforms: { youtube: youtubeToggle.checked, twitch: twitchToggle.checked } },
    });
  });

  warmthSelect.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      payload: { warmth: warmthSelect.value as WarmthLevel },
    });
  });

  // Check API status
  try {
    const response = await fetch(
      configResponse?.payload?.apiBaseUrl
        ? `${configResponse.payload.apiBaseUrl}/status`
        : 'https://api.kindwords.app/v1/status',
    );
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'degraded') statusDot.classList.add('degraded');
      else if (data.status === 'unhealthy') statusDot.classList.add('unhealthy');
    } else {
      statusDot.classList.add('unhealthy');
    }
  } catch {
    statusDot.classList.add('unhealthy');
  }
}

init().catch(console.error);
