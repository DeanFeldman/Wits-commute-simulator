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
  { heading: "Sound effects", entries: [
    { name: "Level 2 vehicle impact", detail: "avakas — CC BY 4.0. Converted to Opus for Level 2 collision feedback.", url: "https://freesound.org/people/avakas/sounds/144113/" },
    { name: "Level 2 shield pop", detail: "DRAGON-STUDIO — Pixabay Content License. Used for shield consumption.", url: "https://pixabay.com/sound-effects/film-special-effects-pop-402324/" },
    { name: "Level 2 pencil mark", detail: "NoisyRedFox — CC0. Used for questionnaire selections.", url: "https://freesound.org/people/NoisyRedFox/sounds/742353/" },
    { name: "Level 3 tutor footsteps", detail: "Yin_Yang_Jake007 and derjuli (Freesound) — Pixabay Content License. Cropped into positional tutor-step cues.", url: "https://pixabay.com/sound-effects/film-special-effects-indoor-footsteps-100664/" },
    { name: "Level 3 desk/chair foley", detail: "Anakronizm — CC0. Cropped into the two active peek-rustle cues; legacy answer clips were removed from the runtime sprite.", url: "https://freesound.org/people/Anakronizm/sounds/494616/" },
    { name: "Level 3 correct answer", detail: "DRAGON-STUDIO — Pixabay Content License. Trimmed and preloaded for immediate correct-answer feedback.", url: "https://pixabay.com/sound-effects/film-special-effects-game-show-correct-tick-sound-416167/" },
    { name: "Level 2 pavement footsteps", detail: "PeteBarry — CC BY 4.0. Cropped into varied pavement steps.", url: "https://freesound.org/people/PeteBarry/sounds/647403/" },
    { name: "Level 2 traffic ambience", detail: "pawsound — CC0. Downmixed into the Level 2 road ambience loop.", url: "https://freesound.org/people/pawsound/sounds/154858/" },
    { name: "Level 2 vehicle pass-bys", detail: "Bakstad — CC0. Two directional vehicle pass-bys used for nearby traffic.", url: "https://freesound.org/people/Bakstad/sounds/823549/" },
    { name: "Level 2 paper foley", detail: "ssugg — CC0. Cropped for survey and quiz paper movement.", url: "https://freesound.org/people/ssugg/sounds/588320/" },
    { name: "Level 3 classroom room tone", detail: "klankbeeld — CC BY 4.0. Used as the classroom/hall ambience loop.", url: "https://freesound.org/people/klankbeeld/sounds/212137/" },
    { name: "Level 3 heartbeat", detail: "Cloud-10 — CC0. Adaptive heartbeat loop for suspicion and time pressure.", url: "https://freesound.org/people/Cloud-10/sounds/688735/" },
    { name: "Level 3 classroom clock", detail: "giddster — CC0. Subtle wall-clock loop that becomes more audible near the end of the test.", url: "https://freesound.org/people/giddster/sounds/434841/" },
    { name: "Level 1 collision impact", detail: "Universfield — Pixabay Content License. Trimmed for immediate car and barrier impacts.", url: "https://pixabay.com/sound-effects/film-special-effects-combat-impact-352458/" },
    { name: "Level 1 pothole thump", detail: "Black_Kumizhi — Pixabay Content License. Low suspension/body thump for potholes.", url: "https://pixabay.com/sound-effects/technology-low-thumpy-kick-reverb-hit-494833/" },
    { name: "Level 1 puddle splash", detail: "cookies+policy — CC0. Wet-pothole tyre splash.", url: "https://freesound.org/people/cookies%2Bpolicy/sounds/563021/" },
    { name: "Level 1 parking-lot ambience", detail: "FunWithSound — CC0. Long-form parking lot / nearby road / light wind ambience for Level 1.", url: "https://freesound.org/people/FunWithSound/sounds/406096/" },
    { name: "Level 1 car start", detail: "GiocoSound — CC0. BMW 120d exterior engine-start cue used when Level 1 begins.", url: "https://freesound.org/people/GiocoSound/sounds/401558/" },
    { name: "Level 1 normal engine idle", detail: "GiocoSound — CC0. BMW 120d exterior idle; converted to a compact seamless Opus loop.", url: "https://freesound.org/people/GiocoSound/sounds/401552/" },
    { name: "Level 1 damaged engine", detail: "LHermanns — CC BY 4.0. Engine warmup loop crossfaded in progressively as Level 1 vehicle condition becomes critical.", url: "https://freesound.org/people/LHermanns/sounds/557214/" },
    { name: "Level 2 traffic warning horn", detail: "Universfield — Pixabay Content License. Used only when a vehicle is approaching a player standing directly in its lane.", url: "https://pixabay.com/sound-effects/film-special-effects-automobile-horn-02-352065/" },
    { name: "Level 2 person bump", detail: "foxboyprower — CC0. Short collision/bump cue, trimmed and converted to mono Opus.", url: "https://freesound.org/people/foxboyprower/sounds/512568/" },
    { name: "Level 2 Vida pickup", detail: "Leszek_Szary — CC0. Dedicated collection cue, silence-trimmed and converted to mono Opus.", url: "https://freesound.org/people/Leszek_Szary/sounds/171579/" },
    { name: "Level 2 pedestrian crossing signal", detail: "MacFerret_20 — traffic-light ticking field recording used only near Yale Road. Source is recorded; exact Freesound licence still needs final verification before submission.", url: "https://freesound.org/people/MacFerret_20/sounds/231936/" },
    { name: "Level 3 incorrect answer", detail: "TheBuilder15 (Freesound), via Pixabay — Pixabay Content License. Louder replacement incorrect-answer cue.", url: "https://pixabay.com/sound-effects/film-special-effects-wrong-47985/" },
  ] },
  {
    heading: "Original music",
    entries: [
      {
        name: "Commute Theme / Dusk Drive / Empire Rush / Don't Get Caught",
        detail: `OpenAI-assisted original compositions generated for this project on 2026-09-25 and stored as pre-rendered WAV files. ${GENERATED}. Continuous level music is disabled; music is retained for menu/story presentation.`
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
        name: "Level 1–3 static tutorial posters",
        detail: "OpenAI/ChatGPT AI-assisted illustrations, designed and iteratively reviewed by Shayna Unterslak using team gameplay screenshots as references. Compressed WebP images replace live tutorial previews; existing third-party game-asset credits remain applicable."
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
        detail: "The old undocumented Level 1 crash/collision/door/idle files have been replaced or retired. Current runtime Level 1 audio has source records in the Sound effects section."
      },
      {
        name: "Pencil Pete trial font",
        detail: "JOEBOB graphics — source identified on 1001 Fonts. The listing says free for personal use / not free for commercial use; redistribution of the trial TTF in the submitted game still needs explicit clearance or replacement.",
        url: "https://www.1001fonts.com/pencilpete-font-font.html"
      },
      {
        name: "Level 1 environment textures still unresolved",
        detail: "The runtime foliage model sources are recorded. The stylized grass texture set still needs provenance. east-precast-wall-texture.jpg was found online via Google Images, traced to Precast Walling Pros, and directly edited/adapted by Dean Feldman for the game.",
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
        detail: "amic-fence.png, amic-fence-reference.png and 2695c241-17bb-416d-9d1d-7f061ccf7976.png were found online, traced to Crown Publications' “Bridging the divide” article (images credited there to eimage/Gareth Gilmour), and directly edited/adapted by Dean Feldman for the game.",
        url: "https://www.crown.co.za/lighting-in-design/case-studies/27707-bridging-the-divide"
      },
      {
        name: "UI artwork still awaiting provenance records",
        detail: "main-menu-background.png and level3-story-loading-screen.png now have OpenAI/ChatGPT generation records from Dean Feldman. at-wits-end-logo-v2.png, main-menu-v3-background.png, level2-story-loading-screen.png and suspicion-meter.png still need generation or source/licence records."
      }
    ]
  }
];
