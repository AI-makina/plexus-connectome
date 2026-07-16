// Build stamp — runs after tsc (npm run build). Each build is a distinct release:
//   · bumps package.json patch (1.0.0 → 1.0.1 → …) so the version accurately IDs the
//     build a connectome is running,
//   · writes dist/BUILD_ID (monotonic timestamp) for update detection.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const parts = String(pkg.version || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);
parts[2] += 1; // patch bump per build
pkg.version = parts.join('.');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

try { fs.writeFileSync(path.join(root, 'dist', 'BUILD_ID'), Date.now().toString()); } catch { /* dist not built */ }

console.log('stamped v' + pkg.version);
