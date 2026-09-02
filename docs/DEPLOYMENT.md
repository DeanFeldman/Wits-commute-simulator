# Deployment

The final game is hosted on the Wits department LAMP server.

The server serves static files.

It does not:

- run npm
- run Vite
- install dependencies
- execute build tools
- provide SSH deployment access

Therefore the team must upload the production build.

---

# Vite Configuration

Keep:

```js
export default defineConfig({
  base: "./"
});
```

The game is hosted under a subdirectory rather than at the domain root.

---

# Relative Paths

Use:

```js
"./assets/models/car.glb"
```

Do not use:

```js
"/assets/models/car.glb"
```

A leading slash points to the root of the whole server and can break deployed assets.

---

# Linux Filename Rules

The server is case-sensitive.

Prefer:

```text
road-normal-map.jpg
wits-car.glb
lecture-seat.glb
```

Avoid:

```text
Road-Normal-Map.JPG
Wits Car.glb
lecture Seat.glb
```

Use lowercase, hyphenated filenames.

---

# Build

Create the production build:

```bash
npm run build
```

Output:

```text
dist/
```

---

# Test the Production Build

Run:

```bash
npm run preview
```

Then:

1. play Level 1
2. play Level 2
3. play Level 3
4. test restart
5. open browser console
6. check for 404s
7. check for JavaScript errors

Do not rely only on `npm run dev`.

---

# Submission Archive

Zip the contents of:

```text
dist/
```

so that:

```text
index.html
```

is at the top level of the zip.

Do not upload:

```text
node_modules/
src/
package.json
```

as the deployment artefact.

---

# Performance Checks

Before release:

- test on modest hardware where possible
- inspect frame rate
- limit unnecessary shadows
- limit large textures
- reuse materials and geometry
- dispose removed level resources
- avoid allocation-heavy update loops

---

# Final Deployment Checklist

- [ ] `npm run build` succeeds
- [ ] `npm run preview` succeeds
- [ ] all three levels work
- [ ] restart works without refreshing
- [ ] all asset paths are relative
- [ ] asset filename case matches exactly
- [ ] no 404 errors
- [ ] no blocking console errors
- [ ] `index.html` is at zip root
- [ ] deployed URL works in Chrome
