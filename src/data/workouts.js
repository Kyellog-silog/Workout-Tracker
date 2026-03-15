// ============================================================
// WORKOUT TRACKER -- SCIENCE-BASED PPL PROGRAMME
// Schedule: 5-day rotating (Push/Pull/Legs/Rest/Push/Pull/Rest)
// Each muscle hit 2x/week = optimal frequency per Schoenfeld et al.
// Volume: 10-16 sets/muscle/week split across 2 sessions of 5-8 sets
// Sequence: Compound -> Accessory -> Isolation (neural demand order)
// ============================================================

export const SESSION_META = {
  push: {
    label: "PUSH",
    color: "#a05c2c",
    dimColor: "rgba(160,92,44,0.10)",
    borderColor: "rgba(160,92,44,0.28)",
    focus: "Chest · Shoulders · Triceps",
    warmup: [
      "10× Arm circles (forward & back)",
      "10× Shoulder rolls",
      "5× Scapular push-ups",
      "10× Band pull-aparts (or towel substitute)",
    ],
    cooldown: [
      "30s Doorway chest stretch each side",
      "30s Cross-body shoulder stretch each side",
      "30s Overhead tricep stretch each side",
    ],
    restActivities: [],
  },
  pull: {
    label: "PULL",
    color: "#2c6e7a",
    dimColor: "rgba(44,110,122,0.10)",
    borderColor: "rgba(44,110,122,0.28)",
    focus: "Back · Biceps · Rear Delts",
    warmup: [
      "10× Cat-cow stretches",
      "10× Thoracic rotations each side",
      "5× Dead hangs from pull-up bar (15–20s each)",
      "10× Scapular pull-ups (dead hang, retract shoulder blades)",
    ],
    cooldown: [
      "30s Lat stretch each side (hang from bar or doorframe)",
      "30s Bicep wall stretch each side",
      "30s Child's pose — arms extended forward",
    ],
    restActivities: [],
  },
  legs: {
    label: "LEGS",
    color: "#6b4fa0",
    dimColor: "rgba(107,79,160,0.10)",
    borderColor: "rgba(107,79,160,0.28)",
    focus: "Quads · Hamstrings · Glutes · Calves",
    warmup: [
      "10× Bodyweight squats (slow, controlled, 3s descent)",
      "10× Hip circles each side",
      "10× Leg swings forward/back each leg",
      "30s Hip flexor lunge stretch each side",
    ],
    cooldown: [
      "30s Standing quad stretch each leg",
      "30s Hamstring forward fold (hold)",
      "30s Pigeon pose each side",
      "30s Seated calf stretch each leg",
    ],
    restActivities: [],
  },
  rest: {
    label: "REST",
    color: "#7d6b56",
    dimColor: "rgba(125,107,86,0.08)",
    borderColor: "rgba(125,107,86,0.2)",
    focus: "Recovery · Mobility",
    warmup: [],
    cooldown: [],
    restActivities: [
      "10–15 min light walk or easy cycling",
      "Full body stretching routine (15–20 min)",
      "Foam rolling: quads, lats, thoracic spine, calves",
      "Sleep 7–9 hours — muscle synthesis peaks during sleep",
      "Protein target: 1.6–2g per kg bodyweight today",
      "Hydration: 35–45ml per kg bodyweight",
    ],
  },
  cardio: {
    label: "CARDIO",
    color: "#4a7c59",
    dimColor: "rgba(74,124,89,0.10)",
    borderColor: "rgba(74,124,89,0.28)",
    focus: "Cardiovascular · Endurance",
    warmup: [
      "5 min easy walk or slow jog",
      "Leg swings, arm circles, hip rotations",
    ],
    cooldown: [
      "5 min easy walk",
      "Standing quad, calf and hip-flexor stretches",
    ],
    restActivities: [
      "20–45 min steady-state cardio (run, cycle, swim, row)",
      "Keep heart rate at 60–70% max for aerobic base",
      "Intervals: 30s hard / 90s easy × 8–10 rounds",
      "Finish with 5 min easy cool-down and light stretching",
      "Protein target: 1.6–2g per kg bodyweight today",
      "Hydration: 35–45ml per kg bodyweight",
    ],
  },
};

