#!/usr/bin/env python3
"""Seed GitHub issues for Wits Commute Simulator.

    python3 seed_issues.py OWNER/REPO            # dry run, no token needed
    python3 seed_issues.py OWNER/REPO --apply    # create them (needs GITHUB_TOKEN)

Safe to re-run: skips anything that already exists.
"""
import json, os, sys, time, urllib.error, urllib.request

API = "https://api.github.com"

MILESTONES = [
    ("Phase 1 - Setup", "Three.js + Vite, Git, renderer, input, game loop. Exit: a trivial scene builds and runs on the LAMP server."),
    ("Phase 2 - Blockout", "Rough geometry for all three levels. Exit: the full journey is playable end to end with primitives."),
    ("Phase 3 - Mechanics", "Driving, parking test, hopping, stealth, transitions, shader prototype. Exit: every level can be won and lost by its real rules."),
    ("Phase 4 - AI and animation", "Traffic paths, pedestrians, tutor patrol, walk and hop cycles. Exit: nothing in the world moves by placeholder."),
    ("Phase 5 - Visual production", "Real assets, textures, lighting, shadows, shader integration. Exit: each level has its distinct lighting identity."),
    ("Phase 6 - Polish and release", "Menus, sound, scoring, optimisation, deployment. Exit: frame rate target met on lab hardware; final build deployed."),
]

LABELS = {
    "ws1-world-assets": ("8B6D3F", "Workstream 1 - reference photography, blockout, models, props"),
    "ws2-driving-parking": ("B8860B", "Workstream 2 - Level 1 owner"),
    "ws3-traffic-crossing": ("2E8B8B", "Workstream 3 - Level 2 owner"),
    "ws4-stealth-npcs": ("A83B3B", "Workstream 4 - Level 3 owner"),
    "ws5-graphics-shaders": ("6A4FB8", "Workstream 5 - lighting, materials, shaders"),
    "ws6-integration-build": ("3B6EA8", "Workstream 6 - state, UI, sound, deployment"),
    "level-1": ("FFD966", "Park at Wits"),
    "level-2": ("9FE2E0", "Cross the road"),
    "level-3": ("F4A9A9", "Don't get caught"),
    "engine": ("C9CCD1", "Shared engine layer or systems"),
    "graphics": ("D5C2F0", "Lighting, materials, shaders, post-processing"),
    "assets": ("E8D5A8", "Models, textures, audio files"),
    "mvp": ("0E8A16", "Required for the minimum viable product"),
    "stretch": ("BFD4C8", "Only after MVP is complete"),
    "rubric": ("D93F0B", "Directly tied to a marked rubric area"),
    "infra": ("5A6472", "Repo, build, deployment, tooling"),
    "docs": ("BFDADC", "Documentation, credits, report, trailer"),
    "blocked-by-assets": ("EEEEEE", "Waiting on a model, texture or photo"),
}

