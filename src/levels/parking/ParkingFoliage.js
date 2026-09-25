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
    new THREE.Vector3(item.x, item.y ?? 0.05, item.z),
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

export function addSharedFoliage(root, { trees = [], bushes = [], grass = [] } = {}, { name = "shared-foliage", treeDetail = "near" } = {}) {
  const foliageRoot = new THREE.Group();
  foliageRoot.name = name;
  root.add(foliageRoot);
  if (typeof document === "undefined") return foliageRoot;
  Promise.all([
    addPackInstances(foliageRoot, "treePack", treeDetail === "far" ? TREE_VARIANTS_FAR : TREE_VARIANTS_NEAR, trees, { normalizeToUnitHeight: true }),
    addPackInstances(foliageRoot, "bushes", BUSH_VARIANTS, bushes),
    addPackInstances(foliageRoot, "grass", GRASS_VARIANTS, grass)
  ]).catch((error) => console.warn(`Unable to add ${name}`, error));
  return foliageRoot;
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

function isClearOfRoadSegments(item, roadSegments, margin) {
  return roadSegments.every((road) => {
    const dx = item.x - road.x;
    const dz = item.z - road.z;
    const cos = Math.cos(road.rotation);
    const sin = Math.sin(road.rotation);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    const besideSegment = Math.abs(localZ) <= road.depth / 2 + margin;
    const outsideCarriageway = Math.abs(localX) > road.width / 2 + margin;
    return !besideSegment || outsideCarriageway;
  });
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

// East-facing vista vegetation is staged in depth along +X. The central field
// stays deliberately sparse; most of the triangle budget is reserved for the
// two staggered background bands that form the cemetery/green-belt horizon.
const EAST_SCATTERED_TREE_PLACEMENTS = Object.freeze([
  ...createStrip({
    x: 98,
    z: -27,
    count: 16,
    stepZ: 8.1,
    scale: 6.4,
    scaleVariance: 0.85,
    jitterX: 10,
    jitterZ: 0.9
  })
]);

const EAST_DENSE_TREE_PLACEMENTS = Object.freeze([
  ...createForestPatch({
    x: 150,
    z: -17,
    columns: 9,
    rows: 22,
    stepX: 6.2,
    stepZ: 6.7,
    scale: 8.4,
    scaleVariance: 1.05,
    seed: 200
  }),
  ...createForestPatch({
    x: 204,
    z: -12,
    columns: 5,
    rows: 22,
    stepX: 6.8,
    stepZ: 7,
    scale: 9.2,
    scaleVariance: 1.2,
    seed: 220
  })
]);

const EAST_BUSH_PLACEMENTS = Object.freeze([
  ...createStrip({
    x: 78.2,
    z: -36.5,
    count: 44,
    stepZ: 3.05,
    scale: 0.4,
    scaleVariance: 0.07,
    jitterX: 0.65,
    jitterZ: 0.55
  }),
  ...createStrip({
    x: 137,
    z: -30.5,
    count: 27,
    stepZ: 4.7,
    scale: 0.43,
    scaleVariance: 0.08,
    jitterX: 2.4,
    jitterZ: 0.65
  })
]);

const EAST_GRASS_PLACEMENTS = Object.freeze([
  ...createStrip({
    x: 79.5,
    z: -36,
    count: 67,
    stepZ: 1.95,
    scale: 0.48,
    scaleVariance: 0.08,
    jitterX: 1.3,
    jitterZ: 0.7
  }),
  ...createStrip({
    x: 131,
    z: -30.5,
    count: 49,
    stepZ: 2.55,
    scale: 0.45,
    scaleVariance: 0.08,
    jitterX: 4.5,
    jitterZ: 0.75
  })
]);

export function getEastDioramaFoliageLayout(density = 1) {
  const scatteredTrees = takeDensity(EAST_SCATTERED_TREE_PLACEMENTS, density);
  const heroIndices = new Set([0, 4, 8].filter((index) => index < scatteredTrees.length));

  return Object.freeze({
    giantTrees: Object.freeze(scatteredTrees
      .filter((_, index) => heroIndices.has(index))
      .map((item) => ({ ...item, scale: item.scale * 1.15 }))),
    scatteredTrees: Object.freeze(scatteredTrees.filter((_, index) => !heroIndices.has(index))),
    denseTrees: Object.freeze(takeDensity(EAST_DENSE_TREE_PLACEMENTS, density)),
    bushes: Object.freeze(takeDensity(EAST_BUSH_PLACEMENTS, density)),
    grass: Object.freeze(takeDensity(EAST_GRASS_PLACEMENTS, density))
  });
}

export async function addEastDioramaFoliage(root, density = 1) {
  const foliageRoot = new THREE.Group();
  foliageRoot.name = "east-diorama-foliage";
  root.add(foliageRoot);

  const layout = getEastDioramaFoliageLayout(density);

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
        TREE_VARIANTS_FAR,
        layout.scatteredTrees,
        { normalizeToUnitHeight: true }
      ),
      addPackInstances(
        foliageRoot,
        "treePack",
        TREE_VARIANTS_FAR,
        layout.denseTrees,
        { normalizeToUnitHeight: true }
      ),
      // These names explicitly select the supplied lilac LOD2 nodes.
      addPackInstances(foliageRoot, "bushes", BUSH_VARIANTS, layout.bushes),
      addPackInstances(foliageRoot, "grass", GRASS_VARIANTS, layout.grass)
    ]);
  } catch (error) {
    console.warn("Unable to add east diorama foliage", error);
  }
}

