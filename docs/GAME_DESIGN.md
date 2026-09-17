# Game Design

## Core Concept

One student.  
One morning.  
Three escalating problems.

The journey is:

```text
PARK -> CROSS -> CHEAT
```

The story connects the levels while the gameplay deliberately changes genre.

---

# Level 1 — Park at Wits

## Purpose

Introduce the world and teach movement through a low-speed precision driving challenge.

## Objective

Drive through the parking environment and correctly stop inside the target bay.

## Core Systems

- continuous driving
- acceleration / braking / reverse
- steering
- blocking collisions
- pothole triggers
- vehicle condition
- parking validation
- chase camera

## Pothole Response

Planned pothole feedback:

- speed loss
- camera shake
- body pitch / suspension response
- condition loss
- HUD feedback

## Parking Validation

A valid park should require all of the following:

1. sufficient vehicle containment inside the bay
2. acceptable angle relative to the bay
3. sufficiently low speed

## Failure

Vehicle condition reaches zero.

## Success

The parking validation passes.

## Visual Identity

- dusk
- warm street lights
- headlights
- long shadows
- damaged / wet asphalt
- custom shader

---

# Level 2 — Cross the Road

## Purpose

Change genre after the player exits the car.

Level 1 makes the player the vehicle.

Level 2 makes vehicles the threat.

## Objective

Reach the opposite pavement.

## Movement

Grid-based and discrete.

One input produces one movement step.

Movement may allow:

- forward
- backward
- left
- right

## Traffic

Traffic lanes differ by:

- speed
- direction
- spacing

The player should need to read each lane rather than memorise one rhythm.

## Failure

Collision with a vehicle.

## Checkpoints

Kerbs or traffic islands may act as checkpoints.

## Psychology Survey NPC

Walking into the Psych Elective NPC pauses Level 2 and opens a mouse-driven,
in-game PSY-04 questionnaire. Each opening draws three distinct
Yes/No/Undecided prompts and three distinct 1–10 agreement-scale prompts from
`src/levels/crossing/psychologyQuestionnaire.js`.

The form is deliberately bureaucratic flavour: all six responses are required,
but they are discarded on submission. It does not create a profile, alter
dialogue, award a reward, or affect gameplay. The questionnaire is presented
as a Google-Forms-inspired academic sheet; Yes/No choices are marked with a
rough pencil ring, while scale choices use a filled graphite radio dot. Normal
movement resumes immediately after the completed form closes.

## Success

Reach the far pavement / level exit.

## Visual Identity

- bright midday lighting
- high contrast
- orthographic / near-isometric camera
- animated traffic
- character hop / walk animation

---

# Level 3 — Don't Get Caught

The detailed implementation contract for this level is in `docs/LEVEL_3_CHEATING_MECHANICS.md`.

## Purpose

End with a distinct stealth challenge.

The player is seated and cannot walk around the room.

## Objective

Read the question on the player's paper, inspect nearby students' possible answers, then type the answer that fits the question without reaching maximum suspicion or running out of time.

## Core Loop

```text
read the question on the player's paper
  ↓
inspect nearby tablets and hold left click to reveal their assigned answers
  ↓
release and look down at the player's paper
  ↓
type the answer and press Enter
  ↓
repeat while monitoring the tutor
```

## Tutor

The tutor follows a patrol route.

Detection considers:

- view angle
- distance
- whether the player is peeking at a functional tablet
- line-of-sight occlusion

## Suspicion

While seen peeking at a functional tablet:

```text
suspicion increases
```

While unseen or not peeking:

```text
suspicion holds its current value
```

## Failure

Suspicion reaches 100% or the timer expires. Either failure shows a Game Over screen with a Retry button.

## Success

Answer progress reaches 100% before the timer expires.

## Visual Identity

- interior lighting
- projector glow
- tutor spotlight
- vision cone
- suspicion-driven vignette / desaturation
