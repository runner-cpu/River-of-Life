import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { species, speciesRecords } from '../src/content/species';
import { chapters } from '../src/content/chapters';
import { questions } from '../src/content/questions';
import { inquiries } from '../src/content/inquiries';
import type { ModelAsset } from '../src/core/types';

const errors: string[] = [];
const check = (condition: unknown, message: string) => { if (!condition) errors.push(message); };
const nonempty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ids = new Set<string>();
const chapterIds = new Set(chapters.map((chapter) => chapter.id));
const publicIds = new Map(species.map((entry) => [entry.id, entry]));
const today = new Date().toISOString().slice(0, 10);
const isHttps = (value: string) => {
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname); } catch { return false; }
};

check(chapters.length === 8, `Expected 8 chapters, received ${chapters.length}`);
check(chapterIds.size === chapters.length, 'Duplicate chapter ids');
for (const chapter of chapters) {
  check(chapter.id >= 1 && chapter.id <= 8, `Invalid chapter id ${chapter.id}`);
  for (const field of ['name', 'subtitle', 'range', 'title', 'description', 'question', 'takeaway', 'event', 'eventDescription', 'accent', 'icon'] as const) {
    check(nonempty(chapter[field]), `Chapter ${chapter.id}: missing ${field}`);
  }
  check(Number.isFinite(chapter.startMya) && Number.isFinite(chapter.endMya) && chapter.startMya > chapter.endMya && chapter.endMya >= 0, `Chapter ${chapter.id}: invalid time bounds`);
  check(chapter.cost === (chapter.id === 1 ? 0 : 150), `Chapter ${chapter.id}: invalid cost`);
  check(species.filter((entry) => entry.chapter === chapter.id).length === 6, `Chapter ${chapter.id}: expected six public cards`);
  check(questions.filter((question) => question.chapter === chapter.id).length >= 3, `Chapter ${chapter.id}: fewer than 3 questions`);
}

