import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { indexAbgEventCarrier, scopeAbgEventCarrier, pageAbgEventCarrier, detailAbgEventCarrier } from '../../src/server/abg-event-carrier-service.mjs';
import { discoverProjectObservationTopology } from '../../src/server/project-observation-topology-service.mjs';
import { loadAbgRunObservation, loadAbgRunEventDetail, loadAbgRunEventPage } from '../../src/server/abg-run-observation-service.mjs';
import { resolveT046Subjects } from '../../qualification/t046-frozen-subjects.mjs';
import { classifyRetainedRunReplayResult } from '../../src/server/retained-run-observation-service.mjs';
const subjects = resolveT046Subjects();
const fresh = subjects.find((s) => s.key === 's7-fresh');
const source = subjects.find((s) => s.key === 's7-source');
const c = (v) => Array.isArray(v) ? `[${v.map(c).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${c(v[k])}`).join(',')}}` : JSON.stringify(v);
const sha = (v) => `sha256:${createHash('sha256').update(c(v)).digest('hex')}`;
function signed(event) { const { eventId, ...body } = event; body.payloadDigest = sha(body.payload); return { ...body, eventId: `event://abiogenesis/${sha(body).slice(7)}` }; }
function temp(t) { const root = mkdtempSync('/private/tmp/odd-manager-t046-test-');t.after(()=>rmSync(root,{recursive:true,force:true}));return root; }
function records(subject) { return readFileSync(join(subject.path, 'events.jsonl'),'utf8').trimEnd().split('\n').map(JSON.parse); }
function writeRecords(root, rows) { const p=join(root,'events.jsonl');writeFileSync(p,rows.map(c).join('\n')+'\n');return p; }
function publishedRead(subject) { return JSON.parse(readFileSync(join(subject.path, 'read-run_replay.json'))); }
function readValue(subject) { return publishedRead(subject).output.receipt.ownerOutput.value; }
function copyWithRead(t, subject, mutate) {
 const root=temp(t);for(const f of subject.files)copyFileSync(join(subject.path,f.name),join(root,f.name));
 const receipt=publishedRead(subject);mutate(receipt.output.receipt.ownerOutput.value);
 writeFileSync(join(root,'read-run_replay.json'),JSON.stringify(receipt));return root;
}
const ingressSource=readFileSync(new URL('../../src/features/sidecar/abg-run-observation-validation.ts',import.meta.url),'utf8');
const ingressCode=ts.transpileModule(ingressSource,{compilerOptions:{module:ts.ModuleKind.ES2020,target:ts.ScriptTarget.ES2022}}).outputText;
const { asAbgRunObservation }=await import(`data:text/javascript;base64,${Buffer.from(ingressCode).toString('base64')}`);

test('frozen S6 and S7 published carriers bind exact profile, physical prefix, per-Run status and lazy calls',()=>{
 for(const subject of subjects){
  const topology=discoverProjectObservationTopology(subject.path,{refresh:true});
  const run=topology.runs.find(r=>r.runId===subject.run.ref);
  assert.ok(run,JSON.stringify(topology.diagnostics));assert.equal(run.runDigest,subject.run.digest);
  const observation=loadAbgRunObservation(subject.path,{runId:run.runId});
  assert.equal(observation.activity.semanticVectorCount,null);assert.equal(observation.activity.vectorAttemptCount,null);assert.equal(observation.activity.retryCount,null);assert.equal(observation.activity.continuationCount,null);
  assert.equal(observation.state,'ready');assert.equal(observation.runtimeState.status,subject.status);
  assert.equal(observation.processPosture,'unavailable');assert.equal(observation.carrierSnapshot.physicalRecordCount,subject.physicalRecordCount);
  assert.equal(observation.carrierSnapshot.storageReferenceCount,subject.storageReferenceCount);
  assert.equal(observation.runtimeState.coverage,'exact_retained_prefix');assert.equal(observation.runtimeState.asOfOrdinal,subject.physicalRecordCount);
  assert.equal(observation.eventPosture,subject.status==='closed'?'run_closed':'non_terminal');
  assert.ok(JSON.stringify(observation).length<200000);assert.equal(observation.eventPage.rows.length,40);
  const call=observation.eventPage.rows.find(e=>e.cCallRef);assert.ok(call);
  const detail=loadAbgRunEventDetail(subject.path,{runId:run.runId,generation:observation.carrierSnapshot.generation,ordinal:call.ordinal});
  assert.equal(detail.ok,true);assert.equal(detail.detail.value.eventId,call.eventId);assert.equal(detail.detail.value.runId,run.runId);
 }
});

