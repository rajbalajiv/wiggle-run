import {CREATOR_X_HANDLE, creatorProfileUrl, buildXCaption, xIntentUrl, gameUrl} from './social.js';
'use strict';
(function(){
const W=960,H=540,MAX_SEC=90;
const COURSES={
 'wiggle-v1':{name:'Classic',level:'01 / EASY',half:29,waypoints:[[.205,.625],[.265,.625],[.325,.51],[.41,.51],[.495,.63],[.565,.63],[.66,.45],[.73,.45],[.805,.55],[.87,.55]]},
 'chicane-v1':{name:'Chicane',level:'02 / MEDIUM',half:25,waypoints:[[.17,.62],[.235,.62],[.30,.39],[.39,.39],[.46,.64],[.54,.64],[.62,.35],[.70,.35],[.78,.58],[.87,.58]]},
 'switchback-v1':{name:'Switchback',level:'03 / HARD',half:22,waypoints:[[.17,.66],[.235,.66],[.295,.37],[.36,.37],[.43,.64],[.50,.64],[.57,.36],[.64,.36],[.71,.64],[.78,.64],[.85,.41],[.90,.41]]},
 'hairpin-v1':{name:'Hairpin',level:'04 / EXPERT',half:21,waypoints:[[.16,.73],[.68,.73],[.82,.69],[.84,.58],[.80,.47],[.67,.43],[.41,.43],[.32,.37],[.32,.27],[.43,.22],[.86,.22]]}
};
let courseId='wiggle-v1';let WAYPOINTS=COURSES[courseId].waypoints;let HALF=COURSES[courseId].half;
const demo = new URLSearchParams(location.search).get('demo') === '1';
let ticket = null, submitted = false, posting = false, pickMode = false, lastPosted = null;
let color = {h:284,s:.62,v:.61}; // default purple, any saturated color can be sampled

const $=id=>document.getElementById(id);
const canvas=$('stage'),view=canvas.getContext('2d',{alpha:false}),source=$('source'),sctx=source.getContext('2d',{willReadFrequently:false}),det=$('detect'),dctx=det.getContext('2d',{willReadFrequently:true}),video=$('video');
const creatorLink=$('creatorX');const creatorHref=creatorProfileUrl();
if(creatorHref){creatorLink.href=creatorHref;creatorLink.hidden=false;creatorLink.textContent='@'+CREATOR_X_HANDLE.replace(/^@/, '')+' on X';}else{creatorLink.hidden=true;}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dst=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const plus=(a,b,s=1)=>({x:a.x+s*b.x,y:a.y+s*b.y});
const mul=(a,s)=>({x:a.x*s,y:a.y*s});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
function getCourse(){
 let points=WAYPOINTS.map(([x,y])=>({x:x*W,y:y*H}));
 for(let k=0;k<2;k++){
  const next=[points[0]];
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1];
   next.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25});
   next.push({x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75});
  }
  next.push(points[points.length-1]);points=next;
 }
 const interpolated=[points[0]];
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],n=Math.max(1,Math.ceil(dst(a,b)/4));
  for(let j=1;j<=n;j++)interpolated.push(plus(a,sub(b,a),j/n));
 }
 points=interpolated;
 const segments=[],lengths=[0];
 let total=0;
 for(let i=0;i<points.length-1;i++){
  const a=points[i],v=sub(points[i+1],a),len=Math.hypot(v.x,v.y);
  segments.push({a,v,len,len2:len*len,s:total});total+=len;lengths.push(total);
 }
 const tangent0=mul(segments[0].v,1/segments[0].len),tangent1=mul(segments[segments.length-1].v,1/segments[segments.length-1].len);
 const toSides=()=>{
  const left=[],right=[];
  for(let i=0;i<points.length;i++){
   const tangent=i===0?sub(points[1],points[0]):i===points.length-1?sub(points[i],points[i-1]):sub(points[i+1],points[i-1]);
   const mag=Math.hypot(tangent.x,tangent.y)||1,n={x:-tangent.y/mag,y:tangent.x/mag};
   left.push(plus(points[i],n,HALF));right.push(plus(points[i],n,-HALF));
  }
  return {left,right};
 };
 function project(p){let best=Infinity,progress=0;
  for(const seg of segments){const t=clamp(dot(sub(p,seg.a),seg.v)/seg.len2,0,1),q=plus(seg.a,seg.v,t),dd=dst(p,q);
   if(dd<best){best=dd;progress=(seg.s+seg.len*t)/total;}}
  return {distance:best,s:progress};
 }
 function gate(p,which){const start=which==='start',origin=start?points[0]:points[points.length-1],t=start?tangent0:tangent1,del=sub(p,origin);return {signed:dot(del,t),lateral:dot(del,{x:-t.y,y:t.x})};}
 return {points,segments,total,project,gate,sides:toSides(),start:points[0],end:points[points.length-1]};
}
let course=getCourse();
function selectCourse(id){
 if(!(id in COURSES)||game.status!=='idle')return false;
 courseId=id;WAYPOINTS=COURSES[id].waypoints;HALF=COURSES[id].half;course=getCourse();if(window.ServoBuzzCore)window.ServoBuzzCore.course=course;
 game.trail=[];lastRaw=null;detected=null;stable=0;ticket=null;
 document.querySelector('.pill').textContent=(demo?'DEMO / ':'')+COURSES[id].level+' / '+COURSES[id].name.toUpperCase();
 document.getElementById('courseHint').textContent=COURSES[id].name+' / '+(HALF*2)+' px wide / '+Math.round(course.total)+' px long';
 renderResults();refreshLeaderboard();return true;
}
function sweepOutside(a,b){const length=dst(a,b);let max=0;const n=Math.ceil(length/5);for(let i=0;i<=n;i++){
 const p=plus(a,sub(b,a),i/Math.max(1,n));max=Math.max(max,course.project(p).distance);
}return max;}
class Game{
 constructor(){this.rows=[];this.reset();}
 reset(){this.status='idle';this.courseId=courseId;this.name='';this.reason='';this.marker=null;this.prev=null;this.prevTime=0;this.lastSeen=0;this.staging=0;this.started=0;this.elapsed=0;this.progress=0;this.outSince=0;this.trail=[];this.attemptNumber=0;}
 enable(name,now){if(this.status!=='idle')throw Error('Reset or record the previous attempt first');const n=name.trim().replace(/\s+/g,' ').slice(0,36);if(!n)throw Error('Enter your name first');this.reset();this.name=n;this.courseId=courseId;this.status='armed';this.enabledAt=now;}
 end(reason,now){if(this.status!=='running')return;this.elapsed=(now-this.started)/1000;this.reason=reason;this.progress=reason==='FINISHED'?1:Math.min(this.progress,.999);this.status='review';}
 tick(marker,now){this.marker=marker;
  if(this.status!=='running'&&this.status!=='armed')return;
  if(this.status==='running'){this.elapsed=(now-this.started)/1000;if(this.elapsed>=MAX_SEC){this.end('TIME LIMIT',now);return;}}
  if(!marker){
   if(this.status==='armed'){this.prev=null;this.staging=0;}
   if(this.status==='running'&&now-this.lastSeen>850)this.end('TRACKING LOST',now);
   return;
  }
  this.lastSeen=now;
  const old=this.prev,dt=now-this.prevTime;this.prev=marker;this.prevTime=now;
  if(old&&dt>0&&dst(old,marker)>Math.max(17,800*dt/1000)){
    this.prev=null;
    if(this.status==='armed')this.staging=0;
    if(this.status==='running')this.lastSeen=now-450;
    return;
  }
  if(this.status==='armed'){
   const g=course.gate(marker,'start');
   if(g.signed>=-75&&g.signed<=-5&&Math.abs(g.lateral)<=HALF-2)this.staging=Math.min(15,this.staging+1);
   if(Math.abs(g.lateral)>HALF+12||g.signed>55||g.signed<-95)this.staging=0;
   if(old){const og=course.gate(old,'start');if(og.signed<0&&g.signed>=0&&g.signed>og.signed&&this.staging>=2&&Math.abs(g.lateral)<=HALF-2&&Math.abs(og.lateral)<=HALF+4&&Math.abs(og.signed)<55&&g.signed<55){
    this.status='running';this.started=now;this.elapsed=0;this.progress=0;this.trail=[marker];this.outSince=0;
   }}return;
  }
  const g=course.gate(marker,'finish');
  if(old){const og=course.gate(old,'finish');
   if(og.signed<0&&g.signed>=0&&g.signed>og.signed&&Math.abs(g.lateral)<HALF-3&&Math.abs(og.lateral)<HALF+5&&Math.abs(og.signed)<55&&g.signed<55&&this.progress>=.83){this.trail.push(marker);this.end('FINISHED',now);return;}
  }
  const p=course.project(marker),start=course.gate(marker,'start').signed;
  if(start<-9||(g.signed>9&&this.progress<.83)){this.end('OUT OF BOUNDS',now);return;}
  const deviation=old?sweepOutside(old,marker):p.distance;
  if(deviation>HALF+15){this.end('OUT OF BOUNDS',now);return;}
  if(deviation>HALF+4){if(!this.outSince)this.outSince=now;if(now-this.outSince>=150){this.end('OUT OF BOUNDS',now);return;}}
  else this.outSince=0;
  if(old){const possible=dst(old,marker)/course.total*1.25+.012;
   if(p.s<=this.progress+possible)this.progress=Math.max(this.progress,Math.min(.999,p.s));
  }
  this.trail.push(marker);if(this.trail.length>2500)this.trail.shift();
 }
 save(){if(this.status!=='review')throw Error('No completed attempt');
  const r={course:this.courseId,name:this.name,distance:Number((this.progress*100).toFixed(1)),seconds:Number(this.elapsed.toFixed(1)),outcome:this.reason,time:new Date().toLocaleString()};
  this.rows.push(r);this.reset();return r;
 }
}
window.ServoBuzzCore={Game,getCourse,course};
const game=new Game();
let stream=null,mirrored=false,lastDraw=0,lastDetect=0,detected=null,detectedAt=0,stable=0,lastRaw=null,lastRawAt=0;
let recorder=null,recordedParts=[],clipBlob=null,clipName='',clipUrl=null,clipType='',recordingGeneration=0;let lastEndNotified='';
const setNotice=(s,bad=false)=>{const e=$('notice');e.textContent=s;e.classList.toggle('error',bad);};
function pts(ctx,arr){ctx.beginPath();ctx.moveTo(arr[0].x,arr[0].y);for(let i=1;i<arr.length;i++)ctx.lineTo(arr[i].x,arr[i].y);}
function drawFixed(){
 const {left,right}=course.sides;
 view.save();view.strokeStyle='#ed4545';view.lineWidth=3;view.lineJoin='round';view.lineCap='round';
 pts(view,left);view.stroke();pts(view,right);view.stroke();
 view.strokeStyle='#f8f8f8';view.lineWidth=3;
 view.beginPath();view.moveTo(left[0].x,left[0].y);view.lineTo(right[0].x,right[0].y);view.stroke();
 const l=left.length-1;view.beginPath();view.moveTo(left[l].x,left[l].y);view.lineTo(right[l].x,right[l].y);view.stroke();
 view.fillStyle='#fff';view.font='bold 15px Helvetica,Arial,sans-serif';view.textAlign='center';
 view.fillText('START  >',course.start.x,course.start.y-47);view.fillText('FINISH',course.end.x,course.end.y-47);
 view.restore();
}
function drawFrame(){
 if(video.readyState>=2&&video.videoWidth){
  sctx.save();sctx.fillStyle='#050505';sctx.fillRect(0,0,W,H);
  const vw=video.videoWidth,vh=video.videoHeight,scale=Math.max(W/vw,H/vh),dw=vw*scale,dh=vh*scale;
  if(mirrored){sctx.translate(W,0);sctx.scale(-1,1);}
  sctx.drawImage(video,(W-dw)/2,(H-dh)/2,dw,dh);sctx.restore();
  view.drawImage(source,0,0);
 }else{view.fillStyle='#101010';view.fillRect(0,0,W,H);view.fillStyle='#999';view.textAlign='center';view.font='18px Helvetica,Arial,sans-serif';view.fillText('Connect a front-facing camera to begin',W/2,H/2);}
 view.fillStyle='rgba(0,0,0,.65)';view.fillRect(0,0,W,41);
 view.font='bold 15px Helvetica,Arial,sans-serif';view.textAlign='left';view.fillStyle='#fff'; view.fillText((game.name||'WIGGLE RUN').toUpperCase()+'  /  '+COURSES[courseId].name.toUpperCase()+'  /  '+game.status.toUpperCase(),15,26);
 view.textAlign='right';view.fillText(game.status==='running'?game.elapsed.toFixed(1)+'s  /  '+(game.progress*100).toFixed(1)+'%':(game.progress*100).toFixed(1)+'%',W-15,26);
 drawFixed();
 if(game.trail.length>1){view.save();view.strokeStyle='#ffe14b';view.lineWidth=3;view.lineCap='round';view.lineJoin='round';pts(view,game.trail);view.stroke();view.restore();}
 if(game.marker){view.save();view.strokeStyle='#ffe14b';view.fillStyle='#ffe14b';view.lineWidth=2;view.beginPath();view.arc(game.marker.x,game.marker.y,11,0,Math.PI*2);view.stroke();view.beginPath();view.arc(game.marker.x,game.marker.y,3,0,Math.PI*2);view.fill();view.restore();}
}
// Compare pixels in HSV. Color can be selected from any bright marker, not just purple.
function rgbHsv(r,g,b){
 r/=255;g/=255;b/=255;
 const max=Math.max(r,g,b), min=Math.min(r,g,b),d=max-min;
 let h=0;
 if(d){
  if(max===r)h=((g-b)/d)%6;
  else if(max===g)h=(b-r)/d+2;
  else h=(r-g)/d+4;
  h=(h*60+360)%360;
 }
 return {h,s:max?d/max:0,v:max};
}
function hueDelta(a,b){return Math.abs((a-b+540)%360-180);}
function markerPixel(r,g,b){
 const p=rgbHsv(r,g,b);
 if(p.s<Math.max(.24,color.s*.45)||p.v<Math.max(.19,color.v*.34))return false;
 return hueDelta(p.h,color.h)<19;
}
function sampleMarker(x,y){
 if(video.readyState<2)return false;
 const dat=sctx.getImageData(Math.max(0,x-7),Math.max(0,y-7),Math.min(15,W-Math.max(0,x-7)),Math.min(15,H-Math.max(0,y-7)));
 let c=0,ss=0,vv=0,xx=0,yy=0;
 for(let j=0;j<dat.data.length;j+=4){const p=rgbHsv(dat.data[j],dat.data[j+1],dat.data[j+2]);
  if(p.s<.32||p.v<.25)continue;
  c++;ss+=p.s;vv+=p.v;xx+=Math.cos(p.h*Math.PI/180);yy+=Math.sin(p.h*Math.PI/180);
 }
 if(c<8)return false;
 color={h:(Math.atan2(yy,xx)*180/Math.PI+360)%360,s:ss/c,v:vv/c};
 $('swatch').style.background=`hsl(${color.h} 72% 54%)`;
 $('colorName').textContent='Marker color saved. Keep the camera and lighting steady.';
 detected=null;lastRaw=null;stable=0;
 return true;
}
function findMarker(){
 if(video.readyState<2)return null;
 dctx.drawImage(source,0,0,320,180);
 let raw;
 try{raw=dctx.getImageData(0,0,320,180).data;}catch(_){return null;}
 const WW=320,HH=180,N=WW*HH,mask=new Uint8Array(N),seen=new Uint8Array(N),queue=new Int32Array(N);
 for(let i=0;i<N;i++){const j=i*4;mask[i]=markerPixel(raw[j],raw[j+1],raw[j+2])?1:0;}
 const candidates=[];
 for(let i=0;i<N;i++){
  if(!mask[i]||seen[i])continue;
  let head=0,tail=1,area=0,sx=0,sy=0,minx=WW,maxx=0,miny=HH,maxy=0;queue[0]=i;seen[i]=1;
  while(head<tail){const q=queue[head++],y=(q/WW)|0,x=q-y*WW;area++;sx+=x;sy+=y;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);
   if(x>0){const n=q-1;if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
   if(x<WW-1){const n=q+1;if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
   if(y>0){const n=q-WW;if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
   if(y<HH-1){const n=q+WW;if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
  }
  const bw=maxx-minx+1,bh=maxy-miny+1,ratio=bw/bh;
  if(area>=14&&area<=4400&&ratio>.20&&ratio<5.0){
    const p={x:sx/area*3+1.5,y:sy/area*3+1.5};
    candidates.push({p,area});
  }
 }
 if(!candidates.length)return null;
 let best=null,bestScore=-Infinity;
 for(const c of candidates){
  const closeness=detected?dst(c.p,detected):0;
  const score=Math.log(c.area+1)*15-(detected?closeness*.32:0);
  if(score>bestScore){bestScore=score;best=c;}
 }
 return best.p;
}
function updateTracking(now){
 const raw=findMarker();
 if(!raw){stable=0;lastRaw=null;if(now-detectedAt>350)detected=null;game.tick(null,now);return;}
 if(lastRaw&&now-lastRawAt>0){const delta=dst(raw,lastRaw),dt=now-lastRawAt;if(delta>Math.max(32,850*dt/1000)){
  stable=0;game.tick(null,now);return;
 }}
 lastRaw=raw;lastRawAt=now;
 detected=detected?plus(detected,sub(raw,detected),.63):raw;
 detectedAt=now;stable=Math.min(8,stable+1);
 game.tick(stable>=3?detected:null,now);
}
function chooseMediaRecorderType(){if(!window.MediaRecorder)return '';
 // Prefer X-friendly MP4/H.264 when browser recording supports it.
 const types=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'];
 return types.find(t=>MediaRecorder.isTypeSupported(t))||'';
}
function startRecording(){
 const generation=++recordingGeneration;recordedParts=[];clipBlob=null;clipName='';$('clip').disabled=true;$('shareClip').disabled=true;
 const type=chooseMediaRecorderType();if(!type||!canvas.captureStream)return;
 try{
  const media=canvas.captureStream(20);recorder=new MediaRecorder(media,{mimeType:type,videoBitsPerSecond:1800000});clipType=type;
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)recordedParts.push(e.data);};
  recorder.onstop=()=>{if(generation!==recordingGeneration)return;if(recordedParts.length){clipBlob=new Blob(recordedParts,{type:clipType});$('clip').disabled=false;$('shareClip').disabled=false;}};
  recorder.start(1000);
 }catch(e){console.warn('Recording unavailable',e);recorder=null;}
}
function stopRecording(){if(recorder&&recorder.state==='recording')recorder.stop();recorder=null;}
function showReview(){
 $('review').classList.add('visible');$('reviewTitle').textContent=game.reason==='FINISHED'?'Course completed':'Run ended: '+game.reason;
 $('reviewDistance').textContent=(game.progress*100).toFixed(1)+'%';
 $('reviewDetails').textContent=game.name+' / '+game.elapsed.toFixed(1)+' seconds';
 $('enable').disabled=true;$('player').disabled=true;$('camera').disabled=true;$('mirror').disabled=true;$('pick').disabled=true;$('course').disabled=true;
 $('record').disabled=false;$('record').textContent=demo?'Save demo result':'Post to leaderboard';
 $('share').classList.remove('hide');$('card').classList.remove('hide');$('postX').classList.remove('hide');$('shareClip').classList.remove('hide');$('share').textContent='Copy result';
 setNotice('Run complete. Post the score or try again. Video is available if your browser supports recording.');
}
function updateUI(now){
 $('distance').textContent=(game.progress*100).toFixed(1)+'%';
 $('clock').textContent=(game.status==='running'?(now-game.started)/1000:game.elapsed).toFixed(1)+' s';
 $('phase').textContent=({idle:'IDLE',armed:'READY',running:'RUNNING',review:'ENDED'})[game.status]||game.status.toUpperCase();
 $('playerTag').textContent=game.name?game.name.toUpperCase():'NO ACTIVE RUN';
 const good=!!detected&&now-detectedAt<400&&stable>=3;
 $('trackDot').className='dot '+(good?'ok':'warning');$('trackLabel').textContent=stream?(good?'MARKER TRACKED':'MARKER NOT FOUND'):'CAMERA OFF';
 if(game.status==='review'&&lastEndNotified!=='review'){
  stopRecording();showReview();lastEndNotified='review';
 }
 if(game.status==='running'&&lastEndNotified!=='running'){
  startRecording();lastEndNotified='running';setNotice('Run live. Follow the red path.');
 }
 if(game.status==='armed'&&lastEndNotified!=='armed'){
  lastEndNotified='armed';setNotice('Enabled. Cross the START gate from left to right to begin.');
 }
}
function loop(now){
 if(now-lastDetect>75){lastDetect=now;updateTracking(now);}
 if(game.status==='running'&&(now-game.started)/1000>=MAX_SEC){game.end('TIME LIMIT',now);}
 if(now-lastDraw>32){lastDraw=now;drawFrame();updateUI(now);}
 requestAnimationFrame(loop);
}
async function listCameras(){
 const cameras=$('camera'),selected=cameras.value;let items=[];
 try{items=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='videoinput');}catch(_){ }
 cameras.innerHTML='<option value="">Default camera</option>';
 items.forEach((item,i)=>{const opt=document.createElement('option');opt.value=item.deviceId;opt.textContent=item.label||'Camera '+(i+1);cameras.append(opt);});
 if([...cameras.options].some(o=>o.value===selected))cameras.value=selected;
}
async function connect(){
 if(!navigator.mediaDevices?.getUserMedia){setNotice('Camera requires HTTPS or localhost. Ask the host for the secure link.',true);return;}
 $('connect').disabled=true;
 try{
  const deviceId=$('camera').value;
  const constraints={audio:false,video:deviceId?{deviceId:{exact:deviceId},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24}}:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24}}};
  const next=await navigator.mediaDevices.getUserMedia(constraints);
  if(stream)stream.getTracks().forEach(t=>t.stop());stream=next;video.srcObject=stream;
  await video.play();
  $('enable').disabled=game.status!=='idle';$('pick').disabled=game.status!=='idle';
  await listCameras();
  setNotice('Camera connected. Click Pick marker color and then click your gripper marker.');
 }catch(err){setNotice('Camera error: '+(err?.message||err?.name||'unavailable')+'. Check browser camera permission or another app using it.',true);}
 finally{$('connect').disabled=false;}
}
function copyText(t){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(t);const e=document.createElement('textarea');e.value=t;document.body.append(e);e.select();try{document.execCommand('copy');}finally{e.remove();}return Promise.resolve();}
function scoreLine(r){return (COURSES[r.course]||COURSES['wiggle-v1']).name+' / '+r.name+': '+r.distance.toFixed(1)+'% / '+r.seconds.toFixed(1)+'s / '+r.outcome+' | wiggle run';}
function renderResults(){
 const list=$('results');list.textContent='';
 const ranks=game.rows.filter(r=>(r.course||'wiggle-v1')===courseId).sort((a,b)=>b.distance-a.distance||a.seconds-b.seconds);
 $('empty').classList.toggle('hide',ranks.length>0);
 ranks.slice(0,20).forEach((r,i)=>{const li=document.createElement('li');const a=document.createElement('span');a.textContent=(i+1)+'. '+r.name;const b=document.createElement('b');b.textContent=r.distance.toFixed(1)+'%';li.append(a,b);list.append(li);});
}
async function fetchJson(url,options){
 const response=await fetch(url,{cache:'no-store',...options});
 let data={};try{data=await response.json();}catch(_){ }
 if(!response.ok)throw Error(data.error||'Network error. Try again.');
 return data;
}
async function refreshLeaderboard(){
 if(demo){$('lbStatus').textContent='Demo mode. Scores are not published.';return;}
 try{
  const data=await fetchJson('/api/leaderboard?course='+encodeURIComponent(courseId));
  const list=$('leaderboard');list.textContent='';
  (data.scores||[]).forEach((r,i)=>{const li=document.createElement('li');const name=document.createElement('span');name.textContent=(i+1)+'. '+r.name;
   const score=document.createElement('b');score.textContent=Number(r.distance).toFixed(1)+'%  /  '+Number(r.seconds).toFixed(1)+'s';
   if(lastPosted&&r.id===lastPosted.id)li.classList.add('mine');li.append(name,score);list.append(li);
  });
  $('lbStatus').textContent=(data.scores||[]).length?'Top '+data.scores.length+' attempts':'No scores yet. Be the first.';
 }catch(err){$('lbStatus').textContent='Leaderboard unavailable. '+err.message;}
}
function md(){
 const lines=['# Wiggle Run','','Session scorecard',''];
 for(const [id,courseDef] of Object.entries(COURSES)){
  const rows=game.rows.filter(r=>(r.course||'wiggle-v1')===id).sort((a,b)=>b.distance-a.distance||a.seconds-b.seconds);
  if(!rows.length)continue;
  lines.push('## '+courseDef.name,'','| Rank | Participant | Distance | Time | Result |','| ---: | --- | ---: | ---: | --- |');
  rows.forEach((r,i)=>lines.push('| '+(i+1)+' | '+r.name.replace(/\|/g,'/')+' | '+r.distance.toFixed(1)+'% | '+r.seconds.toFixed(1)+'s | '+r.outcome+' |'));
  lines.push('');
 }
 lines.push('Recorded attempts: '+game.rows.length,'','Distance is estimated locally using a selected colored marker and a fixed 2D camera course. Physical collisions are not detected.','');
 return lines.join('\n');
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function safeFile(s){return s.replace(/[^a-z0-9_-]/gi,'_').slice(0,32)||'participant';}
function resetAttempt(){
 stopRecording();recordingGeneration++;game.reset();ticket=null;submitted=false;posting=false;lastEndNotified='';clipBlob=null;clipUrl=null;
 $('review').classList.remove('visible');$('enable').disabled=!stream;$('player').disabled=false;$('camera').disabled=false;$('mirror').disabled=false;$('pick').disabled=!stream;$('course').disabled=false;$('clip').disabled=true;$('shareClip').disabled=true;
 setNotice('Ready for another run. Enter your name and select Enable.');
}
$('connect').addEventListener('click',connect);
$('camera').addEventListener('change',()=>{if(game.status==='idle'&&stream)connect();});
$('course').addEventListener('change',e=>{if(game.status!=='idle'){e.target.value=courseId;return;}selectCourse(e.target.value);setNotice('Course selected. Frame your robot so the marker can reach both gates.');});
$('mirror').addEventListener('click',()=>{if(game.status!=='idle')return;mirrored=!mirrored;detected=null;lastRaw=null;stable=0;$('mirror').textContent='Mirror: '+(mirrored?'on':'off');});
$('pick').addEventListener('click',()=>{
 if(!stream||game.status!=='idle')return;
 pickMode=!pickMode;$('stagewrap').classList.toggle('picking',pickMode);
 $('pick').textContent=pickMode?'Cancel picking':'Pick marker color';
 if(pickMode)setNotice('Click directly on your colored gripper marker in the video.');
});
canvas.addEventListener('click',evt=>{
 if(!pickMode||game.status!=='idle')return;
 const rect=canvas.getBoundingClientRect();const x=Math.max(0,Math.min(W-1,Math.round((evt.clientX-rect.left)*W/rect.width)));
 const y=Math.max(0,Math.min(H-1,Math.round((evt.clientY-rect.top)*H/rect.height)));
 if(sampleMarker(x,y)){
  pickMode=false;$('stagewrap').classList.remove('picking');$('pick').textContent='Pick marker color';setNotice('Marker calibrated. Check the tracking ring and frame the START gate.');
 }else setNotice('That area has too little color. Click on bright, solid tape or a marker.',true);
});
$('enable').addEventListener('click',async()=>{
 if(!stream||game.status!=='idle')return;
 $('enable').disabled=true;
 try{
  const name=$('player').value.trim();
  if(!name||name.length<2||name.length>32)throw Error('Enter a name between 2 and 32 characters.');
  setNotice(demo?'Enabling demo attempt...':'Preparing online attempt...');
  ticket=demo?'demo':(await fetchJson('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,course:courseId})})).ticket;
  game.enable(name,performance.now());submitted=false;lastEndNotified='';
  $('player').disabled=true;$('camera').disabled=true;$('mirror').disabled=true;$('pick').disabled=true;$('course').disabled=true;
  pickMode=false;$('stagewrap').classList.remove('picking');$('pick').textContent='Pick marker color';
 }catch(e){$('enable').disabled=false;ticket=null;setNotice(e.message,true);}
});
$('reset').addEventListener('click',resetAttempt);
$('record').addEventListener('click',async()=>{
 if(game.status!=='review'||submitted||posting)return;
 posting=true;$('record').disabled=true;$('record').textContent='Posting...';
 const row={course:game.courseId,name:game.name,distance:Number((game.progress*100).toFixed(1)),seconds:Number(game.elapsed.toFixed(1)),outcome:game.reason,time:new Date().toLocaleString()};
 try{
  if(!demo){const answer=await fetchJson('/api/score',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket,distance:row.distance,seconds:row.seconds,outcome:row.outcome})});lastPosted=answer.score;}
  submitted=true;game.rows.push(row);
  try{localStorage.setItem('wiggle_run_local_v1',JSON.stringify(game.rows.slice(-100)));}catch(_){ }
  renderResults();$('record').textContent=demo?'Saved locally':'Posted to global board';
  setNotice(demo?'Demo score saved locally.':'Score posted. Challenge a friend to beat it.');
  if(!demo)refreshLeaderboard();
 }catch(e){$('record').disabled=false;$('record').textContent='Retry posting';setNotice('Could not post: '+e.message+'. Keep this page open and retry.',true);}
 finally{posting=false;}
});
$('share').addEventListener('click',async()=>{
 if(game.status!=='review')return;
 const r={course:game.courseId,name:game.name,distance:Number((game.progress*100).toFixed(1)),seconds:Number(game.elapsed.toFixed(1)),outcome:game.reason};
 try{await copyText(scoreLine(r)+(submitted?'':' (not posted)')+' | '+location.origin);setNotice('Copied. Tag three robot owners to try the challenge.');}catch(e){setNotice('Copy unavailable. '+scoreLine(r),true);}
});

