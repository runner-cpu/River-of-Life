import { isInquiryBadge, type InquiryBadgeId } from '../content/inquiry-badges';
import type { Progress, Species, Question } from './types';
import { openProgressDatabase, readCurrentProgress } from './persistence';

const SAVE_KEY = 'life-museum-save-v1';
const UNLOCK_COST = 150;
const publishable = (s: Species) => s.status === 'published' && s.sources.length > 0;
const chapterTasks = (p: Progress, chapter: number, species: Species[], questions: Question[]) => {
  const ids = species.filter(s => s.chapter === chapter && publishable(s)).map(s => s.id);
  return [
    { id: 'observe', label: '发现 3 位远古居民', current: ids.filter(id => p.observed.includes(id)).length, target: 3, icon: 'ScanEye', mode: 'journey' },
    { id: 'read', label: '读懂 3 张生命档案', current: ids.filter(id => p.read.includes(id)).length, target: 3, icon: 'BookOpen', mode: 'codex' },
    { id: 'quiz', label: '答对 3 道知识挑战', current: questions.filter(q => q.chapter === chapter && ids.includes(q.speciesId) && p.answered.includes(q.id)).length, target: 3, icon: 'Lightbulb', mode: 'quiz' },
    { id: 'dig', label: '完成本纪元的化石挖掘', current: +p.excavated.includes(chapter), target: 1, icon: 'Pickaxe', mode: 'dig' },
    { id: 'compare', label: '比较一次代表尺寸', current: +ids.some(id => p.compared.includes(id)), target: 1, icon: 'Ruler', mode: 'codex' },
  ];
};
export const freshProgress = (): Progress => ({
  version: 2, points: 0, totalEarned: 0, chapter: 1, unlockedChapters: [1], completedChapters: [],
  observed: [], read: [], collected: [], compared: [], answered: [], mistakes: [], excavated: [], events: [], badges: [],
  settings: { sound: false, reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, quality: 'auto', projection: false },
  updatedAt: new Date().toISOString(),
});

