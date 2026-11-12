import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameStore, validateProgress } from '../src/core/store';
import { species } from '../src/content/species';
import { questions } from '../src/content/questions';

const create = () => new GameStore(species, questions);
const chapterSpecies = (chapter: number) => species.filter(s => s.chapter === chapter);
const chapterQuestions = (chapter: number) => questions.filter(q => q.chapter === chapter);
const saveKey = 'life-museum-save-v1';
let storage: { getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>; setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>> };

function databaseStorage(current?: unknown) {
  const records = new Map<string, unknown>(current === undefined ? [] : [['current', structuredClone(current)]]);
  let abortNextWrite = false;
  const get = vi.fn((key: string) => {
    const request = { result: undefined as unknown, onsuccess: undefined as (() => void) | undefined };
    queueMicrotask(() => { request.result = structuredClone(records.get(key)); request.onsuccess?.(); });
    return request;
  });
  const put = vi.fn((value: unknown, key: string) => records.set(key, structuredClone(value)));
  const database = { transaction: (_name: string, mode?: string) => {
    const before = new Map(records), abort = mode === 'readwrite' && abortNextWrite;
    if (mode === 'readwrite') abortNextWrite = false;
    const transaction = { objectStore: () => ({ get, put }), oncomplete: undefined as (() => void) | undefined, onabort: undefined as (() => void) | undefined };
    if (mode === 'readwrite') queueMicrotask(() => {
      if (abort) { records.clear(); before.forEach((value, key) => records.set(key, value)); transaction.onabort?.(); }
      else transaction.oncomplete?.();
    });
    return transaction;
  } };
  vi.stubGlobal('indexedDB', { open: () => {
    const request = { result: database, onsuccess: undefined as (() => void) | undefined };
    queueMicrotask(() => request.onsuccess?.()); return request;
  } });
  return { records, get, put, abortNextWrite: () => { abortNextWrite = true; } };
}

function learn(store: GameStore, chapter: number, all = false) {
  for (const s of chapterSpecies(chapter).slice(0, all ? undefined : 3)) { store.observe(s.id); store.read(s.id); }
  for (const q of chapterQuestions(chapter).slice(0, all ? undefined : 3)) store.answer(q.id, q.correct);
}

beforeEach(() => {
  const values = new Map<string, string>();
  storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('indexedDB', undefined);
});
afterEach(() => { vi.useRealTimers(); });

