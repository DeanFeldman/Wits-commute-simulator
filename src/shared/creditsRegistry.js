const CC_BY_4 = "CC BY 4.0";
const CC0 = "CC0 (public domain)";
const GENERATED = "AI-generated / AI-assisted; no third-party licence attaches";

/**
 * Concise in-game counterpart of docs/ASSETS_AND_CREDITS.md.
 *
 * This registry only states provenance that the repository currently supports.
 * Unknown or incomplete provenance is surfaced explicitly rather than guessed.
 */
export const CREDITS = [
  {
    heading: "Project team",
    entries: [
      {
        name: "7:55AM — At Wits End",
        detail: "COMS3006A / COMS3025A Computer Graphics and Visualisation project (Wits Commute Simulator)."
      },
      {
        name: "Team",
        detail: "Dean Feldman, Shayna Unterslak, Nadav Sundy, Liora Rosenberg, Benjamin Swartz and Gabriel Raz."
      }
    ]
  },
  {
    heading: "Libraries and type",
    entries: [
      {
        name: "Three.js",
        detail: "3D rendering, cameras, scene graph, materials and WebGL abstraction — MIT.",
        url: "https://threejs.org"
      },
      {
        name: "Vite",
        detail: "Development server and production bundling — MIT.",
        url: "https://vitejs.dev"
      },
      {
        name: "Pixelify Sans",
        detail: "Google Fonts typeface by Stefie Justprince — SIL Open Font License 1.1.",
        url: "https://fonts.google.com/specimen/Pixelify+Sans"
      },
      {
        name: "Inter",
        detail: "Google Fonts typeface by Rasmus Andersson — SIL Open Font License 1.1.",
        url: "https://fonts.google.com/specimen/Inter"
      }
    ]
  },
  {
    heading: "CC BY 4.0 models",
    entries: [
      {
        name: "Whiteboard",
        detail: `tboiston — ${CC_BY_4}. Level 3 classroom; rescaled and repositioned at runtime.`,
        url: "https://sketchfab.com/3d-models/whiteboard-d0b05bd140734a799666f0a29e1fe1bb"
      },
      {
        name: "Plastic Chair (retained asset)",
        detail: `Jazavac — ${CC_BY_4}. plastic-chair.glb remains in the distributed public asset folder, although current Level 3 code loads classroom-plastic-chair.glb instead.`,
        url: "https://sketchfab.com/3d-models/plastic-chair-be3d5131e634424e89ffd57ebb19804e"
      },
      {
        name: "Paper Tablet",
        detail: `NameSsis — ${CC_BY_4}. Level 3 answer tablets; rescaled and given runtime answer textures.`,
        url: "https://sketchfab.com/3d-models/paper-tablet-f2b7978367164eb38167dd4832978288"
      },
      {
        name: "Car Scene",
        detail: `toivo — ${CC_BY_4}. Level 1 player car; the showcase surroundings are removed at load time.`,
        url: "https://sketchfab.com/3d-models/car-scene-b7b32eaca80d460c9338197e2c9d1408"
      },
      {
        name: "Generic Passenger Car Pack",
        detail: `Comrade1280 — ${CC_BY_4}. Level 1 parked-car population; individual vehicles are extracted and cloned.`,
        url: "https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5"
      },
      {
        name: "Diesel Powered Thomas reference",
        detail: "mrmrnaufal — Creative Commons Attribution (CC BY), as listed on Sketchfab. The repo retains lightweight project-made procedural proxy GLBs rather than a conversion of the source mesh.",
        url: "https://sketchfab.com/3d-models/diesel-powered-thomas-7e94742d88a84ca9aacb6b7881aec2ab"
      }
    ]
  },
  {
    heading: "Textures and environment lighting",
    entries: [
      {
        name: "Asphalt 02 PBR set",
        detail: `Rob Tuytel / Poly Haven — ${CC0}. Diffuse, roughness, displacement and OpenGL normal textures used by the Level 1 and Level 2 asphalt shader.`,
        url: "https://polyhaven.com/a/asphalt_02"
      },
      {
        name: "Grass Pack of 9 Variations",
        detail: "LOLIPOP (@lolipop_1707) — CC BY. Used for Level 1 grass foliage; processed and instanced at runtime.",
        url: "https://sketchfab.com/3d-models/grass-pack-of-9-vars-lowpoly-game-ready-0561204a1fa14c17939300ee1108948b"
      },
      {
        name: "Lilac Bush Pack",
        detail: "LOLIPOP (@lolipop_1707) — CC BY. Used for Level 1 bush/understory foliage; processed and instanced at runtime.",
        url: "https://sketchfab.com/3d-models/lilac-bush-pack-12-vars-lods-game-ready-10312697ec994fc99355cb94f1963a2e"
      },
      {
        name: "Giant Low Poly Tree",
        detail: "Sahir Virmani (@sahirvirmani) — CC BY. Used for Level 1 hero/near-campus trees; normalised/scaled and instanced at runtime.",
        url: "https://sketchfab.com/3d-models/giant-low-poly-tree-acfd2b7f80894848b56c2ac8e7e59572"
      },
      {
        name: "Low Poly Tree Pack",
        detail: "Pasha (@Pasha.) — Sketchfab Free Standard. Used for Level 1 near/distant trees; selected subtrees are normalised/scaled and instanced at runtime.",
        url: "https://sketchfab.com/3d-models/low-poly-tree-pack-1edaac90fe8d4bb28546740496684d96"
      },
      {
        name: "Joburg Central Sunset HDRI",
        detail: `Dimitrios Savva (photography) and Greg Zaal (processing) / Poly Haven — ${CC0}. Used for Level 3 environment lighting and background.`,
        url: "https://polyhaven.com/a/sunset_jhbcentral"
      }
    ]
  },
  {
    heading: "Original music",
    entries: [
      {
        name: "Commute Theme / Dusk Drive / Empire Rush / Don't Get Caught",
        detail: `OpenAI-assisted original compositions generated for this project on 2026-09-25 and stored as pre-rendered WAV files. ${GENERATED}. No third-party samples are recorded as used.`
      }
    ]
  },
  {
    heading: "AI-generated and project-created assets",
    entries: [
      {
        name: "Level 1 story loading screen",
        detail: `Generated with OpenAI image generation on 2026-09-08 from the team's driver-checking-a-watch concept reference — ${GENERATED}.`
      },
      {
        name: "Main menu background",
        detail: `main-menu-background.png — generated with OpenAI image generation via ChatGPT under the direction of Dean Feldman for this project — ${GENERATED}.`
      },
      {
        name: "Level 3 story loading screen",
        detail: `level3-story-loading-screen.png — generated with OpenAI image generation via ChatGPT under the direction of Dean Feldman for this project — ${GENERATED}.`
      },
      {
        name: "Wits shark 3D model",
        detail: "Project-created by Gabriel Raz using Wits Sharks Instagram imagery as visual reference supplied by Dean Feldman. The separate reference PNG was removed because gameplay loads only the GLB.",
        url: "https://www.instagram.com/wits_sharks/"
      },
      {
        name: "Classroom brick wall and terrazzo floor",
        detail: `Generated by Gabriel Raz and tiled at runtime in Level 3 — ${GENERATED}.`
      },
      {
        name: "Level 3 zoom-hands UI",
        detail: `Generated by Gabriel Raz with OpenAI gpt-image v2.0; C2PA metadata records trainedAlgorithmicMedia — ${GENERATED}.`
      },
      {
        name: "Team-authored systems and environments",
        detail: "Includes the parking blockout and bay layout, surrounding road geometry, vehicle rig/controller, custom shader code, Level 2 crossing/traffic layout, Level 3 classroom layout and exam-paper textures, and shared UI/menu/HUD styling."
      }
    ]
  },
  {
    heading: "Pending provenance before final submission",
    entries: [
      {
        name: "Level 1 recorded audio",
        detail: "car-crash.mp3, car-door-shut.mp3, idle-car.wav and collision-hit.mp3 still need complete source/author/licence records or replacement."
      },
      {
        name: "Pencil Pete trial font",
        detail: "JOEBOB graphics — source identified on 1001 Fonts. The listing says free for personal use / not free for commercial use; redistribution of the trial TTF in the submitted game still needs explicit clearance or replacement.",
        url: "https://www.1001fonts.com/pencilpete-font-font.html"
      },
      {
        name: "Level 1 environment textures still unresolved",
        detail: "The runtime foliage model sources are recorded. The stylized grass texture set still needs provenance. east-precast-wall-texture.jpg was directly edited/adapted from a Precast Walling Pros image by Dean Feldman; reuse/redistribution terms have not yet been confirmed.",
        url: "https://precastwallingpros.co.za/"
      },
      {
        name: "Level 2 character assets",
        detail: "Student backpack, NPC/player GLB/FBX models and walk/run/idle animations are used at runtime but their source/licence or team-authorship records are not yet complete."
      },
      {
        name: "Level 3 character/prop assets",
        detail: "Tutor GLB/FBX assets, the seated-student animation, classroom-desk and classroom-plastic-chair variants still need complete provenance records. The repo also retains a known project-created cartoon-desk and a Jazavac CC BY 4.0 plastic-chair source asset, but the relationship to the current runtime replacement files must be confirmed before those credits are carried across."
      },
      {
        name: "AMIC / Level 2 deck textures",
        detail: "amic-fence.png, amic-fence-reference.png and 2695c241-17bb-416d-9d1d-7f061ccf7976.png were directly edited/adapted by Dean Feldman from imagery in Crown Publications' “Bridging the divide” article. The article credits its images to eimage/Gareth Gilmour; reuse/redistribution permission still needs confirmation.",
        url: "https://www.crown.co.za/lighting-in-design/case-studies/27707-bridging-the-divide"
      },
      {
        name: "UI artwork still awaiting provenance records",
        detail: "main-menu-background.png and level3-story-loading-screen.png now have OpenAI/ChatGPT generation records from Dean Feldman. at-wits-end-logo-v2.png, main-menu-v3-background.png, level2-story-loading-screen.png and suspicion-meter.png still need generation or source/licence records."
      }
    ]
  }
];
