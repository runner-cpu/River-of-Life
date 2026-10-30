import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createCreature, animateCreature } from './creatures';
import type { Chapter, ModelAsset, Species } from '../core/types';
import { escape, icon } from '../core/ui';
import { seeded } from '../core/lab';
import { retainObjectResources, releaseObjectResources } from './resource-lifetime';
import { placeModel } from './model-placement';
import { buildHabitat } from './habitat';
import { frameObject } from './framing';
import { RenderLoop } from './render-loop';
import { layoutHotspots, type HotspotBox } from './hotspot-layout';

type Resident = { root: THREE.Group; body: THREE.Group; label: HTMLButtonElement; species: Species; origin: THREE.Vector3; phase: number; mixer?: THREE.AnimationMixer };
let manifestPromise: Promise<ModelAsset[]> | undefined;
export function getModels(): Promise<ModelAsset[]> {
  return manifestPromise ??= fetch(`${import.meta.env.BASE_URL}models/manifest.json`)
    .then(response => { if (!response.ok) throw new Error('模型清单未能加载'); return response.json(); })
    .then((value: ModelAsset[] | { models: ModelAsset[] }) => {
      const list = Array.isArray(value) ? value : value?.models;
      if (!Array.isArray(list)) throw new Error('模型清单格式无效');
      return list;
    })
    .catch(error => { manifestPromise = undefined; throw error; });
}
function loader() {
  const draco = new DRACOLoader(); draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  const gltf = new GLTFLoader(); gltf.setDRACOLoader(draco); return { gltf, draco };
}

