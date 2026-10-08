import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gamePath = path.join(root, 'src/core/Game.js');
const htmlPath = path.join(root, 'index.html');
if (!fs.existsSync(gamePath) || !fs.existsSync(htmlPath)) {
  throw new Error('Run this script from the Wits-commute-simulator repository root.');
}
let game = fs.readFileSync(gamePath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');
function replaceOne(source, oldText, newText, what) {
  const n = source.split(oldText).length - 1;
  if (n !== 1) throw new Error(`Expected exactly one ${what} match; found ${n}. No files written.`);
  return source.replace(oldText, newText);
}
// Guard against applying an experimental patch twice.
if (game.includes('showStaticParkingTutorial()') || html.includes('static-parking-tutorial')) {
  throw new Error('Static Level 1 tutorial patch already appears to be applied.');
}

game = replaceOne(game, '    if (showIntro) this.setLevelIntroLoadState("ready");', `    if (showIntro) this.setLevelIntroLoadState("ready");
    if (this.currentLevelNumber === 1 && this.staticParkingTutorial && !this.staticParkingTutorial.hidden) {
      this.staticParkingStart.disabled = false;
      this.staticParkingStart.textContent = 'START LEVEL';
    }`, 'ready-state');


game = replaceOne(game, '    const waitingForLevel = isFinalBox && !this.isLevelIntroReady;', `    const waitingForLevel = isFinalBox && !this.isLevelIntroReady && this.currentLevelNumber !== 1;`, 'dialogue loading gate');
game = replaceOne(game, '    if (!this.isLevelIntroReady) return;\n\n    const nextLevel', `    if (!this.isLevelIntroReady && this.currentLevelNumber !== 1) return;

    const nextLevel`, 'intro transition gate');
game = replaceOne(game, '    this.showInstruction(this.currentLevel);\n  }\n\n  setCheckpoint', `    if (this.currentLevelNumber === 1) this.showStaticParkingTutorial();
    else this.showInstruction(this.currentLevel);
  }

  setCheckpoint`, 'story to tutorial');

game = replaceOne(game, '  showInstruction(level) {\n    const config', `  showStaticParkingTutorial() {
    // DOM-only, no game canvas, no live frame copies, no tutorial update loop.
    this.isTutorialActive = true;
    this.input.clearTransientState();
    document.exitPointerLock?.();
    this.instructionElement.hidden = true;
    this.staticParkingTutorial ??= document.querySelector('#static-parking-tutorial');
    this.staticParkingStart ??= document.querySelector('#static-parking-start');
    if (!this.staticParkingStart.dataset.bound) {
      this.staticParkingStart.dataset.bound = 'true';
      this.staticParkingStart.addEventListener('click', () => {
        if (this.isLoading || !this.currentLevel || this.currentLevelNumber !== 1) return;
        this.hideInstruction();
        this.input.clearTransientState();
        this.uiAudio.stopMusic();
        this.input.requestPointerLock();
        this.clock.getDelta();
      });
    }
    this.staticParkingTutorial.hidden = false;
    this.staticParkingStart.disabled = this.isLoading || !this.currentLevel;
    this.staticParkingStart.textContent = this.staticParkingStart.disabled ? 'LOADING LEVEL 1…' : 'START LEVEL';
  }

  showInstruction(level) {
    if (this.currentLevelNumber === 1) {
      this.showStaticParkingTutorial();
      return;
    }
    const config`, 'showInstruction');

game = replaceOne(game, '    if(this.isLoading)return;', `    if(this.isLoading || (this.currentLevelNumber === 1 && this.isTutorialActive)) return;`, 'unneeded 3D rendering behind static tutorial');
game = replaceOne(game, '    if (!this.isTutorialActive || !preview || !source || !this.currentLevel) return;', `    if (this.currentLevelNumber === 1 || !this.isTutorialActive || !preview || !source || !this.currentLevel) return;`, 'canvas copying');
game = replaceOne(game, '    this.instructionElement.hidden = true;\n  }\n\n  onInstructionClick', `    this.instructionElement.hidden = true;
    if (this.staticParkingTutorial) this.staticParkingTutorial.hidden = true;
  }

  onInstructionClick`, 'hideInstruction');
game = replaceOne(game, `    if (this.isTutorialActive) {
      this.currentLevel?.updateTutorial?.(dt);
      return;
    }`, `    if (this.isTutorialActive) {
      // Level 1 uses a static DOM tutorial; do not run its 3D tutorial.
      if (this.currentLevelNumber !== 1) this.currentLevel?.updateTutorial?.(dt);
      return;
    }`, 'tutorial animation loop');

const staticCard = `
    <!-- Local experiment: a lightweight Level 1 tutorial, replacing its live WebGL preview. -->
    <section id="static-parking-tutorial" hidden aria-label="Level 1 parking tutorial">
      <div class="static-parking-card" role="dialog" aria-modal="true" aria-labelledby="static-parking-title">
        <header>
          <small>WITS COMMUTE SIMULATOR // LEVEL 1</small>
          <h2 id="static-parking-title">LEVEL 1 // PARK AT WITS</h2>
          <strong>PARKING TUTORIAL</strong>
          <p>Drive through the parking area, avoid potholes, and park neatly in one of the 3 highlighted bays.</p>
        </header>
        <div class="static-parking-content">
          <div class="static-parking-pictures">
            <figure><img src="./assets/images/ui/level1-tutorial-driving.webp" alt="Orange car navigating a parking aisle with scattered potholes" /><figcaption>01 // DRIVE &amp; AVOID POTHOLES</figcaption></figure>
            <span class="static-parking-arrow" aria-hidden="true">→</span>
            <figure><img src="./assets/images/ui/level1-tutorial-parking.webp" alt="Orange car approaching a highlighted purple parking bay" /><figcaption>02 // PARK IN A PURPLE BAY</figcaption></figure>
          </div>
          <div class="static-parking-notes">
            <section><h3>CONTROLS</h3><p><kbd>W</kbd> Accelerate &nbsp; <kbd>S</kbd> Brake / reverse</p><p><kbd>A</kbd> <kbd>D</kbd> Steer &nbsp; <kbd>C</kbd> Camera</p><p><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> Alternative controls</p></section>
            <section><h3>OBJECTIVE</h3><p>① Avoid potholes</p><p>② Find one of the three purple bays</p><p>③ Park straight inside it and stop</p></section>
            <section><h3>WATCH FOR</h3><p>Impacts reduce condition. Potholes also slow you down. Your position and angle matter.</p></section>
          </div>
        </div>
        <footer><span>Static tutorial // Level 1 loading in background</span><button id="static-parking-start" type="button" disabled>LOADING LEVEL 1…</button></footer>
      </div>
    </section>
`;
html = replaceOne(html, '    <section id="instruction-card"', staticCard + '    <section id="instruction-card"', 'insert static tutorial');
html = replaceOne(html, '    <script type="module" src="./src/main.js"></script>', `    <link rel="stylesheet" href="./src/static-parking-tutorial.css" />
    <script type="module" src="./src/main.js"></script>`, 'load static stylesheet');

const css = `#static-parking-tutorial[hidden]{display:none}
#static-parking-tutorial{position:fixed;inset:0;z-index:42;display:grid;place-items:center;padding:clamp(10px,2vw,30px);background:#1c2633 url('/assets/images/ui/level1-story-loading-screen.png') center/cover no-repeat;color:#203651;overflow:auto}
.static-parking-card{width:min(1240px,96vw);padding:clamp(15px,2.2vw,30px);border:5px solid #182a48;border-radius:12px;background:rgba(255,255,255,.97);box-shadow:10px 10px 0 rgba(7,20,42,.8);font-family:Arial,system-ui,sans-serif}
.static-parking-card header small{color:#008f9b;font-weight:800;letter-spacing:.13em}
.static-parking-card h2{margin:.2em 0 0;font-size:clamp(25px,3.5vw,50px);line-height:1.06;color:#123557;text-shadow:3px 3px #6de1dc}
.static-parking-card header strong{display:block;margin-top:6px;font:900 clamp(15px,1.8vw,24px) monospace;letter-spacing:.18em}
.static-parking-card header p{margin:.7em 0 1em;padding-top:10px;border-top:3px solid #6cd7d6;font-size:clamp(13px,1.3vw,18px)}
.static-parking-content{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(255px,1fr);gap:20px}
.static-parking-pictures{display:grid;grid-template-columns:minmax(0,1fr) 30px minmax(0,1fr);gap:8px;align-items:center}
.static-parking-pictures figure{min-width:0;margin:0;border:3px solid #203651;border-radius:7px;overflow:hidden;background:#cee1ec}
.static-parking-pictures img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover}
.static-parking-pictures figcaption{padding:9px 3px;text-align:center;font:bold clamp(10px,1vw,14px) monospace;letter-spacing:.02em}
.static-parking-arrow{text-align:center;color:#08799a;font-size:38px;font-weight:900}
.static-parking-notes{display:grid;gap:12px;align-content:stretch}
.static-parking-notes section{padding:12px 15px;border:3px solid #203651;border-radius:6px;background:#f1fafb}
.static-parking-notes section:last-child{background:#fff5d3}
.static-parking-notes h3{display:inline-block;margin:-22px 0 8px -9px;padding:5px 13px;border:3px solid #203651;border-radius:5px;background:#ffcf53;font-size:18px}
.static-parking-notes p{margin:7px 0;font-size:clamp(12px,1.05vw,15px);line-height:1.35;font-weight:600}
.static-parking-notes kbd{padding:2px 5px;border:2px solid #203651;border-radius:3px;background:white;font:700 13px monospace}
.static-parking-card footer{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:15px;padding-top:12px;border-top:2px solid #b8d7d7;font-size:12px}
#static-parking-start{padding:13px 27px;border:4px solid #203651;border-radius:7px;background:#ffd25d;box-shadow:4px 4px #203651;color:#173252;font:900 clamp(14px,1.6vw,20px) monospace;cursor:pointer}
#static-parking-start:disabled{background:#becbd0;cursor:wait;box-shadow:none}
@media(max-width:830px){.static-parking-content{grid-template-columns:1fr}.static-parking-pictures img{aspect-ratio:16/10}.static-parking-card{margin:auto}.static-parking-notes{grid-template-columns:repeat(3,minmax(0,1fr))}.static-parking-notes section{padding:9px}.static-parking-notes h3{font-size:13px}}
@media(max-width:540px){.static-parking-notes{grid-template-columns:1fr}.static-parking-card footer{flex-wrap:wrap}}
`;
const destDir = path.join(root, 'public/assets/images/ui');
fs.mkdirSync(destDir, {recursive:true});
for (const filename of ['level1-tutorial-driving.webp','level1-tutorial-parking.webp']) {
  const src = new URL(`./patch-assets/${filename}`, import.meta.url);
  fs.copyFileSync(src, path.join(destDir,filename));
}
fs.writeFileSync(gamePath, game);
fs.writeFileSync(htmlPath, html);
fs.writeFileSync(path.join(root,'src/static-parking-tutorial.css'),css);
console.log('Local Level 1 static tutorial patch applied. No commits or pushes made.');