test('shared ledger source selection retains dependencies and cannot inherit fresh closure or cursors',()=>{
 const t=discoverProjectObservationTopology(fresh.path,{refresh:true});assert.equal(t.runs.length,2);
 const old=loadAbgRunObservation(fresh.path,{runId:source.run.ref});const next=loadAbgRunObservation(fresh.path,{runId:fresh.run.ref});
 assert.equal(old.eventPosture,'non_terminal');assert.equal(old.runtimeState.status,null);assert.equal(old.runtimeState.coverage,'unavailable');
 assert.equal(next.runtimeState.status,'closed');assert.equal(next.carrierSnapshot.ledgerEventCount,4485);
 assert.ok(next.carrierSnapshot.dependencyEventCount>0);assert.notEqual(old.carrierSnapshot.generation,next.carrierSnapshot.generation);
 assert.equal(loadAbgRunEventPage(fresh.path,{runId:source.run.ref,generation:next.carrierSnapshot.generation}).code,'stale_event_generation');
 assert.equal(loadAbgRunEventDetail(fresh.path,{runId:fresh.run.ref,generation:next.carrierSnapshot.generation,ordinal:20}).code,'event_missing');
 const index=indexAbgEventCarrier(join(fresh.path,'events.jsonl'));const scoped=scopeAbgEventCarrier(index,fresh.run.ref);
 assert.ok(scoped.dependencyEvents.some(e=>e.runId===source.run.ref));
 for(const event of scoped.compactEvents)assert.equal(event.runId,fresh.run.ref);
});

for(const [label,mutate] of [
 ['unknown stamp',r=>{r[0]=signed({...r[0],eventContractDigest:`sha256:${'f'.repeat(64)}`});}],
 ['mixed stamp',r=>{const e={...r[1]};delete e.eventContractDigest;r[1]=signed(e);}],
 ['unresolved reference',r=>{r.find(e=>e.bodyReference).bodyReference.sourceEventRef='event://missing';}],
 ['body digest mismatch',r=>{r.find(e=>e.bodyReference).bodyReference.bodyDigest=`sha256:${'f'.repeat(64)}`;}],
 ['reference chain',r=>{const refs=r.filter(e=>e.bodyReference);refs[1].bodyReference.sourceEventRef=refs[0].event.eventId;refs[1].bodyReference.sourcePayloadDigest=refs[0].event.payloadDigest;}],
]) test(`${label} fails closed before semantic projection`,t=>{const r=records(source).slice(0,80);mutate(r);const i=indexAbgEventCarrier(writeRecords(temp(t),r));assert.equal(i.state,'invalid');});

test('child terminal evidence cannot close the selected Run; append invalidates exact detail',t=>{
 const rows=records(fresh);const path=writeRecords(temp(t),rows.slice(0,-1));const i=indexAbgEventCarrier(path);
 assert.equal(i.state,'ready');assert.equal(scopeAbgEventCarrier(i,fresh.run.ref).eventPosture,'non_terminal');
 assert.ok(i.compactEvents.some(e=>e.kind==='terminal_reached'));
 const scoped=scopeAbgEventCarrier(i,fresh.run.ref);appendFileSync(path,c(rows.at(-1))+'\n');
 assert.equal(detailAbgEventCarrier(scoped,{generation:scoped.generation,ordinal:scoped.firstOrdinal}).code,'stale_event_generation');
 const newer=scopeAbgEventCarrier(indexAbgEventCarrier(path),fresh.run.ref);assert.equal(newer.eventPosture,'run_closed');assert.notEqual(newer.generation,scoped.generation);
 assert.equal(pageAbgEventCarrier(newer,{generation:scoped.generation}).code,'stale_event_generation');
});