export class LifeScene {
  renderer!: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(42, 1, .1, 180);
  controls!: OrbitControls; residents: Resident[] = [];
  private content = new THREE.Group(); private particles?: THREE.Points; private loop?: RenderLoop; private last = 0; private elapsed = 0;
  private observer: ResizeObserver; private stopped = false; private destroyed = false; private isReduced = false; private chapter?: Chapter;
  private focusTarget?: THREE.Vector3; private focusPosition?: THREE.Vector3; private dragStart = { x: 0, y: 0 }; private generation = 0;
  private loadTools = loader(); private labels = document.createElement('div'); private fpsFrames = 0; private fpsStart = 0;
  private quality = 'auto';
  private labelSizes = new WeakMap<HTMLButtonElement,{width:number;height:number}>();
  private environment = new THREE.Group(); private inspection?: string; private inspectionFloor?: THREE.Mesh;
  private habitatBackground = new THREE.Color(); private habitatFog?: THREE.FogExp2;
  private lighting?: { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight; rim: THREE.DirectionalLight; ocean: boolean };
  stats = { fps: 0, triangles: 0, drawCalls: 0, frames: 0 };
  private invalidate = () => this.loop?.request();
  constructor(private container: HTMLElement, private onSelect: (s: Species) => void, options: { quality?: string; reducedMotion?: boolean } = {}) {
    this.isReduced = options.reducedMotion || false;
    this.quality = options.quality || 'auto';
    this.labels.className = 'scene-hotspots'; container.append(this.labels);
    this.observer = new ResizeObserver(() => this.resize());
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: options.quality !== 'low', alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, options.quality === 'low' ? 1 : innerWidth < 768 ? 1.3 : 1.7));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1;
      this.renderer.shadowMap.enabled = this.quality !== 'low'; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.domElement.setAttribute('aria-label', '可旋转的远古生态场景，拖动旋转，滚轮缩放，也可使用生物名称按钮观察');
      this.renderer.domElement.tabIndex = 0;
      container.prepend(this.renderer.domElement);
      this.camera.position.set(10, 9, 17); this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true; this.controls.dampingFactor = .06; this.controls.target.set(0, 1.2, 0); this.controls.minDistance = 5; this.controls.maxDistance = 32; this.controls.maxPolarAngle = Math.PI * .49; this.controls.minPolarAngle = .17;
      this.controls.addEventListener('start', () => { this.focusTarget = undefined; this.focusPosition = undefined; });
      this.controls.addEventListener('change', this.invalidate);
      this.renderer.domElement.addEventListener('pointerdown', e => { this.dragStart = { x: e.clientX, y: e.clientY }; });
      this.renderer.domElement.addEventListener('pointerup', e => this.pick(e));
      this.renderer.domElement.addEventListener('keydown', e => {
        if (e.key === '+' || e.key === '=') this.zoom(.85);
        if (e.key === '-') this.zoom(1.18);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); this.focusPosition=undefined;this.focusTarget=undefined; const offset = this.camera.position.clone().sub(this.controls.target); offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), e.key === 'ArrowLeft' ? -.15 : .15); this.camera.position.copy(this.controls.target).add(offset); this.invalidate(); }
      });
      this.loop = new RenderLoop(container,t=>this.animate(t)); this.observer.observe(container); this.resize();
    } catch {
      container.classList.add('webgl-unavailable');
      const fallback = document.createElement('div'); fallback.className = 'webgl-message'; fallback.textContent = '当前设备未开启 WebGL，仍可点击下方生物名称阅读知识、完成任务。'; container.append(fallback);
    }
  }
  private resize() { if (!this.renderer) return; this.labelSizes=new WeakMap();const { width, height } = this.container.getBoundingClientRect(); this.renderer.setSize(width, height); this.camera.aspect = width / Math.max(height, 1); this.camera.updateProjectionMatrix(); if(this.inspection) this.inspectSpecies(this.inspection); this.invalidate(); }
  setChapter(chapter: Chapter, species: Species[]) {
    this.generation++; const generation = this.generation;
    this.residents.forEach(r => { r.mixer?.stopAllAction(); r.mixer?.uncacheRoot(r.body); });
    this.chapter = chapter; this.scene.remove(this.content); releaseObjectResources(this.content); this.content = new THREE.Group(); this.scene.add(this.content); this.labels.innerHTML = ''; this.residents = []; this.inspection = undefined;
    this.environment = new THREE.Group(); this.content.add(this.environment);
    const ocean = chapter.environment === 'ocean' || chapter.environment === 'reef';
    const bg = ocean ? '#123f46' : chapter.environment === 'ice' ? '#b8c9cc' : chapter.environment === 'desert' ? '#c3b39a' : '#91a69a';
    this.scene.background = new THREE.Color(bg); this.scene.fog = new THREE.FogExp2(bg, ocean ? .026 : .022);
    this.habitatBackground.copy(this.scene.background); this.habitatFog = this.scene.fog;
    const hemi = new THREE.HemisphereLight(ocean ? '#c3f4e7' : '#e1ece7', ocean ? '#263d3b' : '#484b3b', ocean ? 1.9 : 1.5); this.content.add(hemi);
    const sun = new THREE.DirectionalLight(ocean ? '#d3f1d4' : '#fff0d6', 2.6); sun.position.set(-8, 15, 9); sun.castShadow = !ocean;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 13, bottom: -13, near: 1, far: 45 }); sun.shadow.normalBias = .045; sun.shadow.bias = -.0002; this.content.add(sun);
    const rim = new THREE.DirectionalLight(ocean ? '#58c3c7' : '#c4dacc', .8); rim.position.set(9, 8, -9); this.content.add(rim);
    this.lighting = {hemi,sun,rim,ocean}; this.content.add(sun.target);
    this.inspectionFloor = new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#d3dccf',roughness:1}));
    this.inspectionFloor.rotation.x = -Math.PI/2; this.inspectionFloor.receiveShadow = true; this.inspectionFloor.visible = false; this.content.add(this.inspectionFloor);
    this.createEnvironment(chapter, ocean);
    const positions = chapter.id === 6 ? [[-5,-.55,-2],[-5,-.55,3],[0,-.55,-3.5],[0,-.55,2.4],[5.6,-.9,-3.7],[5,-.55,3.2]] : chapter.id === 7 ? [[-5,-.55,2.5],[6.4,-.9,-3],[0,-.55,-2],[4.2,-.9,-4.3],[.5,-.55,3],[5,-.55,3.2]] : [[-5,-.55,2.5],[0,-.55,3.8],[5,-.55,-2],[-4.5,-.55,-3.5],[.5,-.55,-2.5],[5,-.55,3.2]];
    species.slice(0, 6).forEach((s, i) => {
      const root = new THREE.Group(), body = createCreature(s); root.add(body);
      const pos = positions[i]; const isSwimming = (ocean && ['anomalocaris', 'opabinia', 'fish', 'shark', 'worm', 'cell'].includes(s.form)) || ['dragonfly', 'pterosaur'].includes(s.form);
      root.position.set(pos[0], pos[1] + (isSwimming ? 1.5 : 0), pos[2]); root.rotation.y = [ .28, -.65, .45, -.1, -.3, .65 ][i];
      const scale = s.id === 'archaeopteryx' ? .65 : s.form === 'frond' ? 1.35 : ['anomalocaris', 'sauropod', 'mammoth'].includes(s.form) ? 1.15 : 1.05; root.scale.setScalar(scale);
      root.userData.species = s; this.content.add(root);
      const label = document.createElement('button'); label.className = 'hotspot'; label.dataset.species = s.id; label.setAttribute('aria-label', `观察${s.name}`); label.innerHTML = `<span class="hotspot-dot"></span><span>${escape(s.name)}</span>${icon('Plus', 13)}`;
      label.addEventListener('click', () => { this.focusSpecies(s.id); this.onSelect(s); }); this.labels.append(label);
      const resident: Resident = { root, body, label, species: s, origin: root.position.clone(), phase: i * 1.8 };
      this.residents.push(resident);
      void getModels().then(models => {
        // Fossil slabs and teeth belong on the specimen stage, never as living animals.
        const asset = models.find(m => m.speciesId === s.id && m.representation === 'reconstruction'); if (!asset || this.destroyed || generation !== this.generation) return;
        this.loadTools.gltf.load(import.meta.env.BASE_URL + asset.url.replace(/^\//, ''), gltf => {
          retainObjectResources(gltf.scene);
          if (this.destroyed || generation !== this.generation) { releaseObjectResources(gltf.scene); return; }
          try {
            const placed = placeModel(gltf.scene, gltf.animations, s.form === 'sauropod' ? 4.3 : 3.3);
            placed.root.traverse(object => {
              if (!(object instanceof THREE.Mesh)) return;
              object.castShadow = true; object.receiveShadow = true;
              // The source FBX Phong conversion assigned metallic skin. Restore
              // diffuse response while preserving source colors and textures.
              for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                if (material instanceof THREE.MeshStandardMaterial && material.userData.fromFBX?.isTruePBR === false) {
                  material.metalness = 0; material.roughness = .82;
                }
              }
            });
            root.remove(body); releaseObjectResources(body); root.add(placed.root); resident.body = placed.root; resident.mixer = placed.mixer;
            if(this.inspection===s.id) this.inspectSpecies(s.id);
            this.invalidate();
          } catch { releaseObjectResources(gltf.scene); label.title = '模型范围无效，显示结构示意'; }
        }, undefined, () => { label.title = '模型加载失败，显示结构示意'; });
      }).catch(() => { label.title = '模型清单暂不可用，显示结构示意；可打开档案重新加载'; });
    });
    retainObjectResources(this.content);
    if (this.controls) this.reset();
  }
  private createEnvironment(chapter: Chapter, ocean: boolean) {
    this.environment.add(buildHabitat(chapter, ocean));
    const random = seeded(chapter.id * 149);
    if (ocean) {
      // Volumetric-looking cones are atmospheric illustration, not a physical scattering simulation.
      const beamMat = new THREE.MeshBasicMaterial({ color: '#bce4c2', transparent: true, opacity: .035, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      for (let i = 0; i < 7; i++) { const beam = new THREE.Mesh(new THREE.CylinderGeometry(.15, 2.8, 22, 16, 1, true), beamMat); beam.position.set(-10 + i * 4, 9, -5 + i % 3 * 3); beam.rotation.z = -.28; this.environment.add(beam); }
    }
    const count = innerWidth < 768 ? 100 : 220, positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { positions[i * 3] = (random() - .5) * 40; positions[i * 3 + 1] = random() * 15; positions[i * 3 + 2] = (random() - .5) * 30; }
    const particleGeo = new THREE.BufferGeometry(); particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({ size: .045, color: ocean ? '#c2dfcb' : '#eee7c4', transparent: true, opacity: .43, depthWrite: false })); this.environment.add(this.particles);
  }
  private pick(event: PointerEvent) {
    if (Math.hypot(event.clientX - this.dragStart.x, event.clientY - this.dragStart.y) > 6) return;
    const box = this.container.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1), this.camera);
    const hits = ray.intersectObjects(this.residents.filter(r=>r.root.visible).map(r => r.root), true); if (!hits.length) return;
    let object: THREE.Object3D | null = hits[0].object;
    while (object && !object.userData.species) object = object.parent;
    if (object?.userData.species) { const s = object.userData.species as Species; this.focusSpecies(s.id); this.onSelect(s); }
  }
  focusSpecies(id: string) {
    const r = this.residents.find(r => r.species.id === id); if (!r || !this.controls) return;
    const bounds = new THREE.Box3().setFromObject(r.root), size = bounds.getSize(new THREE.Vector3());
    this.focusTarget = bounds.getCenter(new THREE.Vector3());
    const distance = Math.max(5, Math.max(size.x, size.z, size.y * 1.5) * 1.9 / Math.min(this.camera.aspect, 1.4));
    this.focusPosition = this.focusTarget.clone().add(new THREE.Vector3(2.5, 2.4, 6).normalize().multiplyScalar(distance));
    this.labels.classList.add('has-selection');
    this.residents.forEach(item => item.label.classList.toggle('selected', item === r));
    this.invalidate();
  }
  inspectSpecies(id: string) {
    const resident = this.residents.find(r=>r.species.id===id); if(!resident || !this.controls || !this.inspectionFloor || !this.lighting) return;
    this.inspection=id; this.container.dataset.view='inspection'; this.container.dataset.species=id;
    this.environment.visible=false; this.scene.background=new THREE.Color('#e1e2d6'); this.scene.fog=new THREE.Fog('#e1e2d6',16,70);
    this.residents.forEach(r=>{r.root.visible=r===resident;r.label.hidden=r!==resident;r.label.classList.toggle('selected',r===resident);});
    const bounds=new THREE.Box3().setFromObject(resident.root,true), fit=frameObject(bounds,this.camera.fov,this.camera.aspect);
    this.focusTarget=fit.target;this.focusPosition=fit.position;this.controls.minDistance=fit.minDistance;this.controls.maxDistance=fit.maxDistance;
    this.inspectionFloor.position.y=bounds.min.y-.025;this.inspectionFloor.visible=true;
    const {hemi,sun,rim}=this.lighting;
    hemi.color.set('#f5f5ed');hemi.groundColor.set('#7a8c78');hemi.intensity=2.2;
    sun.color.set('#fff0d8');sun.intensity=2.8;sun.castShadow=true;sun.position.copy(fit.target).add(new THREE.Vector3(-5,9,5));sun.target.position.copy(fit.target);
    Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:30});sun.shadow.camera.updateProjectionMatrix();
    rim.color.set('#c7ddd4');rim.intensity=1.2;
    this.labels.classList.add('has-selection');
    this.invalidate();
  }
  reset() {
    this.inspection=undefined;this.container.dataset.view='overview';delete this.container.dataset.species;
    this.environment.visible=true;if(this.inspectionFloor)this.inspectionFloor.visible=false;
    this.scene.background=this.habitatBackground.clone();this.scene.fog=this.habitatFog||null;
    if(this.lighting){const {hemi,sun,rim,ocean}=this.lighting;hemi.color.set(ocean?'#c3f4e7':'#e1ece7');hemi.groundColor.set(ocean?'#263d3b':'#484b3b');hemi.intensity=ocean?1.9:1.5;sun.color.set(ocean?'#d3f1d4':'#fff0d6');sun.intensity=2.6;sun.castShadow=!ocean;sun.position.set(-8,15,9);sun.target.position.set(0,0,0);Object.assign(sun.shadow.camera,{left:-14,right:14,top:13,bottom:-13,near:1,far:45});sun.shadow.camera.updateProjectionMatrix();rim.color.set(ocean?'#58c3c7':'#c4dacc');rim.intensity=.8;}
    if(this.controls){this.controls.minDistance=5;this.controls.maxDistance=40;}
    const fit = Math.max(1, 1.35 / this.camera.aspect); this.focusTarget = new THREE.Vector3(0, .4, 0); this.focusPosition = new THREE.Vector3(9, 10, 18).multiplyScalar(fit);
    this.labels.classList.remove('has-selection'); this.residents.forEach(item => {item.root.visible=true;item.label.hidden=false;item.label.classList.remove('selected');});
    this.invalidate();
  }
  showLabels(visible: boolean) { this.labels.classList.toggle('labels-hidden', !visible); }
  zoom(factor: number) { if (!this.controls) return; const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor); offset.clampLength(this.controls.minDistance, this.controls.maxDistance); this.camera.position.copy(this.controls.target).add(offset); this.focusPosition = undefined; this.focusTarget = undefined; this.invalidate(); }
  pause(paused: boolean) { if(this.stopped===paused)return; this.stopped = paused; this.invalidate(); }
  reducedMotion(reduced: boolean) { this.isReduced = reduced; this.invalidate(); }
  setQuality(quality: string) { this.quality = quality; if (this.renderer) { this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 1 : innerWidth < 768 ? 1.3 : 1.7)); this.renderer.shadowMap.enabled = quality !== 'low'; this.invalidate(); } }
  screenshot() { return new Promise<Blob | null>(resolve => { if (this.renderer) this.renderer.domElement.toBlob(resolve); else resolve(null); }); }
  private animate(time: number) {
    if (this.destroyed) return false;
    const dt = Math.min((time - this.last) / 1000, .05); this.last = time;
    if (!this.stopped && !this.isReduced) this.elapsed += dt;
    if (this.focusTarget && this.focusPosition) {
      const amount = this.isReduced ? 1 : .055; this.controls.target.lerp(this.focusTarget, amount); this.camera.position.lerp(this.focusPosition, amount);
      if (this.camera.position.distanceTo(this.focusPosition) < .02) { this.camera.position.copy(this.focusPosition);this.controls.target.copy(this.focusTarget); this.focusPosition = undefined; this.focusTarget = undefined; }
    }
    this.controls.update();
    const { clientWidth: width, clientHeight: height } = this.container;
    const visibleLabels:{label:HTMLButtonElement;box:HotspotBox}[]=[];
    this.residents.forEach(r => {
      if(!r.root.visible) return;
      const swim = (['ocean', 'reef'].includes(this.chapter?.environment || '') && ['anomalocaris', 'opabinia', 'fish', 'shark', 'worm', 'cell'].includes(r.species.form)) || ['dragonfly', 'pterosaur'].includes(r.species.form);
      if (swim && !this.inspection) { r.root.position.y = r.origin.y + Math.sin(this.elapsed * .7 + r.phase) * .22; r.root.position.x = r.origin.x + Math.sin(this.elapsed * .22 + r.phase) * .35; }
      animateCreature(r.body, this.elapsed + r.phase);
      if (!this.stopped && !this.isReduced) r.mixer?.update(dt);
      const p = r.root.position.clone().add(new THREE.Vector3(0, r.species.form === 'frond' ? 3.7 : r.species.id === 'archaeopteryx' ? 1.5 : 1.8, 0)).project(this.camera);
      const visible=!(p.z > 1 || p.z < -1 || Math.abs(p.x) > .93 || Math.abs(p.y) > .85);
      r.label.style.visibility=visible?'visible':'hidden';
      if(visible) {
        let size=this.labelSizes.get(r.label);
        if(!size){size={width:r.label.offsetWidth,height:r.label.offsetHeight};this.labelSizes.set(r.label,size);}
        visibleLabels.push({label:r.label,box:{...size,x:(p.x*.5+.5)*width,y:(-p.y*.5+.5)*height,selected:r.label.classList.contains('selected')}});
      }
    });
    layoutHotspots(visibleLabels.map(item=>item.box),width,height).forEach((box,index)=>{
      visibleLabels[index].label.style.transform=`translate(-50%,-50%) translate(${box.x}px,${box.y}px)`;
    });
    if (this.particles && !this.stopped && !this.isReduced) this.particles.rotation.y = this.elapsed * .008;
    this.renderer.render(this.scene, this.camera);
    this.stats.frames++;
    this.stats.triangles = this.renderer.info.render.triangles; this.stats.drawCalls = this.renderer.info.render.calls;
    this.fpsFrames++; if (time - this.fpsStart > 1000) { this.stats.fps = Math.round(this.fpsFrames * 1000 / (time - this.fpsStart)); this.fpsFrames = 0; this.fpsStart = time; }
    return (!this.stopped && !this.isReduced) || !!this.focusPosition;
  }
  dispose() { this.destroyed = true; this.loop?.dispose(); this.observer.disconnect(); this.controls?.dispose(); this.residents.forEach(r => { r.mixer?.stopAllAction(); r.mixer?.uncacheRoot(r.body); }); releaseObjectResources(this.content); this.loadTools.draco.dispose(); this.renderer?.dispose(); this.renderer?.domElement.remove(); this.labels.remove(); }
}

