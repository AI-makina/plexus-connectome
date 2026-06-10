// Capture UI states for visual QA: overview, node-selected (via search), simulation result.
// Usage: node scripts/screenshot.js <url> <outDir>
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '../ui/node_modules/puppeteer-core'));

const url = process.argv[2] || 'http://localhost:3401';
const outDir = process.argv[3] || '/tmp/plexus-shots';

(async () => {
    fs.mkdirSync(outDir, { recursive: true });
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        userDataDir: fs.mkdtempSync('/tmp/plexus-shot-profile-'),
        args: ['--window-size=1600,1000', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--force-color-profile=srgb',
            '--no-first-run', '--no-default-browser-check', '--disable-features=Translate'],
        defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 },
    });
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR:', e.message));
    page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE_ERROR:', m.text().slice(0, 300)); });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const canvas = await page.waitForSelector('canvas', { timeout: 20000 }).catch(() => null);
    if (!canvas) console.log('WARN: no canvas found');
    await new Promise(r => setTimeout(r, 7000)); // let the force layout settle

    await page.screenshot({ path: path.join(outDir, '01-overview.png') });

    const input = await page.$('input');
    if (input) {
        await input.click();
        await input.type('server', { delay: 30 });
        await new Promise(r => setTimeout(r, 1200));
        await page.screenshot({ path: path.join(outDir, '02-search.png') });

        // New UI: Enter selects the first dropdown result; old UI: typing already auto-selected.
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 1800));
        await page.screenshot({ path: path.join(outDir, '03-node-selected.png') });

        const clicked = await page.evaluate(() => {
            const btn = [...document.querySelectorAll('button')]
                .find(b => /simulat/i.test(b.textContent || ''));
            if (btn) { btn.click(); return true; }
            return false;
        });
        if (clicked) {
            await new Promise(r => setTimeout(r, 3500));
            await page.screenshot({ path: path.join(outDir, '04-simulation.png') });
        } else {
            console.log('WARN: Simulate button not found');
        }
    }

    await browser.close();
    console.log('DONE:', fs.readdirSync(outDir).join(', '));
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
