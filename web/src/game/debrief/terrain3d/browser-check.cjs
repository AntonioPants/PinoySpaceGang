/* Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package, and Vite on 5177. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5177/src/game/debrief/terrain3d/preview.html');
  await page.locator('.tc3d-canvas').waitFor();
  await page.waitForFunction(()=>document.querySelector('.tc3d-scale')?.textContent.includes('m'));
  assert.equal(await page.locator('.tc3d-canvas').count(),1);
  assert.deepEqual(await page.locator('.tc3d-scale').allTextContents(),Array(2).fill(await page.locator('.tc3d-scale').first().textContent()));
  const before=await page.locator('.tc3d-scale').first().textContent();
  const right=await page.locator('.tc3d-pane-1').boundingBox();
  await page.mouse.move(right.x+right.width/2,right.y+right.height/2);await page.mouse.wheel(0,-200);
  await page.waitForFunction(old=>document.querySelector('.tc3d-scale')?.textContent!==old,before);
  assert.equal(await page.locator('.tc3d-scale').first().textContent(),await page.locator('.tc3d-scale').last().textContent());
  await page.mouse.down();await page.mouse.move(right.x+right.width/2+50,right.y+right.height/2+30,{steps:5});await page.mouse.up();
  await page.getByRole('button',{name:'Slope & hazard heatmap'}).click();
  await page.getByRole('button',{name:'Wireframe',exact:true}).click();
  assert((await page.locator('.tc3d-note').first().textContent()).includes('Not vehicle-specific'));
  await page.getByRole('button',{name:'Reset View',exact:true}).click();
  await page.waitForFunction(old=>document.querySelector('.tc3d-scale')?.textContent===old,before);
  await page.screenshot({path:process.env.TERRAIN_SCREENSHOT||'terrain-comparison-check.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>window.terrainPreview.synthetic());
  await page.getByText('Synthesized from catalog DEM stats',{exact:true}).waitFor();
  assert.equal(await page.locator('.tc3d-canvas').count(),1);
  await page.evaluate(()=>window.terrainPreview.unmount());
  await page.waitForFunction(()=>!document.querySelector('.tc3d-canvas'));
  assert.deepEqual(errors,[]);
  console.log('PASS: real DEMs, one canvas, both synchronized scale bars, right-pane zoom/orbit, modes, reset, 390px layout, labelled fallback, StrictMode cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
