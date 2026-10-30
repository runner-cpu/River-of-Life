import * as THREE from 'three';
import { EPOCHS, EPOCH_DURATION, sampleCamera, smooth, type EpochTheme } from './epoch-timeline';

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
export type EpochSceneOptions = { quality?: string; reducedMotion: boolean };

/** Each event owns its complete resource tree and accepts time from its UI owner. */
export class EpochCinematic {
  readonly theme: EpochTheme;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(43, 1, .1, 100);
  private renderer?: THREE.WebGLRenderer;
  private observer?: ResizeObserver;
  private disposed = false;
  private reduced: boolean;
  private readonly updates: ((time: number, progress: number) => void)[] = [];
  private readonly materials = new Set<THREE.Material>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private elapsed = 0;
  private triangles = 0;
  private drawCalls = 0;
  private pixelRatio = 1;
  private readonly definition;

  constructor(private readonly container: HTMLElement, chapter: number, private readonly options: EpochSceneOptions) {
    this.definition = EPOCHS[chapter] || EPOCHS[1]; this.theme = this.definition.theme; this.reduced = options.reducedMotion;
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: options.quality !== 'low', powerPreference: 'low-power' });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      this.container.append(this.renderer.domElement);
      this.scene.background = new THREE.Color(this.definition.color);
      this.scene.fog = new THREE.FogExp2(this.definition.color, .025);
      this.scene.add(new THREE.HemisphereLight('#e2f2e3', '#26393c', 2.6));
      const light = new THREE.DirectionalLight('#fff2d9', 3); light.position.set(0, 12, 8); this.scene.add(light);
      const rim = new THREE.DirectionalLight(this.definition.accent, 2); rim.position.set(-10, 4, -8); this.scene.add(rim);
      this.build(chapter);
      this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
      this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
      this.resize(); this.render(0);
    } catch {
      this.releaseGraphics(); this.fallback();
    }
  }
  get stats() { return { theme: this.theme, webgl: !!this.renderer, elapsed: this.elapsed, triangles: this.triangles, drawCalls: this.drawCalls, pixelRatio: this.pixelRatio }; }
  private contextLost = (event: Event) => { event.preventDefault(); this.releaseGraphics(); this.fallback(); };
  private fallback() {
    if (this.disposed || this.container.querySelector('.epoch-fallback')) return;
    const message = document.createElement('p'); message.className = 'epoch-fallback'; message.textContent = `画面暂不可用 · ${this.definition.label}。下方的事件说明与学习总结仍可完整阅读。`; this.container.append(message);
  }
  private material(color: string, properties: THREE.MeshStandardMaterialParameters = {}) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: .78, ...properties }); this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, position: [number, number, number] = [0, 0, 0], parent: THREE.Object3D = this.scene): Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh;
  }
  private ground(color: string) {
    const bed = this.mesh(new THREE.CylinderGeometry(8.5, 8.2, .65, 64), this.material(color), [0, -.6, 0]);
    const band = this.mesh(new THREE.CylinderGeometry(8.55, 8.55, .08, 64), this.material(this.definition.accent, { transparent: true, opacity: .26 }), [0, -.24, 0]);
    return { bed, band };
  }
  private branch(points: THREE.Vector3[], color: string, radius = .07, parent: THREE.Object3D = this.scene) {
    const path = new THREE.CatmullRomCurve3(points);
    return this.mesh(new THREE.TubeGeometry(path, 12, radius, 5, false), this.material(color), [0, 0, 0], parent);
  }
  private particles(color: string, mode: number, count = 440) {
    const positions = new Float32Array(count * 3), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) { const s = (Math.sin(i * 127.1 + mode * 15) * 43758.5453) % 1; seeds[i] = Math.abs(s); positions[i * 3] = Math.sin(i * 2.399) * (2 + seeds[i] * 5.5); positions[i * 3 + 1] = seeds[i] * 9; positions[i * 3 + 2] = Math.cos(i * 2.399) * (2 + seeds[i] * 5.5); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1)); this.geometries.add(geometry);
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(color) }, mode: { value: mode }, opacity: { value: .55 } },
      transparent: true, depthWrite: false,
      vertexShader: `attribute float seed; uniform float time; uniform float mode; varying float alpha;
        void main(){vec3 p=position; float t=time*.32;
        if(mode<.5){p.y=mod(position.y+t*(.65+seed),9.);p.x+=sin(t+seed*25.)*.22;}
        else if(mode<1.5){p.y=mod(position.y+t*(1.+seed),9.);p.x+=sin(t+seed*20.)*.8;}
        else {p.y=mod(position.y-t*(.3+seed)+9.,9.);p.x+=sin(t+seed*20.)*.5;}
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((mode<.5?28.:40.)*(.5+seed)/max(1.,-mv.z),1.,7.);alpha=.4+seed*.6;}`,
      fragmentShader: `uniform vec3 tint; uniform float opacity; varying float alpha;
        void main(){float r=length(gl_PointCoord-.5);float edge=1.-smoothstep(.28,.5,r);gl_FragColor=vec4(tint,edge*opacity*alpha);}`,
    });
    this.materials.add(material); this.scene.add(new THREE.Points(geometry, material));
    this.updates.push(time => { material.uniforms.time.value = time; }); return material;
  }
  private plants(parent: THREE.Group, color: string, count: number, height = 1) {
    const material = this.material(color), geometry = new THREE.ConeGeometry(.34, height, 5); this.geometries.add(geometry);
    for (let i = 0; i < count; i++) {
      const radius = 3.3 + (i % 4) * .7, angle = i * 2.399;
      const plant = this.mesh(geometry, material, [Math.sin(angle) * radius, height / 2, Math.cos(angle) * radius], parent); plant.scale.setScalar(.8 + (i % 3) * .25);
    }
  }
  private build(chapter: number) {
    switch (chapter) {
      case 1: {
        this.ground('#47615c');
        const domeGeometry = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat = this.material('#739884');
        for (let i = 0; i < 12; i++) { const angle = i * 2.399, radius = Math.sqrt(i) * 1.55; const dome = this.mesh(domeGeometry, mat, [Math.sin(angle) * radius, -.2, Math.cos(angle) * radius]); dome.scale.set(1.1, .4 + (i % 3) * .2, .9); }
        this.particles('#bcebd7', 0, 520); break;
      }
      case 2: {
        this.ground('#425d67');
        const growth = new THREE.Group(); this.scene.add(growth);
        for (let i = 0; i < 14; i++) {
          const angle = i / 14 * Math.PI * 2, direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
          const tip = direction.clone().multiplyScalar(5 + i % 3); tip.y = .6 + i % 3 * .3;
          const root = new THREE.Vector3(0, .1, 0), middle = direction.clone().multiplyScalar(2.6); middle.y = 1;
          this.branch([root, middle, tip], i % 2 ? '#c79179' : '#83bcae', .065, growth);
          for (const sign of [-1, 1]) { const offset = new THREE.Vector3(Math.cos(angle) * sign, 0, -Math.sin(angle) * sign).multiplyScalar(1.3); this.branch([middle, middle.clone().add(offset).add(direction), tip.clone().add(offset)], '#d7bf91', .045, growth); }
          const form = this.mesh(new THREE.OctahedronGeometry(.5, 0), this.material(i % 2 ? '#e8c09c' : '#a7d4c1'), tip.toArray() as [number, number, number], growth); form.scale.set(.6, 1.1, 1.7); form.rotation.y = angle;
        }
        this.updates.push((_t, p) => growth.scale.setScalar(.32 + smooth(p / .7) * .68)); this.particles('#abcbdc', 0, 180); break;
      }
      case 3: {
        this.ground('#4f655e');
        for (let i = 0; i < 15; i++) { const x = Math.sin(i * 2.4) * (2 + i % 4), z = Math.cos(i * 2.4) * (2 + i % 4); this.branch([new THREE.Vector3(x, 0, z), new THREE.Vector3(x + .3, 1, z), new THREE.Vector3(x - .3, 1.8, z)], '#8aaf98', .09); }
        const layers: Mesh[] = [];
        for (let i = 0; i < 3; i++) layers.push(this.mesh(new THREE.CylinderGeometry(8, 8, .09, 48), this.material('#1b2d44', { transparent: true, opacity: .12, depthWrite: false }), [0, .9 + i * 1.6, 0]));
        this.updates.push((_t, p) => { const pulses = [.24, .5, .76].reduce((sum, center) => sum + Math.exp(-(((p - center) / .1) ** 2)), 0); layers.forEach((layer, i) => { layer.material.opacity = .12 + pulses * .2; layer.scale.x = layer.scale.z = .8 + pulses * .18 + i * .03; }); });
        this.particles('#7fa8ac', 2, 280); break;
      }
      case 4: {
        this.ground('#65564c');
        for (const [x, z, height] of [[-2, -1, 4.8], [2.8, -3, 3.3], [4, 2, 2]]) {
          this.mesh(new THREE.CylinderGeometry(.55, height * .7, height, 14), this.material('#61574f'), [x, height / 2 - .2, z]);
          const crater = this.mesh(new THREE.TorusGeometry(.55, .1, 6, 24), this.material('#b56b4b', { emissive: '#8c3821', emissiveIntensity: .4 }), [x, height - .2, z]); crater.rotation.x = Math.PI / 2;
          this.branch([new THREE.Vector3(x, height - .2, z + .5), new THREE.Vector3(x + .7, height * .5, z + height * .4), new THREE.Vector3(x + 1.1, 0, z + height * .6)], '#d4895d', .13);
        }
        const ash = this.particles('#c1aea0', 1, 620); this.updates.push((_t, p) => { ash.uniforms.opacity.value = .15 + smooth(p / .8) * .45; }); break;
      }
      case 5: {
        this.ground('#6b604d');
        const fissure: THREE.Vector3[] = [];
        for (let i = 0; i < 9; i++) fissure.push(new THREE.Vector3((i % 2 ? .45 : -.45), .03, i * 1.7 - 6.8));
        const lava = this.branch(fissure, '#e89867', .2); lava.material.emissive.set('#a3472b'); lava.material.emissiveIntensity = .5;
        for (let i = 0; i < 6; i++) this.mesh(new THREE.CylinderGeometry(.5, .8, .8 + i % 3 * .4, 6), this.material('#554a43'), [i % 2 ? -2.7 : 2.7, .2, i * 2 - 5]);
        const old = new THREE.Group(), next = new THREE.Group(); this.scene.add(old, next); this.plants(old, '#a3946e', 18, 1.8); this.plants(next, '#91ae7a', 28, 1.5); next.rotation.y = .7;
        this.updates.push((_t, p) => { old.scale.y = 1 - smooth(p / .65) * .82; next.scale.setScalar(.08 + smooth((p - .4) / .6) * .92); }); this.particles('#cbb496', 1, 260); break;
      }
      case 6: {
        this.ground('#59624e');
        const plants = new THREE.Group(); this.scene.add(plants); this.plants(plants, '#739471', 26, 1.5);
        const asteroid = this.mesh(new THREE.DodecahedronGeometry(.7, 0), this.material('#b6a38e', { emissive: '#a16b42', emissiveIntensity: .18 }));
        const impact = this.mesh(new THREE.TorusGeometry(1, .07, 6, 72), this.material('#d1ad82', { transparent: true, opacity: 0, depthWrite: false }), [0, .12, 0]); impact.rotation.x = Math.PI / 2;
        const crater = this.mesh(new THREE.SphereGeometry(.75, 24, 10), this.material('#47433c'), [0, -.16, 0]); crater.scale.y = .1;
        const dust = this.particles('#c4b8a5', 2, 580);
        this.updates.push((_t, p) => {
          const descent = smooth(p / .46), spread = smooth((p - .43) / .5); asteroid.position.set(6 * (1 - descent), 10 * (1 - descent) + .4, -4 * (1 - descent)); asteroid.visible = p < .49;
          asteroid.rotation.set(p * 2, p * 3, p); impact.scale.setScalar(.3 + spread * 7.5); impact.material.opacity = smooth((p - .42) / .15) * (1 - smooth((p - .75) / .25)) * .65;
          dust.uniforms.opacity.value = smooth((p - .42) / .4) * .48; plants.scale.y = 1 - smooth((p - .5) / .5) * .6;
        }); break;
      }
      case 7: {
        this.ground('#7b8161');
        const forest = new THREE.Group(), grass = new THREE.Group(); this.scene.add(forest, grass); forest.position.x = -1.3; this.plants(forest, '#4f745f', 19, 2.8);
        const geometry = new THREE.ConeGeometry(.12, .7, 3), material = this.material('#b4bc7f'); this.geometries.add(geometry);
        const blades = new THREE.InstancedMesh(geometry, material, 240), matrix = new THREE.Matrix4();
        for (let i = 0; i < 240; i++) { const radius = Math.sqrt(i / 240) * 7.5, angle = i * 2.399; matrix.compose(new THREE.Vector3(Math.sin(angle) * radius, .18, Math.cos(angle) * radius), new THREE.Quaternion(), new THREE.Vector3(1, .6 + i % 5 * .18, 1)); blades.setMatrixAt(i, matrix); }
        grass.add(blades); this.updates.push((_t, p) => { forest.scale.setScalar(1 - smooth(p) * .4); grass.scale.setScalar(.15 + smooth(p) * .85); }); this.particles('#dce5da', 2, 120); break;
      }
      case 8: {
        this.ground('#687d77');
        const ice = this.material('#cbdeda', { roughness: .45 }), sheets: Mesh[] = [];
        for (let i = 0; i < 8; i++) { const sheet = this.mesh(new THREE.BoxGeometry(1.7, .35 + i % 3 * .2, 7), ice, [-6 + i * 1.7, .15, -3.5]); sheet.rotation.y = (i % 2 ? 1 : -1) * .08; sheets.push(sheet); }
        const markers: { mesh: Mesh; path: THREE.CatmullRomCurve3 }[] = [];
        for (let i = 0; i < 3; i++) {
          const points = [new THREE.Vector3(-5, .35, -2 + i), new THREE.Vector3(-2 + i, .4, 1), new THREE.Vector3(2, .35, 3 + i * .8), new THREE.Vector3(5, .35, 1 + i)];
          const route = this.branch(points, i % 2 ? '#d8b88b' : '#d6ebe2', .035); route.material.transparent = true; route.material.opacity = .7;
          const marker = this.mesh(new THREE.SphereGeometry(.15, 10, 6), this.material('#f1d1a1')); markers.push({ mesh: marker, path: new THREE.CatmullRomCurve3(points) });
        }
        this.updates.push((_t, p) => { const advance = Math.sin(p * Math.PI * 2 - .5) * .5 + .5; sheets.forEach((sheet, i) => { sheet.scale.z = .35 + advance * .65; sheet.position.z = -4.5 + advance * 1.6 + i % 2 * .15; }); markers.forEach((marker, i) => marker.mesh.position.copy(marker.path.getPoint(Math.min(1, p * .8 + i * .09)))); });
        this.particles('#e4f3f0', 2, 210); break;
      }
    }
  }
  private resize() {
    if (!this.renderer || this.disposed) return;
    const { width, height } = this.container.getBoundingClientRect();
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.options.quality === 'low' ? 1 : window.innerWidth < 768 ? 1.3 : 1.7);
    this.renderer.setPixelRatio(this.pixelRatio); this.renderer.setSize(Math.max(1, width), Math.max(1, height));
    this.camera.aspect = Math.max(1, width) / Math.max(1, height); this.camera.updateProjectionMatrix(); this.render(this.elapsed);
  }
  setReducedMotion(reduced: boolean) { this.reduced = reduced; this.render(this.elapsed); }
  render(elapsed: number) {
    if (this.disposed || !this.renderer) return;
    this.elapsed = elapsed;
    const seconds = this.reduced ? 5 : elapsed, progress = Math.min(1, Math.max(0, seconds / EPOCH_DURATION));
    const camera = sampleCamera(this.definition.cameras, progress); this.camera.position.set(...camera.position); this.camera.lookAt(...camera.target);
    const color = (this.scene.background as THREE.Color).set(this.definition.color).lerp(new THREE.Color(this.definition.endColor), smooth(progress));
    (this.scene.fog as THREE.FogExp2).color.copy(color);
    for (const update of this.updates) update(seconds, progress);
    this.renderer.render(this.scene, this.camera); this.triangles = this.renderer.info.render.triangles; this.drawCalls = this.renderer.info.render.calls;
  }
  private releaseGraphics() {
    this.observer?.disconnect(); this.observer = undefined;
    for (const geometry of this.geometries) geometry.dispose(); for (const material of this.materials) material.dispose();
    this.geometries.clear(); this.materials.clear(); this.updates.length = 0; this.scene.clear();
    if (this.renderer) { this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); this.renderer = undefined; }
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.releaseGraphics(); this.container.replaceChildren(); }
}
