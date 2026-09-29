import { defineConfig } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api=Number(process.env.OMAN_E2E_API_PORT);const client=Number(process.env.OMAN_E2E_CLIENT_PORT);
export default defineConfig({
 expect:{timeout:15_000},
 testDir:'../tests/e2e',testMatch:'odd-manager-t046-i01.spec.ts',workers:1,retries:0,
 outputDir:process.env.OMAN_T046_BROWSER_ARTIFACTS,
 use:{baseURL:`http://127.0.0.1:${client}`,viewport:{width:1600,height:1100},screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:[
  {cwd,command:'node src/server/index.mjs',url:`http://127.0.0.1:${api}/api/health`,timeout:60_000,reuseExistingServer:false,env:{OMAN_API_PORT:String(api),OMAN_MANAGER_STATE_ROOT:process.env.OMAN_E2E_STATE_ROOT!}},
  {cwd,command:`npx vite preview --host 127.0.0.1 --port ${client}`,url:`http://127.0.0.1:${client}`,timeout:60_000,reuseExistingServer:false,env:{OMAN_API_TARGET:`http://127.0.0.1:${api}`}},
 ],
});
