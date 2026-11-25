import type { GameStore } from '../core/store';

export function practiceBadge(store: GameStore, name: string) {
  const result = store.badge(name);
  if (result === 'readonly') return '只读练习，本次不记录徽章。';
  return result === 'existing' ? `你的记录中已有「${name}」徽章。` : `已获得「${name}」徽章。`;
}
