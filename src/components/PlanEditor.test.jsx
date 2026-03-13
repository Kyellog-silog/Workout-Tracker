/**
 * PlanEditor — file upload validation tests
 *
 * Covers:
 * 1. Renders without crashing
 * 2. Oversized file (> 500 KB) shows error, does not call FileReader
 * 3. Non-text MIME type shows error, does not call FileReader
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlanEditor from './PlanEditor';

// Supabase is not used by PlanEditor, but guard against any accidental import
vi.mock('../lib/supabase', () => ({}));

describe('PlanEditor — file upload validation', () => {
  const defaultProps = { customPlans: {}, setCustomPlans: vi.fn() };

  it('renders without crashing', () => {
    render(<PlanEditor {...defaultProps} />);
    expect(screen.getByText('IMPORT TEXT')).toBeTruthy();
  });

  it('shows error and does not read an oversized file', () => {
    render(<PlanEditor {...defaultProps} />);

    // Show the import panel
    fireEvent.click(screen.getByText('IMPORT TEXT'));

    const fileInput = document.querySelector('input[type="file"]');
    // Mock a file object that is 513 KB (> 500 KB limit)
    const bigFile = { name: 'big.txt', type: 'text/plain', size: 513 * 1024 };
    Object.defineProperty(fileInput, 'files', { value: [bigFile], configurable: true });

    const readSpy = vi.spyOn(FileReader.prototype, 'readAsText');
    fireEvent.change(fileInput);

    expect(readSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/max 500 KB/i)).toBeTruthy();

    readSpy.mockRestore();
  });

  it('shows error and does not read a non-text file', () => {
    render(<PlanEditor {...defaultProps} />);

    // Show the import panel
    fireEvent.click(screen.getByText('IMPORT TEXT'));

    const fileInput = document.querySelector('input[type="file"]');
    const pdfFile = { name: 'plan.pdf', type: 'application/pdf', size: 1024 };
    Object.defineProperty(fileInput, 'files', { value: [pdfFile], configurable: true });

    const readSpy = vi.spyOn(FileReader.prototype, 'readAsText');
    fireEvent.change(fileInput);

    expect(readSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/plain text/i)).toBeTruthy();

    readSpy.mockRestore();
  });
});
