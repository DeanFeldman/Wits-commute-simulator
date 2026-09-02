# Assets and Credits

Everything the team did not create itself must be recorded and credited.

This includes:

- libraries
- models
- textures
- audio
- music
- sound effects
- shaders
- code samples
- tutorials
- adapted examples
- external tools where relevant

---

# Rule

When a third-party resource is added to the repository, add its credit entry here immediately.

Do not wait until submission week.

---

# Asset Storage

Runtime assets live under:

```text
public/assets/
```

Suggested structure:

```text
public/assets/
├── models/
│   ├── vehicles/
│   ├── characters/
│   ├── environment/
│   └── props/
├── textures/
├── audio/
└── images/
```

---

# Naming

Use:

- lowercase
- hyphen-separated names
- no spaces
- exact filename case in code

Example:

```text
wits-parking-sign.glb
asphalt-normal.jpg
taxi-horn.mp3
```

---

# Model Format

Prefer compressed `.glb` models for runtime.

Avoid committing large source working files unless the team specifically needs them in the repo.

---

# Texture Rules

Use the smallest resolution that still looks correct.

Avoid unnecessary 4096×4096 textures.

Prefer power-of-two dimensions when practical.

Compress images appropriately.

---

# Credit Template

Copy this section for each external resource.

```md
## Resource Name

Type:
Model / texture / audio / code / library / tutorial / other

Source:
<URL or source description>

Author:
<name>

Licence:
<licence>

Used for:
<where it appears in the game>

Modified:
Yes / No

Added by:
<team member>
```

---

# Current External Dependencies

## Three.js

Type: Library

Used for:
3D rendering, cameras, scene graph, materials and WebGL abstraction.

Licence:
MIT

## Vite

Type: Development / build tooling

Used for:
Local development and production bundling.

Licence:
MIT

---

# Project-Created Assets

List major original assets here as they are created.

Examples:

- Wits parking blockout
- custom car hierarchy
- custom asphalt shader
- custom Wits facade textures
- custom UI