test('body reference detail limit applies after logical restoration',t=>{
 const r=records(source);const originalRef=r.find(e=>e.bodyReference);const bodyIndex=r.findIndex(e=>e.eventId===originalRef.bodyReference.sourceEventRef);
 const prior=r.slice(0,bodyIndex+1);const field='rawInputValue';const big={padding:'x'.repeat(1100000)};
 const changed=structuredClone(prior.at(-1));changed.payload[field]=big;changed.payload.rawInputDigest=sha(big);prior[prior.length-1]=signed(changed);
 const e=structuredClone(originalRef.event);e.admissionOrdinal=prior.length+1;e.causationEventRefs=[];e.payload.value=big;e.payload.valueDigest=sha(big);const logical=signed(e);const stored=structuredClone(logical);delete stored.payload.value;
 prior.push({kind:'abg_admitted_body_reference_record',codecVersion:1,event:stored,bodyReference:{sourceEventRef:prior.at(-1).eventId,sourcePayloadDigest:prior.at(-1).payloadDigest,sourceSlot:'basis_input',bodyDigest:sha(big)}});
 const i=indexAbgEventCarrier(writeRecords(temp(t),prior));assert.equal(i.state,'ready',JSON.stringify(i.diagnostics));
 const detail=detailAbgEventCarrier(i,{ordinal:logical.admissionOrdinal});assert.equal(detail.ok,true);assert.equal(detail.detail.truncated,true);assert.equal(detail.detail.value,null);assert.ok(detail.detail.sourceByteLength<5000);
});

for(const [label,change] of [
 ['Run source digest',v=>{v.output.receipt.ownerOutput.value.source.digest=`sha256:${'0'.repeat(64)}`;}],
 ['prefix coordinate',v=>{v.output.receipt.ownerOutput.value.projectionBasis.digest=`sha256:${'0'.repeat(64)}`;}],
]) test(`tampered ${label} cannot supply a canonical status`,t=>{
 const root=temp(t);for(const f of source.files)copyFileSync(join(source.path,f.name),join(root,f.name));
 const path=join(root,'read-run_replay.json');const value=JSON.parse(readFileSync(path));change(value);writeFileSync(path,JSON.stringify(value));
 const topology=discoverProjectObservationTopology(root,{refresh:true});assert.equal(topology.runs.length,0);assert.ok(topology.diagnostics.some(d=>d.code==='retained_run_binding_invalid'));
});

test('published receipt discovery survives archive relocation and neutral filenames',t=>{
 const root=temp(t);for(const f of source.files)copyFileSync(join(source.path,f.name),join(root, f.name==='execution.json'?'published-invocation.json':f.name==='read-run_replay.json'?'published-read.json':f.name==='events.jsonl'?'ledger.jsonl':f.name));
 const topology=discoverProjectObservationTopology(root,{refresh:true});assert.equal(topology.runs.length,1,JSON.stringify(topology.diagnostics));const run=topology.runs[0];assert.equal(run.runId,source.run.ref);assert.notEqual(run.retainedObservation.originalCoordinate.eventLogRef,run.eventPath);assert.equal(run.runtimeState.status,'blocked');
});