export function validateProgress(input: unknown, species: Species[], questions: Question[]): Progress {
  if (!input || typeof input !== 'object') throw new Error('这不是有效的探索记录。');
  const p = input as Omit<Progress, 'version'> & { version: number };
  if (p.version !== 1 && p.version !== 2) throw new Error('暂不支持这个版本的探索记录。');
  const result = freshProgress();
  const ids = new Set(species.filter(publishable).map(s => s.id)), qids = new Set(questions.filter(q => ids.has(q.speciesId)).map(q => q.id));
  for (const key of ['points', 'totalEarned'] as const) {
    if (!Number.isSafeInteger(p[key]) || p[key] < 0 || p[key] > 100000) throw new Error('记录中的演化点数据无效。');
    result[key] = p[key];
  }
  if (p.points > p.totalEarned) throw new Error('记录中的演化点余额不一致。');
  for (const key of ['observed', 'read', 'collected', 'compared'] as const) {
    if (!Array.isArray(p[key]) || p[key].some(v => !ids.has(v))) throw new Error('记录中包含未知物种。');
    result[key] = [...new Set(p[key])];
  }
  for (const key of ['answered', 'mistakes'] as const) {
    if (!Array.isArray(p[key]) || p[key].some(v => !qids.has(v))) throw new Error('记录中包含未知题目。');
    result[key] = [...new Set(p[key])];
  }
  for (const key of ['unlockedChapters', 'completedChapters', 'excavated'] as const) {
    if (!Array.isArray(p[key]) || p[key].some(v => !Number.isInteger(v) || v < 1 || v > 8)) throw new Error('章节数据无效。');
    result[key] = [...new Set(p[key])].sort((a, b) => a - b);
  }
  if (!result.unlockedChapters.includes(1) || result.unlockedChapters.some((v, i) => v !== i + 1)) throw new Error('解锁章节必须连续。');
  if (result.completedChapters.some(c => !result.unlockedChapters.includes(c)) || result.excavated.some(c => !result.unlockedChapters.includes(c))) throw new Error('未开启的章节不能有完成记录。');
  if (result.unlockedChapters.some(c => c > 1 && !result.completedChapters.includes(c - 1))) throw new Error('缺少前一章的通关记录。');
  const unlockedSpecies = new Set(species.filter(s => result.unlockedChapters.includes(s.chapter)).map(s => s.id));
  if (['observed', 'read', 'collected', 'compared'].some(key => result[key as 'observed'].some(id => !unlockedSpecies.has(id)))) throw new Error('记录中包含未开启章节的学习进度。');
  if ([...result.answered, ...result.mistakes].some(id => !result.unlockedChapters.includes(questions.find(q => q.id === id)!.chapter))) throw new Error('题目与解锁章节不一致。');
  if ([...result.read, ...result.compared, ...result.collected].some(id => !result.observed.includes(id))) throw new Error('学习记录缺少观察记录。');
  const fossils = result.excavated.map(chapter => species.find(s => s.chapter === chapter && publishable(s))?.id).filter((id): id is string => !!id);
  if (fossils.some(id => !result.observed.includes(id) || !result.collected.includes(id))) throw new Error('化石记录缺少对应藏品。');
  if (result.observed.length && !result.collected.length) throw new Error('记录缺少首次发现藏品。');
  if (result.collected.some((id, i) => i > 0 && !fossils.includes(id) && !result.read.includes(id))) throw new Error('藏品缺少阅读记录。');
  if (result.completedChapters.some(chapter => !chapterTasks(result, chapter, species, questions).slice(0, 3).every(t => t.current >= t.target))) throw new Error('通关记录缺少学习任务。');
  if (p.events !== undefined && (!Array.isArray(p.events) || p.events.length > 3000 || p.events.some(e => typeof e !== 'string' || e.length > 150))) throw new Error('学习事件记录无效。');
  result.badges = Array.isArray(p.badges) ? p.badges.filter(b => typeof b === 'string' && b.length < 50).slice(0, p.version === 1 ? 30 : 32) : [];
  // Validate the full v1 ledger before returning v2; reserved IDs in old saves are not awards.
  result.badges = [...new Set(result.badges)].filter(id => p.version === 2 || !isInquiryBadge(id));
  result.chapter = result.unlockedChapters.includes(p.chapter) ? p.chapter : 1;
  if (p.settings) {
    result.settings.sound = p.settings.sound === true;
    result.settings.reducedMotion = p.settings.reducedMotion === true;
    result.settings.projection = p.settings.projection === true;
    result.settings.quality = ['auto', 'high', 'low'].includes(p.settings.quality) ? p.settings.quality : 'auto';
  }
  // Action arrays are the ledger. Imported event metadata cannot invent or repeat rewards.
  for (const [key, prefix] of [['observed', 'observe'], ['read', 'read'], ['answered', 'answer'], ['compared', 'compare'], ['excavated', 'dig'], ['completedChapters', 'complete']] as const) {
    for (const id of result[key]) result.events.push(`${prefix}:${id}`);
  }
  let taskCount = 0;
  for (const chapter of result.unlockedChapters) for (const task of chapterTasks(result, chapter, species, questions)) {
    if (task.current >= task.target) { result.events.push(`task:${chapter}:${task.id}`); taskCount++; }
  }
  const earned = result.observed.length * 5 + result.read.length * 3 + result.answered.length * 10 + result.excavated.length * 20 + result.completedChapters.length * 100 + taskCount * 50;
  if (result.totalEarned !== earned) throw new Error('累计演化点与学习记录不一致。');
  const collectionCost = result.collected.slice(1).reduce((sum, id) => sum + species.find(s => s.id === id)!.cost, 0);
  // Old saves do not record whether a fossil was bought before digging or granted by it.
  // Accept only balances achievable by those specific free specimens, never arbitrary points.
  let possibleDiscounts = new Set([0]);
  for (const id of fossils.filter(id => result.collected.indexOf(id) > 0)) {
    const cost = species.find(s => s.id === id)!.cost;
    possibleDiscounts = new Set([...possibleDiscounts].flatMap(value => result.read.includes(id) ? [value, value + cost] : [value + cost]));
  }
  const spent = result.totalEarned - result.points;
  const maximumSpent = collectionCost + (result.unlockedChapters.length - 1) * UNLOCK_COST;
  if (!possibleDiscounts.has(maximumSpent - spent)) throw new Error('演化点余额与藏品、章节花费不一致。');
  // Keep the saved revision time: startup uses it to reconcile both storage copies.
  result.updatedAt = typeof p.updatedAt === 'string' && Number.isFinite(Date.parse(p.updatedAt)) ? p.updatedAt : new Date(0).toISOString();
  return result;
}

