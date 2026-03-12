# Workout Tracker

A web-based Push/Pull/Legs workout tracker with calendar scheduling, daily session logging, progression tracking, and cloud sync via Supabase. Built with React and Vite.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [Deployment](#deployment)
- [Architecture](#architecture)
  - [Data Flow](#data-flow)
  - [Scheduling Engine](#scheduling-engine)
  - [Smart Guard System](#smart-guard-system)
  - [Authentication Model](#authentication-model)
- [Components](#components)
- [Data Model](#data-model)
- [License](#license)

---

## Overview

Workout Tracker implements a science-based Push/Pull/Legs (PPL) programme using a 5-day rotating schedule. Each muscle group is trained twice per week following evidence-based volume guidelines (10-16 sets per muscle per week). The app handles schedule management, missed session detection, automatic rescheduling, and workout logging -- all synced across devices via a passphrase-based cloud storage system.

## Features

- **Calendar view** -- Full month calendar with colour-coded session types (Push, Pull, Legs, Rest, Missed) mapped to your programme schedule.
- **Daily workout tracker** -- Exercise checklist with per-exercise completion tracking, coaching cues, weight progression info, and session notes.
- **Plan editor** -- Customise exercises per session type. Supports manual editing, text import (one exercise per line), and `.txt` file upload. Changes apply to future sessions only; past logs are preserved.
- **Progression tracking** -- Visualises your current training phase (Foundation, Build, Overload, Progress) with dumbbell weight progression guidelines.
- **Stats dashboard** -- Displays total workouts completed, current streak, programme week, and per-session breakdown with progress bars.
- **Smart scheduling** -- Automatic miss detection with two strategies: shift mode (1-3 missed days push the schedule forward) and guard mode (4+ missed days reset the schedule without drift).
- **Rest timer** -- Draggable floating timer with presets (30s, 60s, 90s, 2m, 3m), circular progress ring, and audio beep on completion.
- **Cloud sync** -- Data is stored locally and synced to Supabase with debounced writes. Passphrase is SHA-256 hashed before storage.
- **Offline support** -- Falls back to localStorage when offline; syncs when reconnected.
- **Mobile-friendly** -- Responsive layout optimised for phone screens.

## Tech Stack

| Layer       | Technology                       |
| ----------- | -------------------------------- |
| Framework   | React 18                         |
| Build tool  | Vite 5                           |
| Styling     | CSS custom properties (no library) |
| Backend     | Supabase (PostgreSQL + REST API) |
| Hosting     | Vercel                           |
| Fonts       | Lora, Libre Baskerville, IBM Plex Mono (Google Fonts) |

## Project Structure

```
workout-tracker/
  index.html              -- Entry HTML file
  package.json            -- Dependencies and scripts
  vite.config.js          -- Vite build configuration
  vercel.json             -- Vercel deployment settings
  supabase.js             -- Root-level Supabase client (uses env vars via import.meta.env)
  src/
    main.jsx              -- React DOM entry point
    App.jsx               -- Root component: routing, state management, layout
    index.css             -- Global styles, CSS variables, theme, animations
    components/
      Calendar.jsx        -- Month calendar grid with session colour coding
      DayActionSheet.jsx  -- Bottom sheet for per-day actions (swap, miss, restore)
      Icons.jsx           -- Inline SVG icon library (no external dependencies)
      MissedAlert.jsx     -- Modal alert for shift/guard events on app open
      PassphraseGate.jsx  -- Login screen with passphrase input
      PlanEditor.jsx      -- Exercise plan editor with text import and file upload
      Progression.jsx     -- Training phase timeline and weight progression rules
      RestTimer.jsx       -- Draggable floating rest timer with presets
      Stats.jsx           -- Workout statistics dashboard
      WorkoutTracker.jsx  -- Daily session view with exercise cards
    data/
      workouts.js         -- Programme data: exercises, session metadata, schedule, phases
    hooks/
      useLocalStorage.js  -- Generic localStorage hook with JSON serialization
      useSyncedData.js    -- Dual-write hook: localStorage + debounced Supabase sync
    lib/
      scheduler.js        -- Scheduling engine: date utilities, session resolution, smart guard
      scheduler.test.js   -- Test suite for the scheduling engine (run with Node.js)
      supabase.js         -- Supabase client initialisation, passphrase hashing, CRUD
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Installation

```bash
npm install
```

### Environment Variables

The Supabase client at `src/lib/supabase.js` has credentials embedded for the default project. To use your own Supabase instance, create a `.env` file at the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The root-level `supabase.js` reads these via `import.meta.env`.

Your Supabase project needs a `ppl_data` table with the following schema:

| Column       | Type        | Notes                     |
| ------------ | ----------- | ------------------------- |
| passphrase   | text        | Primary key (SHA-256 hash)|
| data         | jsonb       | Full application state    |
| updated_at   | timestamptz | Last sync timestamp       |

### Running Locally

```bash
npm run dev
```

Opens at `http://localhost:5173` by default.

### Build for Production

```bash
npm run build
```

Output is written to the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Deployment

The project is configured for Vercel deployment via `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

To deploy:

1. Connect the repository to Vercel, or
2. Run `vercel deploy` from the project root.

## Architecture

### Data Flow

```
User action
  -> App.jsx (state updater)
    -> useSyncedData hook
      -> localStorage (immediate write)
      -> Supabase (debounced write, 1.5s after last change)
```

On app open, data is loaded from Supabase first. If offline, the app falls back to localStorage. The `selectedDate` field is always kept from the local copy to avoid overwriting the user's current view.

### Scheduling Engine

Located in `src/lib/scheduler.js`. The schedule is a repeating 7-day pattern:

```
Push - Pull - Legs - Rest - Push - Pull - Rest
```

This results in each muscle group being trained exactly twice per week.

Key functions:

- `baseSessionForDate(date, programStart)` -- Returns the session type for a date assuming no overrides.
- `resolvedSession(date, programStart, overrides)` -- Returns the effective session after applying all overrides, shifts, and guard resets.
- `runMidnightCheck(programStart, completedDays, overrides)` -- Entry point called on app open and at midnight. Detects missed sessions and applies the smart guard.

### Smart Guard System

The scheduling engine includes a "smart guard" to handle missed sessions:

- **Shift mode** (1-3 consecutive missed workout days): Marks missed days as rest and shifts all future sessions forward by N days. This preserves weekly volume.
- **Guard mode** (4+ consecutive missed workout days): Marks all missed days and resets the schedule to resume fresh from the next day. This prevents schedule drift from extended absences (travel, illness).

Idempotency is guaranteed by a `__processedUpTo` watermark stored in the overrides object.

### Authentication Model

There is no traditional authentication. Users enter a passphrase which is:

1. Normalised (trimmed, lowercased)
2. Hashed with SHA-256 using the Web Crypto API
3. Used as the primary key in the `ppl_data` table

The raw passphrase is stored in the browser's localStorage for session persistence but is never sent to or stored on the server.

## Components

| Component          | Description |
| ------------------ | ----------- |
| `App.jsx`          | Root component. Manages global state (programme start, completed days, overrides, custom plans), midnight check scheduling, tab navigation, and sync status display. |
| `Calendar.jsx`     | Renders a month grid. Each cell shows the session type, completion status, and override indicators. Tapping a date selects it; right-click (or long-press) opens the action sheet. |
| `DayActionSheet.jsx` | Bottom sheet modal with contextual actions for a selected date: swap to rest, mark as missed, restore original schedule. |
| `Icons.jsx`        | Stateless SVG icon component. All icons are defined as inline SVG paths with configurable size, colour, and stroke width. |
| `MissedAlert.jsx`  | Full-screen modal shown when the smart guard detects missed sessions. Displays shift and guard events with explanations. |
| `PassphraseGate.jsx` | Login screen. Accepts a passphrase, calls `loadFromSupabase` to verify connectivity, and stores the passphrase locally. |
| `PlanEditor.jsx`   | Tabbed editor for Push/Pull/Legs exercise plans. Supports inline editing of all exercise fields, drag reordering, text import with automatic parsing, and `.txt` file upload. |
| `Progression.jsx`  | Displays the four training phases with the current phase highlighted based on weeks since programme start. Includes the "2.5kg rule" reference. |
| `RestTimer.jsx`    | Floating action button that expands into a rest timer. Features preset durations, play/pause/reset controls, a circular SVG progress ring, and Web Audio API beep alerts. Supports pointer-based drag repositioning. |
| `Stats.jsx`        | Computes and displays total workouts, current streak, programme week, and per-session-type breakdown with proportional progress bars. |
| `WorkoutTracker.jsx` | Renders the daily session: header with session type and progress, warmup list, exercise cards (with expandable details, notes, and completion toggle), and cooldown list. Handles rest days and missed sessions with appropriate messaging. |

## Data Model

### Application State (stored in Supabase as JSON)

```javascript
{
  programStart: "2025-01-06",         // ISO date string, null if not set
  selectedDate: "2025-03-12",         // Currently viewed date
  completedDays: {
    "2025-01-06": {
      checked: { "p1": true, "p2": true },  // Exercise completion map
      notes: { "p1": "Felt strong" },       // Per-exercise notes
      allDone: true                          // All exercises completed flag
    }
  },
  customPlans: {
    "push": [/* array of exercise objects */]  // Overrides DEFAULT_EXERCISES
  },
  overrides: {
    "2025-01-10": "rest",                    // Direct date override
    "__shifts": [{ "from": "2025-01-11", "by": 1 }],  // Schedule shift markers
    "__processedUpTo": "2025-03-11",         // Idempotency watermark
    "__resumeFrom": "2025-02-01"             // Guard reset point
  }
}
```

### Exercise Object

```javascript
{
  id: "p1",
  name: "Push-Ups",
  type: "bodyweight",           // "dumbbell" | "bodyweight" | "pullup"
  order: 1,
  sets: "4",
  reps: "10-15",
  rest: "90s",
  weightStart: "",              // Starting weight in kg
  weightIncrement: "",          // Weight increment per progression step
  cue: "Slow 3-second descent...",
  progression: "Standard -> Diamond -> Archer...",
  whyOrder: "CNS primer -- activates chest..."
}
```

## Running Tests

The scheduler test suite runs directly with Node.js (no test framework required):

```bash
node src/lib/scheduler.test.js
```

## License

This project does not currently specify a license.
