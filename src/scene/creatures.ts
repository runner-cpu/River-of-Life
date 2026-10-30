import * as THREE from 'three';
import type { Species } from '../core/types';
import { createArchaeopteryx } from './avian';

// Original educational morphology diagrams. Colors and motions are artistic choices.
// These meshes are deliberately distinguished from licensed fossil scans in the UI.
const sphere = new THREE.SphereGeometry(1, 20, 14);
const sphereLow = new THREE.SphereGeometry(1, 12, 8);
const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string, roughness = .88) {
  const key = color + roughness;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
  return materials.get(key)!;
}
function ellipsoid(parent: THREE.Object3D, color: string, xyz: number[], scale: number[], low = false) {
  const mesh = new THREE.Mesh(low ? sphereLow : sphere, material(color));
  mesh.position.set(xyz[0], xyz[1], xyz[2]); mesh.scale.set(scale[0], scale[1], scale[2]); parent.add(mesh); return mesh;
}
function rod(parent: THREE.Object3D, color: string, from: THREE.Vector3, to: THREE.Vector3, radius = .05, endRadius = radius) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(endRadius, radius, from.distanceTo(to), 8), material(color));
  mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()); parent.add(mesh); return mesh;
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function curved(parent: THREE.Object3D, color: string, points: number[][], radius: number) {
  const path = new THREE.CatmullRomCurve3(points.map(p => v(p[0], p[1], p[2])));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 16, radius, 7, false), material(color)); parent.add(mesh); return mesh;
}
function leaf(parent: THREE.Object3D, color: string, xyz: number[], size: number[], angle = 0) {
  const mesh = ellipsoid(parent, color, xyz, size, true); mesh.rotation.z = angle; return mesh;
}
function eyes(parent: THREE.Object3D, x: number, y: number, z: number, size = .09) {
  for (const sign of [-1, 1]) { ellipsoid(parent, '#c8c6a0', [x, y, z * sign], [size * 1.25, size * 1.25, size]); ellipsoid(parent, '#102429', [x - size * .3, y + size * .12, z * sign + sign * size * .65], [size * .65, size * .75, size * .5]); }
}