export class SpecimenStage {
  renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(38, 1, .01, 100); private controls: OrbitControls; private object: THREE.Group; private loop: RenderLoop; private observer: ResizeObserver; private time = 0; private last = 0; private paused = false; private rotating = false;
  constructor(private element: HTMLElement, species: Species, reducedMotion = false) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.2; element.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#fffdf0', '#537b79', 2.8)); const key = new THREE.DirectionalLight('#fff4dc', 3); key.position.set(-3, 7, 5); this.scene.add(key); const rim = new THREE.DirectionalLight('#a2dad8', 2); rim.position.set(4, 3, -3); this.scene.add(rim);
    this.object = createCreature(species); retainObjectResources(this.object); this.scene.add(this.object); const box = new THREE.Box3().setFromObject(this.object), center = box.getCenter(new THREE.Vector3()); this.object.position.sub(center); const max = Math.max(...box.getSize(new THREE.Vector3()).toArray());
    this.camera.position.set(max * .55, max * .55, max * 1.8); this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true; this.controls.minDistance = max * .7; this.controls.maxDistance = max * 4; this.controls.enablePan = false;
    this.paused = reducedMotion; this.loop = new RenderLoop(element,this.animate); this.controls.addEventListener('change',this.loop.request); this.observer = new ResizeObserver(() => { const w = element.clientWidth, h = element.clientHeight; this.renderer.setSize(w, h); this.camera.aspect = w / Math.max(h,1); this.camera.updateProjectionMatrix(); this.loop.request(); }); this.observer.observe(element);
  }
  private animate = (now: number) => {
    const dt=Math.min((now-this.last)/1000,.05);this.last=now;
    if (!this.paused) this.time += dt;
    animateCreature(this.object,this.time);
    this.controls.autoRotate=this.rotating;this.controls.autoRotateSpeed=.8;
    this.controls.update(dt);this.renderer.render(this.scene,this.camera);
    return !this.paused || this.rotating;
  };
  rotate(value: boolean) { this.rotating = value; this.loop.request(); }
  pause(value: boolean) { this.paused = value; this.loop.request(); }
  dispose() { this.loop.dispose(); this.observer.disconnect(); this.controls.dispose(); releaseObjectResources(this.object); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
