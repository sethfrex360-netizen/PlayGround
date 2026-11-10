(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const WORLD = { w: 2400, h: 1800 };
  const rand = (seed) => { let n = seed >>> 0; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; };
  const random = rand(12931);
  let W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  let started = false, ended = false, last = 0, gameSeconds = 8 * 3600 + 20 * 60, dayLength = 24, elapsed = 0, toastTimer = 0;
  let muted = false, running = false, keys = {}, touchVector = {x:0,y:0};
  const player = { x: 1130, y: 920, r: 13, faceX: 1, faceY: 0, speed: 170 };
  const stats = { hunger: 78, thirst: 72, health: 100 };
  const bag = { berries: 2, water: 1, wood: 0, stone: 0 };
  let gathered = 0, days = 1, shelters = [], fires = [], particles = [];
  let objective = 'Find a source of fresh water';
  const resources = [];
  const add = (kind,x,y,extra={}) => resources.push({kind,x,y,active:true,phase:random()*6,...extra});
  // Deliberately clustered landmarks create readable routes around the forest clearing.
  for(let i=0;i<78;i++){
    const angle=random()*Math.PI*2, radius=130+random()*1000;
    const x=Math.max(55,Math.min(WORLD.w-55,player.x+Math.cos(angle)*radius));
    const y=Math.max(55,Math.min(WORLD.h-55,player.y+Math.sin(angle)*radius));
    if(Math.hypot(x-1460,y-660)<250 || Math.hypot(x-player.x,y-player.y)<120) continue;
    add('tree',x,y,{size:25+random()*17});
  }
  [[900,740],[1015,610],[1320,1000],[1510,980],[790,1110],[1190,520],[1570,800],[920,1280],[1700,1150],[690,830],[1390,1320],[1040,480]].forEach(([x,y])=>add('berry',x,y,{size:15}));
  [[1030,1040],[950,980],[1260,1160],[1360,1120],[820,960],[1600,920],[1220,470],[730,1150],[1760,750],[1480,1290],[1000,1230],[1170,1150],[780,660]].forEach(([x,y])=>add('rock',x,y,{size:11+random()*5}));
  [[1460,660],[1415,690],[1505,715],[1380,640],[1530,620],[1460,755]].forEach(([x,y])=>add('water',x,y,{size:20}));
  [[1045,925],[1070,920],[1085,946],[1052,950]].forEach(([x,y])=>add('scrap',x,y,{size:10}));
  const lake = {x:1450,y:660,rx:215,ry:145};
  function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  addEventListener('resize',resize);
  const screen = (x,y) => ({x:x-camera.x+W/2,y:y-camera.y+H/2});
  const camera = {x:player.x,y:player.y};
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function ellipse(x,y,rx,ry,fill,stroke){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function rounded(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
  function drawGround(){
    ctx.fillStyle='#426344';ctx.fillRect(0,0,W,H);
    const left=camera.x-W/2, top=camera.y-H/2;
    const startX=Math.floor(left/64)*64, startY=Math.floor(top/64)*64;
    for(let x=startX;x<left+W+64;x+=64) for(let y=startY;y<top+H+64;y+=64){
      const p=screen(x,y), shade=(Math.sin(x*.021+y*.008)+Math.cos(y*.017-x*.009))*1.6;
      ctx.fillStyle=shade>0?'rgba(181,190,115,.045)':'rgba(14,46,34,.055)';ctx.fillRect(p.x,p.y,65,65);
      let hash=Math.abs(Math.sin(x*12.98+y*78.23)*43758.5)%1;
      if(hash>.58){ctx.fillStyle=hash>.88?'rgba(216,207,146,.22)':'rgba(195,208,142,.15)';ctx.beginPath();ctx.ellipse(p.x+hash*55,p.y+(hash*93)%58,1.3,2.4,-.3,0,Math.PI*2);ctx.fill();}
    }
    // Worn trails through the clearing
    ctx.save();ctx.translate(W/2-camera.x,H/2-camera.y);ctx.strokeStyle='rgba(179,157,107,.13)';ctx.lineWidth=35;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(820,1040);ctx.bezierCurveTo(1000,900,1170,1030,1330,890);ctx.stroke();ctx.restore();
  }
  function drawLake(t){
    const p=screen(lake.x,lake.y);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.16);
    ellipse(0,0,lake.rx+11,lake.ry+8,'rgba(27,65,53,.28)');
    ellipse(0,0,lake.rx,lake.ry,'#397c7a','#75a89a');
    ellipse(-7,-3,lake.rx-12,lake.ry-11,'#4d9991');
    ellipse(-20,-14,138,88,'rgba(133,190,164,.14)');
    for(let i=0;i<8;i++){const a=t*.3+i*1.7;ctx.strokeStyle=`rgba(190,221,184,${.1+((Math.sin(t+i)+1)*.025)})`;ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(Math.sin(a)*95,Math.cos(a*1.3)*48,18+(i%3)*9,3,Math.sin(a),0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    // Reeds along the bank
    for(let i=0;i<18;i++){let a=i*2.39;let x=lake.x+Math.cos(a)*(lake.rx+4+(i%4)*3),y=lake.y+Math.sin(a)*(lake.ry+3+(i%3)*3),s=screen(x,y);ctx.strokeStyle='#8c9c5e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x+Math.sin(t+i)*4,s.y-9);ctx.stroke();}
  }
  function drawTree(o,t){
    const p=screen(o.x,o.y);if(p.x<-70||p.x>W+70||p.y<-90||p.y>H+70)return;
    const s=o.size, sway=Math.sin(t*.6+o.phase)*1.5;
    ellipse(p.x+2,p.y+5,s*.66,s*.35,'rgba(12,31,22,.24)');
    ctx.fillStyle='#6b5034';ctx.fillRect(p.x-4,p.y-s*.55,8,s*.72);
    ellipse(p.x+sway,p.y-s*.72,s*.78,s*.73,'#254833');
    ellipse(p.x-s*.27+sway,p.y-s*.9,s*.52,s*.48,'#315a3d');
    ellipse(p.x+s*.29+sway,p.y-s*.89,s*.48,s*.52,'#3b6745');
    ellipse(p.x-s*.08+sway,p.y-s*1.12,s*.37,s*.31,'#4b714a');
    ellipse(p.x-s*.24,p.y-s*.83,s*.17,s*.13,'rgba(169,182,117,.13)');
    if(o.active){ctx.fillStyle='rgba(230,235,194,.42)';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('✦',p.x,p.y+4);}
  }
  function drawBerry(o,t){const p=screen(o.x,o.y);if(p.x<-35||p.x>W+35||p.y<-40||p.y>H+40)return;ellipse(p.x,p.y+5,13,7,'rgba(10,30,19,.25)');ellipse(p.x-3,p.y,11,8,'#648248');ellipse(p.x+4,p.y-2,10,7,'#789050');ctx.fillStyle='#bd5751';[[p.x-4,p.y-3],[p.x+3,p.y-5],[p.x+6,p.y+1]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y+Math.sin(t+o.phase)*.4,2.5,0,7);ctx.fill();});}
  function drawRock(o){const p=screen(o.x,o.y);if(p.x<-30||p.x>W+30||p.y<-30||p.y>H+30)return;ellipse(p.x,p.y+5,o.size*1.1,o.size*.58,'rgba(9,24,17,.23)');ctx.fillStyle='#838c78';ctx.beginPath();ctx.moveTo(p.x-o.size,p.y+3);ctx.lineTo(p.x-o.size*.55,p.y-o.size*.65);ctx.lineTo(p.x+o.size*.24,p.y-o.size*.83);ctx.lineTo(p.x+o.size,p.y-o.size*.14);ctx.lineTo(p.x+o.size*.65,p.y+o.size*.46);ctx.lineTo(p.x-o.size*.65,p.y+o.size*.49);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(219,219,182,.3)';ctx.beginPath();ctx.moveTo(p.x-o.size*.55,p.y-o.size*.65);ctx.lineTo(p.x+o.size*.24,p.y-o.size*.83);ctx.lineTo(p.x+o.size*.05,p.y-o.size*.2);ctx.lineTo(p.x-o.size*.7,p.y-.5);ctx.fill();}
  function drawScrap(o){const p=screen(o.x,o.y);if(p.x<-30||p.x>W+30||p.y<-30||p.y>H+30)return;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(o.phase);ctx.fillStyle='#9c8761';ctx.fillRect(-8,-5,16,10);ctx.fillStyle='#4d534b';ctx.fillRect(-6,-3,12,6);ctx.restore();}
  function drawBuilds(t){
    for(const f of fires){const p=screen(f.x,f.y);ellipse(p.x,p.y+8,29,12,'rgba(6,15,12,.32)');ctx.strokeStyle='#574b36';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(p.x-18,p.y+5);ctx.lineTo(p.x+17,p.y-2);ctx.moveTo(p.x-14,p.y-4);ctx.lineTo(p.x+14,p.y+7);ctx.stroke();const flame=7+Math.sin(t*7)*2;ellipse(p.x,p.y-7,flame*.55,flame,'#ed984e');ellipse(p.x,p.y-8,3,5,'#ffde91');const glow=ctx.createRadialGradient(p.x,p.y,5,p.x,p.y,90);glow.addColorStop(0,'rgba(245,157,76,.19)');glow.addColorStop(1,'rgba(245,157,76,0)');ctx.fillStyle=glow;ctx.fillRect(p.x-90,p.y-95,180,180);}
    for(const h of shelters){const p=screen(h.x,h.y);ellipse(p.x,p.y+10,33,12,'rgba(6,15,12,.3)');ctx.fillStyle='#796144';ctx.beginPath();ctx.moveTo(p.x-29,p.y+10);ctx.lineTo(p.x,p.y-25);ctx.lineTo(p.x+31,p.y+10);ctx.closePath();ctx.fill();ctx.fillStyle='#4d6345';ctx.beginPath();ctx.moveTo(p.x-24,p.y+4);ctx.lineTo(p.x,p.y-20);ctx.lineTo(p.x+26,p.y+4);ctx.closePath();ctx.fill();ctx.fillStyle='#19291f';ctx.beginPath();ctx.moveTo(p.x-8,p.y+8);ctx.lineTo(p.x,p.y-3);ctx.lineTo(p.x+9,p.y+8);ctx.fill();}
  }
  function drawPlayer(t){
    const p=screen(player.x,player.y);ellipse(p.x,p.y+10,13,7,'rgba(8,20,15,.3)');
    ctx.save();ctx.translate(p.x,p.y+Math.sin(t*7)*.8);ctx.rotate(Math.atan2(player.faceY,player.faceX));
    ctx.fillStyle='#c9a77a';ctx.beginPath();ctx.ellipse(0,0,9,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#4b6851';ctx.beginPath();ctx.ellipse(-1,1,7,9,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d5b68b';ctx.beginPath();ctx.arc(6,-2,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d8d6b1';ctx.beginPath();ctx.arc(9,-3,1.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#53644b';ctx.beginPath();ctx.ellipse(5,-6,7,3,0,Math.PI,Math.PI*2);ctx.fill();ctx.restore();
    ellipse(p.x,p.y-20,2.4,2.4,'#e7d99f');
  }
  function draw(){
    if(!W||!H)return;
    ctx.clearRect(0,0,W,H);const time=elapsed;
    drawGround();drawLake(time);
    // Draw by depth so scenery overlaps naturally.
    const sorted=resources.filter(o=>o.kind!=='water').slice().sort((a,b)=>a.y-b.y);
    sorted.forEach(o=>{if(o.kind==='tree')drawTree(o,time);else if(o.kind==='berry'&&o.active)drawBerry(o,time);else if(o.kind==='rock'&&o.active)drawRock(o);else if(o.kind==='scrap'&&o.active)drawScrap(o);});
    drawBuilds(time);drawPlayer(time);
    const hour=(gameSeconds/3600)%24;
    const darkness=hour<4?.58:hour<6?.58*(6-hour)/2:hour<18?0:hour<20?.58*(hour-18)/2:.58;
    if(darkness>0){ctx.fillStyle=`rgba(11,19,36,${darkness*.62})`;ctx.fillRect(0,0,W,H);for(const f of fires){const p=screen(f.x,f.y),g=ctx.createRadialGradient(p.x,p.y,5,p.x,p.y,105);g.addColorStop(0,'rgba(250,174,90,.32)');g.addColorStop(1,'rgba(250,174,90,0)');ctx.fillStyle=g;ctx.fillRect(p.x-105,p.y-105,210,210);}}
    if(started&&!ended)drawMinimap();
  }
  function drawMinimap(){
    const w=mini.width,h=mini.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#2e503b';mctx.fillRect(0,0,w,h);
    const scale=w/560, ox=player.x-280, oy=player.y-280;
    mctx.fillStyle='#4b9390';mctx.beginPath();mctx.ellipse((lake.x-ox)*scale,(lake.y-oy)*scale,lake.rx*scale,lake.ry*scale,-.16,0,Math.PI*2);mctx.fill();
    resources.forEach(o=>{if(!o.active||o.kind==='water')return;let x=(o.x-ox)*scale,y=(o.y-oy)*scale;if(x<0||x>w||y<0||y>h)return;mctx.fillStyle=o.kind==='tree'?'rgba(15,38,26,.75)':o.kind==='berry'?'#d18a61':'#a9ad8b';mctx.beginPath();mctx.arc(x,y,o.kind==='tree'?1.5:2,0,7);mctx.fill();});
    mctx.fillStyle='#e7d89e';mctx.beginPath();mctx.arc(w/2,h/2,4,0,7);mctx.fill();mctx.strokeStyle='rgba(255,235,167,.5)';mctx.lineWidth=1;mctx.beginPath();mctx.arc(w/2,h/2,7,0,7);mctx.stroke();
  }
  function showToast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);}
  function nearby(){
    let best=null,dist=Infinity;for(const o of resources){if(!o.active||o.kind==='water')continue;const d=Math.hypot(o.x-player.x,o.y-player.y);if(d<dist&&d<58){best=o;dist=d;}}
    const lakeDist=Math.hypot((player.x-lake.x)/lake.rx,(player.y-lake.y)/lake.ry);if(lakeDist<1.04)return {kind:'lake',distance:lakeDist};return best?{...best,distance:dist}:null;
  }
  function interact(){
    if(!started||ended)return;const target=nearby();if(!target){showToast('Nothing to gather here. Explore the clearing.');return;}
    if(target.kind==='lake'){bag.water=Math.min(8,bag.water+3);gathered+=3;showToast('Fresh water collected · +3');objective='Gather food and build a shelter';$('logCopy').textContent='The lake is clear and cold. There are useful supplies scattered nearby.';}
    else if(target.kind==='tree'){const amount=2+Math.floor(random()*2);bag.wood+=amount;gathered+=amount;target.active=false;showToast(`Wood gathered · +${amount}`);objective=bag.wood>=8?'Build a shelter before night':'Gather 8 wood for a shelter';}
    else if(target.kind==='berry'){const amount=2+Math.floor(random()*2);bag.berries+=amount;gathered+=amount;target.active=false;showToast(`Wild berries gathered · +${amount}`);objective='Gather food and build a shelter';}
    else if(target.kind==='rock'){const amount=1+Math.floor(random()*2);bag.stone+=amount;gathered+=amount;target.active=false;showToast(`Stone gathered · +${amount}`);objective=bag.stone>=4?'Build a shelter before night':'Gather stone for a shelter';}
    else if(target.kind==='scrap'){bag.wood+=2;bag.stone+=1;gathered+=3;target.active=false;showToast('Useful supplies salvaged · +2 wood, +1 stone');objective='Find water and gather supplies';}updateUI();
  }
  function eat(){if(!started||ended)return;if(bag.berries<1){showToast('No berries in your pack. Find a berry bush.');return;}bag.berries--;stats.hunger=Math.min(100,stats.hunger+27);showToast('A handful of berries · hunger restored');updateUI();}
  function drink(){if(!started||ended)return;if(bag.water<1){showToast('Your flask is empty. Find the lake and gather water.');return;}bag.water--;stats.thirst=Math.min(100,stats.thirst+34);showToast('Cool, fresh water · thirst restored');objective=bag.wood>=8&&bag.stone>=4?'Build a shelter before night':'Gather supplies for shelter';updateUI();}
  function buildFire(){if(!started||ended)return;if(bag.wood<4||bag.stone<2){showToast('Need 4 wood and 2 stone to build a fire.');return;}bag.wood-=4;bag.stone-=2;fires.push({x:player.x+player.faceX*27,y:player.y+player.faceY*27});showToast('Campfire built · warmth for the night');updateUI();}
  function buildShelter(){if(!started||ended)return;if(bag.wood<8||bag.stone<4){showToast('Need 8 wood and 4 stone to build a shelter.');return;}bag.wood-=8;bag.stone-=4;shelters.push({x:player.x,y:player.y});showToast('Shelter built · you can rest safely here');objective='Survive until the rescue plane returns';updateUI();}
  function updateUI(){
    for(const [name,value] of Object.entries(stats)){$(name+'Num').textContent=Math.round(value)+'%';$(name+'Bar').style.width=clamp(value,0,100)+'%';}
    const status=stats.health<35?'CRITICAL':stats.thirst<30||stats.hunger<30?'WEAK':'STEADY';$('conditionText').textContent=status;$('conditionText').style.color=status==='STEADY'?'#bdd8a7':status==='WEAK'?'#e4be7e':'#e98e7e';$('berriesCount').textContent=bag.berries;$('waterCount').textContent=bag.water;
    const total=bag.berries+bag.water+bag.wood+bag.stone;$('packCount').textContent=`${total} / 24`;
    const items=[['◉',bag.berries,'#d88367'],['⌁',bag.water,'#84c6c2'],['⌁',bag.wood,'#c7a77b'],['◆',bag.stone,'#a9b49a']];$('inventory').innerHTML=items.map(([symbol,count,color])=>`<div class="inv-item ${count?'':'empty'}" style="color:${count?color:''}">${symbol}<em>${count}</em></div>`).join('');
    const clock=((Math.floor(gameSeconds/3600)%24)+'').padStart(2,'0')+':'+(Math.floor(gameSeconds/60)%60+'').padStart(2,'0');$('clock').textContent=clock;$('dayLabel').textContent='DAY '+String(days).padStart(2,'0');
    const hour=Math.floor(gameSeconds/3600)%24,isNight=hour>=20||hour<6;$('weatherLabel').textContent=isNight?'NIGHTFALL · '+(hour<6?'COLD':'CLEAR'):'CLEAR SKIES';
    const target=nearby();$('hintText').textContent=target?(target.kind==='lake'?'Gather fresh water':target.kind==='tree'?'Gather wood':target.kind==='berry'?'Pick wild berries':target.kind==='rock'?'Gather stone':'Salvage supplies'):'Explore the forest';$('interactionHint').classList.toggle('visible',!!target&&started&&!ended);
    $('coords').textContent=`N ${String(Math.floor(player.y/20)).padStart(2,'0')}° · E ${String(Math.floor(player.x/20)).padStart(2,'0')}°`;if(objective)$('objectiveText').textContent=objective;
  }
  function endGame(won){ended=true;$('endOverlay').classList.remove('hidden');$('endEyebrow').textContent=won?'RESCUE REPORT · DAY 05':'FIELD REPORT · SURVIVAL ENDED';$('endMark').textContent=won?'✳':'☾';$('endTitle').innerHTML=won?'YOU MADE<br>IT HOME':'LOST IN<br>THE WILD';$('endCopy').textContent=won?'Five days in the wilderness. The rescue plane found your signal just before dusk. You made it.':stats.health<=0?'Your strength finally gave out. The wilderness is unforgiving, but every journey begins with a lesson.':'Night fell without shelter. The cold was too much to bear.';$('finalDays').textContent=`${Math.min(days,5)} ${days===1?'day':'days'}`;$('finalGathered').textContent=`${gathered} useful items`;$('restartButton').focus();}
  function tick(dt){if(!started||ended)return;elapsed+=dt;gameSeconds+=dt*600;const nextDay=Math.floor(gameSeconds/(dayLength*3600))+1;if(nextDay>days){days=nextDay;showToast(`Day ${days} begins · keep going`);if(days>=6){endGame(true);return;}}
    stats.hunger=Math.max(0,stats.hunger-dt*.069);stats.thirst=Math.max(0,stats.thirst-dt*.105);const hour=Math.floor(gameSeconds/3600)%24,night=hour>=20||hour<6,sheltered=shelters.some(s=>Math.hypot(s.x-player.x,s.y-player.y)<45),warmed=fires.some(f=>Math.hypot(f.x-player.x,f.y-player.y)<115);
    if(stats.hunger<8||stats.thirst<8)stats.health=Math.max(0,stats.health-dt*.65);else if(stats.hunger<25||stats.thirst<25)stats.health=Math.max(0,stats.health-dt*.16);if(night&&!sheltered&&!warmed)stats.health=Math.max(0,stats.health-dt*.22);if(stats.health<=0){endGame(false);return;}updateUI();
  }
  function frame(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;if(started&&!ended){move(dt);tick(dt);}draw();requestAnimationFrame(frame);}
  function move(dt){let x=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+touchVector.x,y=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+touchVector.y;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}if(len>.05){player.faceX=x;player.faceY=y;const speed=player.speed*(running?1.55:1),nx=clamp(player.x+x*speed*dt,30,WORLD.w-30),ny=clamp(player.y+y*speed*dt,30,WORLD.h-30);const test=Math.hypot((nx-lake.x)/(lake.rx-14),(ny-lake.y)/(lake.ry-14));if(test>1){player.x=nx;player.y=ny;}else{const tx=Math.hypot((nx-lake.x)/(lake.rx-14),(player.y-lake.y)/(lake.ry-14)),ty=Math.hypot((player.x-lake.x)/(lake.rx-14),(ny-lake.y)/(lake.ry-14));if(tx>1)player.x=nx;if(ty>1)player.y=ny;}}
    camera.x+=(player.x-camera.x)*Math.min(1,dt*4);camera.y+=(player.y-camera.y)*Math.min(1,dt*4);
  }
  function begin(){if(started)return;started=true;$('startOverlay').classList.add('hidden');last=performance.now();updateUI();showToast('Find water. The sun is already moving.');}
  $('startButton').addEventListener('click',begin);
  $('restartButton').addEventListener('click',()=>location.reload());
  $('eatButton').addEventListener('click',eat);$('drinkButton').addEventListener('click',drink);$('fireButton').addEventListener('click',buildFire);$('shelterButton').addEventListener('click',buildShelter);
  document.querySelectorAll('.hot-slot').forEach((button)=>button.addEventListener('click',()=>{
    const slots=[eat,drink,buildFire,buildShelter];document.querySelectorAll('.hot-slot').forEach((b)=>b.classList.remove('selected'));button.classList.add('selected');slots[Number(button.dataset.slot)]?.();
  }));
  $('soundButton').addEventListener('click',()=>{muted=!muted;$('soundButton').textContent=muted?'♩':'♫';$('soundButton').setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');showToast(muted?'Sound muted':'Sound enabled');});
  addEventListener('keydown',(event)=>{
    const key=event.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))event.preventDefault();
    if(key==='enter'&&!started){begin();return;}if(key==='e'){interact();return;}if(key==='1'){eat();return;}if(key==='2'){drink();return;}if(key==='3'){buildFire();return;}if(key==='4'){buildShelter();return;}
    keys[key]=true;if(key==='shift')running=true;
  });
  addEventListener('keyup',(event)=>{const key=event.key.toLowerCase();keys[key]=false;if(key==='shift')running=false;});
  addEventListener('blur',()=>{keys={};running=false;touchVector={x:0,y:0};});
  const stick=$('touchStick');let stickPointer=null;
  stick.addEventListener('pointerdown',(event)=>{stickPointer=event.pointerId;stick.setPointerCapture(event.pointerId);updateStick(event);});
  stick.addEventListener('pointermove',(event)=>{if(event.pointerId===stickPointer)updateStick(event);});
  const stopStick=(event)=>{if(event.pointerId===stickPointer){stickPointer=null;touchVector={x:0,y:0};stick.querySelector('span').style.transform='translate(0,0)';}};
  stick.addEventListener('pointerup',stopStick);stick.addEventListener('pointercancel',stopStick);
  function updateStick(event){const r=stick.getBoundingClientRect(),dx=(event.clientX-(r.left+r.width/2))/(r.width*.36),dy=(event.clientY-(r.top+r.height/2))/(r.height*.36),length=Math.hypot(dx,dy),scale=length>1?1/length:1;touchVector={x:dx*scale,y:dy*scale};stick.querySelector('span').style.transform=`translate(${dx*15}px,${dy*15}px)`;}
  $('touchGather').addEventListener('pointerdown',(event)=>{event.preventDefault();interact();});
  $('touchShelter').addEventListener('pointerdown',(event)=>{event.preventDefault();buildShelter();});
  resize();updateUI();requestAnimationFrame(frame);
})();