test('a valid child failure observation is not Run failure or closure',t=>{
 const r=records(source).slice(0,40);const frame=r.find(e=>e.kind==='frame_opened');
 const failure=signed({...frame,kind:'runtime_failure_observed',admissionOrdinal:r.length+1,eventTime:r.at(-1).eventTime,causationEventRefs:[frame.eventId],payload:{failureClass:'operator',code:'fixture_child_failure',subjectDigest:`sha256:${'a'.repeat(64)}`,cCallRef:'c-call:sha256:'+ 'b'.repeat(64)}});
 r.push(failure);const i=indexAbgEventCarrier(writeRecords(temp(t),r));assert.equal(i.state,'ready',JSON.stringify(i.diagnostics));assert.equal(scopeAbgEventCarrier(i,source.run.ref).eventPosture,'non_terminal');
});

test('cross-Run body provenance is legal while causal Run crossing is rejected',t=>{
 const r=records(fresh);const old=r.find(e=>e.runId===source.run.ref);const last=r.at(-1);r[r.length-1]=signed({...last,causationEventRefs:[old.eventId]});
 const i=indexAbgEventCarrier(writeRecords(temp(t),r));assert.equal(i.state,'invalid');assert.match(i.diagnostics.at(-1).message,/crosses run scope/);
});

test('an append after cached topology admission cannot relabel the retained status as current',t=>{
 const root=temp(t);for(const f of source.files)copyFileSync(join(source.path,f.name),join(root,f.name));
 const old=loadAbgRunObservation(root,{runId:source.run.ref,refresh:true});assert.equal(old.runtimeState.status,'blocked');
 const suffix=readFileSync(join(fresh.path,'events.jsonl')).subarray(readFileSync(join(source.path,'events.jsonl')).length);appendFileSync(join(root,'events.jsonl'),suffix);
 assert.equal(loadAbgRunObservation(root,{runId:source.run.ref}).state,'error');
 assert.equal(loadAbgRunEventPage(root,{runId:source.run.ref,generation:old.carrierSnapshot.generation}).code,'stale_event_generation');
});

for (const [label, causeScope, candidateScope, admitted] of [
 ['workspace to workspace', 'workspace', 'workspace', true],
 ['workspace to Run', 'workspace', 'run', true],
 ['Run to same Run', 'run', 'run', true],
 ['Run to workspace', 'run', 'workspace', false],
 ['Run to a different Run', 'run', 'different_run', false],
]) test(`stamped causal direction ${label} is ${admitted ? 'admitted' : 'rejected'}`,t=>{
 const rows=records(source).slice(0,40);
 const workspace=rows.find(e=>e.scopeClass==='workspace');const run=rows.find(e=>e.kind==='frame_opened');
 assert.ok(workspace);assert.ok(run);
 const candidate=structuredClone(candidateScope==='workspace'?workspace:run);
 if(candidateScope==='different_run')candidate.runId=fresh.run.ref;
 const cause=causeScope==='workspace'?workspace:run;
 rows.push(signed({...candidate,admissionOrdinal:41,eventTime:rows.at(-1).eventTime,causationEventRefs:[cause.eventId]}));
 const index=indexAbgEventCarrier(writeRecords(temp(t),rows));
 assert.equal(index.state,admitted?'ready':'invalid',JSON.stringify(index.diagnostics));
 if(!admitted)assert.match(index.diagnostics.at(-1).message,/causation crosses run scope/);
});

test('Run replay base branch conserves the frozen nine-status schema without interpreting liveness',()=>{
 for(const status of ['active','blocked','closed','failed','gap_stopped','held','refused','stopped','workspace']){
  const value=readValue(status==='closed'?fresh:source);value.projection.status=status;
  assert.equal(classifyRetainedRunReplayResult(value),'validated',status);
 }
 for(const status of ['open','converged','unknown','running','']){
  const value=readValue(source);value.projection.status=status;
  assert.equal(classifyRetainedRunReplayResult(value),'invalid',status);
 }
 for(const [fromOrdinal,limit] of [[0,1],[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]]){
  const value=readValue(source);Object.assign(value.projection,{fromOrdinal,limit});
  assert.equal(classifyRetainedRunReplayResult(value),'validated');
 }
});