// Default exercises — used as fallback when user has no custom plan
// Sets are calibrated to: 5–8 working sets per muscle per session
// giving 10–16 total weekly sets when hitting each muscle 2x/week
export const DEFAULT_EXERCISES = {
  push: [
    {
      id: "p1", name: "Push-Ups", type: "bodyweight", order: 1,
      sets: "4", reps: "10–15", rest: "90s",
      weightStart: "", weightIncrement: "",
      cue: "Slow 3-second descent. Body rigid like a plank. Elbows at 45°, not flared.",
      progression: "Standard → Wide grip → Diamond → Archer → Pike push-up",
      whyOrder: "CNS primer — activates chest & shoulders with zero equipment or setup time.",
    },
    {
      id: "p2", name: "DB Chest Press", type: "dumbbell", order: 2,
      sets: "4", reps: "8–12", rest: "2–3min",
      weightStart: "12", weightIncrement: "2.5",
      cue: "Lower to chest level, feel the stretch at bottom. Press up and slightly inward.",
      progression: "12kg → 15kg → 17.5kg → 20kg → 22.5kg → 25kg",
      whyOrder: "Primary chest compound. Done when energy is highest for maximum load.",
    },
    {
      id: "p3", name: "DB Overhead Press", type: "dumbbell", order: 3,
      sets: "4", reps: "8–12", rest: "2min",
      weightStart: "10", weightIncrement: "2.5",
      cue: "Core braced, ribs down. Press straight up. Lower to ear level.",
      progression: "10kg → 12.5kg → 15kg → 17.5kg → 20kg",
      whyOrder: "Primary shoulder compound. Done 3rd — chest and shoulders share fatigue.",
    },
    {
      id: "p4", name: "Pike Push-Ups", type: "bodyweight", order: 4,
      sets: "3", reps: "8–12", rest: "90s",
      weightStart: "", weightIncrement: "",
      cue: "Hips high in inverted V. Head through on descent. Builds toward handstand push-up.",
      progression: "Pike → Elevated Pike (feet on chair) → Wall HSPU → Freestanding HSPU",
      whyOrder: "Shoulder accessory — bodyweight, no rest needed between dumbbell sets.",
    },
    {
      id: "p5", name: "DB Lateral Raises", type: "dumbbell", order: 5,
      sets: "4", reps: "12–15", rest: "60s",
      weightStart: "5", weightIncrement: "1.25",
      cue: "Lead with elbows, not hands. Slight bend in elbow. Stop at shoulder height.",
      progression: "5kg → 7.5kg → 10kg → 12kg → 15kg",
      whyOrder: "Medial delt isolation. Light load — done after heavy pressing.",
    },
    {
      id: "p6", name: "Tricep Dips", type: "bodyweight", order: 6,
      sets: "3", reps: "10–15", rest: "60s",
      weightStart: "", weightIncrement: "",
      cue: "Upright torso for tricep focus. Full lockout at top. Elbows track back.",
      progression: "Bent knee → Straight leg → Feet elevated → Weighted (backpack)",
      whyOrder: "Tricep finisher — already pre-fatigued from all pressing movements.",
    },
    {
      id: "p7", name: "DB Chest Fly", type: "dumbbell", order: 7,
      sets: "3", reps: "12–15", rest: "60s",
      weightStart: "8", weightIncrement: "1.25",
      cue: "Wide arc down, slight elbow bend. Squeeze at top like hugging a tree.",
      progression: "8kg → 10kg → 12kg → 15kg",
      whyOrder: "Chest isolation finisher — stretch-focused, different stimulus from press.",
    },
  ],
  pull: [
    {
      id: "l1", name: "Pull-Ups / Chin-Ups", type: "pullup", order: 1,
      sets: "4", reps: "Max (aim 6–10)", rest: "2–3min",
      weightStart: "", weightIncrement: "",
      cue: "Dead hang start, full extension at bottom. Chest to bar at top. No kipping.",
      progression: "Negatives (5s down) → Full pull-ups → Weighted → L-sit pull-up",
      whyOrder: "Hardest movement — always done first while completely fresh.",
    },
    {
      id: "l2", name: "DB Bent-Over Row", type: "dumbbell", order: 2,
      sets: "4", reps: "8–12", rest: "2min",
      weightStart: "15", weightIncrement: "2.5",
      cue: "Hinge at hips, back flat, slight knee bend. Pull to hip, squeeze at top for 1s.",
      progression: "15kg → 20kg → 25kg → 30kg → 35kg → 40kg",
      whyOrder: "Primary back compound. Heavy bilateral — builds mid-back thickness.",
    },
    {
      id: "l3", name: "Inverted Rows", type: "bodyweight", order: 3,
      sets: "3", reps: "10–15", rest: "90s",
      weightStart: "", weightIncrement: "",
      cue: "Body completely rigid. Pull chest to bar — full scapular retraction at top.",
      progression: "Bent knee → Straight leg → Feet elevated → Weighted vest",
      whyOrder: "Horizontal pull — complements vertical pull-up for full back width.",
    },
    {
      id: "l4", name: "DB Single-Arm Row", type: "dumbbell", order: 4,
      sets: "3", reps: "10–12 each side", rest: "90s",
      weightStart: "15", weightIncrement: "2.5",
      cue: "Elbow drives straight back, not flared out. Full stretch at bottom.",
      progression: "15kg → 20kg → 25kg → 30kg → 35kg",
      whyOrder: "Unilateral — corrects left/right imbalances. More ROM than bilateral.",
    },
    {
      id: "l5", name: "Rear Delt Fly", type: "dumbbell", order: 5,
      sets: "4", reps: "12–15", rest: "60s",
      weightStart: "5", weightIncrement: "1.25",
      cue: "Hinge forward 45°. Arms arc like a reverse hug. Pause at top, squeeze.",
      progression: "5kg → 7.5kg → 10kg → 12kg",
      whyOrder: "Rear delt isolation. Light weight, strict tempo — done after heavy rows.",
    },
    {
      id: "l6", name: "DB Hammer Curls", type: "dumbbell", order: 6,
      sets: "3", reps: "10–12", rest: "60s",
      weightStart: "10", weightIncrement: "2.5",
      cue: "Neutral grip (thumbs up). Curl to shoulder, squeeze at top. No swinging.",
      progression: "10kg → 12.5kg → 15kg → 17.5kg",
      whyOrder: "Brachialis + bicep. Neutral grip reduces elbow stress vs supinated curl.",
    },
    {
      id: "l7", name: "DB Supinated Bicep Curl", type: "dumbbell", order: 7,
      sets: "3", reps: "10–12", rest: "60s",
      weightStart: "8", weightIncrement: "2.5",
      cue: "Rotate palm up as you curl. Full extension at bottom. No shoulder swinging.",
      progression: "8kg → 10kg → 12.5kg → 15kg → 17.5kg",
      whyOrder: "Bicep peak isolation last — already heavily pre-fatigued from all pulling.",
    },
  ],
  legs: [
    {
      id: "g1", name: "Goblet Squat", type: "dumbbell", order: 1,
      sets: "4", reps: "10–15", rest: "2min",
      weightStart: "15", weightIncrement: "2.5",
      cue: "DB at chest. Chest tall throughout. Knees track toes. Sit to parallel or below.",
      progression: "15kg → 20kg → 25kg → 30kg → 35kg → 40kg",
      whyOrder: "Primary quad compound. Highest neural demand — always done first.",
    },
    {
      id: "g2", name: "DB Romanian Deadlift", type: "dumbbell", order: 2,
      sets: "4", reps: "8–12", rest: "2min",
      weightStart: "15", weightIncrement: "2.5",
      cue: "Push hips back — hinge, don't squat. Back flat, feel hamstring load. Bar stays close.",
      progression: "15kg → 20kg → 25kg → 30kg → 35kg → 40kg",
      whyOrder: "Primary hamstring/glute compound. Balances quad work of squat.",
    },
    {
      id: "g3", name: "Bulgarian Split Squat", type: "dumbbell", order: 3,
      sets: "3", reps: "8–10 each leg", rest: "90s",
      weightStart: "0", weightIncrement: "2.5",
      cue: "Rear foot elevated. Front foot far forward. Descend straight down, torso upright.",
      progression: "Bodyweight → 5kg×2 → 10kg×2 → 15kg×2 → 20kg×2",
      whyOrder: "Unilateral compound — fixes imbalances. Done after bilateral when CNS still fresh.",
    },
    {
      id: "g4", name: "Hip Thrust", type: "dumbbell", order: 4,
      sets: "4", reps: "12–15", rest: "90s",
      weightStart: "15", weightIncrement: "2.5",
      cue: "Upper back on bench, DB on hips. Drive through heels. Hard glute squeeze at top for 1s.",
      progression: "15kg → 20kg → 25kg → 30kg → 35kg → 40kg",
      whyOrder: "Glute isolation — hip hinge muscles still warm from RDL. Best glute activator.",
    },
    {
      id: "g5", name: "Walking Lunges", type: "dumbbell", order: 5,
      sets: "3", reps: "10–12 each leg", rest: "60s",
      weightStart: "0", weightIncrement: "2.5",
      cue: "Torso upright throughout. Step forward, knee hovers near floor. Drive through front heel.",
      progression: "Bodyweight → 5kg×2 → 10kg×2 → 15kg×2 → 20kg×2",
      whyOrder: "Quad/glute accessory. Legs pre-fatigued — this is the burnout set.",
    },
    {
      id: "g6", name: "Nordic Hamstring Curl", type: "bodyweight", order: 6,
      sets: "3", reps: "5–8", rest: "90s",
      weightStart: "", weightIncrement: "",
      cue: "Anchor feet under bench/sofa. Lower as slowly as possible. Use hands to push back up.",
      progression: "Assisted (bands) → Full negative only → Partial rep → Full rep",
      whyOrder: "Hamstring isolation — eccentric-focused, one of the best injury prevention exercises.",
    },
    {
      id: "g7", name: "Calf Raises", type: "bodyweight", order: 7,
      sets: "4", reps: "15–25", rest: "45s",
      weightStart: "", weightIncrement: "",
      cue: "Full range — pause 1s at bottom stretch, 1s hold at top. Edge of step for ROM.",
      progression: "2-leg BW → 1-leg BW → 1-leg weighted (hold DB at side)",
      whyOrder: "Calf isolation always last. High rep, short rest — calves recover fast.",
    },
  ],
};