// West is the densest architectural vista. Trees are arranged as irregular
// edge clusters and a deep horizon rather than a uniform screen, then filtered
// against every building footprint supplied by WestDiorama.
const WEST_TREE_PLACEMENTS = Object.freeze([
  ...createStrip({
    x: -108,
    z: -82,
    count: 15,
    stepZ: 12.1,
    scale: 9.1,
    scaleVariance: 1.1,
    jitterX: 3.2,
    jitterZ: 1.4
  }),
  ...createForestPatch({
    x: -151,
    z: -118,
    columns: 4,
    rows: 13,
    stepX: 15.5,
    stepZ: 18.2,
    scale: 7.5,
    scaleVariance: 0.95,
    seed: 510
  }),
  ...createStrip({
    x: -224,
    z: -142,
    count: 34,
    stepZ: 8.8,
    scale: 7.1,
    scaleVariance: 0.85,
    jitterX: 8.5,
    jitterZ: 1.3
  })
]);

const WEST_BUSH_PLACEMENTS = Object.freeze([
  ...createStrip({
    x: -104,
    z: -100,
    count: 36,
    stepZ: 6.1,
    scale: 0.43,
    scaleVariance: 0.07,
    jitterX: 2.6,
    jitterZ: 0.8
  }),
  ...createStrip({
    x: -153,
    z: -116,
    count: 42,
    stepZ: 5.7,
    scale: 0.39,
    scaleVariance: 0.06,
    jitterX: 6.2,
    jitterZ: 0.9
  }),
  ...createStrip({
    x: -226,
    z: -132,
    count: 26,
    stepZ: 10.2,
    scale: 0.36,
    scaleVariance: 0.05,
    jitterX: 7.5,
    jitterZ: 1.2
  })
]);

const WEST_GRASS_PLACEMENTS = Object.freeze([
  ...createStrip({
    x: -105,
    z: -108,
    count: 48,
    stepZ: 4.8,
    scale: 0.46,
    scaleVariance: 0.08,
    jitterX: 3.4,
    jitterZ: 0.8
  }),
  ...createStrip({
    x: -142,
    z: -118,
    count: 44,
    stepZ: 5.2,
    scale: 0.43,
    scaleVariance: 0.07,
    jitterX: 7.5,
    jitterZ: 1.1
  }),
  ...createStrip({
    x: -221,
    z: -128,
    count: 24,
    stepZ: 10.6,
    scale: 0.4,
    scaleVariance: 0.06,
    jitterX: 9,
    jitterZ: 1.4
  })
]);

export function getWestDioramaFoliageLayout({ density = 1, exclusions = [] } = {}) {
  const trees = takeDensity(WEST_TREE_PLACEMENTS, density)
    .filter((item) => outsideExclusions(item, exclusions));
  const heroIndices = new Set([
    1,
    Math.floor(trees.length * 0.28),
    Math.floor(trees.length * 0.55),
    Math.floor(trees.length * 0.78)
  ].filter((index) => index >= 0 && index < trees.length));

  return Object.freeze({
    giantTrees: Object.freeze(trees
      .filter((_, index) => heroIndices.has(index))
      .map((item) => ({ ...item, scale: item.scale * 1.16 }))),
    lod2Trees: Object.freeze(trees.filter((_, index) => !heroIndices.has(index))),
    bushes: Object.freeze(takeDensity(WEST_BUSH_PLACEMENTS, density)
      .filter((item) => outsideExclusions(item, exclusions))),
    grass: Object.freeze(takeDensity(WEST_GRASS_PLACEMENTS, density)
      .filter((item) => outsideExclusions(item, exclusions)))
  });
}

export async function addWestDioramaFoliage(
  root,
  density = 1,
  { exclusions = [] } = {}
) {
  const foliageRoot = new THREE.Group();
  foliageRoot.name = "west-diorama-foliage";
  root.add(foliageRoot);
  const layout = getWestDioramaFoliageLayout({ density, exclusions });

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
        TREE_VARIANTS_FAR,
        layout.lod2Trees,
        { normalizeToUnitHeight: true }
      ),
      addPackInstances(foliageRoot, "bushes", BUSH_VARIANTS, layout.bushes),
      addPackInstances(foliageRoot, "grass", GRASS_VARIANTS, layout.grass)
    ]);
  } catch (error) {
    console.warn("Unable to add west diorama foliage", error);
  }
}

