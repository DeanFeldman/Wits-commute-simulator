import * as THREE from "three";

/**
 * Low-poly recreation of the Wits shelter beside Yale Road.
 *
 * Local orientation:
 *   +Z = open/front side
 *   -Z = flat back side
 *
 * CrossingStrip rotates this by 180 degrees so the flat back
 * faces Yale Road and the stepped/open side faces further into campus.
 */
export function createWitsBusStop() {
  const root = new THREE.Group();
  root.name = "wits-yale-bus-stop";

  // --------------------------------------------------
  // MATERIALS
  // --------------------------------------------------

  const brick = new THREE.MeshStandardMaterial({
    color: 0x934b36,
    roughness: 0.92
  });

  const paleStone = new THREE.MeshStandardMaterial({
    color: 0xd8d0bb,
    roughness: 0.88
  });

  const steel = new THREE.MeshStandardMaterial({
    color: 0x555b59,
    roughness: 0.7,
    metalness: 0.35
  });

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d846d,
    roughness: 0.86,
    metalness: 0.12
  });

  const backPanelMaterial = new THREE.MeshStandardMaterial({
    color: 0xdfded6,
    roughness: 0.92
  });

  const darkBench = new THREE.MeshStandardMaterial({
    color: 0x57382e,
    roughness: 0.9
  });

  const binMaterial = new THREE.MeshStandardMaterial({
    color: 0x307565,
    roughness: 0.82
  });

  const binTopMaterial = new THREE.MeshStandardMaterial({
    color: 0x202322,
    roughness: 0.74
  });

  // --------------------------------------------------
  // HELPER
  // --------------------------------------------------

  const addBox = (
    parent,
    size,
    position,
    material,
    {
      name = "",
      castShadow = true,
      receiveShadow = true
    } = {}
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      material
    );

    mesh.position.set(...position);
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    parent.add(mesh);

    return mesh;
  };

  // --------------------------------------------------
  // MAIN DIMENSIONS
  // --------------------------------------------------

  const width = 9.6;
  const depth = 3.0;

  const roofHeight = 3.15;

  const backZ =
    -depth / 2 + 0.16;

  // --------------------------------------------------
  // RAISED RED-BRICK BASE
  // --------------------------------------------------

  addBox(
    root,
    [width, 0.48, 2.55],
    [0, 0.24, -0.12],
    brick,
    {
      name: "wits-bus-stop-brick-base"
    }
  );

  // Pale cap over the brick platform.
  addBox(
    root,
    [width - 0.18, 0.09, 2.36],
    [0, 0.525, -0.1],
    paleStone,
    {
      name: "wits-bus-stop-platform-cap"
    }
  );

  // --------------------------------------------------
  // FRONT STEPS
  // Similar to the real Wits reference.
  // --------------------------------------------------

  addBox(
    root,
    [5.8, 0.24, 0.72],
    [0.45, 0.12, 1.5],
    brick,
    {
      name: "wits-bus-stop-step-lower"
    }
  );

  addBox(
    root,
    [5.7, 0.06, 0.68],
    [0.45, 0.27, 1.5],
    paleStone,
    {
      name: "wits-bus-stop-step-lower-cap"
    }
  );

  addBox(
    root,
    [3.4, 0.25, 0.72],
    [-0.55, 0.36, 1.05],
    brick,
    {
      name: "wits-bus-stop-step-upper"
    }
  );

  addBox(
    root,
    [3.3, 0.06, 0.68],
    [-0.55, 0.515, 1.05],
    paleStone,
    {
      name: "wits-bus-stop-step-upper-cap"
    }
  );

  // Long brick bench against the back wall.
  addBox(
    root,
    [width - 0.65, 0.38, 0.46],
    [0, 0.72, backZ + 0.36],
    brick,
    {
      name: "wits-bus-stop-bench-base"
    }
  );

  addBox(
    root,
    [width - 0.72, 0.08, 0.42],
    [0, 0.95, backZ + 0.36],
    darkBench,
    {
      name: "wits-bus-stop-bench-seat"
    }
  );

  // --------------------------------------------------
  // STEEL SUPPORT POSTS
  // --------------------------------------------------

  const postXs = [
    -width / 2 + 0.32,
    -width / 6,
    width / 6,
    width / 2 - 0.32
  ];

  for (const x of postXs) {
    addBox(
      root,
      [0.16, 2.55, 0.16],
      [x, 1.78, backZ],
      steel,
      {
        name: "wits-bus-stop-post"
      }
    );
  }

  // Long beam beneath the roof.
  addBox(
    root,
    [width + 0.15, 0.16, 0.18],
    [0, 2.92, backZ],
    steel,
    {
      name: "wits-bus-stop-top-beam"
    }
  );

  // --------------------------------------------------
  // FLAT BACK PANELS
  //
  // These are deliberately plain from the outside.
  // Posters are added only to the interior/front side.
  // --------------------------------------------------

  const panelWidth =
    (width - 1.0) / 3;

  for (let index = 0; index < 3; index++) {
    const x =
      -panelWidth +
      index * panelWidth;

    addBox(
      root,
      [panelWidth - 0.1, 1.65, 0.1],
      [x, 1.93, backZ + 0.02],
      backPanelMaterial,
      {
        name: "wits-bus-stop-flat-back-panel",
        castShadow: false
      }
    );
  }

  // --------------------------------------------------
  // SIMPLE NOTICE POSTERS
  //
  // These sit only on the inside of the shelter.
  // The outside/back remains visually flat.
  // --------------------------------------------------

  const posterMaterials = [
    new THREE.MeshBasicMaterial({
      color: 0x3c9fa9
    }),
    new THREE.MeshBasicMaterial({
      color: 0xe2c23b
    }),
    new THREE.MeshBasicMaterial({
      color: 0xc85f54
    })
  ];

  const posterPositions = [
    [-2.35, 2.05],
    [0.1, 1.85],
    [2.45, 2.08]
  ];

  posterPositions.forEach(
    ([x, y], index) => {
      const poster =
        new THREE.Mesh(
          new THREE.PlaneGeometry(
            0.72,
            0.88
          ),
          posterMaterials[index]
        );

      // PlaneGeometry faces +Z,
      // therefore posters are visible only from the open/front side.
      poster.position.set(
        x,
        y,
        backZ + 0.075
      );

      poster.name =
        "wits-bus-stop-poster";

      root.add(poster);
    }
  );

  // --------------------------------------------------
  // CORRUGATED ROOF
  // --------------------------------------------------

  const roof = new THREE.Group();
  roof.name = "wits-bus-stop-roof";

  roof.position.y =
    roofHeight;

  // Slight Wits-style slope.
  roof.rotation.x =
    -0.055;

  addBox(
    roof,
    [
      width + 0.65,
      0.13,
      depth + 0.85
    ],
    [
      0,
      0,
      0.1
    ],
    roofMaterial,
    {
      name: "wits-bus-stop-roof-sheet"
    }
  );

  // Corrugation ribs.
  const ribCount = 28;

  const ribGeometry =
    new THREE.BoxGeometry(
      0.055,
      0.055,
      depth + 0.9
    );

  const ribs =
    new THREE.InstancedMesh(
      ribGeometry,
      roofMaterial,
      ribCount
    );

  const matrix =
    new THREE.Matrix4();

  for (
    let index = 0;
    index < ribCount;
    index++
  ) {
    const x =
      -width / 2 - 0.2 +
      index *
      (
        (width + 0.4) /
        (ribCount - 1)
      );

    matrix.makeTranslation(
      x,
      0.09,
      0.1
    );

    ribs.setMatrixAt(
      index,
      matrix
    );
  }

  ribs.instanceMatrix.needsUpdate =
    true;

  ribs.castShadow = true;
  ribs.name =
    "wits-bus-stop-roof-ribs";

  roof.add(ribs);
  root.add(roof);

  // --------------------------------------------------
  // SMALL SIDE BRACES
  // --------------------------------------------------

  for (const x of [
    -width / 2 + 0.4,
    width / 2 - 0.4
  ]) {
    const brace =
      addBox(
        root,
        [0.12, 0.12, 1.45],
        [x, 2.72, -0.58],
        steel,
        {
          name:
            "wits-bus-stop-roof-brace"
        }
      );

    brace.rotation.x =
      -Math.PI / 5.8;
  }

  // --------------------------------------------------
  // GREEN BIN
  // --------------------------------------------------

  const bin =
    new THREE.Group();

  bin.name =
    "wits-bus-stop-bin";

  const binBody =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.32,
        0.32,
        1.02,
        14
      ),
      binMaterial
    );

  binBody.position.y =
    0.51;

  binBody.castShadow = true;
  bin.add(binBody);

  const binTop =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.35,
        0.35,
        0.15,
        14
      ),
      binTopMaterial
    );

  binTop.position.y =
    1.07;

  binTop.castShadow = true;
  bin.add(binTop);

  bin.position.set(
    width / 2 + 0.62,
    0,
    0.75
  );

  root.add(bin);

  return root;
}