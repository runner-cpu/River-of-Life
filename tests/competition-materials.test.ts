import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { collectMaterials, renderMarkdown, verifyMaterialLinks } from '../scripts/competition-materials';

const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'life-materials-'));
  fixtures.push(root);
  const repo = join(root, 'repo'), target = join(root, 'package');
  mkdirSync(target);
  const write = (path: string, content: string) => {
    mkdirSync(join(repo, path, '..'), { recursive: true });
    writeFileSync(join(repo, path), content);
  };
  return { repo, target, write };
}

it('collects recursive references and rewrites each Markdown and HTML base', () => {
  const { repo, target, write } = fixture();
  write('docs/competition/README.md', '[detail](../project-introduction.md) [pdf](../project-introduction.pdf) [evidence](../../evidence/acceptance.md)');
  write('docs/project-introduction.md', '![view](../evidence/new-view.png) ![architecture](images/project.svg)');
  write('docs/project-introduction.pdf', 'reviewed-pdf');
  write('docs/images/project.svg', '<svg><image href="diagram.png"/></svg>');
  write('docs/images/diagram.png', 'diagram');
  write('evidence/new-view.png', 'screenshot');
  write('evidence/acceptance.md', '[readme](../docs/competition/README.md)');
  const materials = collectMaterials(repo, target, ['docs/competition/README.md']);
  expect(materials.sources).toHaveLength(7);
  expect(readFileSync(join(target, 'materials/README.md'), 'utf8')).toContain('[detail](project-introduction-detailed.md) [pdf](../%E9%A1%B9%E7%9B%AE%E4%BB%8B%E7%BB%8D.pdf) [evidence](../verification/acceptance.md)');
  expect(readFileSync(join(target, 'materials/project-introduction-detailed.md'), 'utf8')).toContain('../screenshots/new-view.png');
  const html = renderMarkdown(materials.markdownForHtml('docs/competition/README.md'));
  expect(html).toContain('href="materials/project-introduction-detailed.md"');
  expect(html).toContain('href="verification/acceptance.md"');
  writeFileSync(join(target, '评审说明.html'), html);
  expect(verifyMaterialLinks(target)).toHaveLength(10);
});

it('fails on missing resources and references outside the repository/package', () => {
  const { repo, target, write } = fixture();
  write('docs/competition/README.md', '[missing](missing.md)');
  expect(() => collectMaterials(repo, target, ['docs/competition/README.md'])).toThrow();
  write('docs/competition/README.md', '[escape](../../../outside.md)');
  expect(() => collectMaterials(repo, target, ['docs/competition/README.md'])).toThrow('escapes');
  writeFileSync(join(target, 'bad.md'), '[escape](../outside.md)');
  expect(() => verifyMaterialLinks(target)).toThrow('escapes');
});

it('renders escaped text, safe clickable links and table links while preserving code', () => {
  const html = renderMarkdown('# <script>\n\n[<unsafe>](https://example.org/?a=1&b=2) **bold** `x < y`\n\n| Evidence |\n| --- |\n| [local](verification/acceptance.md) |\n\n```\n[example](literal.md)\n```');
  expect(html).toContain('<h1>&lt;script&gt;</h1>');
  expect(html).toContain('<a href="https://example.org/?a=1&amp;b=2">&lt;unsafe&gt;</a>');
  expect(html).toContain('<strong>bold</strong> <code>x &lt; y</code>');
  expect(html).toContain('<td><a href="verification/acceptance.md">local</a></td>');
  expect(html).toContain('<pre><code>[example](literal.md)</code></pre>');
  expect(() => renderMarkdown('[bad](javascript:alert)')).toThrow('Unsafe');
  expect(() => renderMarkdown('[bad](//example.org)')).toThrow('Unsafe');
});
