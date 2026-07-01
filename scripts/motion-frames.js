// Capture timed frame sequences to verify animation (impulses, breathing).
// Usage: node scripts/motion-frames.js <url> <outDir>
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '../ui/node_modules/puppeteer-core'));

const url = process.argv[2] || 'http://localhost:3401';
const outDir = process.argv[3] || '/tmp/plexus-motion';

(async () => {
    fs.mkdirSync(outDir, { recursive: true });
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        userDataDir: fs.mkdtempSync('/tmp/plexus-motion-profile-'),
        args: ['--window-size=1600,1000', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--force-color-profile=srgb',
            '--no-first-run', '--no-default-browser-check'],
        defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 },
    });
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE_ERROR:', m.text().slice(0, 250)); });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 8000)); // layout settle + bloom mount (60 frames)

    // Overview: 4 frames, 600ms apart — impulses should visibly change position
    for (let i = 0; i < 4; i++) {
        await page.screenshot({ path: path.join(outDir, `overview-t${i}.png`) });
        await new Promise(r => setTimeout(r, 600));
    }

    // Selected state: impulses should concentrate on the lit circuit
    const input = await page.$('input');
    if (input) {
        await input.click();
        await input.type('server', { delay: 30 });
        await new Promise(r => setTimeout(r, 900));
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2500));
        for (let i = 0; i < 2; i++) {
            await page.screenshot({ path: path.join(outDir, `selected-t${i}.png`) });
            await new Promise(r => setTimeout(r, 700));
        }
    }

    await browser.close();
    console.log('DONE:', fs.readdirSync(outDir).join(', '));
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
