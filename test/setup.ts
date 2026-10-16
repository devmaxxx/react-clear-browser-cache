import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

// Server-rendering tests run in the node environment, without a DOM.
if (typeof window !== 'undefined') {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
}