describe('museum progression and economy', () => {
  it('opens the valid local backup when database startup stalls and closes late connections',async()=>{
    vi.useFakeTimers();const saved=create();saved.observe(species[0].id);
    const close=vi.fn(),request={result:{close},onsuccess:undefined as undefined|(()=>void)};
    vi.stubGlobal('indexedDB',{open:()=>request});
    const loaded=create(),initializing=loaded.init();await vi.advanceTimersByTimeAsync(4000);await initializing;
    expect(loaded.state.observed).toEqual([species[0].id]);
    request.onsuccess?.();expect(close).toHaveBeenCalledTimes(1);
  });
  it('opens the valid local backup when the database read never replies',async()=>{
    vi.useFakeTimers();const saved=create();saved.observe(species[1].id);const close=vi.fn();
    vi.stubGlobal('indexedDB',{open:()=>{
      const request={result:{close,transaction:()=>({objectStore:()=>({get:()=>({})})})},onsuccess:undefined as undefined|(()=>void)};
      queueMicrotask(()=>request.onsuccess?.());return request;
    }});
    const loaded=create(),initializing=loaded.init();await vi.advanceTimersByTimeAsync(4000);await initializing;
    expect(loaded.state.observed).toEqual([species[1].id]);expect(close).toHaveBeenCalledTimes(1);
    loaded.read(species[1].id);expect(JSON.parse(storage.getItem(saveKey)!).read).toEqual([species[1].id]);
  });
  it('grants the first discovery free, requires observation before reading and reading before paid collection', () => {
    const store = create(), [first, second] = species;
    expect(store.read(second.id)).toBe(0);
    expect(store.collect(second.id)).toContain('先观察');
    expect(store.observe(first.id)).toBe(5);
    expect(store.state.collected).toEqual([first.id]);
    expect(store.state.points).toBe(5);
    expect(store.read(first.id)).toBe(3);
    expect(store.state.points).toBe(8);
    expect(validateProgress(JSON.parse(store.export()), species, questions).points).toBe(8);
  });

  it('never repeats observation, reading, quiz, digging, task, comparison, or chapter rewards', () => {
    const store = create();
    learn(store, 1); store.compare(species[0].id); store.excavate(1); store.complete(1);
    const earned = store.state.totalEarned;
    learn(store, 1); store.compare(species[0].id); store.excavate(1); store.complete(1);
    const points = store.state.points;
    store.collect(species[0].id); store.collect(species[0].id);
    expect(store.state.points).toBe(points);
    expect(store.state.totalEarned).toBe(earned);
    for (const key of ['observed', 'read', 'answered', 'compared', 'excavated', 'events', 'completedChapters'] as const) expect(new Set<string | number>(store.state[key]).size).toBe(store.state[key].length);
  });

  it('rejects actions for locked, unknown, unpublished, or unsourced taxa', () => {
    const unpublished = { ...species[0], id: 'unpublished', status: 'review' as const };
    const unsourced = { ...species[0], id: 'unsourced', sources: [] };
    const store = new GameStore([...species, unpublished, unsourced], [...questions, { ...questions[0], id: 'bad-q', speciesId: unpublished.id }]);
    const before = store.export();
    for (const id of ['unknown', chapterSpecies(2)[0].id, unpublished.id, unsourced.id]) {
      expect(store.observe(id)).toBe(0); expect(store.read(id)).toBe(0); store.compare(id); store.collect(id);
    }
    expect(store.answer(chapterQuestions(2)[0].id, 0).points).toBe(0);
    expect(store.answer('bad-q', questions[0].correct).points).toBe(0);
    expect(store.excavate(2)).toBe(0); expect(store.complete(2)).toBe(false);
    expect(store.export()).toBe(before);
  });

  it('failed and invalid answers do not earn points; a later correct answer earns once', () => {
    const store = create(), q = questions[0];
    for (let i = 0; i < 2; i++) expect(store.answer(q.id, (q.correct + 1) % 4)).toEqual({ correct: false, points: 0 });
    expect(store.state.mistakes).toEqual([q.id]);
    expect(store.answer(q.id, -1).points).toBe(0);
    expect(store.answer(q.id, NaN).points).toBe(0);
    expect(store.state.totalEarned).toBe(0);
    expect(store.answer(q.id, q.correct).points).toBe(10);
    expect(store.answer(q.id, q.correct).points).toBe(0);
  });

  it('charges exactly 150 for valid chapter 2–8 unlocks and rejects malformed chapters', () => {
    const store = create(); learn(store, 1); expect(store.canComplete(1)).toBe(true); store.complete(1);
    const before = store.state.points;
    for (const chapter of [-1, 0, 1, 2.5, 9, Infinity, NaN]) expect(store.unlock(chapter, -999)).not.toBe('');
    expect(store.state.points).toBe(before);
    expect(store.unlock(3, -1)).not.toBe('');
    expect(store.unlock(2, -1000)).toBe(''); expect(store.state.points).toBe(before - 150);
    expect(store.unlock(2, 100000)).toBe(''); expect(store.state.points).toBe(before - 150);
  });

  it('rejects negative collection prices and insufficient balances', () => {
    const altered = species.map(s => ({ ...s })); altered[1].cost = -50;
    const store = new GameStore(altered, questions); store.observe(altered[0].id); store.observe(altered[1].id); store.read(altered[1].id);
    const before = store.state.points;
    expect(store.collect(altered[1].id)).toContain('无效'); expect(store.state.points).toBe(before);
    store.observe(species[2].id); store.read(species[2].id);
    expect(store.collect(species[2].id)).not.toBe('已加入你的生命图鉴'); expect(store.state.points).toBeGreaterThanOrEqual(0);
  });

  it('preserves the next unlock reserve when optional collections exhaust available spending', () => {
    const store = create(); learn(store, 1); store.complete(1);
    for (const s of chapterSpecies(1)) { store.observe(s.id); store.read(s.id); store.collect(s.id); }
    expect(store.state.points).toBeGreaterThanOrEqual(150);
    expect(store.unlock(2)).toBe('');
  });

  it('completes all eight chapters and collects all 48 species using only finite rewards', () => {
    const store = create();
    for (let chapter = 1; chapter <= 8; chapter++) {
      learn(store, chapter, true); store.excavate(chapter); store.compare(chapterSpecies(chapter)[0].id);
      expect(store.complete(chapter)).toBe(true);
      for (const s of chapterSpecies(chapter)) store.collect(s.id);
      expect(store.state.points).toBeGreaterThanOrEqual(0);
      if (chapter < 8) expect(store.unlock(chapter + 1)).toBe('');
      expect(() => validateProgress(JSON.parse(store.export()), species, questions)).not.toThrow();
    }
    for (const s of species) store.collect(s.id);
    expect(store.state.collected).toHaveLength(48);
    expect(store.state.completedChapters).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(store.state.totalEarned).toBe(4784);
    const costs = species.filter(s => s.id !== species[0].id && !Array.from({ length: 8 }, (_, i) => chapterSpecies(i + 1)[0].id).includes(s.id)).reduce((sum, s) => sum + s.cost, 0);
    expect(store.state.points).toBe(4784 - 1050 - costs);
  });
});

