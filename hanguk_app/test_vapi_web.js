const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--use-fake-ui-for-media-stream'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  page.on('requestfailed', request => console.log('REQUEST_FAILED:', request.url(), request.failure().errorText));

  try {
    await page.goto('http://127.0.0.1:8085', { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Page loaded. Waiting for Flutter App to boot...');
    await new Promise(r => setTimeout(r, 10000));
    
    // We are inside auth layer or main view. We don't have auth bypass easily in a blackbox Puppeteer script.
    // Instead of clicking through, let's just observe if the initial load throws Vapi load errors.
  } catch (e) {
    console.error('Fetch error:', e);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