# title | phase | labels | why | tasks (;) | done (;) | note
ISSUES = [
    ("Set up the repository, branch rules and .gitignore", "P1", "ws6-integration-build,infra,mvp",
     "Everything else depends on a repo that six people can work in without stepping on each other.",
     "Create the repo with a README describing the project in three sentences;Add a .gitignore covering node_modules, dist, and large working files (.blend, raw photos);Protect main so it cannot be pushed to directly;Document the branch naming convention: level-1/*, level-2/*, level-3/*, engine/*, gfx/*;Add a PR template with a 'what did you test' field",
     "main is protected;All six members have cloned and pushed a test branch successfully", ""),
    ("Scaffold the Three.js + Vite project", "P1", "ws6-integration-build,engine,infra,mvp",
     "The base every other task builds on.",
     "npm init, install three and vite;src/ structure: engine/, systems/, levels/, assets/, ui/;Renderer, perspective camera, a lit cube, resize handling;npm run dev and npm run build both working",
     "A spinning lit cube renders locally;npm run build produces a dist/ that opens without errors", ""),
    ("Build the game loop and delta-time timing", "P1", "ws6-integration-build,engine,mvp",
     "Frame-rate-independent movement, or the game plays differently on every machine.",
     "requestAnimationFrame loop with a clamped delta;update(dt) / render() split;Pause and resume support;No object allocation inside the loop",
     "Movement speed is identical at 30fps and 144fps (test by throttling)", ""),
    ("Build the input manager", "P1", "ws6-integration-build,engine,mvp",
     "Three levels need three control schemes without three copies of keyboard handling.",
     "Key state map with pressed / held / released;Input buffering support (needed by the Level 2 hop);Pointer-lock mouse-look support (needed by Level 3);An action-binding layer so levels ask for 'accelerate', not 'KeyW'",
     "A level can register its own bindings and unregister them cleanly on exit", ""),
    ("Deploy a throwaway test build to the LAMP server", "P1", "ws6-integration-build,infra,mvp,rubric",
     "This is the single most common late failure in this course. Find the path and MIME problems in week one, not week twelve.",
     "Build and upload the cube scene;Confirm .glb and texture files are served with correct MIME types;Confirm relative, lowercase, hyphenated asset paths work on a case-sensitive server;Write the deployment steps into README so anyone can do it",
     "The cube scene loads from the LAMP server URL on a machine that has never run the project", "If this issue is still open at the end of Phase 2, escalate it in the group meeting."),
    ("Write the asset naming and export conventions", "P1", "ws1-world-assets,assets,infra,docs",
     "Six people exporting models with inconsistent scale, axes and filenames is a week of lost time.",
     "Agree units and up-axis; document the Blender export settings;Filenames: lowercase, hyphenated, no spaces;Compressed .glb only; textures at power-of-two sizes;A CONTRIBUTING-assets.md in the repo",
     "Two different people export the same test model and it lands identically in the scene", ""),
    ("Build the level loader and scene disposal", "P2", "ws6-integration-build,engine,mvp",
     "Levels must load and unload without leaking GPU memory, or the third level runs at half the frame rate.",
     "Level interface: load(), update(dt), dispose();dispose() must free geometries, materials and textures;Loading state shown while assets load",
     "Cycling all three levels ten times shows no growth in renderer.info.memory", ""),
    ("Build the game state machine", "P2", "ws6-integration-build,engine,mvp",
     "Menu, three levels, fail, results and restart-without-reload all need one owner.",
     "States: menu, level1, level2, level3, results;Fail transition returns to the current level's checkpoint;Restart without a page refresh;Dev-only level select",
     "Every transition in the state diagram can be exercised from the menu", ""),
    ("Blockout Level 1 - parking area", "P2", "ws1-world-assets,level-1,mvp",
     "Rough geometry first; the route must be provably fun before anyone textures it.",
     "Ground plane, road corridor, kerbs as primitives;Parked car blockers as boxes;Bay markings and the one valid bay;Pothole trigger positions marked",
     "A car can be driven through the corridor and into the bay using placeholder physics", ""),
    ("Blockout Level 2 - the road crossing", "P2", "ws1-world-assets,level-2,mvp",
     "Lane count and width determine whether the level is fun; settle it with boxes.",
     "Pavement, kerbs, traffic islands as primitives;Lane markers laid out on the grid;Start and finish zones",
     "The player can walk the whole crossing with no traffic present", ""),
    ("Blockout Level 3 - the lecture venue", "P2", "ws1-world-assets,level-3,mvp",
     "The camera never moves in this level, so only what is visible from the seat needs building.",
     "Tiered floor, desk rows, one instanced seat mesh;Player seat position and neighbour positions;Tutor patrol aisle marked out",
     "From the seated camera, the venue reads as a lecture hall in primitives", ""),
    ("Make the full journey playable end to end with primitives", "P2", "ws6-integration-build,engine,mvp",
     "The governing rule of the project: a rough complete game can be cut down, three polished fragments cannot be assembled.",
     "Wire the three blockouts into the state machine;Placeholder win conditions so each level can be completed;Level transitions with a fade",
     "One person can play menu to results without touching the console", "This is the Phase 2 exit criterion. Nothing in Phase 3 starts until this closes."),
    ("Implement the vehicle controller", "P3", "ws2-driving-parking,level-1,engine,mvp,rubric",
     "Used by the player in Level 1 and by the AI traffic in Level 2 - one system, two roles.",
     "Acceleration, braking, reverse;Steering angle that reduces with speed so the car feels heavy;Simplified arcade physics, no physics library;Exposed as a component so AI traffic can drive it too",
     "The car is controllable and does not feel like it is on ice", ""),
    ("Build the hierarchical car model rig", "P3", "ws2-driving-parking,level-1,rubric,mvp",
     "Scene hierarchy is explicitly marked. The car is the clearest demonstration of it.",
     "Root > body > four wheels, two headlights, suspension pivot;Wheels rotate with speed and steer with input, locally;Body pitches on the suspension pivot for pothole response",
     "The hierarchy can be shown in a debug panel and every child transforms correctly", ""),
    ("Implement collider classes: blocking, trigger, lethal, observation", "P3", "ws2-driving-parking,engine,mvp,rubric",
     "One collision abstraction shared by all three levels.",
     "AABB tests by default; OBB where rotation matters;Simple spatial partition so only nearby colliders are tested;Debug visualisation toggle for all collision volumes",
     "The debug toggle draws every collider in the active level", ""),
    ("Implement the pothole hazard", "P3", "ws2-driving-parking,level-1,mvp",
     "The level's core hazard and the anchor for the custom shader.",
     "Trigger volumes, not blocking geometry;Speed multiplied by ~0.6 on entry;Camera shake impulse decaying over ~0.5s;Body pitch on the suspension pivot;Condition meter -1 and a HUD flash",
     "Hitting a pothole is unmistakable without any text on screen", ""),
    ("Implement the three-part parking validation", "P3", "ws2-driving-parking,level-1,mvp",
     "The level's win condition. All three tests must hold simultaneously so the player cannot skid in sideways.",
     "Containment: >= ~80% of the car's box inside the bay volume;Alignment: angle to bay forward vector within ~12 degrees;Rest: speed below ~0.3 m/s;Short confirmation period before the level ends;HUD shows which of the three currently pass",
     "A deliberately bad park is rejected and the HUD explains which test failed", ""),
    ("Implement the grid-hop character controller", "P3", "ws3-traffic-crossing,level-2,mvp",
     "Discrete movement is what makes Crossy Road readable. No momentum at all.",
     "One key press = exactly one cell in one of four directions;Short hop with input buffering so presses during a hop are queued, not dropped;Snap to grid; no partial positions;Backward movement allowed but costs time",
     "Rapid input never leaves the character between cells", ""),
    ("Implement lane traffic generation", "P3", "ws3-traffic-crossing,level-2,mvp",
     "Each lane must be readable on its own so the player cannot learn one rhythm and coast.",
     "Lanes vary in speed, direction and gap spacing;Gaps generated within a range - irregular but always passable;Vehicles recycled from a pool rather than created and destroyed;Reuses the vehicle controller from Level 1",
     "Every lane is crossable by a patient player; no impossible configurations in 100 generated runs", ""),
    ("Implement the taxi behaviour", "P3", "ws3-traffic-crossing,level-2,mvp",
     "The level's difficulty spike and its most recognisable local detail.",
     "Faster than other traffic;Stops without warning to pick up a passenger, closing a gap the player committed to;Visually distinct so the player learns to fear it",
     "A player can identify the taxi lane after one death", ""),
    ("Implement checkpoints and instant-fail for Level 2", "P3", "ws3-traffic-crossing,level-2,mvp",
     "One hit kills, but failure must cost seconds, not minutes.",
     "Contact with any vehicle = immediate fail;Each kerb or island reached becomes the restart point;Restart is instant, with no level reload",
     "Dying and restarting takes under one second", ""),
    ("Implement the tutor patrol and vision cone", "P3", "ws4-stealth-npcs,level-3,mvp,rubric",
     "The level's rule and its lighting effect are the same object - that is what makes it demonstrable.",
     "Waypoint patrol route with pause, turn and scan behaviours;Vision cone as a real spotlight parented to the tutor's head;Detection = angular test + distance test + raycast occlusion check;Occlusion by chairs and other students must actually work",
     "Hiding behind a student in front genuinely breaks line of sight", ""),
    ("Implement the copy mechanic and suspicion meter", "P3", "ws4-stealth-npcs,level-3,mvp",
     "The commit-and-retreat rhythm is the whole level.",
     "Hold key to lean and copy, filling an answer bar;Release returns to facing forward, the safe posture;Suspicion rises while copying inside the cone, decays while forward;Fail at 100% suspicion; win when the answer bar fills before the timer",
     "A skilled player can clear it; a careless player is caught within 20 seconds", ""),
    ("Implement mouse-look for Level 3", "P3", "ws4-stealth-npcs,level-3,mvp,rubric",
     "The third control scheme. No locomotion at all - this is what makes the level distinct.",
     "Pointer lock with restricted yaw and pitch range;Seated camera position, fixed;Sensitivity setting in the pause menu",
     "The player can look at their neighbour, the tutor and the front of the room, and nowhere else", ""),
    ("Prototype the custom asphalt shader", "P3", "ws5-graphics-shaders,level-1,graphics,rubric,mvp",
     "Prototyped in Phase 3, not Phase 5. A shader added late is a shader nobody can explain, and explanation is where the marks are.",
     "Custom vertex + fragment stage on the Level 1 road surface;Procedural noise blended with the road texture to darken and deform pothole areas;Vertex displacement so damage has depth at grazing angles;u_time uniform driving a moving sheen on wet patches;Headlight-distance uniform coupling the effect to the car",
     "The shader runs on the blockout road;Its author can explain every uniform without notes", "Blocks nothing, but if this slips past Phase 4 raise it as a risk."),
    ("Implement level transitions", "P3", "ws6-integration-build,engine,mvp",
     "The journey must feel continuous - the player exits the car they parked and enters the venue they crossed to.",
     "Fade or dissolve between levels;Carry score and time forward across levels;Camera hand-off between the three camera types",
     "No visible pop or reload between levels", ""),
    ("Build the waypoint system", "P4", "ws3-traffic-crossing,engine,mvp",
     "One system used by Level 2 traffic, Level 2 pedestrians and the Level 3 tutor.",
     "Path definition, looping and one-shot modes;Speed and pause-at-node support;Debug drawing of paths",
     "All three consumers use it with no per-consumer forks", ""),
    ("Rig and animate the character walk and hop cycles", "P4", "ws4-stealth-npcs,level-2,assets,rubric,mvp",
     "Animation is a marked area and the hop is what sells Level 2.",
     "Character armature with limb bones;Looping hop cycle timed to the grid step;Idle pose;Exported as .glb with animations intact",
     "The hop lands exactly when the character arrives in the cell", ""),
    ("Animate the tutor: idle, turn, walk", "P4", "ws4-stealth-npcs,level-3,assets,mvp",
     "A gliding tutor destroys the tension the level depends on.",
     "Walk cycle matched to patrol speed;Turn and scan animations at waypoints;Head movement drives the vision cone naturally",
     "Foot sliding is not visible at patrol speed", ""),
    ("Implement pedestrian crowds on the Level 2 pavements", "P4", "ws3-traffic-crossing,level-2,mvp",
     "They obstruct rather than kill - pressure without an unfair failure state.",
     "Looping waypoint paths on both pavements;Bunching at the kerb creating bottlenecks;Player collision pushes and delays, never kills",
     "A player can lose a gap to a crowd but never die to one", ""),
    ("Produce Level 1 dusk lighting identity", "P5", "ws5-graphics-shaders,level-1,graphics,rubric,mvp",
     "Three distinct lighting identities is the cheapest way to prove lighting control.",
     "Low warm ambient;Headlight spotlights parented to the car;Streetlight point lights along the route;Long shadows, with shadow-casting lights capped for performance",
     "Level 1 is visually unmistakable from Level 2 in a screenshot", ""),
    ("Produce Level 2 midday lighting identity", "P5", "ws5-graphics-shaders,level-2,graphics,rubric,mvp",
     "Deliberate contrast against Level 1's dusk.",
     "Strong directional sun, high ambient, hard shadows;Flat stylised materials suited to the low-poly art direction;High contrast palette",
     "The level reads clearly under an orthographic camera with no depth cues", ""),
    ("Produce Level 3 interior lighting identity", "P5", "ws5-graphics-shaders,level-3,graphics,rubric,mvp",
     "Interior lighting is the third identity and the vision cone lives inside it.",
     "Ceiling fixtures and projector glow;Soft shadows in an enclosed space;The tutor's spotlight tuned to be subtly visible without looking like a searchlight",
     "The cone is visible enough to read as a rule but not so bright it looks like a different game", ""),
    ("Implement the suspicion post-processing pass", "P5", "ws5-graphics-shaders,level-3,graphics,rubric",
     "Backup shader deliverable and the clearest feedback channel in Level 3.",
     "Vignette and desaturation driven by a single suspicion uniform;Tuned so 50% suspicion is noticeable but not disabling",
     "The player can feel suspicion rising without looking at the meter", ""),
    ("Model and texture the Level 1 parking environment", "P5", "ws1-world-assets,level-1,assets,blocked-by-assets",
     "Recognition, not architectural accuracy.",
     "Replace blockout with real geometry for the playable corridor;Photographic textures on facades visible from the corridor;Props: kerbs, bollards, bins, signage;Distant buildings as simplified forms or impostors",
     "A Wits student identifies the location within a few seconds", ""),
    ("Model and texture the Level 2 crossing environment", "P5", "ws1-world-assets,level-2,assets,blocked-by-assets",
     "Stylised low-poly - geometry that can largely be generated rather than modelled.",
     "Stylised road, pavements, islands;Low-poly vehicle set including the taxi;Animated crossing markings",
     "The art direction is visibly deliberate, not unfinished", ""),
    ("Model and texture the Level 3 venue interior", "P5", "ws1-world-assets,level-3,assets,blocked-by-assets",
     "The camera never travels, so detail only where it is seen.",
     "Tiered desks with one instanced seat mesh;Student NPCs at desks, low detail;Whiteboard, projector, door - the things in the player's view",
     "The interior holds up from the seated camera and nowhere else needs to", ""),
    ("Reference photography session at Wits", "P5", "ws1-world-assets,assets,docs",
     "Blocks all three environment issues.",
     "Shoot in flat overcast light to avoid baked-in shadows;Facades straight-on for textures, three-quarter for proportion;Road surface, kerbs, bollards, signage, bins;The parking area, the crossing point, a lecture venue interior;Shared folder, consistent naming, location noted per shot",
     "Every environment issue has the photos it needs to start", "Schedule this early in Phase 4 so Phase 5 is not waiting on it."),
    ("Build the HUD for all three levels", "P6", "ws6-integration-build,mvp",
     "Each HUD must answer 'what is about to kill me?' and nothing else.",
     "L1: condition, soft timer, three-part parking indicator;L2: attempts, timer, subtle next-gap indicator;L3: answer bar, suspicion meter, time remaining;Multi-channel feedback - shake, colour, sound - never a text popup alone",
     "A new player understands each failure condition without being told", ""),
    ("Build menus, pause and restart-without-reload", "P6", "ws6-integration-build,mvp",
     "Marked, and needed for the demo.",
     "Main menu, pause, results screen;Restart without a page refresh;Skippable instruction card per level, since controls differ;Credits screen",
     "The whole game can be demonstrated without touching the browser reload button", ""),
    ("Implement scoring and the commute rating", "P6", "ws6-integration-build,stretch",
     "Replay value and a clean way to end the journey.",
     "Per-level scores: time, mistakes, level-specific quality measure;Combined commute rating on the results screen;Best times stored locally",
     "Two runs produce meaningfully different ratings", ""),
    ("Add audio for all three levels", "P6", "ws6-integration-build,assets,mvp",
     "Level 3's audio is a mechanic, not decoration - footstep proximity gives information the camera cannot.",
     "L1: engine loop pitched to speed, suspension thump, campus ambience;L2: traffic wash, taxi hoots, doppler passes, footsteps;L3: ticking clock, page turns, approaching footsteps, near-silence otherwise;Short, compressed, preloaded per level",
     "Playing Level 3 with eyes closed still conveys where the tutor is", ""),
    ("Performance pass against the frame rate target", "P6", "ws5-graphics-shaders,ws6-integration-build,infra,mvp",
     "Measured on lab hardware, not assumed on a gaming laptop.",
     "Profile each level; record before and after numbers;Instance repeated objects: seats, parked cars, traffic;Cap dynamic shadow-casting lights;Texture resolution proportionate to viewing distance;Confirm no allocation inside the render loop",
     "Target frame rate held in all three levels on a lab machine", ""),
    ("Final LAMP deployment and cross-machine test", "P6", "ws6-integration-build,infra,mvp,rubric",
     "The last chance for the case-sensitivity and MIME problems to bite.",
     "Deploy the production build;Test on a machine that has never run the project;Test in at least two browsers;Confirm load times are acceptable on campus wifi",
     "Someone outside the group plays the full journey from the URL", ""),
    ("Write the credits and third-party attribution", "P6", "ws6-integration-build,docs",
     "Required, and easiest done incrementally rather than the night before.",
     "Every third-party model, texture, sound and tutorial credited;Any adapted or AI-assisted code noted per the course policy;Team members and workstreams listed",
     "Nothing in the project is unattributed", "Rule from the project doc: whoever adds a third-party asset adds its credit line the same day."),
    ("Record the trailer and devlog", "P6", "ws6-integration-build,docs",
     "Usually forgotten until the last week.",
     "Capture footage of each level at its best;Show the custom shader clearly - it is a marked deliverable;Keep it short and cut to the three-level structure",
     "The trailer makes the three levels look like three different games", ""),
    ("Weekly full-journey playtest", "P6", "ws6-integration-build,docs",
     "Everyone plays the whole journey weekly and logs what feels wrong, not what is broken.",
     "Recurring issue - add findings as comments each week;Log feel problems separately from bugs;Each level owner triages their own level's feedback",
     "Kept open until the final submission", ""),
    ("Stretch: rain, puddles and weather particles", "P6", "ws5-graphics-shaders,graphics,stretch",
     "Only after MVP.",
     "Particle rain;Puddle reflections reusing the asphalt shader",
     "MVP is fully closed first", ""),
    ("Stretch: day-to-night transition across the three levels", "P6", "ws5-graphics-shaders,graphics,stretch",
     "Only after MVP.",
     "Procedural sky with a time-of-day parameter",
     "MVP is fully closed first", ""),
    ("Stretch: second invigilator in Level 3", "P6", "ws4-stealth-npcs,level-3,stretch",
     "Only after MVP.",
     "Overlapping vision cones;Difficulty tuning",
     "MVP is fully closed first", ""),
    ("Stretch: visible car damage", "P6", "ws2-driving-parking,level-1,stretch",
     "Only after MVP.",
     "Damage visuals tied to the condition meter",
     "MVP is fully closed first", ""),
    ("Stretch: minimap and multiple camera modes", "P6", "ws6-integration-build,stretch",
     "Only after MVP.",
     "Minimap for Level 1;Selectable camera modes",
     "MVP is fully closed first", ""),
]