describe('safe save handling', () => {
  it('restores newer IndexedDB learning after localStorage stops accepting writes across sessions', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T00:00:00Z'));
    const database = databaseStorage(), first = create(); await first.init(); first.observe(species[0].id);
    const olderLocal = storage.getItem(saveKey);
    vi.setSystemTime(new Date('2026-10-30T00:01:00Z'));
    storage.setItem.mockImplementation(() => { throw new Error('quota'); }); first.read(species[0].id);
    expect(JSON.parse(olderLocal!).points).toBe(5); expect((database.records.get('current') as { points: number }).points).toBe(8);
    const next = create(); await next.init();
    expect(next.state.points).toBe(8); expect(next.state.read).toContain(species[0].id); expect(next.state.updatedAt).toBe('2026-10-30T00:01:00.000Z');
    next.observe(species[1].id);
    expect((database.records.get('current') as { read: string[] }).read).toContain(species[0].id);
    expect(database.get).toHaveBeenCalledTimes(2);
  });

  it('keeps newer local progress when the database has an older valid snapshot', async () => {
    const first = create(); first.observe(species[0].id); first.state.updatedAt = '2026-10-29T00:00:00Z';
    databaseStorage(JSON.parse(first.export())); first.read(species[0].id); first.state.updatedAt = '2026-10-30T00:00:00Z';
    storage.setItem(saveKey, first.export());
    const next = create(); await next.init(); expect(next.state.points).toBe(8); expect(next.state.updatedAt).toBe('2026-10-30T00:00:00Z');
  });

  it('orders consecutive snapshots even when writes happen in the same clock tick', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T00:00:00Z'));
    const database = databaseStorage(), first = create(); await first.init(); first.observe(species[0].id);
    const older = JSON.parse(storage.getItem(saveKey)!); storage.setItem.mockImplementation(() => { throw new Error('quota'); }); first.read(species[0].id);
    const newer = database.records.get('current') as { updatedAt: string };
    expect(Date.parse(newer.updatedAt)).toBeGreaterThan(Date.parse(older.updatedAt));
    const next = create(); await next.init(); expect(next.state.points).toBe(8); expect(next.state.read).toContain(species[0].id);
  });

  it.each(['{', JSON.stringify({ version: 1, points: 50000 })])('recovers valid database progress and preserves invalid local input (%#)', async invalid => {
    const original = create(); original.observe(species[0].id); original.read(species[0].id);
    databaseStorage(JSON.parse(original.export())); storage.setItem(saveKey, invalid); storage.setItem.mockClear();
    const next = create(); await next.init();
    expect(next.state.points).toBe(8); expect(storage.getItem(saveKey)).toBe(invalid); expect(storage.setItem).not.toHaveBeenCalled();
    const notice = vi.fn(); next.onNotice(notice); expect(notice).toHaveBeenCalled();
    next.observe(species[1].id);
    expect(storage.setItem.mock.calls.some(([key, raw]) => key.startsWith(`${saveKey}-recovery-`) && raw === invalid)).toBe(true);
    expect(JSON.parse(storage.getItem(saveKey)!).read).toContain(species[0].id);
  });

  it('recovers local progress while preserving an invalid database snapshot before the next write', async () => {
    const original = create(); original.observe(species[0].id);
    const invalid = { version: 1, points: 50000 }, database = databaseStorage(invalid);
    const next = create(); await next.init(); expect(next.state.points).toBe(5); expect(database.records.get('current')).toEqual(invalid);
    next.read(species[0].id);
    expect([...database.records.entries()].some(([key, value]) => key.startsWith('recovery-') && JSON.stringify(value) === JSON.stringify(invalid))).toBe(true);
    expect((database.records.get('current') as { points: number }).points).toBe(8);
  });

  it('retries the original database backup after its recovery transaction aborts', async () => {
    const original = create(); original.observe(species[0].id);
    const invalid = { version: 1, points: 50000 }, database = databaseStorage(invalid);
    const next = create(); await next.init(); database.abortNextWrite(); next.read(species[0].id);
    await Promise.resolve();
    expect(database.records.get('current')).toEqual(invalid);
    expect([...database.records.keys()].some(key => key.startsWith('recovery-'))).toBe(false);
    next.observe(species[1].id); await Promise.resolve();
    expect([...database.records.entries()].some(([key, value]) => key.startsWith('recovery-') && JSON.stringify(value) === JSON.stringify(invalid))).toBe(true);
    expect((database.records.get('current') as { points: number; read: string[] }).points).toBe(13);
    expect((database.records.get('current') as { read: string[] }).read).toContain(species[0].id);
  });

  it('roundtrips real exports including a fossil collected without reading', () => {
    const original = create(); original.observe(species[1].id); original.excavate(1); original.compare(species[0].id);
    expect(original.state.read).not.toContain(species[0].id);
    const imported = create(); imported.import(original.export());
    expect({ ...imported.state, events: [...imported.state.events].sort(), updatedAt: '' }).toEqual({ ...original.state, events: [...original.state.events].sort(), updatedAt: '' });
  });

  it('accepts valid legacy saves where a fossil was paid for before excavation', () => {
    const original = create(); original.observe(species[1].id); learn(original, 1, true); original.complete(1); original.collect(species[0].id); original.excavate(1);
    const imported = create(); expect(() => imported.import(original.export())).not.toThrow(); expect(imported.state.points).toBe(original.state.points);
  });

  it('reconstructs completed task events without replaying their 50 point awards', () => {
    const original = create(); learn(original, 1); original.compare(species[0].id); original.excavate(1); original.complete(1);
    const exported = JSON.parse(original.export()); exported.events = [];
    const imported = create(); imported.import(JSON.stringify(exported));
    expect(imported.state.points).toBe(original.state.points);
    expect(imported.state.events.filter(e => e.startsWith('task:'))).toHaveLength(5);
    learn(imported, 1); imported.compare(species[0].id); imported.excavate(1); imported.complete(1);
    expect(imported.state.points).toBe(original.state.points);
  });

  it('rejects a paid collection without reading even when the species is also a dug fossil', () => {
    const original = create(); original.observe(species[1].id); original.excavate(1);
    const payload = JSON.parse(original.export()); payload.points -= species[0].cost;
    expect(() => original.import(JSON.stringify(payload))).toThrow();
  });

  it.each([
    (p: Record<string, any>) => { p.points = -1; },
    (p: Record<string, any>) => { p.points += 1; p.totalEarned += 1; },
    (p: Record<string, any>) => { p.totalEarned += 50; },
    (p: Record<string, any>) => { p.observed.push('unknown'); },
    (p: Record<string, any>) => { p.read.push(species[3].id); },
    (p: Record<string, any>) => { p.compared.push(species[4].id); },
    (p: Record<string, any>) => { p.collected.push(species[5].id); },
    (p: Record<string, any>) => { p.completedChapters.push(1); },
    (p: Record<string, any>) => { p.unlockedChapters.push(3); },
    (p: Record<string, any>) => { p.mistakes.push(chapterQuestions(2)[0].id); },
    (p: Record<string, any>) => { p.events = [{}]; },
    (p: Record<string, any>) => { p.version = 3; },
  ])('rejects inconsistent imports atomically (%#)', mutate => {
    const store = create(); store.observe(species[0].id); const before = store.export(); const payload = JSON.parse(before); mutate(payload);
    expect(() => store.import(JSON.stringify(payload))).toThrow(); expect(store.export()).toBe(before);
  });

  it('rejects invalid JSON and oversized files atomically', () => {
    const store = create(), before = store.export();
    expect(() => store.import('{')).toThrow(); expect(() => store.import(' '.repeat(250001))).toThrow(); expect(store.export()).toBe(before);
  });

  it('preview stores neither read nor overwrite saved data even before init', async () => {
    const saved = create(); saved.observe(species[0].id); const raw = storage.getItem(saveKey);
    storage.setItem.mockClear(); storage.getItem.mockClear();
    const preview = new GameStore(species, questions, { persist: false });
    preview.observe(species[1].id); preview.read(species[1].id); preview.excavate(1); await preview.init(); preview.reset();
    expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.getItem(saveKey)).toBe(raw);
  });

  it('loads a valid local save and handles storage read/write failures', async () => {
    const saved = create(); saved.observe(species[0].id);
    const loaded = create(); await loaded.init(); expect(loaded.state.points).toBe(5);
    storage.getItem.mockImplementation(() => { throw new Error('unavailable'); });
    storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    const store = create(), notice = vi.fn(); store.onNotice(notice);
    await expect(store.init()).resolves.toBeUndefined(); expect(() => store.observe(species[0].id)).not.toThrow();
    expect(store.state.points).toBe(5); expect(notice.mock.calls.flat().join(' ')).toContain('无法读取'); expect(notice.mock.calls.flat().join(' ')).toContain('未能保存');
  });

  it('reports corrupt saved progress and starts fresh without overwriting the original', async () => {
    const invalid = JSON.stringify({ version: 1, points: 50000 }); storage.setItem(saveKey, invalid); storage.setItem.mockClear();
    const store = create(), notice = vi.fn(); store.onNotice(notice); await store.init();
    expect(store.state.points).toBe(0); expect(store.state.observed).toEqual([]); expect(notice).toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.getItem(saveKey)).toBe(invalid);
  });
});


