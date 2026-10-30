export const EPOCH_DURATION = 10;
export type EpochTheme = 'oxygen' | 'radiation' | 'anoxia' | 'volcanism' | 'rift' | 'impact' | 'grasslands' | 'glaciation';
export type CameraKey = { at: number; position: [number, number, number]; target: [number, number, number] };
export type EpochDefinition = { theme: EpochTheme; color: string; endColor: string; accent: string; label: string; stages: [string, string, string]; cameras: CameraKey[] };
const cameras = (a: CameraKey['position'], b: CameraKey['position'], c: CameraKey['position'], target: CameraKey['target'] = [0, 1, 0]): CameraKey[] => [
  { at: 0, position: a, target }, { at: .36, position: b, target }, { at: .72, position: c, target }, { at: 1, position: a.map((v, i) => (v + c[i]) / 2) as CameraKey['position'], target },
];

// Captions describe the illustration; chapter text remains the source of scientific claims.
export const EPOCHS: Record<number, EpochDefinition> = {
  1: { theme: 'oxygen', color: '#173b43', endColor: '#226b72', accent: '#97e5ca', label: '产氧气泡 · 海水色彩', stages: ['微光中的产氧气泡', '海水色彩缓慢改变', '环境变化与生命的回应'], cameras: cameras([10, 6, 13], [7, 4, 11], [-5, 6, 13]) },
  2: { theme: 'radiation', color: '#102f4b', endColor: '#315d6b', accent: '#f1c080', label: '分枝形态 · 辐射扩展', stages: ['海底的身体轮廓', '多条分枝向外舒展', '不同结构，共同展开'], cameras: cameras([0, 11, 14], [6, 7, 12], [0, 13, 10]) },
  3: { theme: 'anoxia', color: '#1d5256', endColor: '#223646', accent: '#b3bd9b', label: '海洋缺氧 · 多次脉冲', stages: ['海底的层层水体', '多次缺氧扰动的示意', '变化后的海洋生态'], cameras: cameras([11, 5, 13], [5, 4, 12], [-6, 7, 13]) },
  4: { theme: 'volcanism', color: '#3b3039', endColor: '#544335', accent: '#eeab77', label: '火山轮廓 · 灰尘升起', stages: ['陆地与火山轮廓', '灰尘缓慢遮蔽天空', '环境变化留下痕迹'], cameras: cameras([11, 7, 15], [7, 5, 12], [-4, 7, 15]) },
  5: { theme: 'rift', color: '#463b36', endColor: '#58624d', accent: '#e8bb83', label: '裂隙火山 · 生态更替', stages: ['大地上的发光裂隙', '环境改变，轮廓退去', '新的绿色逐渐展开'], cameras: cameras([9, 11, 13], [3, 8, 12], [-7, 6, 14]) },
  6: { theme: 'impact', color: '#263c4a', endColor: '#464447', accent: '#e5bf88', label: '小行星 · 冲击环 · 尘幕', stages: ['天际的下落轨迹', '缓慢展开的冲击环', '尘幕中的幸存线索'], cameras: cameras([11, 8, 17], [7, 6, 15], [-5, 10, 17]) },
  7: { theme: 'grasslands', color: '#496359', endColor: '#476b7a', accent: '#d7daa0', label: '降温色调 · 草地扩展', stages: ['森林与开阔地的轮廓', '色调变冷，草地展开', '生境与分布不断调整'], cameras: cameras([10, 7, 14], [5, 5, 12], [-6, 8, 14]) },
  8: { theme: 'glaciation', color: '#354e65', endColor: '#587e85', accent: '#dcf3ed', label: '冰盖进退 · 迁徙路线', stages: ['冰盖向陆地推进', '冰缘退去，通道变化', '弯曲路线连接栖息地'], cameras: cameras([2, 13, 13], [6, 10, 12], [-5, 12, 13]) },
};

export const smooth = (value: number) => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); };
export function sampleCamera(keys: readonly CameraKey[], progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const end = keys.findIndex((key, index) => index > 0 && key.at >= p);
  const i = end < 0 ? keys.length - 1 : end;
  const a = keys[Math.max(0, i - 1)], b = keys[i], weight = smooth((p - a.at) / Math.max(.001, b.at - a.at));
  const blend = (first: number[], second: number[]) => first.map((value, j) => value + (second[j] - value) * weight) as [number, number, number];
  return { position: blend(a.position, b.position), target: blend(a.target, b.target) };
}

/** One monotonic clock owns both visuals and completion, including paused/hidden time. */
export class EpochClock {
  elapsed = 0;
  status: 'playing' | 'paused' | 'summary' | 'closed' = 'playing';
  private previous?: number;
  constructor(readonly duration = EPOCH_DURATION) {}
  tick(now: number) {
    if (this.status === 'closed') return this.elapsed;
    if (this.status === 'playing' && this.previous !== undefined) this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, now - this.previous) / 1000);
    this.previous = now;
    if (this.elapsed >= this.duration) this.status = 'summary';
    return this.elapsed;
  }
  pause(now: number) { this.tick(now); if (this.status === 'playing') this.status = 'paused'; }
  resume(now: number) { if (this.status === 'paused') { this.previous = now; this.status = 'playing'; } }
  finish() { if (this.status !== 'closed') { this.elapsed = this.duration; this.status = 'summary'; } }
  close() { this.status = 'closed'; this.previous = undefined; }
}