// Results stay on the player's device. X receives only a prefilled post;
// attaching video still requires the player's explicit action.
function resultForShare(){return {name:game.name,course:(COURSES[game.courseId]||COURSES['wiggle-v1']).name,distance:game.progress*100,seconds:game.elapsed,outcome:game.reason};}
function videoFilename(){return 'wiggle-run-'+safeFile(game.name)+'.'+(clipType.includes('mp4')?'mp4':'webm');}
$('postX').addEventListener('click',()=>{
 if(game.status!=='review')return;
 const text=buildXCaption(resultForShare());
 const draft=xIntentUrl(text,location.href);
 const opened=window.open(draft,'_blank','noopener,noreferrer');
 if(clipBlob){download(clipBlob,videoFilename());}
 if(!opened&&navigator.clipboard?.writeText){copyText(text+'\n\n'+gameUrl(location.href)).catch(()=>{});}
 setNotice(clipBlob?'X draft opened and clip downloaded. Attach the video in X, then tag three robot owners. Nothing posts automatically.':'X draft opened. Recording was unavailable; save your score card and attach it on X. Nothing posts automatically.');
});
$('shareClip').addEventListener('click',async()=>{
 if(game.status!=='review'||!clipBlob)return;
 const file=new File([clipBlob],videoFilename(),{type:clipBlob.type||clipType});
 const text=buildXCaption(resultForShare());
 try{
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
   await navigator.share({files:[file],title:'Wiggle Run',text,url:gameUrl(location.href)});
   setNotice('Choose X in your share sheet if available. Nothing was uploaded by the game.');
  }else{
   download(clipBlob,videoFilename());
   setNotice('Video saved. Use Share on X for a prefilled post, then attach the clip manually.');
  }
 }catch(e){if(e?.name!=='AbortError')setNotice('Could not open share sheet. Use Save video and Share on X instead.',true);}
});

