import type { CommentResult } from '@kindwords/types';
import { BADGE_CLASS, TOOLTIP_CLASS } from '../../shared/constants';

// Single global listener to close all tooltips when clicking outside a badge.
// Registered once, handles all badges via event delegation.
let globalListenerAttached = false;

function ensureGlobalListener(): void {
  if (globalListenerAttached) return;
  globalListenerAttached = true;

  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.classList?.contains(BADGE_CLASS)) return;

    document.querySelectorAll(`.${TOOLTIP_CLASS}`).forEach((tooltip) => {
      (tooltip as HTMLElement).style.display = 'none';
    });
  });
}

export function renderOverlay(
  domNode: Element,
  originalText: string,
  result: CommentResult,
): void {
  ensureGlobalListener();

  // Create badge
  const badge = document.createElement('span');
  badge.className = BADGE_CLASS;
  badge.textContent = 'KW';
  badge.title = 'Rewritten by KindWords — click to see original';

  // Create tooltip container
  const tooltip = document.createElement('div');
  tooltip.className = TOOLTIP_CLASS;
  tooltip.style.display = 'none';

  // Tooltip content — show original text
  const originalSection = document.createElement('div');
  originalSection.className = 'kindwords-tooltip-section';
  originalSection.innerHTML = `<strong>Original:</strong> <span class="kindwords-original-text">${escapeHtml(originalText)}</span>`;
  tooltip.appendChild(originalSection);

  if (result.suggestedResponse) {
    const suggestSection = document.createElement('div');
    suggestSection.className = 'kindwords-tooltip-section';
    suggestSection.innerHTML = `<strong>Suggested reply:</strong> ${escapeHtml(result.suggestedResponse)}`;
    tooltip.appendChild(suggestSection);
  }

  // Toggle this tooltip on badge click
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    tooltip.style.display = tooltip.style.display === 'none' ? 'block' : 'none';
  });

  // Insert badge after the text node
  const parent = domNode.parentElement;
  if (parent) {
    parent.style.position = 'relative';
    parent.appendChild(badge);
    parent.appendChild(tooltip);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
