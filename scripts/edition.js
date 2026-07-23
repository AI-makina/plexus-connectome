#!/usr/bin/env node
// Bakes the build edition into edition.json at the app root.
//   node scripts/edition.js operator   (default — Carlos's own build)
//   node scripts/edition.js user       (customer artifact: no operator surface)
// The packager additionally prunes dist/managerPage.js from user artifacts so
// the operator code physically isn't in what customers download.
const fs = require('fs');
const path = require('path');

const edition = process.argv[2] === 'user' ? 'user' : 'operator';
const file = path.join(__dirname, '..', 'edition.json');
fs.writeFileSync(file, JSON.stringify({ edition }, null, 2) + '\n');
console.log(`edition: ${edition}`);
