import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { attachBackpack, loadBackpackTemplate } from "./BackpackAsset.js";

const ASSET_ROOT = "./assets/models/level2-npcs";
const RUN_ANIMATION_PATH = "./assets/models/level2-player/running.fbx";
const SELECTION_ANIMATION_PATH = "./assets/models/level2-player/selection-fight-idle.fbx";
const TARGET_HEIGHT = 1.72;
export const STUDENT_MODEL_VARIANTS = Object.freeze([
  ...[1, 2, 3].map((index) => Object.freeze({
    id: `male-${index}`,
    label: `Male${index}`,
    rig: `${ASSET_ROOT}/male-student-${index}-rig.fbx`,
    textured: `${ASSET_ROOT}/male-student-${index}-textured.glb`,
    retargetGeometry: index === 2
  })),
  ...[1, 2, 3].map((index) => Object.freeze({
    id: `female-${index}`,
    label: `Female${index}`,
    rig: `${ASSET_ROOT}/female-student-${index}-rig.fbx`,
    textured: `${ASSET_ROOT}/female-student-${index}-textured.glb`,
    retargetGeometry: false
  }))
]);

export class AnimatedNpcFactory {
  constructor({ createHeldCup = null } = {}) {
    this.createHeldCup = createHeldCup;
    this.templates = [];
    this.idleClip = null;
    this.walkClip = null;
    this.runClip = null;
    this.selectionClip = null;
    this.backpackTemplate = null;
  }

  async load({ idlePath = `${ASSET_ROOT}/standing-idle.fbx` } = {}) {
    const fbx = new FBXLoader();
    const gltf = new GLTFLoader();
    const [idleSource, walkSource, runSource, selectionSource, backpackTemplate, ...variantSources] = await Promise.all([
      fbx.loadAsync(idlePath),
      fbx.loadAsync(`${ASSET_ROOT}/walk.fbx`),
      fbx.loadAsync(RUN_ANIMATION_PATH),
      fbx.loadAsync(SELECTION_ANIMATION_PATH),
      loadBackpackTemplate(),
      ...STUDENT_MODEL_VARIANTS.map((variant) => Promise.all([
        fbx.loadAsync(variant.rig),
        gltf.loadAsync(variant.textured)
      ]))
    ]);

    this.idleClip = idleSource.animations[0]?.clone();
    this.walkClip = walkSource.animations[0]?.clone();
    this.runClip = runSource.animations[0]?.clone();
    this.selectionClip = selectionSource.animations[0]?.clone();
    this.backpackTemplate = backpackTemplate;
    if (!this.idleClip || !this.walkClip || !this.runClip || !this.selectionClip) {
      throw new Error("Level 2 NPC animation files contain no clips.");
    }
    this.removeRootMotion(this.idleClip);
    this.removeRootMotion(this.walkClip);
    this.removeRootMotion(this.runClip);
    this.removeRootMotion(this.selectionClip);
    this.alignHipHeight(this.walkClip, this.idleClip);
    // The player run was authored with a much larger vertical hip range than
    // these NPC rigs. Keep the limb motion, but let the crowd controller move
    // the character root so chasing does not launch the model up and down.
    this.alignHipHeight(this.runClip, this.idleClip, true);
    this.alignHipHeight(this.selectionClip, this.idleClip);

    for (let index = 0; index < STUDENT_MODEL_VARIANTS.length; index += 1) {
      const [rig, textured] = variantSources[index];
      // Student 2's rig and GLB are different mesh revisions. Preserve the
      // GLB's exact surface/UVs and transfer the rig's nearest skin weights.
      const template = STUDENT_MODEL_VARIANTS[index].retargetGeometry
        ? this.prepareRetargetedTemplate(rig, textured.scene)
        : this.prepareTemplate(rig, textured.scene);
      this.templates.push(template);
    }
  }