export function createCreature(s: Pick<Species, 'id' | 'form' | 'color'>): THREE.Group {
  if (s.id === 'archaeopteryx') return createArchaeopteryx();
  const group = new THREE.Group(); group.name = s.id;
  const color = s.color || '#ba8460';
  const dark = '#' + new THREE.Color(color).multiplyScalar(.62).getHexString();
  const light = '#' + new THREE.Color(color).lerp(new THREE.Color('#efdec2'), .35).getHexString();
  const joints: THREE.Object3D[] = [];
  switch (s.form) {
    case 'stromatolite': {
      // The card describes a layered sedimentary structure, not a single organism.
      ellipsoid(group, dark, [0, .02, 0], [1.45, .12, .9], true);
      for (const [x, z, radius] of [[-.55, .1, .8], [.5, -.1, .68], [.1, .48, .48]]) {
        for (let layer = 0; layer < 8; layer++) {
          const fraction = layer / 8;
          const width = radius * Math.sqrt(1 - fraction * fraction);
          ellipsoid(group, layer % 2 ? color : light, [x, .1 + layer * radius * .12, z], [width, radius * .085, width * .8]);
        }
      }
      break;
    }
    case 'branching-plant': {
      rod(group, dark, v(0, 0, 0), v(0, .75, 0), .05, .04);
      for (const sign of [-1, 1]) {
        const fork = v(sign * .4, 1.3, .04 * sign);
        rod(group, color, v(0, .75, 0), fork, .04, .03);
        for (const branch of [-1, 1]) {
          const tip = v(sign * .4 + branch * .26, 1.95 - (branch === sign ? .1 : 0), branch * .12);
          rod(group, color, fork, tip, .03, .022);
          ellipsoid(group, dark, [tip.x, tip.y + .08, tip.z], [.105, .12, .085]);
        }
      }
      break;
    }
    case 'lycopsid': {
      rod(group, dark, v(0, 0, 0), v(0, 2.05, 0), .2, .115);
      // Diamond marks refer to the leaf-base scars quoted in the knowledge card.
      for (let row = 0; row < 8; row++) for (const sign of [-1, 1]) {
        const scar = new THREE.Mesh(new THREE.PlaneGeometry(.07, .09), material(light));
        scar.position.set(sign * .065, .3 + row * .19 + (sign > 0 ? .07 : 0), .185 - row * .007);
        scar.rotation.z = Math.PI / 4; group.add(scar);
      }
      for (const sign of [-1, 1]) {
        const fork = v(sign * .55, 2.65, 0);
        rod(group, color, v(0, 2.05, 0), fork, .115, .075);
        for (const branch of [-1, 1]) {
          const tip = v(sign * .55 + branch * .35, 3.12, branch * .2);
          rod(group, color, fork, tip, .075, .035);
          for (let i = 0; i < 7; i++) {
            const angle = (i - 3) * .25;
            leaf(group, i % 2 ? color : light, [tip.x + Math.sin(angle) * .17, tip.y + .12, tip.z], [.035, .3, .045], -angle);
          }
        }
      }
      break;
    }
    case 'cell': {
      for (let chain = 0; chain < 3; chain++) for (let i = 0; i < 9; i++) {
        const x = (i - 4) * .28, z = Math.sin(i * .63 + chain) * .28 + (chain - 1) * .45;
        const cell = ellipsoid(group, chain === 1 ? color : light, [x, .2 + Math.cos(i * .5) * .08, z], [.17, .16, .17]);
        ellipsoid(cell, '#628d58', [0, .3, 0], [.32, .35, .4], true);
      }
      break;
    }
    case 'frond': {
      curved(group, dark, [[0, 0, 0], [0, .8, 0], [.13, 1.8, 0], [.3, 2.5, 0]], .045);
      ellipsoid(group, dark, [0, .03, 0], [.23, .07, .23]);
      for (let i = 0; i < 18; i++) {
        const y = .3 + i * .116, width = Math.sin((i + 2) / 21 * Math.PI) * .55;
        for (const sign of [-1, 1]) {
          const blade = leaf(group, i % 2 ? light : color, [sign * width * .53 + y * y * .035, y, 0], [width, .062, .12], sign * .36);
          joints.push(blade);
        }
      }
      break;
    }
    case 'dickinsonia': {
      ellipsoid(group, dark, [0, .05, 0], [1.2, .16, .74]);
      for (let i = -12; i <= 12; i++) {
        const x = i * .09, width = Math.sqrt(Math.max(0, 1 - (i / 13) ** 2)) * .7;
        const part = ellipsoid(group, i % 2 ? color : light, [x, .13 + (1 - Math.abs(i) / 13) * .07, 0], [.072, .11, width]); part.rotation.y = i * .014;
      }
      curved(group, dark, [[-1.05, .22, 0], [0, .29, 0], [1.05, .22, 0]], .018);
      break;
    }
    case 'trilobite': {
      ellipsoid(group, dark, [.1, .15, 0], [1.3, .26, .7]);
      for (let i = 0; i < 12; i++) {
        const x = -.45 + i * .13, width = .62 - i * .026;
        ellipsoid(group, i % 2 ? color : light, [x, .27, 0], [.13, .24 - i * .008, width]);
        ellipsoid(group, dark, [x, .47 - i * .008, 0], [.075, .045, .16]);
        for (const sign of [-1, 1]) { curved(group, dark, [[x, .1, sign * .3], [x + .13, .05, sign * .65], [x + .2, .02, sign * .78]], .022); }
      }
      ellipsoid(group, color, [-.9, .27, 0], [.5, .32, .76]);
      ellipsoid(group, light, [-1.02, .51, 0], [.25, .1, .21]);
      eyes(group, -.95, .49, .42, .1);
      for (const sign of [-1, 1]) curved(group, dark, [[-1.08, .15, sign * .3], [-1.55, .18, sign * .55], [-1.8, .3, sign * .62]], .025);
      break;
    }
    case 'anomalocaris': case 'opabinia': {
      ellipsoid(group, color, [0, .25, 0], [1.65, .33, .45]);
      for (let i = 0; i < 11; i++) {
        const x = -1 + i * .23, width = .6 - i * .027;
        ellipsoid(group, i % 2 ? light : color, [x, .29, 0], [.17, .3 - i * .01, .44 - i * .015]);
        for (const sign of [-1, 1]) {
          const fin = new THREE.Group(); fin.position.set(x, .18, sign * .3); group.add(fin);
          const blade = ellipsoid(fin, light, [.14, -.04, sign * width * .48], [.32, .046, width]); blade.rotation.y = sign * -.4;
          fin.userData.sign = sign; joints.push(fin);
        }
      }
      for (const sign of [-1, 1]) leaf(group, light, [1.65, .35, sign * .27], [.5, .055, .25], sign * .2).rotation.y = sign * -.55;
      ellipsoid(group, color, [-1.38, .32, 0], [.48, .36, .42]);
      if (s.form === 'opabinia') {
        for (let i = 0; i < 5; i++) { const z = (i - 2) * .17, y = .7 + (i % 2) * .14; rod(group, light, v(-1.45, .45, z), v(-1.5, y, z * 1.4), .035); ellipsoid(group, '#172b2a', [-1.5, y, z * 1.4], [.09, .085, .08]); }
        curved(group, color, [[-1.55, .22, 0], [-2, .1, 0], [-2.4, .28, 0], [-2.55, .55, 0]], .075);
        for (const sign of [-1, 1]) curved(group, dark, [[-2.55, .55, 0], [-2.65, .7, sign * .12], [-2.52, .78, sign * .11]], .035);
      } else {
        for (const sign of [-1, 1]) {
          curved(group, color, [[-1.4, .48, sign * .25], [-1.6, .62, sign * .6], [-1.75, .75, sign * .72]], .06);
          ellipsoid(group, '#152829', [-1.75, .75, sign * .72], [.19, .14, .14]);
          curved(group, dark, [[-1.65, .17, sign * .28], [-2, -.05, sign * .4], [-2.15, -.32, sign * .36], [-1.93, -.55, sign * .25]], .09);
          for (let i = 0; i < 5; i++) rod(group, light, v(-1.78 - i * .06, -.02 - i * .09, sign * .35), v(-1.67 - i * .05, -.2 - i * .1, sign * .24), .025, .005);
        }
      }
      break;
    }
    case 'wiwaxia': {
      ellipsoid(group, color, [0, .25, 0], [1, .45, .6]);
      for (let i = 0; i < 9; i++) for (const sign of [-1, 1]) {
        const x = -.8 + i * .2; leaf(group, i % 2 ? light : dark, [x, .37, sign * .35], [.2, .2, .28], sign * .4);
        rod(group, light, v(x, .55, sign * .2), v(x + .15, 1.25 - Math.abs(x) * .5, sign * .42), .045, .005);
      }
      break;
    }
    case 'worm': {
      curved(group, color, [[-1.5, .15, 0], [-.5, .2, .25], [.3, .17, -.2], [1.3, .2, .1]], .16);
      for (let i = 0; i < 13; i++) {
        const x = -1.3 + i * .2;
        if (s.id.includes('hallucigenia')) for (const sign of [-1, 1]) { rod(group, light, v(x, .22, 0), v(x, .7, sign * .13), .025, .002); curved(group, dark, [[x, .15, 0], [x + .08, -.06, sign * .15], [x + .1, -.2, sign * .13]], .03); }
        else ellipsoid(group, light, [x, .21, Math.sin(i * .5) * .16], [.03, .16, .16], true);
      }
      break;
    }
    case 'ammonite': {
      const points: number[][] = []; for (let i = 0; i <= 90; i++) { const t = i / 90 * Math.PI * 5, r = .08 + i / 90; points.push([Math.cos(t) * r, 1 + Math.sin(t) * r, 0]); }
      curved(group, color, points, .16);
      for (let i = 0; i < 6; i++) curved(group, light, [[-.95, .65, 0], [-1.3, .4 + i * .07, (i - 3) * .06], [-1.7, .2 + i * .1, (i - 3) * .09]], .035);
      break;
    }
    case 'fish': case 'shark': {
      ellipsoid(group, color, [0, .35, 0], [1.5, .52, .42]);
      ellipsoid(group, light, [-.1, .16, 0], [1.22, .25, .38]);
      ellipsoid(group, s.id.includes('dunk') ? dark : color, [-1.05, .4, 0], [.68, .5, .43]);
      eyes(group, -1.35, .56, .36, .085);
      for (const sign of [-1, 1]) { const fin = leaf(group, dark, [-.2, .05, sign * .55], [.6, .05, .46]); fin.rotation.y = sign * -.6; joints.push(fin); }
      leaf(group, dark, [.3, .9, 0], [.44, .47, .05], -.5);
      const tail = new THREE.Group(); tail.position.x = 1.5; group.add(tail); leaf(tail, dark, [.3, .7, 0], [.32, .65, .06], -.55); leaf(tail, dark, [.3, -.05, 0], [.27, .43, .06], .6); joints.push(tail);
      break;
    }
    case 'dragonfly': {
      ellipsoid(group, dark, [0, .5, 0], [1.4, .12, .12]); ellipsoid(group, color, [-.9, .5, 0], [.32, .25, .22]); eyes(group, -1.15, .55, .19, .13);
      for (const sign of [-1, 1]) for (let i = 0; i < 2; i++) { const wing = leaf(group, '#c5d7bd', [-.6 + i * .55, .6, sign * .85], [.38, .025, 1.1]); wing.rotation.y = sign * (i ? -.4 : .3); joints.push(wing); }
      break;
    }
    case 'human': {
      ellipsoid(group, color, [0, 1.2, 0], [.31, .52, .2]); ellipsoid(group, light, [0, 1.95, 0], [.23, .28, .22]);
      for (const sign of [-1, 1]) { rod(group, dark, v(sign * .15, .85, 0), v(sign * .2, .07, .03), .11, .09); rod(group, color, v(sign * .28, 1.5, 0), v(sign * .48, .8, .04), .085, .07); }
      break;
    }
    default: {
      const isDino = ['sauropod', 'theropod', 'triceratops', 'stegosaur', 'dimetrodon', 'reptile', 'tetrapod'].includes(s.form);
      const bird = s.form === 'bird' || s.form === 'pterosaur';
      const large = s.form === 'mammoth' || s.form === 'sauropod';
      ellipsoid(group, color, [0, .9, 0], [1.05, .57, .48]); ellipsoid(group, light, [-.05, .65, 0], [.78, .25, .37]);
      let headX = -1.15, headY = 1.28;
      if (s.form === 'sauropod') { curved(group, color, [[-.7, 1.1, 0], [-1.2, 1.8, 0], [-1.35, 2.9, 0], [-1.8, 3.3, 0]], .22); headX = -1.85; headY = 3.3; }
      else if (s.form === 'theropod') { ellipsoid(group, color, [-.65, 1.35, 0], [.43, .55, .35]); headY = 1.85; }
      else { ellipsoid(group, color, [-.82, 1.2, 0], [.4, .4, .39]); }
      ellipsoid(group, color, [headX, headY, 0], [s.form === 'theropod' ? .6 : .42, .35, .32]); eyes(group, headX - .12, headY + .11, .28, .065);
      if (isDino) curved(group, color, [[.7, .95, 0], [1.5, .9, 0], [2.3, .65, 0], [2.8, .8, .1]], .13);
      const legX = bird || s.form === 'theropod' ? [.35] : [-.6, .6];
      for (const x of legX) for (const sign of [-1, 1]) {
        const leg = new THREE.Group(); leg.position.set(x, .9, sign * .3); group.add(leg);
        ellipsoid(leg, dark, [0, -.33, 0], [large ? .2 : .14, .4, .15]); ellipsoid(leg, color, [-.1, -.78, .03], [.25, .1, .18]); joints.push(leg);
      }
      if (s.form === 'theropod') for (const sign of [-1, 1]) curved(group, dark, [[-.65, 1.15, sign * .32], [-.95, 1, sign * .45], [-1.12, 1.08, sign * .48]], .055);
      if (s.form === 'mammoth') { curved(group, color, [[-1.45, 1.28, 0], [-1.8, .7, 0], [-1.78, .2, 0], [-2.02, .35, 0]], .14); for (const sign of [-1, 1]) { curved(group, '#e9dec5', [[-1.35, 1.05, sign * .23], [-1.85, .72, sign * .38], [-2.3, .9, sign * .38], [-2.45, 1.15, sign * .3]], .06); leaf(group, dark, [-.8, 1.35, sign * .48], [.25, .34, .07]); } }
      if (s.form === 'triceratops') { leaf(group, dark, [-.9, 1.5, 0], [.13, .5, .6]); for (const sign of [-1, 1]) rod(group, '#e4d8b6', v(-1.3, 1.5, sign * .2), v(-1.9, 1.9, sign * .25), .09, .005); rod(group, '#e4d8b6', v(-1.5, 1.3, 0), v(-1.8, 1.6, 0), .075, .005); }
      if (s.form === 'stegosaur' || s.form === 'dimetrodon') for (let i = 0; i < 9; i++) { const x = -.65 + i * .23, h = Math.sin((i + 1) / 10 * Math.PI) * .6; leaf(group, dark, [x, 1.45 + h * .4, (i % 2 ? 1 : -1) * .08], [.2, h, .05], -.2); }
      if (bird) for (const sign of [-1, 1]) { const wing = leaf(group, dark, [0, 1, sign * .9], [.85, .06, 1.2]); wing.rotation.y = sign * -.25; joints.push(wing); }
      break;
    }
  }
  group.userData.joints = joints; group.userData.form = s.form;
  group.traverse(node => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
  return group;
}

export function animateCreature(group: THREE.Group, time: number, speed = 1) {
  const form = group.userData.form;
  (group.userData.joints || []).forEach((joint: THREE.Object3D, index: number) => {
    const wave = Math.sin(time * speed * 2 + index * .44);
    if (form === 'archaeopteryx') joint.rotation.x = Math.sin(time * .7) * .025 * (index ? -1 : 1);
    else if (form === 'anomalocaris' || form === 'opabinia') joint.rotation.x = wave * .17 * (joint.userData.sign || 1);
    else if (form === 'frond') joint.rotation.y = wave * .045;
    else if (form === 'dragonfly' || form === 'bird' || form === 'pterosaur') joint.rotation.x = wave * .18;
    else joint.rotation.z = wave * .06;
  });
}

/** Card artwork is vector and explicitly serves as a morphology diagram. */
export function specimenArt(s: Pick<Species, 'form' | 'color' | 'id'>): string {
  const c = s.color || '#ac825e';
  let shape = '';
  if (s.form === 'stromatolite') {
    shape = `<path d="M30 130Q27 72 67 69Q98 15 133 70Q180 65 181 130Z" fill="${c}" opacity=".35"/>`;
    for (let layer = 0; layer < 7; layer++) {
      const y = 91 + layer * 6;
      shape += `<path d="M${34 - layer * .4} ${y + 12}Q54 ${y - 26} 75 ${y - 9}Q105 ${y - 58} 134 ${y - 8}Q160 ${y - 25} ${178 + layer * .3} ${y + 12}" fill="none" stroke="${c}" stroke-width="3" opacity="${.5 + layer * .06}"/>`;
    }
  } else if (s.form === 'branching-plant') {
    shape = `<path d="M105 134V91M105 91 75 61M105 91 135 61M75 61 55 30M75 61 91 26M135 61 119 26M135 61 155 30" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
    for (const [x, y] of [[55, 27], [91, 23], [119, 23], [155, 27]]) shape += `<ellipse cx="${x}" cy="${y}" rx="6" ry="8" fill="${c}"/>`;
  } else if (s.form === 'lycopsid') {
    shape = `<path d="m98 135 3-63h9l4 63Z" fill="${c}"/><path d="M106 76 78 49M106 76 134 49M78 49 58 28M78 49 89 23M134 49 122 23M134 49 155 28" stroke="${c}" stroke-width="7" fill="none"/>`;
    for (let row = 0; row < 7; row++) for (const x of [104, 109]) shape += `<path d="m${x} ${82 + row * 7} 2 3-2 3-2-3Z" fill="#f3efd7" opacity=".65"/>`;
    for (const [x, y] of [[58, 28], [89, 23], [122, 23], [155, 28]]) for (let i = -2; i <= 2; i++) shape += `<path d="M${x} ${y + 4}l${i * 4} -18" stroke="${c}" stroke-width="2"/>`;
  } else if (s.form === 'frond') {
    shape = `<path d="M100 128Q110 65 105 25" fill="none" stroke="${c}" stroke-width="3"/>`;
    for (let i = 0; i < 12; i++) { const y = 38 + i * 7, width = Math.sin((i + 2) / 15 * Math.PI) * 32; shape += `<path d="M106 ${y + 7}Q${106 - width} ${y + 7} ${106 - width} ${y - 6}Q100 ${y - 5} 106 ${y + 7}M106 ${y + 7}Q${106 + width} ${y + 7} ${106 + width} ${y - 6}Q110 ${y - 5} 106 ${y + 7}" fill="${c}" opacity=".8"/>`; }
  } else if (s.form === 'cell') {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 8; i++) shape += `<circle cx="${40 + i * 17}" cy="${55 + j * 21 + Math.sin(i * .7 + j) * 10}" r="10" fill="${c}" stroke="#fff" stroke-width="2" opacity=".8"/>`;
  } else if (['trilobite', 'dickinsonia', 'wiwaxia'].includes(s.form)) {
    shape = `<ellipse cx="104" cy="82" rx="57" ry="35" fill="${c}" opacity=".25"/>`;
    for (let i = 0; i < 15; i++) { const x = 53 + i * 7, h = Math.sqrt(Math.max(0, 1 - ((i - 7) / 8) ** 2)) * 34; shape += `<path d="M${x - 3} ${82 - h}Q${x + 7} 82 ${x - 3} ${82 + h}" fill="none" stroke="${c}" stroke-width="5"/>`; }
    if (s.form === 'trilobite') shape += `<path d="M65 51Q25 82 65 114Z" fill="${c}"/><circle cx="51" cy="69" r="3" fill="#243b38"/><circle cx="51" cy="96" r="3" fill="#243b38"/>`;
  } else if (['anomalocaris', 'opabinia', 'worm'].includes(s.form)) {
    for (let i = 0; i < 10; i++) { const x = 65 + i * 9, h = 20 - i; shape += `<ellipse cx="${x}" cy="80" rx="10" ry="${h}" fill="${c}"/><path d="M${x} 71l10 -14 -18 5M${x} 89l10 14 -18 -5" fill="${c}" opacity=".6"/>`; }
    shape += `<path d="M64 72Q28 78 43 100M60 89Q33 102 31 91" fill="none" stroke="${c}" stroke-width="5"/><path d="m150 78 25 -12 -9 16 9 13 -25 -10" fill="${c}"/><path d="m67 64 -12 -9m11 42 -12 8" stroke="${c}" stroke-width="4"/><circle cx="53" cy="54" r="5" fill="#243b38"/>`;
  } else if (['fish', 'shark', 'ammonite'].includes(s.form)) {
    shape = s.form === 'ammonite' ? `<path d="M120 89c-35 55-89-17-45-42s87 26 44 51-51-27-25-34 37 23 13 23" stroke="${c}" stroke-width="16" fill="none"/><path d="M119 89q30 16 45 0m-45 6q30 26 39 15" stroke="${c}" stroke-width="4" fill="none"/>` : `<path d="M37 82Q83 36 144 74l32-25-5 34 6 28-34-22Q77 120 37 82Z" fill="${c}"/><path d="m90 65 19-29 14 34m-31 24 20 28 9-29" fill="${c}" opacity=".7"/><circle cx="54" cy="79" r="4" fill="#243b38"/>`;
  } else {
    shape = `<path d="M52 69Q76 50 120 62l24 18 39-2-39 13-8 34h-10l-1-35-39-1-9 35H64l4-41-24-3Z" fill="${c}"/><ellipse cx="47" cy="67" rx="22" ry="16" fill="${c}"/><circle cx="36" cy="63" r="3" fill="#243b38"/>`;
    if (s.form === 'sauropod') shape += `<path d="M60 70Q31 61 43 22l-13-5Q21 65 48 79Z" fill="${c}"/>`;
    if (s.form === 'mammoth') shape += `<path d="M32 67Q20 103 12 92M34 76Q13 88 12 71" stroke="${c}" fill="none" stroke-width="7"/>`;
    if (['stegosaur', 'dimetrodon'].includes(s.form)) shape += `<path d="m65 63 6-25 15 18 7-27 15 29 12-19 9 28" fill="${c}"/>`;
    if (s.form === 'triceratops') shape += `<path d="m35 62-13-22 26 16M27 70 14 60" stroke="${c}" stroke-width="5"/>`;
    if (s.form === 'human') shape = `<circle cx="104" cy="37" r="13" fill="${c}"/><path d="M94 57h21l10 43-13 2-1 31h-10l-3-33-12-1Z" fill="${c}"/><path d="m95 61-18 34m36-34 19 34" stroke="${c}" stroke-width="8"/>`;
    if (s.form === 'dragonfly' || s.form === 'pterosaur' || s.form === 'bird') shape += `<path d="M85 74Q37 12 24 48l57 36M95 74q40-63 68-26l-66 35" fill="${c}" opacity=".7"/>`;
  }
  return `<svg class="specimen-art" viewBox="0 0 210 155" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="105" cy="139" rx="49" ry="4" fill="${c}" opacity=".08"/>${shape}</svg>`;
}
