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

## Purpose

End with a distinct stealth challenge.

The player is seated and cannot walk around the room.

## Objective

Complete the answer bar without reaching maximum suspicion.

## Core Loop

```text
copy
  ↓
watch tutor
  ↓
stop copying
  ↓
suspicion falls
  ↓
copy again
```

## Tutor

The tutor follows a patrol route.

Detection should eventually consider:

- view angle
- distance
- whether the player is copying
- line-of-sight occlusion

## Suspicion

While seen copying:

```text
suspicion increases
```

While safely facing forward:

```text
suspicion decreases
```

## Failure

Suspicion reaches 100%.

## Success

Answer progress reaches 100% before the timer expires.

## Visual Identity

- interior lighting
- projector glow
- tutor spotlight
- vision cone
- suspicion-driven vignette / desaturation
