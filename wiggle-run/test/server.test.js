import test from 'node:test';
import assert from 'node:assert/strict';
import { issueTicket, verifyTicket, verifyScore, validateName, COURSE_ID } from '../lib/server.js';
import start from '../api/start.js';
import score from '../api/score.js';
import leaderboard from '../api/leaderboard.js';
const FIXED_NOW = Date.parse('2026-10-25T10:00:00Z');
process.env.ATTEMPT_SIGNING_SECRET='secret-for-test-that-is-more-than-32-characters';
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY='sb_secret_fake_for_tests';
function res(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(x){this.body=x;return this;}};}
test('name validation',()=>{
 assert.equal(validateName('  alpha  robot   '),'alpha robot');
 for(const bad of ['a','','     ', 'x'.repeat(33),'<script>alert(1)</script>'])assert.throws(()=>validateName(bad));
});
test('signed ticket cannot be forged and expires',()=>{
 const ticket=issueTicket('Alpha',FIXED_NOW);
 assert.equal(verifyTicket(ticket,FIXED_NOW+100).name,'Alpha');
 assert.throws(()=>verifyTicket(ticket+'z',FIXED_NOW+100));
 assert.throws(()=>verifyTicket(ticket,FIXED_NOW+13*60000));
});
test('scoring rejects fake finish, overscores, excessive time and invalid outcomes',()=>{
 const ticket=issueTicket('Alpha',FIXED_NOW);
 const ok={ticket,distance:84.2,seconds:31.5,outcome:'OUT OF BOUNDS'};
 assert.equal(verifyScore(ok,FIXED_NOW+33000).distance,84.2);
 for(const update of [{distance:101},{outcome:'FINISHED'},{seconds:100},{outcome:'UNKNOWN'},{distance:84.23},{seconds:78}])assert.throws(()=>verifyScore({...ok,...update},FIXED_NOW+33000));
 assert.equal(verifyScore({ticket,distance:100,seconds:36.2,outcome:'FINISHED'},FIXED_NOW+37000).course_id,COURSE_ID);
});
test('API rejects unsupported methods',async()=>{
 const r=res();await start({method:'GET'},r);assert.equal(r.code,405);
 const s=res();await score({method:'GET'},s);assert.equal(s.code,405);
 const t=res();await leaderboard({method:'POST'},t);assert.equal(t.code,405);
});
test('start, save and leaderboard through mocked Supabase',async()=>{
 const orig=global.fetch;const saved=[];
 global.fetch=async(url,opts)=>{
  assert.ok(url.startsWith('https://test.supabase.co/rest/v1/wiggle_scores'));
  assert.equal(opts.headers.apikey,'sb_secret_fake_for_tests');
  if(opts.method==='POST'){
   const row=JSON.parse(opts.body);if(saved.some(x=>x.attempt_id===row.attempt_id))return {ok:false,status:409,text:async()=>'{"message":"duplicate key"}'};
   const stored={...row,created_at:'2026-10-25T10:00:00Z'};saved.push(stored);return {ok:true,text:async()=>JSON.stringify([stored])};
  }
  return {ok:true,text:async()=>JSON.stringify(saved)};
 };
 try{
  const first=res();await start({method:'POST',body:{name:'robot_alpha'}},first);assert.equal(first.code,200);
  const second=res();await score({method:'POST',body:{ticket:first.body.ticket,distance:59.5,seconds:2.4,outcome:'OUT OF BOUNDS'}},second);assert.equal(second.code,201);assert.equal(second.body.score.distance,59.5);
  const third=res();await leaderboard({method:'GET'},third);assert.equal(third.code,200);assert.equal(third.body.scores[0].name,'robot_alpha');
  const duplicated=res();await score({method:'POST',body:{ticket:first.body.ticket,distance:59.5,seconds:2.4,outcome:'OUT OF BOUNDS'}},duplicated);assert.equal(duplicated.code,200);assert.equal(duplicated.body.alreadySaved,true);
 }finally{global.fetch=orig;}
});
