import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { species } from '../src/content/species';
import type { ModelAsset } from '../src/core/types';

// Audit the actual release bytes, independently of the manifest's claimed budgets.
type Accessor = { count: number; min?: number[]; max?: number[] };
type Primitive = { mode?: number; indices?: number; attributes: Record<string, number> };
type Gltf = {
  asset: { version: string };
  buffers?: { uri?: string; byteLength: number }[];
  images?: { uri?: string; bufferView?: number; mimeType?: string }[];
  accessors?: Accessor[];
  meshes?: { primitives: Primitive[] }[];
  nodes?: { mesh?: number; children?: number[] }[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
  animations?: { name?: string; channels: unknown[]; samplers: { input: number }[] }[];
  extensionsRequired?: string[];
};
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'public/models/manifest.json'), 'utf8')) as ModelAsset[];
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
assert(new Set(manifest.map(model => model.speciesId)).size === manifest.length, 'Duplicate model species ID');
const results = manifest.map((model) => {
  const label = model.speciesId;
  assert(species.some(entry => entry.id === label), `${label}: model has no published species card`);
  assert(model.url === `/models/${label}.glb`, `${label}: unexpected release path`);
  assert(model.source.startsWith('https://') && model.author && model.note, `${label}: incomplete provenance`);
  assert(['CC0-1.0', 'CC-BY-4.0'].includes(model.license), `${label}: unsupported or unverified license`);
  if (model.license === 'CC-BY-4.0') {
    assert(model.licenseUrl === 'https://creativecommons.org/licenses/by/4.0/' && model.title && model.modifications, `${label}: attribution requires original title, license link, and modifications`);
  }
  const data = readFileSync(resolve(root, `public${model.url}`));
  assert(data.toString('ascii', 0, 4) === 'glTF' && data.readUInt32LE(4) === 2, `${label}: invalid GLB v2 header`);
  assert(data.readUInt32LE(8) === data.length, `${label}: truncated/trailing GLB bytes`);
  let gltf: Gltf | undefined;
  let binaryBytes = 0;
  for (let offset = 12; offset < data.length;) {
    const length = data.readUInt32LE(offset), type = data.readUInt32LE(offset + 4);
    assert(length % 4 === 0 && offset + 8 + length <= data.length, `${label}: invalid GLB chunk`);
    if (type === 0x4e4f534a) gltf = JSON.parse(data.toString('utf8', offset + 8, offset + 8 + length)) as Gltf;
    if (type === 0x004e4942) binaryBytes += length;
    offset += 8 + length;
  }
  assert(gltf?.asset.version === '2.0', `${label}: no glTF 2 JSON`);
  assert(!(gltf.extensionsRequired?.length), `${label}: requires an external decoder/extension`);
  assert((gltf.buffers ?? []).every((b) => !b.uri && b.byteLength <= binaryBytes), `${label}: external or invalid buffer`);
  assert((gltf.images ?? []).every((i) => !i.uri && i.bufferView !== undefined), `${label}: nonembedded image`);
  const accessors = gltf.accessors ?? [];
  const meshTriangles = (gltf.meshes ?? []).map((mesh) => mesh.primitives.reduce((sum, primitive) => {
    const count = accessors[primitive.indices ?? primitive.attributes.POSITION]?.count;
    assert(Number.isInteger(count) && count > 0, `${label}: invalid primitive accessor`);
    const mode = primitive.mode ?? 4;
    assert(mode === 4 || mode === 5 || mode === 6, `${label}: nontriangle geometry`);
    assert(mode !== 4 || count % 3 === 0, `${label}: incomplete triangle`);
    return sum + (mode === 4 ? count / 3 : Math.max(0, count - 2));
  }, 0));
  const nodes = gltf.nodes ?? [];
  const visit = (id: number, ancestors: Set<number>): number => {
    assert(nodes[id] && !ancestors.has(id), `${label}: invalid/cyclic scene node`);
    const node = nodes[id], next = new Set(ancestors).add(id);
    return (node.mesh === undefined ? 0 : meshTriangles[node.mesh]) + (node.children ?? []).reduce((sum, child) => sum + visit(child, next), 0);
  };
  const triangles = (gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []).reduce((sum, id) => sum + visit(id, new Set()), 0);
  const animations = (gltf.animations ?? []).map((animation, index) => {
    assert(animation.channels.length && animation.samplers.length, `${label}: empty animation`);
    for (const sampler of animation.samplers) {
      const input = accessors[sampler.input];
      assert(input && input.count > 1 && (input.max?.[0] ?? 0) > (input.min?.[0] ?? 0), `${label}: zero-duration animation`);
    }
    return animation.name ?? `animation_${index}`;
  });
  assert(triangles > 0 && triangles <= 20_000 && triangles === model.triangles, `${label}: triangle budget/manifest mismatch (${triangles})`);
  assert(data.length <= 2 * 1024 * 1024 && data.length === model.bytes, `${label}: byte budget/manifest mismatch`);
  assert(JSON.stringify(animations) === JSON.stringify(model.animations) && model.static === !animations.length, `${label}: animation manifest mismatch`);
  return { speciesId: label, triangles, bytes: data.length, animations, static: !animations.length, embeddedImages: gltf.images?.length ?? 0, externalResources: 0, requiredExtensions: gltf.extensionsRequired ?? [], sha256: createHash('sha256').update(data).digest('hex') };
});
const releaseFiles = readdirSync(resolve(root, 'public/models')).filter((name) => name.endsWith('.glb')).sort();
assert(JSON.stringify(releaseFiles) === JSON.stringify(manifest.map((model) => `${model.speciesId}.glb`).sort()), 'Unmanifested or missing release GLB');
const audit = { checkedAt: new Date().toISOString(), budgets: { maxTriangles: 20_000, maxBytes: 2 * 1024 * 1024 }, results, errors: [] };
writeFileSync(resolve(root, 'evidence/model-validation.json'), `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Validated ${results.length} embedded GLB models; ${results.reduce((sum, item) => sum + item.bytes, 0)} bytes total.`);
