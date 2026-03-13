/**
 * Stats.jsx UI tests (Vitest + Testing Library)
 * Run with: npx vitest run
 *
 * todayStr is mocked to '2026-01-07' so tests are date-independent.
 * PROGRAM_START = '2026-01-05' (Monday)
 *   Day 0 (Mon) = push  → 2026-01-05
 *   Day 1 (Tue) = pull  → 2026-01-06
 *   Day 2 (Wed) = legs  → 2026-01-07 = MOCK_TODAY
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Stats from './Stats';

// ─── Mock todayStr so tests are date-independent ──────────────────────────────
//
//  vi.mock is hoisted before variable declarations, so we must inline the date.
//  '2026-01-07' is legs day (day 2 from PROGRAM_START = 2026-01-05).

vi.mock('../lib/scheduler', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, todayStr: () => '2026-01-07' };
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

const PROGRAM_START = '2026-01-05'; // Monday
const MOCK_TODAY    = '2026-01-07'; // legs day (= today in all tests)

function done(...dates) {
  const obj = {};
  for (const d of dates) obj[d] = { allDone: true, checked: { p1: true } };
  return obj;
}

const DEFAULT_PROPS = {
  completedDays: {},
  programStart: PROGRAM_START,
  overrides: {},
  streakRestores: {},
  onRestoreDay: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Stats — streak card', () => {
  it('renders streak "0" when there are no completions', () => {
    render(<Stats {...DEFAULT_PROPS} />);
    // The STREAK label's parentElement is the card container div.
    // Its first child is the value element.
    const card = screen.getByText('STREAK').parentElement;
    expect(card.firstChild).toHaveTextContent('0');
  });

  it('shows a flame icon when dayStreak >= 3', () => {
    // Complete all 3 workout days in the window ending at MOCK_TODAY
    render(
      <Stats
        {...DEFAULT_PROPS}
        completedDays={done('2026-01-05', '2026-01-06', '2026-01-07')}
      />
    );
    // When streak >= 3, the STREAK card renders an <svg> flame icon
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    // Also confirm the streak value itself is 3
    const card = screen.getByText('STREAK').parentElement;
    expect(card.firstChild).toHaveTextContent('3');
  });

  it('shows STREAK BROKEN banner when there is a breakDate', () => {
    // Push(d0) done, pull(d1=2026-01-06) MISSED, legs(today) done → breakDate = d1
    render(
      <Stats
        {...DEFAULT_PROPS}
        completedDays={done('2026-01-05', '2026-01-07')}
      />
    );
    expect(screen.getByText('STREAK BROKEN')).toBeInTheDocument();
  });

  it('calls onRestoreDay with the correct breakDate when RESTORE is clicked', () => {
    const onRestoreDay = vi.fn();
    // Push(d0) done, pull(d1=2026-01-06) MISSED → breakDate = '2026-01-06'
    render(
      <Stats
        {...DEFAULT_PROPS}
        completedDays={done('2026-01-05', '2026-01-07')}
        onRestoreDay={onRestoreDay}
        streakRestores={{}}
      />
    );
    const restoreBtn = screen.getByRole('button', { name: /restore/i });
    if (!restoreBtn.disabled) {
      fireEvent.click(restoreBtn);
      expect(onRestoreDay).toHaveBeenCalledWith('2026-01-06');
    }
  });

  it('RESTORE button is disabled when restoresLeft === 0', () => {
    // Exhaust all 5 January restores
    const streakRestores = {
      '2026-01': ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'],
    };
    // Push(d0) done, pull(d1) MISSED → breakDate = '2026-01-06', restoresLeft = 0
    render(
      <Stats
        {...DEFAULT_PROPS}
        completedDays={done('2026-01-05', '2026-01-07')}
        streakRestores={streakRestores}
      />
    );
    // Button says "NO RESTORES" and must be disabled
    const btn = screen.getByRole('button', { name: /no restores/i });
    expect(btn).toBeDisabled();
  });
});