// The south view is intentionally closer and more architectural than the
// north/east vistas. Trees form irregular screens in front of facade seams,
// with a lighter rear band preventing the scene from ending behind the roofs.
// The generic tree pack has no authored Acer LOD names; TREE_VARIANTS_FAR is
// its measured lowest-cost true 3D tier and fills the same LOD2 role here.
const SOUTH_TREE_PLACEMENTS = Object.freeze([
  ...createForestPatch({
    x: -116,
    z: 84,
    columns: 4,
    rows: 6,
    stepX: 7.1,
    stepZ: 8.2,
    scale: 8.1,
    scaleVariance: 1.05,
    seed: 300
  }),
  ...createStrip({
    x: -98,
    z: 80.5,
    count: 6,
    stepX: 10,
    scale: 8.7,
    scaleVariance: 0.95,
    jitterX: 0.85,
    jitterZ: 0.45
  }),
  ...createStrip({
    x: -41,
    z: 80.2,
    count: 6,
    stepX: 12.7,
    scale: 9.1,
    scaleVariance: 1.05,
    jitterX: 1.1,
    jitterZ: 0.4
  }),
  ...createStrip({
    x: 31,
    z: 79.8,
    count: 7,
    stepX: 10.8,
    scale: 8.8,
    scaleVariance: 1,
    jitterX: 0.9,
    jitterZ: 0.5
  }),
  ...createForestPatch({
    x: -109,
    z: 198,
    columns: 12,
    rows: 2,
    stepX: 19.5,
    stepZ: 9.2,
    scale: 7.4,
    scaleVariance: 0.9,
    seed: 340
  })
]);

const SOUTH_BUSH_PLACEMENTS = Object.freeze([
  ...createStrip({
    x: -112,
    z: 79.2,
    count: 55,
    stepX: 4.05,
    scale: 0.42,
    scaleVariance: 0.07,
    jitterX: 0.5,
    jitterZ: 0.48
  }),
  ...createStrip({
    x: -105,
    z: 190,
    count: 32,
    stepX: 7.1,
    scale: 0.38,
    scaleVariance: 0.06,
    jitterX: 0.75,
    jitterZ: 4.8
  })
]);

const SOUTH_GRASS_PLACEMENTS = Object.freeze([
  ...createStrip({
    x: -110,
    z: 78.6,
    count: 44,
    stepX: 5.05,
    scale: 0.45,
    scaleVariance: 0.08,
    jitterX: 0.7,
    jitterZ: 0.45
  }),
  ...createStrip({
    x: -103,
    z: 188,
    count: 18,
    stepX: 11.1,
    scale: 0.42,
    scaleVariance: 0.07,
    jitterX: 0.8,
    jitterZ: 3.6
  })
]);

export function getSouthDioramaFoliageLayout(density = 1, roadSegments = []) {
  // Trees need canopy clearance as well as trunk clearance. Smaller foliage
  // keeps a narrower verge while still remaining completely off the asphalt.
  const trees = takeDensity(SOUTH_TREE_PLACEMENTS, density)
    .filter((item) => isClearOfRoadSegments(item, roadSegments, 4));
  const heroIndices = new Set([
    4, 8, 12, 18, 24, 27, 30, 33, 36, 38, 42, 46
  ].filter((index) => index < trees.length));

  return Object.freeze({
    giantTrees: Object.freeze(trees
      .filter((_, index) => heroIndices.has(index))
      .map((item) => ({ ...item, scale: item.scale * 1.12 }))),
    lod2Trees: Object.freeze(trees.filter((_, index) => !heroIndices.has(index))),
    bushes: Object.freeze(takeDensity(SOUTH_BUSH_PLACEMENTS, density)
      .filter((item) => isClearOfRoadSegments(item, roadSegments, 1.4))),
    grass: Object.freeze(takeDensity(SOUTH_GRASS_PLACEMENTS, density)
      .filter((item) => isClearOfRoadSegments(item, roadSegments, 0.9)))
  });
}

export async function addSouthDioramaFoliage(root, density = 1, roadSegments = []) {
  const foliageRoot = new THREE.Group();
  foliageRoot.name = "south-diorama-foliage";
  root.add(foliageRoot);

  const layout = getSouthDioramaFoliageLayout(density, roadSegments);

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
        TREE_VARIANTS_FAR,
        layout.lod2Trees,
        { normalizeToUnitHeight: true }
      ),
      // The source lilac names explicitly select its lowest-detail 3D LOD2.
      addPackInstances(foliageRoot, "bushes", BUSH_VARIANTS, layout.bushes),
      addPackInstances(foliageRoot, "grass", GRASS_VARIANTS, layout.grass)
    ]);
  } catch (error) {
    console.warn("Unable to add south diorama foliage", error);
  }
}
