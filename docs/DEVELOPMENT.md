# Development

## Governing Rule

> Whole game playable before any level is beautiful.

The team should always prefer a complete rough journey over isolated polished fragments.

---

# Phase 1 — Setup

Focus:

- Three.js
- Vite
- Git
- renderer
- game loop
- input
- production build

Exit criterion:

- a trivial scene runs locally
- `npm run build` works
- the production build can be served locally

---

# Phase 2 — Blockout

Focus:

- primitive geometry for all three levels
- level switching
- basic objectives

Exit criterion:

- the player can move through the whole journey from Level 1 to Level 3

No detailed environment modelling is required yet.

---

# Phase 3 — Mechanics

Focus:

- driving
- parking validation
- potholes
- grid hopping
- traffic collision
- tutor detection
- suspicion
- transitions
- custom shader prototype

Exit criterion:

- every level can be won and lost using its real rules

---

# Phase 4 — AI and Animation

Focus:

- traffic paths
- pedestrian paths
- tutor patrol
- walk / hop animation
- camera movement

Exit criterion:

- important moving objects no longer use placeholder behaviour

---

# Phase 5 — Visual Production

Focus:

- Wits assets
- textures
- lighting
- shadows
- custom shader integration
- post-processing

Exit criterion:

- each level has a clearly different visual identity

---

# Phase 6 — Polish and Release

Focus:

- menus
- restart
- sound
- scoring
- credits
- optimisation
- deployment
- trailer
- devlog

Exit criterion:

- game performs acceptably on target hardware
- production build is deployed and tested

---

# Definition of Done for a Level

A level is done when:

- it can be won
- it can be lost
- its real mechanics are implemented
- its HUD communicates the important danger / objective
- it has its own visual identity
- it can restart cleanly
- it does not leak obvious resources
- another team member has played it
- the owner can explain the implementation

---

# Scope Rules

## MVP — Must Work

- all three levels playable in sequence
- three different control schemes
- parking validation
- traffic
- crossing collision
- tutor patrol
- vision / suspicion logic
- restart / fail logic
- one custom shader
- distinct lighting
- menu
- credits
- stable production build

## Stretch — Only After MVP

Possible stretch features:

- rain
- puddles
- particles
- day/night transition
- minimap
- multiple camera modes
- visible car damage
- smarter traffic
- multiple parking bays
- second invigilator
- local best scores

Do not cut MVP systems to protect stretch features.
