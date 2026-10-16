#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { parseArgs } = require('node:util');

// Non-strict like the minimist parser it replaces: existing build scripts may
// pass flags this CLI never read.
const { values } = parseArgs({
  options: {
    destination: { type: 'string' }
  },
  strict: false
});

// parseArgs ignores `default` before Node 18.11, so the fallback lives here.
const destination =
  typeof values.destination === 'string'
    ? values.destination
    : './public/meta.json';
const filename = path.basename(destination);

try {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify({ version: randomUUID() }));
  console.log(`${filename} file has been saved with latest version number`);
} catch (error) {
  console.error(`An error occurred while writing JSON Object to ${filename}`);
  console.error(error);
  process.exitCode = 1;
}
