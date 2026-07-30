import puppeteer from 'puppeteer-core';

async function capture() {
  console.log("🚀 Launching Chrome to render the new landing page...");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    defaultViewport: { width: 1440, height: 1800 }, // Tall viewport to see hero + safety section
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    const filePath = "file:///C:/Users/noutp/.gemini/antigravity/scratch/replyvera/index.html";
    
    console.log(`🌐 Opening HTML template: ${filePath}...`);
    await page.goto(filePath, { waitUntil: 'networkidle0' });
    
    const screenshotPath = "C:\\Users\\noutp\\.gemini\\antigravity\\brain\\4a331f81-6c15-4593-b466-8c272f51f71e\\replyvera_new_landing_page.png";
    console.log(`📸 Capturing high-resolution landing page...`);
    await page.screenshot({ path: screenshotPath });
    
    console.log(`✅ Success! Landing page saved at ${screenshotPath}`);
  } catch (err) {
    console.error("❌ Capture Error:", err.message);
  } finally {
    await browser.close();
    console.log("🔌 Browser closed.");
  }
}

capture();