check(speciesRecords.length === 48, `Expected 48 source records, received ${speciesRecords.length}`);
check(species.length === 48, `Release requires 48 published, sourced cards, received ${species.length}`);
for (const entry of speciesRecords) {
  check(idPattern.test(entry.id), `Invalid id: ${entry.id}`);
  check(!ids.has(entry.id), `Duplicate species id ${entry.id}`);
  ids.add(entry.id);
  for (const field of ['name', 'latin', 'period', 'sizeLabel', 'taxonomy', 'diet', 'habitat', 'definition', 'fact', 'misconception', 'extinction', 'color', 'form'] as const) {
    check(nonempty(entry[field]), `${entry.id}: missing ${field}`);
  }
  check(chapterIds.has(entry.chapter), `${entry.id}: unknown chapter`);
  check(Number.isFinite(entry.startMya) && Number.isFinite(entry.endMya) && entry.startMya > entry.endMya && entry.endMya >= 0, `${entry.id}: invalid time bounds`);
  check(Number.isFinite(entry.lengthM) && entry.lengthM > 0, `${entry.id}: invalid size`);
  check(/^#[0-9a-f]{6}$/i.test(entry.color), `${entry.id}: invalid hex color`);
  check(entry.cost === { common: 20, rare: 35, star: 60 }[entry.rarity], `${entry.id}: cost does not match rarity`);
  check(entry.status === 'published', `${entry.id}: review record blocks release`);
  check(Array.isArray(entry.sources) && entry.sources.length > 0, `${entry.id}: missing sources`);
  for (const source of entry.sources) {
    check(nonempty(source.title) && isHttps(source.url), `${entry.id}: source needs a title and accessible HTTPS address`);
    check(['A', 'B', 'C'].includes(source.level), `${entry.id}: D/unverified source blocks release`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(source.checked)
      && Number.isFinite(Date.parse(`${source.checked}T00:00:00Z`))
      && new Date(`${source.checked}T00:00:00Z`).toISOString().slice(0, 10) === source.checked
      && source.checked <= today, `${entry.id}: invalid or future verification date`);
  }
}

check(questions.length >= 120, `Expected at least 120 questions, received ${questions.length}`);
const questionIds = new Set<string>();
const allowedFields = new Set(['definition', 'fact', 'misconception', 'diet', 'habitat', 'period']);
for (const question of questions) {
  check(idPattern.test(question.id) && !questionIds.has(question.id), `Invalid/duplicate question id ${question.id}`);
  questionIds.add(question.id);
  const entry = publicIds.get(question.speciesId);
  check(Boolean(entry), `${question.id}: missing published species link`);
  check(question.chapter === entry?.chapter, `${question.id}: chapter differs from species`);
  check(nonempty(question.prompt) && nonempty(question.explanation), `${question.id}: missing prompt/explanation`);
  check(allowedFields.has(question.field), `${question.id}: invalid knowledge field`);
  check(question.options.length >= 3 && question.options.every(nonempty) && new Set(question.options).size === question.options.length, `${question.id}: invalid or repeated options`);
  check(Number.isInteger(question.correct) && question.correct >= 0 && question.correct < question.options.length, `${question.id}: correct index out of bounds`);
  if (entry) {
    check(question.options[question.correct] === entry[question.field], `${question.id}: correct answer differs from linked card field`);
    check(question.explanation.includes(entry[question.field]), `${question.id}: explanation does not anchor to card`);
  }
}

const manifestPath = path.resolve('public/models/manifest.json');
const inquiryIds = new Set<string>();
for (const activity of inquiries) {
  check(!inquiryIds.has(activity.id) && idPattern.test(activity.id), `Invalid/duplicate inquiry ${activity.id}`);inquiryIds.add(activity.id);
  check(publicIds.has(activity.speciesId), `Inquiry ${activity.id}: missing specimen`);
  check(['A','B'].includes(activity.source.level) && isHttps(activity.source.url) && nonempty(activity.source.scope), `Inquiry ${activity.id}: scoped institutional evidence required`);
  check(activity.observations.length >= 2 && activity.observations.every(nonempty), `Inquiry ${activity.id}: missing observations`);
  for(const phase of ['initial','evidence','transfer'] as const) {
    const q=activity[phase];check(nonempty(q.prompt) && nonempty(q.explanation) && q.options.length >= 3 && q.options.every(nonempty) && new Set(q.options).size === q.options.length && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length, `Inquiry ${activity.id}/${phase}: invalid question`);
  }
}
let modelCount = 0;
if (existsSync(manifestPath)) {
  try {
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const assets: ModelAsset[] = Array.isArray(manifest) ? manifest : (manifest as { assets?: ModelAsset[]; models?: ModelAsset[] }).assets ?? (manifest as { models?: ModelAsset[] }).models ?? [];
    check(Array.isArray(assets) && assets.length > 0, 'Model manifest must contain a nonempty asset array');
    const modelIds = new Set<string>();
    for (const asset of assets) {
      modelCount++;
      check(publicIds.has(asset.speciesId), `Model ${asset.speciesId}: unknown species`);
      check(!modelIds.has(asset.speciesId), `Model ${asset.speciesId}: duplicate assignment`);
      modelIds.add(asset.speciesId);
      check(nonempty(asset.source) && isHttps(asset.source) && nonempty(asset.author) && nonempty(asset.license), `Model ${asset.speciesId}: source/author/license required`);
      check(Number.isInteger(asset.triangles) && asset.triangles > 0 && asset.triangles <= 20_000, `Model ${asset.speciesId}: declared triangles exceed 20k or invalid`);
      check(Number.isInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= 2 * 1024 * 1024, `Model ${asset.speciesId}: declared bytes exceed 2MiB or invalid`);
      check(typeof asset.static === 'boolean' && Array.isArray(asset.animations), `Model ${asset.speciesId}: missing animation/static metadata`);
      check(['reconstruction', 'fossil', 'diagram'].includes(asset.representation) && nonempty(asset.note), `Model ${asset.speciesId}: representation and note required`);
      check(typeof asset.url === 'string' && asset.url.startsWith('/models/') && asset.url.endsWith('.glb'), `Model ${asset.speciesId}: expected local /models/*.glb path`);
      const filePath = path.resolve('public', String(asset.url).replace(/^\/+/, ''));
      const allowedRoot = `${path.resolve('public/models')}${path.sep}`;
      check(filePath.startsWith(allowedRoot), `Model ${asset.speciesId}: path escapes model directory`);
      if (filePath.startsWith(allowedRoot) && existsSync(filePath)) {
        const bytes = statSync(filePath).size;
        check(bytes <= 2 * 1024 * 1024, `Model ${asset.speciesId}: actual file exceeds 2MiB`);
        check(bytes === asset.bytes, `Model ${asset.speciesId}: declared bytes differ from file`);
        const header = readFileSync(filePath).subarray(0, 12);
        check(header.length === 12 && header.toString('utf8', 0, 4) === 'glTF' && header.readUInt32LE(4) === 2 && header.readUInt32LE(8) === bytes, `Model ${asset.speciesId}: invalid GLB header/version/length`);
      } else check(false, `Model ${asset.speciesId}: file missing`);
    }
  } catch (error) { errors.push(`Model manifest unreadable: ${String(error)}`); }
}

if (errors.length) {
  console.error(`Content release gate FAILED (${errors.length})\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Content release gate passed: ${species.length} cards, ${chapters.length} chapters, ${questions.length} anchored questions, ${modelCount} model assets checked.`);
}
