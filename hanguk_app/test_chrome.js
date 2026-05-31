const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Listen for console logs
  page.on('console', msg => {
    console.log(`PAGE LOG: ${msg.type().toUpperCase()} - ${msg.text()}`);
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.log(`PAGE ERROR: ${error.message}`);
  });

  page.on('response', response => {
    if (!response.ok() && response.url().includes('vapi')) {
      console.log(`FAILED RESPONSE: ${response.url()} ${response.status()}`);
    }
  });

  try {
    console.log('Navigating to http://localhost:8080 ...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
    console.log('Navigation complete. Waiting 10 seconds for initial logs...');
    // We expect the app to execute tests automatically since it's `flutter run test/vapi_test.dart`
    // Or if the user meant to test the *main app*, we need to click around!
    // But Vapi tests are running at localhost:8080.
    await new Promise(r => setTimeout(r, 10000));
  } catch (err) {
    console.error(`Error during navigation: ${err}`);
  } finally {
    await browser.close();
  }
})();
