import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// The foliage packs are loaded only once. Individual placements are
// baked into InstancedMeshes, keeping the parking level's draw-call count low.
const loader = new GLTFLoader();
const packPromises = new Map();

const PACKS = Object.freeze({
  treePack: "./assets/models/foliage/low-poly-tree-pack.glb",
  giantTree: "./assets/models/foliage/giant-low-poly-tree.glb",
  bushes: "./assets/models/foliage/lilac-bushes-lods.glb",
  grass: "./assets/models/foliage/grass-pack-lods.glb"
});

// The supplied pack has no authored LOD names, so the tiers are selected by
// measured vertex cost and silhouette. Near trees use the fuller 1.6k-4k
// vertex models; distant trees use 156-508 vertex models.
const TREE_VARIANTS_NEAR = Object.freeze([
  "skp3703_1",
  "skp5771_1",
  "skp665F1",
  "skp7EEA1",
  "skp7EEA_1_",
  "skpEFB7_1"
]);

const TREE_VARIANTS_FAR = Object.freeze([
  "Group6",
  "skp4847_1",
  "Group4",
  "Group5"
]);

const GIANT_TREE_VARIANTS = Object.freeze(["Root"]);

const BUSH_VARIANTS = Object.freeze([
  "Lilac_small_bush_1_LOD2",
  "Lilac_small_bush_2_LOD2",
  "Lilac_small_bush_3_LOD2",
  "Lilac_sapling_1_LOD2",
  "Lilac_sapling_2_LOD2",
  "Lilac_sapling_3_LOD2"
]);

const GRASS_VARIANTS = Object.freeze([
  // GLTFLoader sanitises spaces in node names to underscores.
  "Grass_small_1",
  "Grass_small_2",
  "Grass_small_3",
  "Grass_medium_1",
  "Grass_medium_2",
  "Grass_medium_3"
]);

function getPack(kind) {
  if (!packPromises.has(kind)) {
    packPromises.set(kind, loader.loadAsync(PACKS[kind]).then((gltf) => {
      gltf.scene.traverse((object) => {
        if (!object.isMesh) return;
        if (object.geometry) object.geometry.userData.sharedAsset = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const item of materials) {
          if (!item) continue;
          item.userData.sharedAsset = true;

          // The source leaf cards use blended transparency, which makes a
          // sparse crown look even thinner when several cards overlap. Alpha
          // testing gives the silhouettes solid depth and avoids sorting
          // artefacts without adding geometry or draw calls.
          if (/cluster|brunch/i.test(item.name)) {
            item.transparent = false;
            item.alphaTest = Math.max(item.alphaTest ?? 0, 0.38);
            item.depthWrite = true;
            item.side = THREE.DoubleSide;
            if (item.color) item.color.multiply(new THREE.Color(0xc5dbc0));
            item.needsUpdate = true;
          }
        }
      });
      return gltf.scene;
    }));
  }
  return packPromises.get(kind);
}

function placement(x, z, scale = 1, rotation = 0, extras = {}) {
  return Object.freeze({ x, z, scale, rotation, ...extras });
}

function variation(index, salt) {
  const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function signedVariation(index, salt) {
  return variation(index, salt) * 2 - 1;
}

function createStrip({
  x,
  z,
  count,
  stepX = 0,
  stepZ = 0,
  scale,
  scaleVariance = 0.1,
  jitterX = 0.45,
  jitterZ = 0.45
}) {
  return Array.from({ length: count }, (_, index) => placement(
    x + stepX * index + signedVariation(index, 1) * jitterX,
    z + stepZ * index + signedVariation(index, 2) * jitterZ,
    scale + signedVariation(index, 3) * scaleVariance,
    variation(index, 4) * Math.PI * 2
  ));
}

function createForestPatch({
  x,
  z,
  columns,
  rows,
  stepX,
  stepZ,
  scale,
  scaleVariance = 0.16,
  seed
}) {
  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return placement(
      x + column * stepX + signedVariation(index, seed) * 1.25,
      z + row * stepZ + signedVariation(index, seed + 1) * 1.45,
      scale + signedVariation(index, seed + 2) * scaleVariance,
      variation(index, seed + 3) * Math.PI * 2
    );
  });
}