describe('Progress v1 migration', () => {
  it('reconciles migrated v1 and v2 replicas by original timestamp without startup writes', async () => {
    const original = create(); original.observe(species[0].id);
    const legacy = {...original.state, version:1, badges:['old','inquiry-reserved-judgment'], updatedAt:'2026-10-29T00:00:00Z'};
    const newer = {...original.state, badges:['inquiry-reproduction'], updatedAt:'2026-10-30T00:00:00Z'};
    storage.setItem(saveKey, JSON.stringify(legacy)); const database = databaseStorage(newer); storage.setItem.mockClear();
    const next = create(); await next.init(); expect(next.state).toEqual(newer); expect(storage.setItem).not.toHaveBeenCalled(); expect(database.put).not.toHaveBeenCalled();
    storage.setItem(saveKey, JSON.stringify({...legacy,updatedAt:'2026-11-01T00:00:00Z'})); storage.setItem.mockClear();
    const migrated = create(); await migrated.init(); expect(migrated.state.version).toBe(2); expect(migrated.state.badges).toEqual(['old']);
    expect(migrated.state.updatedAt).toBe('2026-11-01T00:00:00Z'); expect(migrated.state.points).toBe(original.state.points); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('imports v1 without retroactive badges and rejects an invalid legacy ledger atomically', () => {
    const store = create(); store.observe(species[0].id); const legacy = {...store.state,version:1,badges:['legacy','inquiry-reproduction']};
    store.import(JSON.stringify(legacy)); expect(store.state.version).toBe(2); expect(store.state.badges).toEqual(['legacy']); expect(store.state.points).toBe(5);
    const before=store.export(); expect(()=>store.import(JSON.stringify({...legacy,totalEarned:999}))).toThrow(); expect(store.export()).toBe(before);
    expect(validateProgress(JSON.parse(before),species,questions)).toEqual(store.state);
  });
});
