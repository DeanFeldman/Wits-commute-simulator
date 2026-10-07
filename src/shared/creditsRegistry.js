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
    { name: "Level 1 damaged engine", detail: "LHermanns — CC BY 4.0. Engine warmup loop crossfaded in progressively as Level 1 vehicle condition becomes critical.", url: "https://freesound.org/people/LHermanns/sounds/557214/" },
    { name: "Level 2 traffic warning horn", detail: "Universfield — Pixabay Content License. Used only when a vehicle is approaching a player standing directly in its lane.", url: "https://pixabay.com/sound-effects/film-special-effects-automobile-horn-02-352065/" },
    { name: "Level 2 person bump", detail: "freesound_community — Pixabay Content License. Used for pedestrian collisions.", url: "https://pixabay.com/sound-effects/film-special-effects-people-colliding-43479/" },
    { name: "Level 2 Vida pickup", detail: "Vadim_Makes_Sound — Pixabay Content License; Pixabay marks the source AI modified/generated. Used for Vida cup collection.", url: "https://pixabay.com/sound-effects/film-special-effects-achievement-badge-pop-sound-1-547860/" },
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
        name: "Normalised vehicle variants",
        detail: "Aston Martin, BYD, Honda, Nissan and Volkswagen runtime variants were converted from uploaded archives that did not preserve original source, author or licence metadata. Supply those records or replace the assets."
      },
      {
        name: "Diesel Thomas proxy",
        detail: "The runtime mesh is a project-made procedural proxy, but the underlying character reference still needs rights clearance or removal."
      },
      {
        name: "Level 1 recorded audio",
        detail: "idle-car.wav still needs complete source/author/licence records or replacement. The old crash/collision files and the end-of-level car-door cue are no longer used."
      },
      {
        name: "Pencil Pete trial font",
        detail: "pencil-pete-trial.ttf is loaded by Level 3 but its source and redistribution licence are not yet recorded."
      },
      {
        name: "Foliage and environment assets",
        detail: "The runtime foliage packs, stylized grass texture set and east precast-wall texture are used in Level 1 but still need source/licence or team-authorship records."
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
        name: "Wits shark",
        detail: "wits-shark.glb and wits-shark.png still need a source/licence or team-authorship record."
      },
      {
        name: "AMIC fence textures",
        detail: "amic-fence.png and amic-fence-reference.png are loaded by the current game and still need source/licence or team-authorship records."
      },
      {
        name: "UI artwork still awaiting provenance records",
        detail: "at-wits-end-logo-v2.png, main-menu-background.png, main-menu-v3-background.png, level2-story-loading-screen.png, level3-story-loading-screen.png and suspicion-meter.png need generation records or source/licence records where not already documented."
      }
    ]
  }
];