export class GameStore {
  state = freshProgress();
  private listeners = new Set<() => void>();
  private db?: IDBDatabase;
  private notice?: (message: string) => void;
  private pendingNotices: string[] = [];
  private invalidLocal?: string;
  private invalidDatabase?: unknown;
  constructor(readonly species: Species[], readonly questions: Question[], private readonly options: { persist?: boolean } = {}) {}
  onNotice(fn: (message: string) => void) { this.notice = fn; this.pendingNotices.splice(0).forEach(fn); }
  private notify(message: string) { if (this.notice) this.notice(message); else if (!this.pendingNotices.includes(message)) this.pendingNotices.push(message); }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  async init() {
    if (this.options.persist === false) return;
    const candidates: Progress[] = [];
    const validate = (value: unknown, source: string) => {
      try { candidates.push(validateProgress(value, this.species, this.questions)); return true; }
      catch { this.notify(`${source}记录无效，已保留原记录；将尝试恢复另一份有效记录。`); return false; }
    };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        try { if (!validate(JSON.parse(raw), '本地')) this.invalidLocal = raw; }
        catch { this.invalidLocal = raw; this.notify('本地记录无法读取，已保留原记录；将尝试恢复另一份有效记录。'); }
      }
    } catch { this.notify('本地记录无法读取，将尝试从数据库恢复探索。'); }
    try {
      this.db = await openProgressDatabase();
      const database = await readCurrentProgress(this.db);
      if (database !== undefined && !validate(database, '数据库')) this.invalidDatabase = database;
    } catch { this.db?.close?.();this.db=undefined;this.notify('数据库暂不可用，已使用本地记录继续探索。建议导出一份备份。'); }
    if (candidates.length) this.state = candidates.reduce((latest, candidate) => Date.parse(candidate.updatedAt) > Date.parse(latest.updatedAt) ? candidate : latest);
  }
  private changed() {
    // Several learning actions can happen within one clock tick; keep revisions ordered.
    this.state.updatedAt = new Date(Math.max(Date.now(), Date.parse(this.state.updatedAt) + 1)).toISOString();
    if (this.options.persist !== false) {
    try {
      if (this.invalidLocal !== undefined) { localStorage.setItem(`${SAVE_KEY}-recovery-${Date.now()}`, this.invalidLocal); this.invalidLocal = undefined; }
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch { this.notify('浏览器未能保存记录，请在设置中导出备份。'); }
    try {
      if (this.db) {
        const transaction = this.db.transaction('progress', 'readwrite'), records = transaction.objectStore('progress');
        const invalid = this.invalidDatabase;
        if (invalid !== undefined) {
          records.put(invalid, `recovery-${Date.now()}`);
          // A put request can succeed and still be rolled back by its transaction.
          // Keep the original pending until the backup and current snapshot commit.
          transaction.oncomplete = () => { if (this.invalidDatabase === invalid) this.invalidDatabase = undefined; };
        }
        transaction.onabort = transaction.onerror = () => this.notify('数据库未能保存记录，请在设置中导出备份。');
        records.put(structuredClone(this.state), 'current');
      }
    } catch { /* fallback above */ }
    }
    this.listeners.forEach(fn => fn());
  }
  private award(event: string, amount: number): number {
    if (this.state.events.includes(event)) return 0;
    this.state.events.push(event); this.state.points += amount; this.state.totalEarned += amount;
    return amount;
  }
  private accessible(id: string) { return this.species.find(s => s.id === id && publishable(s) && this.state.unlockedChapters.includes(s.chapter)); }
  observe(id: string) {
    if (!this.accessible(id)) return 0;
    const points = this.award(`observe:${id}`, 5);
    if (!this.state.observed.includes(id)) this.state.observed.push(id);
    // One first discovery makes the opening three minutes a complete collecting loop.
    if (!this.state.collected.length) { this.state.collected.push(id); this.notice?.('第一件藏品已免费加入图鉴。旅程从这里开始！'); }
    this.checkTasks(); this.changed(); return points;
  }
  read(id: string) {
    if (!this.accessible(id) || !this.state.observed.includes(id)) return 0;
    const points = this.award(`read:${id}`, 3);
    if (!this.state.read.includes(id)) this.state.read.push(id);
    this.checkTasks(); this.changed(); return points;
  }
  collect(id: string): string {
    const s = this.accessible(id);
    if (!s) return '请先开启这个物种所属的纪元。';
    if (this.state.collected.includes(id)) return '这位老朋友已经在图鉴里了。';
    if (!this.state.read.includes(id)) return '先观察并阅读知识卡，再将它加入图鉴。';
    if (!Number.isSafeInteger(s.cost) || s.cost < 0) return '这件藏品的演化点数据无效。';
    if (this.state.points < s.cost) return `还差 ${s.cost - this.state.points} 演化点，去完成一次知识挑战吧。`;
    if (this.state.unlockedChapters.length < 8 && this.state.points - s.cost < UNLOCK_COST) return '先为下一纪元保留 150 演化点；继续学习后即可收藏。';
    this.state.points -= s.cost; this.state.collected.push(id); this.changed(); return '已加入你的生命图鉴';
  }
  compare(id: string) {
    if (!this.accessible(id) || !this.state.observed.includes(id)) return;
    if (!this.state.compared.includes(id)) this.state.compared.push(id);
    this.award(`compare:${id}`, 0);
    this.checkTasks(); this.changed();
  }
  answer(id: string, option: number) {
    const q = this.questions.find(q => q.id === id);
    if (!q || !this.state.unlockedChapters.includes(q.chapter) || !this.accessible(q.speciesId) || !Number.isInteger(option) || option < 0 || option >= q.options.length) return { correct: false, points: 0 };
    const correct = q.correct === option;
    const points = correct ? this.award(`answer:${id}`, 10) : 0;
    if (correct && !this.state.answered.includes(id)) this.state.answered.push(id);
    if (!correct && !this.state.mistakes.includes(id)) this.state.mistakes.push(id);
    this.checkTasks(); this.changed(); return { correct, points };
  }
  excavate(chapter: number) {
    if (!this.state.unlockedChapters.includes(chapter) || this.state.excavated.includes(chapter)) return 0;
    this.state.excavated.push(chapter); const points = this.award(`dig:${chapter}`, 20);
    const specimen = this.species.find(s => s.chapter === chapter && publishable(s));
    if (specimen) { if (!this.state.observed.includes(specimen.id)) { this.state.observed.push(specimen.id); this.award(`observe:${specimen.id}`, 5); } if (!this.state.collected.includes(specimen.id)) this.state.collected.push(specimen.id); }
    this.checkTasks(); this.changed(); return points;
  }
  taskProgress(chapter: number) {
    return chapterTasks(this.state, chapter, this.species, this.questions);
  }
  private checkTasks() {
    for (const chapter of this.state.unlockedChapters) for (const task of this.taskProgress(chapter)) {
      if (task.current >= task.target && this.award(`task:${chapter}:${task.id}`, 50)) this.notice?.(`任务完成：${task.label} · +50 演化点`);
    }
  }
  canComplete(chapter: number) { return this.state.unlockedChapters.includes(chapter) && this.taskProgress(chapter).slice(0, 3).every(t => t.current >= t.target); }
  complete(chapter: number) {
    if (!this.state.unlockedChapters.includes(chapter) || !this.canComplete(chapter)) return false;
    if (!this.state.completedChapters.includes(chapter)) this.state.completedChapters.push(chapter);
    this.award(`complete:${chapter}`, 100); this.changed(); return true;
  }
  unlock(chapter: number, _cost = UNLOCK_COST) {
    if (!Number.isInteger(chapter) || chapter < 2 || chapter > 8) return '章节数据无效。';
    const cost = UNLOCK_COST;
    if (this.state.unlockedChapters.includes(chapter)) { this.setChapter(chapter); return ''; }
    if (!this.state.completedChapters.includes(chapter - 1)) return '先完成上一纪元的三项学习任务，并见证纪元事件。';
    if (this.state.points < cost) return `开启需要 ${cost} 演化点。完成挖掘、体型对比或未答过的题目继续积累。`;
    this.state.points -= cost; this.state.unlockedChapters.push(chapter); this.state.chapter = chapter; this.changed(); return '';
  }
  setChapter(chapter: number) { if (this.state.unlockedChapters.includes(chapter)) { this.state.chapter = chapter; this.changed(); } }
  badge(name: string) { if (!this.state.badges.includes(name)) { this.state.badges.push(name); this.changed(); } }
  inquiryBadge(id: InquiryBadgeId) {
    if (this.options.persist === false || !isInquiryBadge(id) || this.state.badges.includes(id)) return false;
    this.state.badges.push(id); this.changed(); return true;
  }
  settings(settings: Partial<Progress['settings']>) { Object.assign(this.state.settings, settings); this.changed(); }
  export() { return JSON.stringify(this.state, null, 2); }
  import(raw: string) { if (raw.length > 250000) throw new Error('记录文件过大。'); this.state = validateProgress(JSON.parse(raw), this.species, this.questions); this.checkTasks(); this.changed(); }
  reset() { this.state = freshProgress(); this.changed(); }
}