def req(method, path, token, payload=None):
    url = path if path.startswith("http") else API + path
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", "Bearer " + token)
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("Content-Type", "application/json")
    r.add_header("User-Agent", "wits-seed")
    try:
        with urllib.request.urlopen(r) as resp:
            b = resp.read().decode()
            return json.loads(b) if b else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError("%s %s -> %s %s" % (method, url, e.code, e.read().decode()))


def paged(path, token):
    out, page = [], 1
    while True:
        sep = "&" if "?" in path else "?"
        c = req("GET", "%s%sper_page=100&page=%d" % (path, sep, page), token)
        if not c:
            break
        out.extend(c)
        if len(c) < 100:
            break
        page += 1
    return out


def body(why, tasks, done, note):
    L = []
    if why:
        L += ["**Why this matters**", "", why, ""]
    if tasks:
        L += ["**Tasks**", ""] + ["- [ ] " + t for t in tasks.split(";")] + [""]
    if done:
        L += ["**Definition of done**", ""] + ["- " + d for d in done.split(";")] + [""]
    if note:
        L += ["> " + note, ""]
    L.append("<sub>Seeded from the Detailed Project Description v2.0.</sub>")
    return "\n".join(L)


def main():
    args = sys.argv[1:]
    apply = "--apply" in args
    args = [a for a in args if not a.startswith("--")]
    if len(args) != 1 or "/" not in args[0]:
        print("usage: python3 seed_issues.py OWNER/REPO [--apply]")
        sys.exit(1)
    repo = args[0]
    token = os.environ.get("GITHUB_TOKEN", "").strip()

    if not apply:
        print("DRY RUN - nothing created. Add --apply to create for real.\n")
        print("Repo: %s   Labels: %d   Milestones: %d   Issues: %d\n"
              % (repo, len(LABELS), len(MILESTONES), len(ISSUES)))
        for i, it in enumerate(ISSUES, 1):
            print("%2d. [%s] %s" % (i, it[1], it[0]))
        return

    if not token:
        print("ERROR: set GITHUB_TOKEN first")
        sys.exit(1)
    try:
        req("GET", "/repos/" + repo, token)
    except RuntimeError as e:
        print("ERROR: cannot read %s\n%s" % (repo, e))
        sys.exit(1)

    have = {l["name"] for l in paged("/repos/%s/labels" % repo, token)}
    for name, (col, desc) in LABELS.items():
        if name in have:
            continue
        req("POST", "/repos/%s/labels" % repo, token,
            {"name": name, "color": col, "description": desc})
        print("label     " + name)
        time.sleep(0.2)

    ms = {m["title"]: m["number"] for m in paged("/repos/%s/milestones?state=all" % repo, token)}
    keys = {}
    for i, (t, d) in enumerate(MILESTONES):
        keys["P%d" % (i + 1)] = t
        if t not in ms:
            ms[t] = req("POST", "/repos/%s/milestones" % repo, token,
                        {"title": t, "description": d})["number"]
            print("milestone " + t)
            time.sleep(0.2)

    titles = {i["title"] for i in paged("/repos/%s/issues?state=all" % repo, token)
              if "pull_request" not in i}
    made = skip = 0
    for title, ph, labels, why, tasks, done, note in ISSUES:
        if title in titles:
            skip += 1
            continue
        p = {"title": title, "body": body(why, tasks, done, note),
             "labels": labels.split(","), "milestone": ms[keys[ph]]}
        n = req("POST", "/repos/%s/issues" % repo, token, p)["number"]
        print("issue #%-4s %s" % (n, title))
        made += 1
        time.sleep(1.0)

    print("\nDone. %d created, %d already existed." % (made, skip))
    print("https://github.com/%s/issues" % repo)


if __name__ == "__main__":
    main()