test('Run replay base branch rejects missing and additional fields at every consumed object boundary',()=>{
 const paths=[[],['projection'],['source'],['projectionBasis'],['projection','subject'],['projection','replay'],
  ['projection','terminalResult'],['projection','terminalResult','producer'],['projection','terminalResult','result'],
  ['projection','terminalResult','contract'],['projection','terminalResult','projectionBasis'],
  ...['program','graphFunction','executionBasis','terminalRoute'].map(k=>['projection','terminalResult','producer',k])];
 for(const path of paths){
  const keys=Object.keys(path.reduce((v,k)=>v[k],readValue(fresh)));
  for(const key of [...keys,'unexpected']){
   const value=readValue(fresh);const target=path.reduce((v,k)=>v[k],value);
   if(key==='unexpected')target[key]=true;else delete target[key];
   assert.equal(classifyRetainedRunReplayResult(value),'invalid',`${path.join('.')}.${key}`);
  }
 }
});

test('Run replay base branch validates selectors, every reference/digest pair and terminal producer coordinates',()=>{
 for(const key of ['fromOrdinal','limit'])for(const invalid of [-1,0.5,Number.MAX_SAFE_INTEGER+1,'1',null,...(key==='limit'?[0]:[])]){
  const value=readValue(source);value.projection[key]=invalid;
  assert.equal(classifyRetainedRunReplayResult(value),'invalid',`${key}=${invalid}`);
 }
 const pairPaths=[['source'],['projectionBasis'],['projection','subject'],['projection','replay'],
  ...['result','contract','projectionBasis'].map(k=>['projection','terminalResult',k]),
  ...['program','graphFunction','executionBasis','terminalRoute'].map(k=>['projection','terminalResult','producer',k])];
 for(const path of pairPaths)for(const [key,bad] of [['ref',''],['ref',' \n\t'],['ref',17],['digest','sha256:wrong'],['digest','']]){
  const value=readValue(fresh);path.reduce((v,k)=>v[k],value)[key]=bad;
  assert.equal(classifyRetainedRunReplayResult(value),'invalid',`${path.join('.')}.${key}`);
 }
 for(const key of ['runRef','graphCallRef','invocationAdmissionRef','cCallRef','resultAdmissionEventRef','judgmentRef','judgmentAdmissionEventRef']){
  const value=readValue(fresh);value.projection.terminalResult.producer[key]=' \t';
  assert.equal(classifyRetainedRunReplayResult(value),'invalid',key);
 }
 for(const [key,bad] of [['schemaVersion','4'],['kind','result'],['valueKind',' '],['valueDigest','sha256:wrong'],['value',undefined],['value',Infinity]]){
  const value=readValue(fresh);value.projection.terminalResult[key]=bad;
  assert.equal(classifyRetainedRunReplayResult(value),'invalid',key);
 }
});

// These are schema probes over copied reads, not new owner judgments about S7.
for(const status of ['active','blocked','closed','failed','gap_stopped','held','refused','stopped','workspace'])
 test(`published ${status} schema probe survives server and browser ingress without process liveness`,t=>{
  const subject=status==='closed'?fresh:source;const root=copyWithRead(t,subject,v=>{v.projection.status=status;});
  const observation=loadAbgRunObservation(root,{runId:subject.run.ref,refresh:true});
  assert.equal(observation.state,'ready',JSON.stringify(observation.diagnostics));assert.equal(observation.runtimeState.status,status);
  assert.equal(observation.activity.status,status);assert.equal(observation.runs.find(r=>r.runId===subject.run.ref).status,status);
  assert.equal(observation.runtimeState.replayFromOrdinal,0);assert.equal(observation.runtimeState.replayLimit,2048);
  assert.equal(observation.processPosture,'unavailable');assert.equal(asAbgRunObservation(observation).runtimeState.status,status);
 });