  prepareTemplate(model, texturedScene, usesGlbGeometry = false) {
    let authoredMaterial = null;
    texturedScene.traverse((object) => {
      if (!authoredMaterial && object.isMesh) {
        authoredMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
      }
    });
    if (!authoredMaterial?.map) throw new Error("A Level 2 NPC GLB has no base-colour texture.");

    model.traverse((object) => {
      if (!object.isMesh) return;
      const uv = object.geometry?.getAttribute("uv");
      if (uv && !usesGlbGeometry) {
        for (let vertex = 0; vertex < uv.count; vertex += 1) uv.setY(vertex, 1 - uv.getY(vertex));
        uv.needsUpdate = true;
      }
      const material = authoredMaterial.clone();
      material.map = authoredMaterial.map;
      material.map.flipY = false;
      material.map.colorSpace = THREE.SRGBColorSpace;
      material.map.needsUpdate = true;
      material.color?.set(0xffffff);
      material.needsUpdate = true;
      object.material = material;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    });

    model.updateMatrixWorld(true);
    const rawBounds = new THREE.Box3().setFromObject(model, true);
    const height = rawBounds.max.y - rawBounds.min.y;
    if (!Number.isFinite(height) || height < 0.001) throw new Error("A Level 2 NPC rig has no measurable height.");
    model.scale.setScalar(TARGET_HEIGHT / height);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model, true);
    model.position.set(
      -(bounds.min.x + bounds.max.x) / 2,
      -bounds.min.y,
      -(bounds.min.z + bounds.max.z) / 2
    );
    model.updateMatrixWorld(true);
    return model;
  }

  prepareRetargetedTemplate(model, texturedScene) {
    let rigMesh = null;
    let texturedMesh = null;
    model.traverse((object) => { if (!rigMesh && object.isSkinnedMesh) rigMesh = object; });
    texturedScene.traverse((object) => { if (!texturedMesh && object.isMesh) texturedMesh = object; });
    if (!rigMesh || !texturedMesh) throw new Error("Student 2 requires both a skinned FBX mesh and textured GLB mesh.");

    const source = rigMesh.geometry;
    const target = texturedMesh.geometry.clone();
    const sourcePosition = source.getAttribute("position");
    const sourceSkinIndex = source.getAttribute("skinIndex");
    const sourceSkinWeight = source.getAttribute("skinWeight");
    const targetPosition = target.getAttribute("position");
    if (!sourcePosition || !sourceSkinIndex || !sourceSkinWeight || !targetPosition) {
      throw new Error("Student 2 geometry is missing positions or skin weights.");
    }

    source.computeBoundingBox();
    target.computeBoundingBox();
    const sourceBox = source.boundingBox;
    const targetBox = target.boundingBox;
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    const targetSize = targetBox.getSize(new THREE.Vector3());
    const normalized = (attribute, vertex, box, size) => [
      (attribute.getX(vertex) - box.min.x) / size.x,
      (attribute.getY(vertex) - box.min.y) / size.y,
      (attribute.getZ(vertex) - box.min.z) / size.z
    ];

    // Collapse duplicate triangle vertices before the nearest-point search.
    const sourceVertices = [];
    const seen = new Set();
    for (let vertex = 0; vertex < sourcePosition.count; vertex += 1) {
      const position = normalized(sourcePosition, vertex, sourceBox, sourceSize);
      const key = position.map((value) => value.toFixed(5)).join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      sourceVertices.push({ vertex, position });
    }

    const skinIndices = new Uint16Array(targetPosition.count * 4);
    const skinWeights = new Float32Array(targetPosition.count * 4);
    const componentGetters = ["getX", "getY", "getZ", "getW"];
    for (let vertex = 0; vertex < targetPosition.count; vertex += 1) {
      const position = normalized(targetPosition, vertex, targetBox, targetSize);
      let nearest = sourceVertices[0];
      let nearestDistance = Infinity;
      for (const candidate of sourceVertices) {
        const dx = position[0] - candidate.position[0];
        const dy = position[1] - candidate.position[1];
        const dz = position[2] - candidate.position[2];
        const distance = dx * dx + dy * dy + dz * dz;
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
      let weightTotal = 0;
      for (let component = 0; component < 4; component += 1) {
        const offset = vertex * 4 + component;
        const getter = componentGetters[component];
        skinIndices[offset] = sourceSkinIndex[getter](nearest.vertex);
        skinWeights[offset] = sourceSkinWeight[getter](nearest.vertex);
        weightTotal += skinWeights[offset];
      }
      if (weightTotal > 0) {
        for (let component = 0; component < 4; component += 1) {
          skinWeights[vertex * 4 + component] /= weightTotal;
        }
      } else {
        skinWeights[vertex * 4] = 1;
      }
    }
    target.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
    target.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
    source.dispose();
    rigMesh.geometry = target;
    return this.prepareTemplate(model, texturedScene, true);
  }

  create({ variant = 0, holding = null, scale = 1, includeBackpack = true } = {}) {
    if (this.templates.length === 0) throw new Error("AnimatedNpcFactory.load() must finish before create().");
    const model = SkeletonUtils.clone(this.templates[variant % this.templates.length]);
    const root = new THREE.Group();
    root.add(model);
    root.scale.setScalar(scale);

    const mixer = new THREE.AnimationMixer(model);
    const idle = mixer.clipAction(this.idleClip);
    const walk = mixer.clipAction(this.walkClip);
    const run = mixer.clipAction(this.runClip);
    const selection = mixer.clipAction(this.selectionClip);
    idle.play();
    mixer.update(0);

    // Skinning changes the visible bounds from the bind pose grounded in
    // prepareTemplate(). Ground the actual idle pose so NPC shoes rest on the
    // pavement instead of inheriting the animation's vertical hip offset.
    model.updateMatrixWorld(true);
    const animatedBounds = new THREE.Box3().setFromObject(model, true);
    if (Number.isFinite(animatedBounds.min.y)) {
      model.position.y -= animatedBounds.min.y;
      model.updateMatrixWorld(true);
    }

    const rightHand = model.getObjectByName("mixamorigRightHand");
    const backpack = includeBackpack ? attachBackpack(model, this.backpackTemplate) : null;
    const heldItem = this.createHeldItem(holding);
    if (heldItem && rightHand) {
      // FBXLoader has already converted the Mixamo skeleton to metres. Keep
      // attachments in those same units so they do not become giant or drift
      // metres away from the hand.
      heldItem.scale.multiplyScalar(holding === "phone" ? 0.55 : 0.25);
      heldItem.position.set(0.03, 0.1, 0.01);
      heldItem.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      rightHand.add(heldItem);
    }

    root.userData.soleOffset = 0;
    root.userData.rig = { holding, heldItem, backpack };
    root.userData.animation = { mixer, idle, walk, run, selection, active: idle };
    return root;
  }

  createHeldItem(holding) {
    if (!holding) return null;
    if (holding === "phone") {
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.16, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.35, emissive: 0x1f3550 })
      );
    }
    return this.createHeldCup?.(holding) ?? null;
  }

  setMoving(animation, moving, speed = 1, running = false) {
    const next = running ? animation.run : moving ? animation.walk : animation.idle;
    if (next !== animation.active) {
      next.reset().play();
      animation.active.crossFadeTo(next, 0.18, false);
      animation.active = next;
    }
    animation.walk.timeScale = THREE.MathUtils.clamp(speed / 1.1, 0.75, 1.8);
    animation.run.timeScale = THREE.MathUtils.clamp(speed / 3.3, 0.8, 1.3);
  }

  alignHipHeight(clip, referenceClip, lockVerticalMotion = false) {
    const hipTrack = clip.tracks.find((track) => track.name === "mixamorigHips.position");
    const referenceTrack = referenceClip.tracks.find((track) => track.name === "mixamorigHips.position");
    if (!hipTrack || !referenceTrack || hipTrack.getValueSize() !== 3 || referenceTrack.getValueSize() !== 3) return;
    const referenceHeight = referenceTrack.values[1];
    const offset = referenceHeight - hipTrack.values[1];
    for (let value = 1; value < hipTrack.values.length; value += 3) {
      hipTrack.values[value] = lockVerticalMotion ? referenceHeight : hipTrack.values[value] + offset;
    }
  }

  removeRootMotion(clip) {
    for (const track of clip.tracks) {
      if (!track.name.endsWith(".position") || track.getValueSize() !== 3) continue;
      if (!track.name.startsWith("mixamorigHips.")) continue;
      const x = track.values[0];
      const z = track.values[2];
      for (let value = 0; value < track.values.length; value += 3) {
        track.values[value] = x;
        track.values[value + 2] = z;
      }
    }
  }
}
