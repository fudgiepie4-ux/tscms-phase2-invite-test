(function(){
  'use strict';
  // Intensity is entirely independent of radio, music, video and Dicey Discovery.
  const localCanvas=document.getElementById('fallLeafCanvas');
  // In the ADMIN site's embedded PUBLIC view, draw into the parent viewport.
  // Otherwise the iframe's full-page height dilutes the leaves across thousands of pixels.
  let canvas=localCanvas, leafViewport=window;
  try {
    if(window.frameElement && window.frameElement.id==='tscmsPublicFrame'){
      const hostCanvas=window.parent.document.getElementById('tscmsParentLeafCanvas');
      if(hostCanvas){canvas=hostCanvas;leafViewport=window.parent;if(localCanvas)localCanvas.hidden=true;}
    }
  } catch(e) { /* Standalone or cross-origin views retain their own leaf canvas. */ }
  const selector=document.getElementById('leavesToggle');
  const menu=document.getElementById('leafModeMenu');
  const controls=document.querySelector('.leaf-corner');
  const modeButtons=Array.from(document.querySelectorAll('[data-leaf-mode]'));
  const gustBtn=document.getElementById('leavesGust');
  const status=document.getElementById('windReadout');
  if(!canvas||!selector||!menu||!gustBtn||!canvas.getContext)return;
  const ctx=canvas.getContext('2d',{alpha:true}); if(!ctx)return;
  const palette=['#e99b34','#df6c22','#b8421d','#edb24b','#ac3221','#ca7723','#bf4b19','#b76932','#e3c36c'];
  const SETTINGS_KEY='tscms.autumn.leafIntensity.v1';
  const motionReduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MODES={
    off:     {phone:0,tablet:0,desktop:0,speed:0,sway:0,gust:0,size:1},
    calm:    {phone:5,tablet:7,desktop:9,speed:.59,sway:.51,gust:6,size:.86},
    mild:    {phone:10,tablet:14,desktop:19,speed:.94,sway:.84,gust:10,size:.96},
    stronger:{phone:15,tablet:21,desktop:27,speed:1.18,sway:1.12,gust:14,size:1}
  };
  // Fudgie 2026-10-14: leaves ALWAYS start on Calm for every page load.
  let mode=motionReduced?'off':'calm';
  let width=1,height=1,dpr=1,leaves=[],last=0,frame=0,visible=!document.hidden;
  let gust=null, gustBursts=[], gustEvents=0, gustTimer=0;
  const cursor={x:-999,y:-999,dx:0,dy:0,until:0};
  let touchStart=null;
  function rand(a,b){return a+Math.random()*(b-a)}
  function enabled(){return mode!=='off'}
  function config(){return MODES[mode]}
  function makeLeaf(maxHeight,fromTop){
    const size=rand(9,20)*(width<480?.77:1)*config().size;
    return {x:rand(-20,width+20),y:fromTop?rand(-height,-18):rand(-15,maxHeight+15),vx:rand(-7,7),vy:rand(21,47)*(width<480?.85:1),size,
      rot:rand(0,Math.PI*2),spin:rand(-1.5,1.5),phase:rand(0,Math.PI*2),freq:rand(.5,1.5),sway:rand(8,30),type:Math.floor(rand(0,3)),color:palette[Math.floor(rand(0,palette.length))],opacity:rand(.58,.85),flip:rand(-1,1)};
  }
  function resetCount(){
    const c=config(); let count=width<450?c.phone:width<900?c.tablet:c.desktop;
    if(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)count=Math.min(count,mode==='stronger'?16:mode==='mild'?12:8);
    while(leaves.length<count)leaves.push(makeLeaf(height,false));
    if(leaves.length>count)leaves.length=count;
  }
  function resize(){
    width=Math.max(leafViewport.innerWidth,1);height=Math.max(leafViewport.innerHeight,1);dpr=Math.min(leafViewport.devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);resetCount();
  }
  function drawMaple(){ctx.beginPath();ctx.moveTo(0,-1.10);ctx.lineTo(.18,-.68);ctx.lineTo(.54,-.87);ctx.lineTo(.48,-.43);ctx.lineTo(.87,-.43);ctx.lineTo(.57,-.12);ctx.lineTo(1,.08);ctx.lineTo(.50,.20);ctx.lineTo(.57,.58);ctx.lineTo(.15,.42);ctx.lineTo(0,.92);ctx.lineTo(-.15,.42);ctx.lineTo(-.57,.58);ctx.lineTo(-.50,.20);ctx.lineTo(-1,.08);ctx.lineTo(-.57,-.12);ctx.lineTo(-.87,-.43);ctx.lineTo(-.48,-.43);ctx.lineTo(-.54,-.87);ctx.lineTo(-.18,-.68);ctx.closePath()}
  function drawOak(){ctx.beginPath();ctx.moveTo(0,-1.07);ctx.bezierCurveTo(.48,-1.03,.45,-.68,.62,-.57);ctx.bezierCurveTo(.91,-.44,.71,-.27,.72,-.10);ctx.bezierCurveTo(.95,.12,.65,.27,.53,.31);ctx.bezierCurveTo(.73,.60,.28,.61,0,.79);ctx.bezierCurveTo(-.28,.61,-.73,.60,-.53,.31);ctx.bezierCurveTo(-.65,.27,-.95,.12,-.72,-.10);ctx.bezierCurveTo(-.71,-.27,-.91,-.44,-.62,-.57);ctx.bezierCurveTo(-.45,-.68,-.48,-1.03,0,-1.07);ctx.closePath()}
  function drawBirch(){ctx.beginPath();ctx.moveTo(0,-1.12);ctx.bezierCurveTo(1.18,-.8,1.10,.45,0,.90);ctx.bezierCurveTo(-1.10,.45,-1.18,-.8,0,-1.12);ctx.closePath()}
  function drawLeaf(l,t){
    ctx.save();ctx.translate(l.x+Math.sin(t*l.freq+l.phase)*l.sway*config().sway,l.y);
    ctx.rotate(l.rot);ctx.scale(l.size,l.size*(.45+.55*Math.abs(Math.cos(l.flip))));
    ctx.globalAlpha=l.opacity;ctx.fillStyle=l.color;
    if(l.type===0)drawMaple();else if(l.type===1)drawOak();else drawBirch();
    ctx.fill();ctx.strokeStyle='rgba(65,31,12,.3)';ctx.lineWidth=.05;ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-.69);ctx.lineTo(0,1.10);ctx.strokeStyle='rgba(75,30,12,.55)';ctx.lineWidth=.065;ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,.30);ctx.lineTo(-.47,-.22);ctx.moveTo(0,.18);ctx.lineTo(.44,-.33);
    ctx.lineWidth=.035;ctx.stroke();ctx.restore();
  }
  function animate(now){
    frame=0;if(!enabled()||!visible)return;
    const dt=Math.min((now-(last||now))/1000,.04);last=now;const seconds=now*.001;ctx.clearRect(0,0,width,height);
    for(let i=0;i<leaves.length;i++){
      let l=leaves[i];
      if(cursor.until>now){
        const dx=l.x-cursor.x,dy=l.y-cursor.y,dist=Math.hypot(dx,dy)||1;
        if(dist<140){const f=(1-dist/140);l.vx+=(dx/dist*110+cursor.dx*.9)*f*dt*config().speed;l.vy+=(dy/dist*55+cursor.dy*.25)*f*dt*config().speed;}
      }
      if(gust&&now-gust.t<1800){
        const age=(now-gust.t)/1800,strength=Math.pow(1-age,1.2);
        const dx=l.x-gust.x,dy=l.y-gust.y,dist=Math.hypot(dx,dy)||1;
        const inf=gust.wholePage?1:Math.max(0,1-dist/350);
        if(inf>0){l.vx+=gust.dir*370*dt*strength*inf*config().speed;l.vy-=90*dt*strength*inf*config().speed;}
      }
      l.vx*=1-.55*dt;
      l.x+=(l.vx+Math.sin(seconds*.87+l.phase)*8*config().sway)*dt;
      l.y+=(l.vy*config().speed+Math.sin(seconds*1.33+l.phase)*5*config().sway)*dt;
      l.rot+=l.spin*dt*config().speed;l.flip+=dt*(.6+l.freq)*config().speed;
      if(l.y>height+32||l.x>width+90||l.x<-90){leaves[i]=makeLeaf(-18,true);leaves[i].y=rand(-80,-12);l=leaves[i]}
      drawLeaf(l,seconds);
    }
    for(let i=gustBursts.length-1;i>=0;i--){
      const b=gustBursts[i];b.life-=dt;
      if(b.life<=0||b.x<-55||b.x>width+55){gustBursts.splice(i,1);continue}
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.vy+=18*dt;b.rot+=b.spin*dt*2.1;b.flip+=dt*2.6;
      b.opacity=Math.min(.86,Math.max(0,b.life/.7)*.86);drawLeaf(b,seconds);
    }
    // Wind is rendered exclusively as leaf movement. Never draw flashing wind streaks.
    frame=requestAnimationFrame(animate);
  }
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;gustBursts=[];gust=null;ctx.clearRect(0,0,width,height)}
  function start(){if(frame||!enabled()||!visible)return;last=0;frame=requestAnimationFrame(animate)}
  function feedback(message){
    if(!status)return;status.textContent=message;status.classList.add('blowing');
    clearTimeout(gustTimer);gustTimer=setTimeout(()=>{status.classList.remove('blowing');},1700);
  }
  function refreshControls(){
    const word=mode.charAt(0).toUpperCase()+mode.slice(1);
    selector.innerHTML='🍁 <span>'+word+'</span> <span aria-hidden="true">▾</span>';
    selector.setAttribute('aria-label','Falling leaves: '+word+'. Change intensity');
    modeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.leafMode===mode)));
    canvas.hidden=!enabled();if(localCanvas && localCanvas!==canvas)localCanvas.hidden=true;gustBtn.disabled=!enabled();gustBtn.style.opacity=enabled()?'1':'.45';
  }
  function closeMenu(){menu.hidden=true;selector.setAttribute('aria-expanded','false')}
  function setMode(next,save){
    if(!Object.hasOwn(MODES,next))return;
    const wasOn=enabled();mode=next;gust=null;gustBursts=[];
    if(save){try{localStorage.setItem(SETTINGS_KEY,next)}catch(e){}}
    if(!enabled()){stop();leaves=[];}else{if(!wasOn)leaves=[];resetCount();start();}
    refreshControls();closeMenu();feedback('Falling leaves set to '+next+'.');
  }
  function doGust(x,y,dir,wholePage){
    if(!enabled())return;
    const direction=dir<0?-1:1;
    gust={x,y,t:performance.now(),dir:direction,wholePage:!!wholePage};gustEvents++;
    if(wholePage){
      gustBursts=[];const amount=config().gust;
      for(let i=0;i<amount;i++){
        const b=makeLeaf(height,false);b.x=direction>0?rand(0,width*.32):rand(width*.68,width);
        b.y=rand(35,Math.max(36,height-30));b.vx=direction*rand(140,280)*config().speed;b.vy=rand(-75,20);
        b.life=rand(1.4,2);b.opacity=.86;gustBursts.push(b);
      }
    }
  }
  function pointerInCanvas(ev){
    if(leafViewport===window)return {x:ev.clientX,y:ev.clientY};
    const frame=window.frameElement;
    const rect=frame?frame.getBoundingClientRect():{left:0,top:0};
    return {x:ev.clientX+rect.left,y:ev.clientY+rect.top};
  }
  selector.addEventListener('click',function(){menu.hidden=!menu.hidden;selector.setAttribute('aria-expanded',String(!menu.hidden))});
  modeButtons.forEach(button=>button.addEventListener('click',function(){setMode(button.dataset.leafMode,true);selector.focus()}));
  document.addEventListener('pointerdown',function(ev){if(!controls.contains(ev.target))closeMenu()},{passive:true});
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!menu.hidden){closeMenu();selector.focus()}});
  window.addEventListener('pointermove',function(ev){
    if(!enabled()||controls.contains(ev.target))return;
    const pos=pointerInCanvas(ev);const oldX=cursor.x,oldY=cursor.y;cursor.x=pos.x;cursor.y=pos.y;
    cursor.dx=Math.abs(oldX)>10000?0:Math.max(-50,Math.min(50,ev.clientX-oldX));
    cursor.dy=Math.abs(oldY)>10000?0:Math.max(-50,Math.min(50,ev.clientY-oldY));cursor.until=performance.now()+220;
  },{passive:true});
  window.addEventListener('pointerdown',function(ev){
    if(!enabled()||controls.contains(ev.target)||ev.target.closest('button,a,input,select,textarea'))return;
    const pos=pointerInCanvas(ev);touchStart=pos;doGust(pos.x,pos.y,pos.x>width/2?1:-1,false);
  },{passive:true});
  window.addEventListener('pointerup',function(ev){
    if(!enabled()||!touchStart)return;const pos=pointerInCanvas(ev);const dx=pos.x-touchStart.x;
    if(Math.abs(dx)>65)doGust(pos.x,pos.y,dx>0?1:-1,true);touchStart=null;
  },{passive:true});
  gustBtn.addEventListener('click',function(){
    if(!enabled())return;doGust(width/2,height/2,Math.random()>.5?1:-1,true);
    feedback('A gust is moving the leaves!');
  });
  leafViewport.addEventListener('resize',resize,{passive:true});
  if(leafViewport!==window)window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',function(){visible=!document.hidden;if(visible)start();else stop()});
  resize();refreshControls();if(enabled())start();
  window.TSCMSAutumnPreview={status:function(){return{mode,enabled:enabled(),count:leaves.length,width,height,frameActive:Boolean(frame),reducedMotion:motionReduced,gustEvents,activeGust:Boolean(gust&&performance.now()-gust.t<1800),burstLeaves:gustBursts.length}}};
})();