for(const [label,mutate] of [
 ['unsupported open',v=>{v.projection.status='open';}],
 ['empty replay ref',v=>{v.projection.replay.ref='';}],
 ['whitespace replay ref',v=>{v.projection.replay.ref=' \n\t';}],
 ['malformed replay digest',v=>{v.projection.replay.digest='sha256:broken';}],
 ['missing selector',v=>{delete v.projection.fromOrdinal;}],
 ['zero limit',v=>{v.projection.limit=0;}],
 ['additional projection field',v=>{v.projection.current=true;}],
]) test(`invalid published ${label} cannot enter discovered exact status`,t=>{
 const root=copyWithRead(t,source,mutate);const topology=discoverProjectObservationTopology(root,{refresh:true});
 assert.equal(topology.runs.length,0);assert.ok(topology.diagnostics.some(d=>d.code==='retained_run_binding_invalid'));
});

test('recognized native liveness read branch is unsupported while ordinary Run identity and events remain discoverable',t=>{
 const root=copyWithRead(t,source,v=>{v.projection.nativeLiveness={kind:'native_liveness_read_projection',schemaVersion:'5.0.0',
  profileSchedule:{kind:'root_event_profile_schedule',schemaVersion:'5.0.0',spans:[{eventContractDigest:records(source)[0].eventContractDigest,firstOrdinal:1,lastOrdinal:2318}],boundaryEventRef:null,currentEventContractDigest:records(source)[0].eventContractDigest},invocations:[]};});
 const observation=loadAbgRunObservation(root,{runId:source.run.ref,refresh:true});
 assert.equal(observation.state,'ready');assert.equal(observation.selectedRunId,source.run.ref);assert.equal(observation.carrierSnapshot.eventCount,2311);
 assert.equal(observation.eventPage.rows.length,40);assert.equal(observation.runtimeState.state,'unavailable');assert.match(observation.runtimeState.reason,/outside I01 qualification/);
 assert.equal(observation.runtimeState.status,null);assert.equal(observation.processPosture,'unavailable');
 assert.equal(asAbgRunObservation(observation).runtimeState.coverage,'unavailable');
});

test('browser ingress rejects malformed published status, coordinates, selectors and unavailable claims',()=>{
 const base=loadAbgRunObservation(source.path,{runId:source.run.ref,refresh:true});assert.equal(asAbgRunObservation(base).state,'ready');
 const changes=[
  v=>{v.runtimeState.status='open';},v=>{v.runtimeState.status='unknown';},
  v=>{v.runs[0].status='open';},v=>{v.activity.status='open';},
  ...['sourceRef','replayRef','terminalResultRef'].flatMap(k=>[v=>{v.runtimeState[k]='';},v=>{v.runtimeState[k]=' \t';}]),
  ...['sourceDigest','replayDigest'].map(k=>v=>{v.runtimeState[k]='sha256:wrong';}),
  ...['asOfOrdinal','replayFromOrdinal','replayLimit'].flatMap(k=>[v=>{delete v.runtimeState[k];},v=>{v.runtimeState[k]=-1;},v=>{v.runtimeState[k]=0.5;}]),
  v=>{v.runtimeState.replayLimit=0;},v=>{v.runtimeState.coverage='unavailable';},v=>{v.runtimeState.state='unavailable';},
  v=>{v.runtimeState.unexpected=true;},v=>{v.runtimeState.prefix.eventLogRef=' ';},
  v=>{v.runtimeState.prefix.prefixDigest='sha256:wrong';},v=>{v.runtimeState.prefix.coordinateDigest='';},
  v=>{v.runtimeState.prefix.storeIdentity.inode=-1;},v=>{v.runtimeState.prefix.storeIdentity.device=0.5;},
  v=>{v.runtimeState.prefix.prefixLength=Number.MAX_SAFE_INTEGER+1;},v=>{v.runtimeState.prefix.extra=true;},
 ];
 for(const [index,mutate] of changes.entries()){const value=structuredClone(base);mutate(value);assert.throws(()=>asAbgRunObservation(value),undefined,`invalid ingress probe ${index}`);}
});