// The M1 meets the lot as a retaining ledge. Yale Road stays outside the lot,
// leaving a narrow landscaped corridor along the east parking edge.
const TREE_PLACEMENTS = Object.freeze([
  // Sparse, irregular trees in the grass strip between the lot and diagonal
  // Yale Road. This starts south of the M1 bridge where the strip is wide.
  ...createStrip({ x: 60.2, z: 4, count: 8, stepZ: 3.7, scale: 0.48, scaleVariance: 0.09, jitterX: 0.5, jitterZ: 0.7 }),
  // Woodland beyond Yale Road fills the open east field without interfering
  // with the lot, lower highway, checkpoint, or bridge deck.
  ...createForestPatch({ x: 81, z: -46, columns: 9, rows: 14, stepX: 3.5, stepZ: 5.3, scale: 0.54, seed: 10 })
]);

const BUSH_PLACEMENTS = Object.freeze([
  ...createStrip({ x: 59.4, z: -4, count: 12, stepZ: 3.15, scale: 0.4, scaleVariance: 0.08, jitterX: 0.45, jitterZ: 0.65 }),
  ...createForestPatch({ x: 82, z: -44, columns: 5, rows: 10, stepX: 6.1, stepZ: 7.1, scale: 0.42, seed: 20 })
]);

const GRASS_PLACEMENTS = Object.freeze([
  ...createStrip({ x: 59.2, z: -15, count: 31, stepZ: 1.62, scale: 0.52, scaleVariance: 0.1, jitterX: 0.7, jitterZ: 0.65 }),
  ...createForestPatch({ x: 81.5, z: -45, columns: 7, rows: 12, stepX: 4.5, stepZ: 5.9, scale: 0.52, seed: 30 })
]);

function chooseVariant(variants, index) {
  return variants[index % variants.length];
}

function createPlacementMatrix(item) {
  const widthScale = item.widthScale ?? 1;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(item.x, 0.05, item.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, item.rotation, 0)),
    new THREE.Vector3(item.scale * widthScale, item.scale, item.scale * widthScale)
  );
}

function getMeshParts(prototype, normalizeToUnitHeight = false) {
  prototype.updateWorldMatrix(true, true);
  let prototypeMatrix = prototype.matrixWorld.clone().invert();

  // The user-supplied tree pack stores its meshes in a large shared authoring
  // scene. Bake each selected subtree's world transform, recenter it at the
  // trunk base, and normalize it to one metre before applying game scale.
  if (normalizeToUnitHeight) {
    const bounds = new THREE.Box3().setFromObject(prototype);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const normalScale = size.y > 0 ? 1 / size.y : 1;
    prototypeMatrix = new THREE.Matrix4()
      .makeScale(normalScale, normalScale, normalScale)
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
  }
  const parts = [];

  prototype.traverse((object) => {
    if (!object.isMesh) return;
    parts.push({
      geometry: object.geometry,
      material: object.material,
      matrix: prototypeMatrix.clone().multiply(object.matrixWorld)
    });
  });
  return parts;
}

function isLeafMaterial(material) {
  const name = material?.name ?? "";
  return /cluster|brunch|leaf|vegetati|0077|0014/i.test(name);
}

function addInstancedVariant(root, prototype, placements, name, { normalizeToUnitHeight = false } = {}) {
  const parts = getMeshParts(prototype, normalizeToUnitHeight);
  const placementMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();

  for (const [partIndex, part] of parts.entries()) {
    const instances = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    instances.name = `${name}-part-${partIndex}`;
    instances.castShadow = false;
    instances.receiveShadow = true;

    placements.forEach((item, index) => {
      placementMatrix.copy(createPlacementMatrix(item));
      finalMatrix.multiplyMatrices(placementMatrix, part.matrix);
      instances.setMatrixAt(index, finalMatrix);
      if (isLeafMaterial(part.material)) {
        const greens = [0xe0efda, 0xcce4c7, 0xeff3cf];
        instances.setColorAt(index, new THREE.Color(greens[index % greens.length]));
      }
    });
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    instances.computeBoundingSphere();
    root.add(instances);
  }
}