// Default exercises for cardio — empty, user fills in their own
// exercises or the session shows cardio activity suggestions.
export const CARDIO_DEFAULT_ACTIVITIES = [
  "20–45 min steady-state cardio (run, cycle, swim, row)",
  "Keep heart rate at 60–70% max for aerobic base",
];

// 5-day rotating schedule (repeating pattern)
// Week A: Push Pull Legs Rest Push Pull Rest
// Week B: Legs Push Pull Rest Legs Push Rest
// Net result: every muscle hit exactly 2x per week
export const DEFAULT_SCHEDULE = [
  "push", "pull", "legs", "rest", "push", "pull", "rest",
];

// Preset colour palette for custom plans (earthy / muted, matching app aesthetic)
export const PLAN_COLORS = [
  "#a05c2c", // warm brown (Push default)
  "#2c6e7a", // teal (Pull default)
  "#6b4fa0", // purple (Legs default)
  "#4a7c59", // green (Cardio default)
  "#7a4a2c", // dark rust
  "#2c4a7a", // navy
  "#7a2c55", // rose
  "#4a6b7a", // steel blue
  "#6b7a2c", // olive
  "#7a5c2c", // sand
];

export const PROGRESSION_PHASES = [
  {
    weeks: "1–4", title: "Foundation",
    desc: "Master movement patterns. Use 50–60% of your perceived max. Every rep with full range of motion. The goal is technique, not load.",
    range: "5–15kg", color: "#2c6e7a",
  },
  {
    weeks: "5–8", title: "Build",
    desc: "Add weight only when top of rep range feels controlled for 2 sessions in a row. +2.5kg compounds, +1.25kg isolation. This is where most growth happens.",
    range: "12–25kg", color: "#a05c2c",
  },
  {
    weeks: "9–12", title: "Overload",
    desc: "Train to 1–2 reps from failure (RIR 1–2). Introduce 4-second eccentrics or drop sets. Expect soreness to decrease — that's normal, keep pushing.",
    range: "20–35kg", color: "#6b4fa0",
  },
  {
    weeks: "13+", title: "Progress",
    desc: "Take a full deload week at 60% volume and weight, then restart with your Week 9 weights as your new starting point. Your pull-up count should be up 3–5 reps.",
    range: "25–40kg", color: "#7d6b56",
  },
];

export const EXERCISE_TYPES = [
  { value: "dumbbell", label: "Dumbbell" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "pullup", label: "Pull-up Bar" },
];
