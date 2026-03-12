/**
 * useLocalStorage hook.
 *
 * A generic React hook for persisting state in the browser's localStorage.
 * Values are JSON-serialised on write and parsed on read. Supports both
 * direct values and updater functions (like useState).
 *
 * @param {string} key - The localStorage key.
 * @param {*} initialValue - Default value if the key does not exist.
 * @returns {[*, Function]} A stateful value and a setter function.
 */
import { useState, useEffect } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}
