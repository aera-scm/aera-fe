import '@testing-library/jest-dom/vitest';

import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 5000 });

// jsdom has no layout/scroll implementation; Playwright verifies real scrolling.
window.scrollTo = () => {};
