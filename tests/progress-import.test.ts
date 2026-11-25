import { describe, expect, it, vi } from 'vitest';
import { createProgressImport } from '../src/core/progress-import';

function setup() {
  let active = true, writable = true;
  const commit = vi.fn(), status = vi.fn(), imported = vi.fn();
  const importer = createProgressImport({ active: () => active, canWrite: () => writable, commit, status, imported });
  return { importer, commit, status, imported, close: () => { active = false; }, deny: () => { writable = false; } };
}
function deferredFile(size = 100) {
  let resolve!: (raw: string) => void, reject!: (reason: Error) => void;
  const text = vi.fn(() => new Promise<string>((yes, no) => { resolve = yes; reject = no; }));
  return { file: { size, text }, resolve: (raw: string) => resolve(raw), reject: () => reject(new Error('读取失败')) };
}
describe('settings file import lifecycle', () => {
  it('commits only the newest selection when reads resolve in reverse order', async () => {
    const { importer, commit, status } = setup(), first = deferredFile(), second = deferredFile();
    const older = importer.select(first.file), latest = importer.select(second.file);
    expect(status).toHaveBeenLastCalledWith('正在读取探索记录…');
    second.resolve('new'); await latest; first.resolve('old'); await older; expect(commit.mock.calls).toEqual([['new']]);
  });
  it.each(['empty', 'oversized'] as const)('invalidates a pending read on %s selection', async selection => {
    const { importer, commit } = setup(), file = deferredFile(), pending = importer.select(file.file);
    await importer.select(selection === 'empty' ? undefined : { size: 400001, text: vi.fn() });
    file.resolve('old'); await pending; expect(commit).not.toHaveBeenCalled();
  });
  it('catches read rejection and allows the same file to be retried', async () => {
    const { importer, commit, status } = setup(), file = deferredFile(), failed = importer.select(file.file);
    file.reject(); await failed; expect(status).toHaveBeenLastCalledWith('读取失败'); expect(commit).not.toHaveBeenCalled();
    const retry = importer.select(file.file); file.resolve('good'); await retry; expect(commit).toHaveBeenCalledWith('good');
  });
  it.each(['close', 'dispose', 'cancel', 'deny'] as const)('does not commit after %s', async action => {
    const context = setup(), file = deferredFile(), pending = context.importer.select(file.file);
    if (action === 'close') context.close(); else if (action === 'deny') context.deny(); else context.importer[action]();
    file.resolve('old'); await pending; expect(context.commit).not.toHaveBeenCalled(); expect(context.imported).not.toHaveBeenCalled();
  });
  it('never reads files while read-only', async () => {
    const context = setup(), file = deferredFile(); context.deny(); await context.importer.select(file.file);
    expect(file.file.text).not.toHaveBeenCalled(); expect(context.commit).not.toHaveBeenCalled();
  });
  it('uses separate byte and parsed character caps', async () => {
    const { importer, commit, status } = setup();
    await importer.select({ size: 400000, text: async () => 'x'.repeat(250000) }); expect(commit).toHaveBeenCalledTimes(1);
    await importer.select({ size: 400000, text: async () => 'x'.repeat(250001) }); expect(commit).toHaveBeenCalledTimes(1); expect(status).toHaveBeenLastCalledWith('记录文件过大。');
  });
});
