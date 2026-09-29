import { expect, test } from '@playwright/test';
import { T046_MANIFEST } from '../../qualification/t046-frozen-subjects.mjs';
const root = process.env.OMAN_T046_OBSERVATION_ROOT;
if (!root) throw new Error('OMAN_T046_OBSERVATION_ROOT must name the registered frozen observation Project');

test('T046 installed inspector selects exact retained Runs, preserves status, pages and restores lazy call detail', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[]=[];page.on('pageerror',error=>pageErrors.push(error.message));
  const responses: Array<{ url: string; bytes: number }>=[];
  page.on('response', async response=>{if(response.url().includes('/api/ai-workspace/run')){const text=await response.text().catch(()=> '');responses.push({url:response.url(),bytes:Buffer.byteLength(text)});}});
  await page.goto('/');
  const registration=await page.request.post('/api/projects/register',{data:{root,setActive:true}});expect(registration.ok(),await registration.text()).toBe(true);
  await page.goto(`/?project=${encodeURIComponent(root!)}`);
  await page.getByRole('button',{name:'Open Run Inspector'}).click();
  const flyout=page.getByRole('complementary',{name:'Sidecar selection flyout'});if(await flyout.isVisible())await flyout.getByRole('button',{name:'Close selection flyout'}).click();
  const shell=page.getByRole('button',{name:'Minimize shell workspace'});if(await shell.isVisible())await shell.click();
  const run=page.locator('.sidecar-run');const select=run.getByRole('combobox',{name:'Select observed run'});
  await expect(select).toBeVisible({timeout:45_000});
  if(await flyout.isVisible())await flyout.getByRole('button',{name:'Close selection flyout'}).click();
  for (const key of ['s6-live05','s7-source','s7-fresh']) {
    const subject=T046_MANIFEST.subjects.find((s: {key: string})=>s.key===key)!;
    await select.selectOption(subject.run.ref);
    await expect(run.getByRole('heading',{name:key,exact:true})).toBeVisible({timeout:45_000});
    if(await flyout.isVisible())await flyout.getByRole('button',{name:'Close selection flyout'}).click();
    await run.getByRole('button',{name:'Overview',exact:true}).click();
    await expect(run).toContainText(`Run ${subject.status}`);await expect(run).toContainText('Retained observation');
    await expect(run).toContainText('Process postureunavailable');await expect(run).toContainText(`Physical ledger records${subject.physicalRecordCount}`);
    await expect(run).toContainText(`Status as of ordinal${subject.physicalRecordCount}`);
    await expect(run).not.toContainText('terminal converged');
    await expect(run).toContainText('Traversal counters unavailable');
    await expect(run).not.toContainText('0 vectors · 0 attempts');
    if(key!=='s6-live05')await page.screenshot({path:testInfo.outputPath(`${key}-status.png`),fullPage:true});
    await run.getByRole('button',{name:'Events',exact:true}).click();
    const section=run.locator('.sidecar-run__section');await expect(section.locator('tbody tr')).toHaveCount(40);
    const firstRow=section.locator('tbody tr').filter({hasText:'c_call_opened'}).first();
    await expect(firstRow).toBeVisible();await firstRow.getByRole('button').first().click();
    await expect(section).toContainText('payloadDigest');await expect(section).toContainText('cCallRef');
    await expect(section.locator('.sidecar-run__event-detail summary')).toBeVisible();
    await section.locator('.sidecar-run__event-detail summary').scrollIntoViewIfNeeded();
    if(key==='s7-fresh')await page.screenshot({path:testInfo.outputPath('s7-fresh-call-detail.png'),fullPage:true});
    await section.getByRole('button',{name:'Next',exact:true}).click();await expect(section).toContainText('41–80');
  }
  expect(pageErrors).toEqual([]);expect(responses.length).toBeGreaterThan(3);
  for(const route of ['/api/ai-workspace/run?', '/api/ai-workspace/run/events?', '/api/ai-workspace/run/event?']) expect(responses.some(r=>r.url.includes(route)),`missing observed API family ${route}`).toBe(true);
  expect(responses.every(r=>r.bytes<2_000_000),JSON.stringify(responses)).toBe(true);
  await testInfo.attach('bounded-observation-responses',{body:JSON.stringify(responses,null,2),contentType:'application/json'});
});
