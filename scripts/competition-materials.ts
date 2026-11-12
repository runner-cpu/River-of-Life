import { cpSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';

const slash = (path: string) => path.replaceAll('\\', '/');
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const markdownLink = /(!?)\[([^\]\n]*)\]\((<[^>\n]+>|[^\s)\n]+)\)/g;

// The supplied materials use inline links. Code samples remain literal text.
export function rewriteMarkdownLinks(markdown: string, rewrite: (url: string) => string) {
  return markdown.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part, index) => index % 2 ? part :
    part.replace(markdownLink, (_match, image, label, url: string) => `${image}[${label}](${rewrite(url.replace(/^<|>$/g, ''))})`),
  ).join('');
}

function localReference(url: string) {
  if (/^(https?:\/\/|mailto:)/i.test(url)) return undefined;
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || /^[\\/]/.test(url)) throw new Error(`Unsafe material reference: ${url}`);
  const boundary = url.search(/[?#]/);
  return { path: decodeURIComponent(boundary < 0 ? url : url.slice(0, boundary)), suffix: boundary < 0 ? '' : url.slice(boundary) };
}

function inside(root: string, path: string) {
  const result = relative(root, path);
  if (isAbsolute(result) || result === '..' || result.startsWith(`..${sep}`)) throw new Error(`Reference escapes its root: ${path}`);
  return path;
}

export function materialDestination(source: string) {
  if (source === 'docs/project-introduction.md') return 'materials/project-introduction-detailed.md';
  if (['docs/project-introduction.pdf', 'output/pdf/life-museum-project-introduction.pdf'].includes(source)) return '项目介绍.pdf';
  if (source.startsWith('docs/competition/')) return source.replace('docs/competition/', 'materials/');
  if (source.startsWith('docs/images/')) return source.replace('docs/', 'materials/');
  if (source.startsWith('docs/')) return source.replace('docs/', 'documentation/');
  if (source.startsWith('evidence/')) return source.replace('evidence/', /\.(png|jpe?g|webp)$/i.test(source) ? 'screenshots/' : 'verification/');
  if (source.startsWith('public/')) return source.replace('public/', 'site/');
  if (['AI_USAGE.md', 'CREDITS.md'].includes(source)) return source;
  throw new Error(`No package destination for material: ${source}`);
}

export function collectMaterials(repo: string, target: string, seeds: string[]) {
  const repoRoot = realpathSync(repo), packageRoot = resolve(target);
  const collected = new Map<string, string>();

  function collect(source: string) {
    const sourceFile = inside(repoRoot, realpathSync(resolve(repoRoot, source)));
    source = slash(relative(repoRoot, sourceFile));
    if (collected.has(source)) return collected.get(source)!;
    if (!statSync(sourceFile).isFile()) throw new Error(`Material is not a file: ${source}`);
    const destination = materialDestination(source);
    const output = inside(packageRoot, resolve(packageRoot, destination));
    collected.set(source, destination); // Mark first so cycles terminate.
    mkdirSync(dirname(output), { recursive: true });
    const extension = extname(source).toLowerCase();
    if (extension === '.md') {
      writeFileSync(output, rewriteMarkdownLinks(readFileSync(sourceFile, 'utf8'), url => rewrite(source, destination, url)));
    } else if (extension === '.svg') {
      // Local image/use dependencies belong beside the SVG's package location.
      writeFileSync(output, readFileSync(sourceFile, 'utf8').replace(/((?:xlink:)?href|src)=(['"])(.*?)\2/g,
        (_match, attr, quote, url) => `${attr}=${quote}${escapeHtml(rewrite(source, destination, url))}${quote}`));
    } else cpSync(sourceFile, output);
    return destination;
  }

  function rewrite(source: string, destination: string, url: string) {
    const ref = localReference(url);
    if (!ref || !ref.path) return url;
    const dependency = slash(relative(repoRoot, inside(repoRoot, resolve(dirname(resolve(repoRoot, source)), ref.path))));
    const packaged = collect(dependency);
    return encodeURI(slash(relative(dirname(destination), packaged))) + ref.suffix;
  }

  seeds.forEach(collect);
  return {
    sources: [...collected].map(([source, path]) => ({ source, path })),
    markdownForHtml(source: string) {
      return rewriteMarkdownLinks(readFileSync(resolve(repoRoot, source), 'utf8'), url => rewrite(source, '评审说明.html', url));
    },
  };
}

function renderInline(value: string): string {
  const text = (part: string) => escapeHtml(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return value.split(/(`[^`\n]*`)/g).map((part, index) => {
    if (index % 2) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    let position = 0, result = '';
    for (const match of part.matchAll(markdownLink)) {
      result += text(part.slice(position, match.index));
      const [, image, label, rawUrl] = match;
      const url = rawUrl.replace(/^<|>$/g, '');
      localReference(url); // Reject executable schemes even when called without collection.
      result += image ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(label)}">` : `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
      position = match.index! + match[0].length;
    }
    return result + text(part.slice(position));
  }).join('');
}

export function renderMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/), html: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (line.startsWith('```')) {
      const code: string[] = [];
      while (++index < lines.length && !lines[index].startsWith('```')) code.push(lines[index]);
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[] = [];
      while (index < lines.length && lines[index].startsWith('|')) rows.push(lines[index++]);
      index--;
      const cells = (row: string, tag: string) => row.split('|').slice(1, -1).map(cell => `<${tag}>${renderInline(cell.trim())}</${tag}>`).join('');
      html.push(`<table><thead><tr>${cells(rows[0], 'th')}</tr></thead><tbody>${rows.slice(2).map(row => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    html.push(heading ? `<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>` : `<p>${renderInline(line)}</p>`);
  }
  return html.join('\n');
}

// Inspect the written tree, independent of the source-to-destination rewrite.
export function verifyMaterialLinks(target: string) {
  const root = realpathSync(target), checked: { from: string; url: string; path: string }[] = [];
  function verify(from: string, url: string) {
    const ref = localReference(url.replaceAll('&amp;', '&'));
    if (!ref || !ref.path) return url;
    const file = inside(root, realpathSync(inside(root, resolve(dirname(from), ref.path))));
    if (!statSync(file).isFile() || !statSync(file).size) throw new Error(`Missing/empty package resource: ${url}`);
    checked.push({ from: slash(relative(root, from)), url, path: slash(relative(root, file)) });
    return url;
  }
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.md')) rewriteMarkdownLinks(readFileSync(file, 'utf8'), url => verify(file, url));
      else if (/\.(html|svg)$/.test(entry.name)) {
        for (const match of readFileSync(file, 'utf8').matchAll(/(?:\b(?:href|src)|xlink:href)=(['"])(.*?)\1/g)) verify(file, match[2]);
      }
    }
  }
  walk(root);
  return checked;
}