$('card').addEventListener('click',()=>{
 if(game.status!=='review')return;
 const card=document.createElement('canvas');card.width=1080;card.height=1080;
 const ctx=card.getContext('2d');ctx.fillStyle='#0b0b0b';ctx.fillRect(0,0,1080,1080);
 ctx.strokeStyle='#343434';ctx.lineWidth=3;ctx.strokeRect(46,46,988,988);
 ctx.fillStyle='#fff';ctx.font='bold 62px Helvetica,Arial,sans-serif';ctx.fillText('wiggle run.',100,160);
 ctx.fillStyle='#a5a5a5';ctx.font='25px Helvetica,Arial,sans-serif';ctx.fillText('a little obstacle course for robots',100,208);ctx.fillText((COURSES[game.courseId]||COURSES['wiggle-v1']).name.toUpperCase(),100,255);
 ctx.fillStyle='#f0f0ef';ctx.font='bold 30px Helvetica,Arial,sans-serif';ctx.fillText(game.name.slice(0,30),100,354);
 ctx.fillStyle='#fff';ctx.font='bold 200px Helvetica,Arial,sans-serif';ctx.fillText((game.progress*100).toFixed(1)+'%',94,588);
 ctx.fillStyle='#acacac';ctx.font='28px Helvetica,Arial,sans-serif';ctx.fillText('DISTANCE COMPLETED',103,651);
 ctx.fillStyle='#fff';ctx.font='bold 36px Helvetica,Arial,sans-serif';ctx.fillText(game.elapsed.toFixed(1)+'s  /  '+game.reason,102,752);
 ctx.strokeStyle='#f04b4b';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(100,862);ctx.bezierCurveTo(260,773,325,919,460,850);ctx.bezierCurveTo(620,768,685,885,950,830);ctx.stroke();
 ctx.fillStyle='#bdbdbd';ctx.font='25px Helvetica,Arial,sans-serif';ctx.fillText('think your robot can beat this?',101,954);
 downloadDataUrl(card.toDataURL('image/png'),'wiggle-run-'+safeFile(game.name)+'.png');
});
function downloadDataUrl(src,name){const a=document.createElement('a');a.href=src;a.download=name;document.body.append(a);a.click();a.remove();}
$('clip').addEventListener('click',()=>{if(clipBlob)download(clipBlob,'wiggle-run-'+safeFile(game.name)+'.'+(clipType.includes('mp4')?'mp4':'webm'));});
$('export').addEventListener('click',()=>{download(new Blob([md()],{type:'text/markdown;charset=utf-8'}),'wiggle-run-scorecard.md');});
$('refresh').addEventListener('click',refreshLeaderboard);
$('how').addEventListener('click',()=>{$('modalback').classList.remove('hide');});
$('gotit').addEventListener('click',()=>{$('modalback').classList.add('hide');try{localStorage.setItem('wiggle_help_seen','1');}catch(_){}});

try{if(localStorage.getItem('wiggle_help_seen')==='1')$('modalback').classList.add('hide');}catch(_){ }
try{const stored=JSON.parse(localStorage.getItem('wiggle_run_local_v1')||'[]');if(Array.isArray(stored))game.rows=stored.filter(x=>x&&typeof x.distance==='number').slice(-100);}catch(_){ }
selectCourse(courseId);drawFrame();requestAnimationFrame(loop);
setInterval(()=>{if(!document.hidden)refreshLeaderboard();},30000);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='running')game.end('INTERRUPTED',performance.now());});
})();
