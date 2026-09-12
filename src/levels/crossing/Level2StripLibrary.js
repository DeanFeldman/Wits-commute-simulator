// This is the editable catalogue for the whole of Level 2.
// The generator never draws an unnamed fallback row: start, finish, safe zones,
// checkpoint and hazards are all selected from the definitions in this file.
export const LEVEL_2_STRIPS = {
  // Fixed first strip. rowSpan: 2 gives the player two safe starting rows.
  start: {
    id: "arm-walkway",
    type: "start",
    surface: "pavement",
    section: "arm",
    rowSpan: 4,
    checkpoint: true,
    difficulty: 0
  },

  // Fixed final strip.
  finish: {
    id: "engineering-entrance",
    type: "finish",
    surface: "pavement",
    section: "engineering-finish",
    rowSpan: 5,
    difficulty: 0
  },

  yaleRoad: {
    id: "yale-road-crossing",
    type: "yale-road",
    surface: "road",
    section: "yale-road",
    rowSpan: 4,
    difficulty: 2,
    traffic: {
      lanes: [
        { rowOffset: 0, direction: 1, speed: 5.1, gapRange: [8.4, 10.2], allowedVehicleTypes: ["car", "hatchback"], vehicleCount: 2 },
        { rowOffset: 1, direction: 1, speed: 5.8, gapRange: [8.8, 10.8], allowedVehicleTypes: ["car", "van"], vehicleCount: 2 },
        { rowOffset: 2, direction: -1, speed: 6.2, gapRange: [9.2, 11.2], allowedVehicleTypes: ["car", "hatchback"], vehicleCount: 2 },
        { rowOffset: 3, direction: -1, speed: 7.1, gapRange: [9.8, 11.8], allowedVehicleTypes: ["taxi", "car"], vehicleCount: 2, taxiStops: true }
      ]
    }
  },

  bridgeEntry: {
    id: "bridge-entry-plaza",
    type: "bridge-entry",
    surface: "pavement",
    section: "bridge-entry",
    rowSpan: 2,
    checkpoint: true,
    difficulty: 0
  },

  yaleExit: {
    id: "yale-road-exit",
    type: "yale-exit",
    surface: "pavement",
    section: "engineering",
    rowSpan: 2,
    checkpoint: true,
    difficulty: 0
  },

  engineeringCheckpoint: {
    id: "bridge-exit-plaza",
    type: "bridge-exit",
    surface: "pavement",
    section: "bridge-exit",
    rowSpan: 2,
    checkpoint: true,
    difficulty: 0
  },

  // Fixed middle checkpoint. This is separate from ordinary safe strips.
  checkpoint: {
    id: "traffic-island",
    type: "median",
    surface: "median",
    checkpoint: true,
    difficulty: 0
  },

  // The Amic Deck pedestrian bridge, dressed as a checkpoint over the sunken
  // M1 highway. The highway lanes are marked `isHighway` so CrossingStrip
  // sinks them below the deck and CrossingLevel excludes them from
  // collision - the bridge is always safe to stand on, only Yale Road can
  // end a run. The outer rows are campus approaches and the inner rows carry
  // the highway below the deck.
  bridgeCheckpoint: {
    id: "amic-deck-bridge",
    type: "bridge",
    surface: "road",
    section: "m1-bridge",
    surfaceColor: 0x252a31,
    rowSpan: 8,
    checkpoint: false,
    difficulty: 0,
    traffic: {
      lanes: [
        {
          rowOffset: 1,
          direction: 1,
          speed: 5.8,
          gapRange: [8.2, 9.6],
          allowedVehicleTypes: ["car", "hatchback"],
          vehicleCount: 2,
          isHighway: true
        },
        {
          rowOffset: 2,
          direction: -1,
          speed: 6.2,
          gapRange: [8, 9.5],
          allowedVehicleTypes: ["car", "van"],
          vehicleCount: 3,
          isHighway: true
        },
        {
          rowOffset: 3,
          direction: 1,
          speed: 5.8,
          gapRange: [8.2, 9.6],
          allowedVehicleTypes: ["car", "hatchback"],
          vehicleCount: 2,
          isHighway: true
        },
        {
          rowOffset: 6,
          direction: -1,
          speed: 6.2,
          gapRange: [8, 9.5],
          allowedVehicleTypes: ["car", "van"],
          vehicleCount: 3,
          isHighway: true
        }
      ]
    }
  },

  // The generator chooses one of these between each pair of hazards.
  // Add custom safe strips and optional GLB models here.
  safe: [
    {
      id: "safe-pavement",
      type: "safe",
      surface: "pavement",
      checkpoint: false,
      difficulty: 0
    },
    {
      id: "safe-paved-verge",
      type: "safe",
      surface: "pavement",
      checkpoint: false,
      difficulty: 0
    },
    {
      id: "zesties",
      type: "safe",
      surface: "pavement",
      surfaceColor: 0xb86f50,
      checkpoint: false,
      difficulty: 0
    },
    // Dense two-row garden. Only side columns are available to trees, leaving
    // the middle of the crossing clear for the player.
    {
      id: "tree-lined-safe-zone",
      type: "safe",
      surface: "pavement",
      rowSpan: 2,
      surfaceColor: 0x78a85b,
      checkpoint: false,
      difficulty: 0,
      trees: {
        countRange: [6, 9],
        columns: [-6, -5, -4, 4, 5, 6],
        rowOffsets: [0, 1],
        scale: 1,
        canopyColors: [0x356f3f, 0x4d8846, 0x6b9e4f]
      }
    },
    // A lighter one-row variation using the same reusable tree system.
    {
      id: "sparse-tree-verge",
      type: "safe",
      surface: "pavement",
      surfaceColor: 0x8dbb69,
      checkpoint: false,
      difficulty: 0,
      trees: {
        countRange: [2, 4],
        columns: [-6, -5, -4, 4, 5, 6],
        rowOffsets: [0],
        scale: 1
      }
    }
  ],

  // Hazards are grouped so the generator can guarantee variety. Add new
  // hazards to `custom`; they automatically become part of the random pool.
  hazards: {
    left: [
      {
        id: "road-left-steady",
        type: "road-left",
        surface: "road",
        difficulty: 1,
        traffic: {
          direction: -1,
          speed: 4.4,
          gapRange: [7.2, 8.8],
          allowedVehicleTypes: ["car", "van"],
          vehicleCount: 3
        }
      },
      {
        id: "road-left-spaced",
        type: "road-left",
        surface: "road",
        difficulty: 1,
        traffic: {
          direction: -1,
          speed: 5.1,
          gapRange: [7.8, 9.4],
          allowedVehicleTypes: ["car", "hatchback"],
          vehicleCount: 3
        }
      }
    ],

    right: [
      {
        id: "road-right-steady",
        type: "road-right",
        surface: "road",
        difficulty: 1,
        traffic: {
          direction: 1,
          speed: 4.8,
          gapRange: [7.1, 8.7],
          allowedVehicleTypes: ["car", "hatchback"],
          vehicleCount: 3
        }
      },
      {
        id: "road-right-spaced",
        type: "road-right",
        surface: "road",
        difficulty: 1,
        traffic: {
          direction: 1,
          speed: 5.5,
          gapRange: [7.8, 9.5],
          allowedVehicleTypes: ["car", "van"],
          vehicleCount: 3
        }
      }
    ],

    fast: [
      {
        id: "road-fast-left",
        type: "road-fast",
        surface: "road",
        difficulty: 2,
        traffic: {
          direction: -1,
          speed: 7.2,
          gapRange: [8.4, 10.2],
          allowedVehicleTypes: ["car", "hatchback"],
          vehicleCount: 3
        }
      },
      {
        id: "road-fast-right",
        type: "road-fast",
        surface: "road",
        difficulty: 2,
        traffic: {
          direction: 1,
          speed: 7.5,
          gapRange: [8.6, 10.4],
          allowedVehicleTypes: ["car", "van"],
          vehicleCount: 3
        }
      }
    ],

    taxi: [
      {
        id: "taxi-left",
        type: "taxi-hazard",
        surface: "road",
        difficulty: 2,
        traffic: {
          direction: -1,
          speed: 7.8,
          gapRange: [9.2, 10.8],
          allowedVehicleTypes: ["taxi", "car"],
          vehicleCount: 3,
          taxiStops: true
        }
      },
      {
        id: "taxi-right",
        type: "taxi-hazard",
        surface: "road",
        difficulty: 2,
        traffic: {
          direction: 1,
          speed: 8,
          gapRange: [9.4, 11],
          allowedVehicleTypes: ["taxi", "hatchback"],
          vehicleCount: 3,
          taxiStops: true
        }
      }
    ],

    custom: [
      // busyRoad is one logical hazard occupying two physical grid rows.
      {
        id: "busyRoad",
        type: "busy-road",
        surface: "road",
        rowSpan: 2,
        surfaceColor: 0x34383f,
        difficulty: 2,
        markings: {
          color: 0xffffff,
          length: 1.8,
          thickness: 0.1,
          spacing: 3.6,
          offsetZ: 0
        },
        traffic: {
          lanes: [
            {
              rowOffset: 0,
              direction: 1,
              speed: 5.8,
              gapRange: [7.5, 9],
              allowedVehicleTypes: ["car", "hatchback"],
              vehicleCount: 3
            },
            {
              rowOffset: 1,
              direction: -1,
              speed: 6.2,
              gapRange: [8, 9.5],
              allowedVehicleTypes: ["car", "van"],
              vehicleCount: 3
            }
          ]
        }
      },
      // Pedestrians are created only when this dedicated hazard is selected.
      {
        id: "crowdHazard",
        type: "crowd-hazard",
        surface: "pavement",
        rowSpan: 2,
        surfaceColor: 0xd4a05f,
        difficulty: 1,
        crowd: {
          count: 6,
          speedRange: [0.75, 1.15],
          rowOffsets: [0, 1]
        }
      }
    ]
  }
};

// Backwards-compatible names for code/tests that already use these arrays.
export const CUSTOM_SAFE_STRIPS = LEVEL_2_STRIPS.safe;
export const CUSTOM_HAZARD_STRIPS = LEVEL_2_STRIPS.hazards.custom;