async function addPackInstances(root, kind, variants, placements, options = {}) {
  const scene = await getPack(kind);
  const placementsByVariant = new Map();

  placements.forEach((item, index) => {
    const variant = chooseVariant(variants, index);
    const group = placementsByVariant.get(variant) ?? [];
    group.push(item);
    placementsByVariant.set(variant, group);
  });

  for (const [variant, variantPlacements] of placementsByVariant) {
    const prototype = scene.getObjectByName(variant);
    if (!prototype) {
      console.warn(`Parking foliage variant not found: ${variant}`);
      continue;
    }
    addInstancedVariant(root, prototype, variantPlacements, `parking-foliage-${variant}`, options);
  }
}

// Deliberately fire-and-forget: the environment remains usable while foliage
// downloads, then receives the static batches once each pack is ready.
export function addParkingFoliage(root) {
  const foliageRoot = new THREE.Group();
  foliageRoot.name = "parking-foliage";
  root.add(foliageRoot);

  Promise.all([
    addPackInstances(
      foliageRoot,
      "treePack",
      TREE_VARIANTS_FAR,
      TREE_PLACEMENTS.map((item) => ({ ...item, scale: item.scale * 15 })),
      { normalizeToUnitHeight: true }
    ),
    addPackInstances(foliageRoot, "bushes", BUSH_VARIANTS, BUSH_PLACEMENTS),
    addPackInstances(foliageRoot, "grass", GRASS_VARIANTS, GRASS_PLACEMENTS)
  ]).catch((error) => {
    console.warn("Unable to add parking foliage", error);
  });
}

function takeDensity(placements, density) {
  const count = Math.max(0, Math.min(placements.length, Math.round(placements.length * density)));
  return placements.slice(0, count);
}

const NORTH_TREE_PLACEMENTS = Object.freeze([
  // A substantial left-hand canopy masks the simplified western building
  // transitions and establishes the asymmetric mass in the reference.
  ...createForestPatch({
    x: -114,
    z: -148,
    columns: 8,
    rows: 6,
    stepX: 5.3,
    stepZ: 5.7,
    scale: 7.3,
    scaleVariance: 1.15,
    seed: 60
  }),
  // This controlled front band is what the driving camera sees most clearly.
  // Its small Z jitter keeps trunks in the landscaped gap between parking and
  // campus, instead of allowing them to drift into either footprint.
  // Keep the centre-facade sightline open. Even correctly placed foreground
  // trees read as though they grow through the building when their leaf cards
  // project across its window bands from the reference camera.
  ...createStrip({
    x: -75,
    z: -114.9,
    count: 5,
    stepX: 7.25,
    scale: 9.2,
    scaleVariance: 1.1,
    jitterX: 0.7,
    jitterZ: 0.12
  }),
  ...createStrip({
    x: 73.5,
    z: -114.7,
    count: 8,
    stepZ: -4.7,
    scale: 8.4,
    scaleVariance: 0.9,
    jitterX: 0.7,
    jitterZ: 0.45
  })
]);

const NORTH_BUSH_PLACEMENTS = Object.freeze([
  ...createStrip({ x: -76, z: -114.8, count: 31, stepX: 4.7, scale: 0.46, scaleVariance: 0.07, jitterX: 0.55, jitterZ: 0.1 }),
  ...createStrip({ x: 73.8, z: -114.4, count: 10, stepZ: -3.6, scale: 0.42, scaleVariance: 0.07, jitterX: 0.5, jitterZ: 0.3 })
]);

const NORTH_GRASS_PLACEMENTS = Object.freeze([
  ...createStrip({ x: -76, z: -114.75, count: 44, stepX: 3.35, scale: 0.5, scaleVariance: 0.08, jitterX: 0.75, jitterZ: 0.08 }),
  ...createStrip({ x: -72, z: -72, count: 30, stepX: 4.6, scale: 0.44, scaleVariance: 0.08, jitterX: 0.9, jitterZ: 0.55 })
]);

