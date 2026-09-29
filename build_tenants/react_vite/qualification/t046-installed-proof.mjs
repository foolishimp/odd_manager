import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyT046Subjects, resolveT046EvidenceRoot, T046_MANIFEST } from './t046-frozen-subjects.mjs';
const tenant=resolve(dirname(fileURLToPath(import.meta.url)),'..');const repo=resolve(tenant,'../..');
const proof=mkdtempSync('/private/tmp/odd-manager-t046-installed-');const installed=join(proof,'repository');const installedTenant=join(installed,'build_tenants/react_vite');
const hash=b=>createHash('sha256').update(b).digest('hex');
const excludedPrefixes=['build_tenants/react_vite/qualification/t046-i01-evidence/'];
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:repo,encoding:'utf8'}).split('\0').filter(path=>path && !excludedPrefixes.some(prefix=>path.startsWith(prefix))).sort();
const members=[];
for(const path of paths){const from=join(repo,path);if(!existsSync(from))continue;const to=join(installed,path);mkdirSync(dirname(to),{recursive:true});const st=lstatSync(from);if(st.isSymbolicLink()){const target=readlinkSync(from);symlinkSync(target,to);members.push({path,kind:'symlink',target});}else{assert.ok(st.isFile());copyFileSync(from,to);chmodSync(to,st.mode&0o777);const bytes=readFileSync(from);members.push({path,sha256:hash(bytes),bytes:bytes.length,mode:st.mode&0o111});}}
const candidateDigest=hash(JSON.stringify(members));writeFileSync(join(proof,'candidate-manifest.json'),JSON.stringify({candidateDigest,excludedPrefixes,members},null,2)+'\n');
const frozen=copyT046Subjects(join(proof,'observation-project'));
writeFileSync(join(proof,'frozen-subjects.json'),JSON.stringify(T046_MANIFEST,null,2)+'\n');
const env={...process.env,OMAN_T046_EVIDENCE_ROOT:resolveT046EvidenceRoot()};delete env.NODE_TEST_CONTEXT;
function run(command,args){const result=spawnSync(command,args,{cwd:installedTenant,env,encoding:'utf8',maxBuffer:64*1024*1024});writeFileSync(join(proof,`${command}-${args[0].replaceAll(':','-')}.log`),result.stdout+result.stderr);assert.equal(result.status,0,`${command} ${args.join(' ')} failed: ${result.stdout.slice(-3000)} ${result.stderr.slice(-3000)}`);}
async function port(){const s=createServer();await new Promise((yes,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',yes);});const p=s.address().port;await new Promise(yes=>s.close(yes));return p;}
console.log(`T046 installed proof: ${proof}`);
try {
 run('npm',['ci','--no-audit','--no-fund']);run('npm',['run','contracts:build']);run('npx',['tsc','--noEmit']);run('node',['--test','runtime/tests/test_t046_current_run_observation.mjs','runtime/tests/test_abg_event_carrier.mjs','runtime/tests/test_abg_run_observation.mjs','runtime/tests/test_sidecar_msg_replay.mjs']);run('npm',['run','build']);
 env.OMAN_E2E_API_PORT=String(await port());env.OMAN_E2E_CLIENT_PORT=String(await port());env.OMAN_E2E_STATE_ROOT=join(proof,'manager-state');env.OMAN_T046_OBSERVATION_ROOT=frozen.projectRoot;env.OMAN_T046_BROWSER_ARTIFACTS=join(proof,'browser');
 const r=spawnSync('npx',['playwright','test','--config','qualification/t046-playwright.config.ts','--reporter=json'],{cwd:installedTenant,env,encoding:'utf8',maxBuffer:64*1024*1024});writeFileSync(join(proof,'browser-report.json'),r.stdout);writeFileSync(join(proof,'browser-stderr.log'),r.stderr);assert.equal(r.status,0,r.stdout.slice(-5000)+r.stderr.slice(-1000));const report=JSON.parse(r.stdout);assert.equal(report.stats.expected,1);assert.equal(report.stats.skipped,0);assert.equal(report.stats.flaky,0);assert.equal(report.stats.unexpected,0);
 writeFileSync(join(proof,'result.json'),JSON.stringify({kind:'t046_i01_installed_proof',status:'passed',candidateDigest,candidateMembers:members.length,methodBasis:'stdo://releases/v2.5.1-rc.1/',manifestSha256:'5d306da13994e69aa9f215d4c1cd2d0be96283c1e33a652b58e6e9262d036b64',subjects:T046_MANIFEST.subjects.map(s=>({key:s.key,run:s.run,status:s.status,physicalRecordCount:s.physicalRecordCount})),browser:report.stats},null,2)+'\n');
 const durable=join(tenant,'qualification/t046-i01-evidence');mkdirSync(durable,{recursive:true});
 for(const file of ['candidate-manifest.json','frozen-subjects.json','result.json','browser-report.json','browser-stderr.log','node---test.log','npx-tsc.log','npm-run.log','npm-ci.log'])copyFileSync(join(proof,file),join(durable,file));
 cpSync(join(proof,'browser'),join(durable,'browser'),{recursive:true});
 console.log(`PASS ${candidateDigest} (${members.length} candidate files). Evidence retained at ${proof}`);
} catch(error){console.error(`FAIL; evidence retained at ${proof}`);throw error;}
