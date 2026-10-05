const CC_BY_4 = "CC BY 4.0";
const CC0 = "CC0 (public domain)";
const GENERATED = "AI-generated; no third-party licence attaches";

/** Concise in-game counterpart of docs/ASSETS_AND_CREDITS.md. */
export const CREDITS = [
  { heading: "Project team", entries: [
    { name: "Wits Commute Simulator", detail: "COMS3006A / COMS3025A Computer Graphics and Visualisation project." },
    { name: "Team", detail: "Dean Feldman, Shayna Unterslak, Nadav Sundy, Liora Rosenberg, Benjamin Swartz and Gabriel Raz." }
  ] },
  { heading: "Libraries and services", entries: [
    { name: "Three.js", detail: "3D rendering library ? MIT", url: "https://threejs.org" },
    { name: "Vite", detail: "Development and build tooling ? MIT", url: "https://vitejs.dev" },
    { name: "Pixelify Sans", detail: "Google Fonts typeface by Stefie justprince ? SIL Open Font License 1.1", url: "https://fonts.google.com/specimen/Pixelify+Sans" }
  ] },
  { heading: "CC BY 4.0 models", entries: [
    { name: "Whiteboard", detail: `tboiston ? ${CC_BY_4}. Level 3 classroom.`, url: "https://sketchfab.com/3d-models/whiteboard-d0b05bd140734a799666f0a29e1fe1bb" },
    { name: "Plastic Chair", detail: `Jazavac ? ${CC_BY_4}. Level 3 classroom.`, url: "https://sketchfab.com/3d-models/plastic-chair-be3d5131e634424e89ffd57ebb19804e" },
    { name: "Paper Tablet", detail: `NameSsis ? ${CC_BY_4}. Level 3 answer tablets.`, url: "https://sketchfab.com/3d-models/paper-tablet-f2b7978367164eb38167dd4832978288" },
    { name: "Car Scene", detail: `toivo ? ${CC_BY_4}. Player car in Level 1; showcase surroundings removed at load time.`, url: "https://sketchfab.com/3d-models/car-scene-b7b32eaca80d460c9338197e2c9d1408" },
    { name: "Generic Passenger Car Pack", detail: `Comrade1280 ? ${CC_BY_4}. Parked cars in Level 1.`, url: "https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5" }
  ] },
  { heading: "Textures and lighting", entries: [
    { name: "Asphalt 02 PBR set", detail: `Rob Tuytel / Poly Haven ? ${CC0}. Level 1 and 2 asphalt shader.`, url: "https://polyhaven.com/a/asphalt_02" },
    { name: "Joburg Central Sunset HDRI", detail: `Dimitrios Savva and Greg Zaal / Poly Haven ? ${CC0}. Level 3 lighting and background.`, url: "https://polyhaven.com/a/sunset_jhbcentral" }
  ] },
  { heading: "Sound effects", entries: [
    { name: "Level 2 vehicle impact", detail: "avakas — CC BY 4.0. Converted to Opus for Level 2 collision feedback.", url: "https://freesound.org/people/avakas/sounds/144113/" },
    { name: "Level 2 shield pop", detail: "DRAGON-STUDIO — Pixabay Content License. Used for shield consumption.", url: "https://pixabay.com/sound-effects/film-special-effects-pop-402324/" },
    { name: "Level 2 pencil mark", detail: "NoisyRedFox — CC0. Used for questionnaire selections.", url: "https://freesound.org/people/NoisyRedFox/sounds/742353/" },
    { name: "Level 3 tutor footsteps", detail: "Yin_Yang_Jake007 and derjuli (Freesound) — Pixabay Content License. Cropped into positional tutor-step cues.", url: "https://pixabay.com/sound-effects/film-special-effects-indoor-footsteps-100664/" },
    { name: "Level 3 desk/chair foley", detail: "Anakronizm — CC0. Cropped from Classroom Deskchair Walk up Slide and Sit for peek movement.", url: "https://freesound.org/people/Anakronizm/sounds/494616/" },
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
    { name: "Level 2 taxi horn", detail: "Universfield — Pixabay Content License. Used when taxis stop.", url: "https://pixabay.com/sound-effects/film-special-effects-automobile-horn-02-352065/" },
    { name: "Level 2 person bump", detail: "freesound_community — Pixabay Content License. Used for pedestrian collisions.", url: "https://pixabay.com/sound-effects/film-special-effects-people-colliding-43479/" },
    { name: "Level 2 Vida pickup", detail: "Vadim_Makes_Sound — Pixabay Content License; Pixabay marks the source AI modified/generated. Used for Vida cup collection.", url: "https://pixabay.com/sound-effects/film-special-effects-achievement-badge-pop-sound-1-547860/" },
    { name: "Level 3 incorrect answer", detail: "TheBuilder15 (Freesound), via Pixabay — Pixabay Content License. Louder replacement incorrect-answer cue.", url: "https://pixabay.com/sound-effects/film-special-effects-wrong-47985/" },
    { name: "Level 3 failure sting", detail: "Universfield — Pixabay Content License. Used for Level 3 game-over transition.", url: "https://pixabay.com/sound-effects/film-special-effects-fail-trombone-229173/" },
    { name: "Level 3 completion sting", detail: "Universfield — Pixabay Content License. Used on successful Level 3 completion.", url: "https://pixabay.com/sound-effects/film-special-effects-level-up-191997/" }
  ] },
  { heading: "Original music", entries: [
    { name: "Original level soundtrack", detail: `Commute Theme, Dusk Drive, Empire Rush and Don't Get Caught - OpenAI-assisted original compositions generated for this project on 2026-09-25 and used as pre-rendered WAV soundtrack files. ${GENERATED}. No third-party samples.` }
  ] },
  { heading: "AI-generated assets", entries: [
    { name: "Level 1 story loading screen", detail: `OpenAI image generation (2026-09-08) ? ${GENERATED}.` },
    { name: "Level 2 and Level 3 story screens; main-menu art", detail: `Team-provided/generated artwork ? ${GENERATED}; provenance review recorded in the asset ledger.` },
    { name: "Classroom brick wall and terrazzo floor", detail: `Generated by Gabriel Raz ? ${GENERATED}.` },
    { name: "Level 3 zoom-hands UI", detail: `OpenAI gpt-image v2.0, generated by Gabriel Raz ? ${GENERATED}.` },
    { name: "Cartoon Desk", detail: "Gabriel Raz, authored in Blender with Claude assistance ? project-owned." }
  ] },
  { heading: "Provenance review required before submission", entries: [
    { name: "Normalised vehicle pack", detail: "Aston Martin, BYD, Honda, Nissan and Volkswagen source archives did not retain source or licence metadata. Do not submit until the original download pages and licences are recorded." },
    { name: "Diesel Thomas proxy", detail: "Project-made procedural stand-in; original uploaded Blender source is not used at runtime. The underlying character reference needs rights clearance before submission." },
    { name: "Level 1 recorded audio", detail: "car-crash.mp3, car-door-shut.mp3, idle-car.wav and collision-hit.mp3 have no retained source or licence metadata. Do not submit until verified or replaced with team-authored/licensed audio." },
    { name: "Wits shark and unregistered image textures", detail: "wits-shark.glb, wits-shark.png, AMIC fence/deck textures and UI artwork need source-or-team-authorship records in the asset ledger before submission." }
  ] }
];