function outsideExclusions(item, exclusions) {
  return exclusions.every((exclusion) => {
    const buffer = exclusion.buffer ?? 0;
    return Math.abs(item.x - exclusion.x) >= exclusion.width / 2 + buffer
      || Math.abs(item.z - exclusion.z) >= exclusion.depth / 2 + buffer;
  });
}

export function getNorthDioramaFoliageLayout({ density = 1, exclusions = [] } = {}) {
  const baseTrees = takeDensity(NORTH_TREE_PLACEMENTS, density)
    .map((item, index) => ({
      ...item,
      widthScale: 1 + variation(index, 111) * 0.14
    }))
    .filter((item) => outsideExclusions(item, exclusions));

  // Offset companions overlap selected crowns. This adds volume while keeping
  // the same source assets and remains deterministic for visual tests.
  const companions = baseTrees
    .filter((_, index) => index % 3 === 0)
    .map((item, index) => ({
      ...item,
      x: item.x + signedVariation(index, 112) * 2.15,
      z: item.z + signedVariation(index, 113) * 0.24,
      scale: item.scale * 0.78,
      rotation: item.rotation + Math.PI * (0.45 + variation(index, 114) * 0.3),
      widthScale: 1 + variation(index, 118) * 0.1
    }))
    .filter((item) => outsideExclusions(item, exclusions));

  const trees = [...baseTrees, ...companions];
  const nearTrees = trees.filter((item) => item.z > -126);
  const giantTreeSources = [
    nearTrees[0],
    nearTrees[Math.floor(nearTrees.length * 0.55)],
    nearTrees.at(-1)
  ].filter(Boolean);
  const giantTreeSet = new Set(giantTreeSources);
  const giantTrees = giantTreeSources.map((tree) => ({
    ...tree,
    scale: tree.scale * 1.22,
    widthScale: tree.widthScale * 1.04
  }));
  const explicitBushes = takeDensity(NORTH_BUSH_PLACEMENTS, density);
  const understory = trees
    .filter((_, index) => index % 2 === 0)
    .map((item, index) => placement(
      item.x + signedVariation(index, 115) * 1.35,
      item.z + signedVariation(index, 116) * 0.38,
      0.34 + variation(index, 117) * 0.1,
      item.rotation + Math.PI * 0.35
    ));

  return Object.freeze({
    giantTrees: Object.freeze(giantTrees),
    treesNear: Object.freeze(nearTrees.filter((tree) => !giantTreeSet.has(tree))),
    treesFar: Object.freeze(trees.filter((item) => item.z <= -126)),
    bushes: Object.freeze([...explicitBushes, ...understory]
      .filter((item) => outsideExclusions(item, exclusions))),
    grass: Object.freeze(takeDensity(NORTH_GRASS_PLACEMENTS, density)
      .filter((item) => outsideExclusions(item, exclusions)))
  });
}

export async function addNorthDioramaFoliage(root, density = 1, { exclusions = [] } = {}) {
  const foliageRoot = new THREE.Group();
  foliageRoot.name = "north-diorama-foliage";
  root.add(foliageRoot);

  const layout = getNorthDioramaFoliageLayout({ density, exclusions });

  try {
    await Promise.all([
      addPackInstances(
        foliageRoot,
        "giantTree",
        GIANT_TREE_VARIANTS,
        layout.giantTrees,
        { normalizeToUnitHeight: true }
      ),
      addPackInstances(
        foliageRoot,
        "treePack",
        TREE_VARIANTS_NEAR,
        layout.treesNear,
        { normalizeToUnitHeight: true }
      ),
      addPackInstances(
        foliageRoot,
        "treePack",
        TREE_VARIANTS_FAR,
        layout.treesFar,
        { normalizeToUnitHeight: true }
      ),
      addPackInstances(foliageRoot, "bushes", BUSH_VARIANTS, layout.bushes),
      addPackInstances(foliageRoot, "grass", GRASS_VARIANTS, layout.grass)
    ]);
  } catch (error) {
    console.warn("Unable to add north diorama foliage", error);
  }
}
