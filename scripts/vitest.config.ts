import { defineProject } from 'vitest/config';

export default defineProject({ test: { name: 'scripts', testTimeout: 300_000 } });
