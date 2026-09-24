// Legacy rig, face, hair, orientation, walk, FX and micro-interaction code (v16.4.14).
// Evaluated inside each mascot instance; every top-level binding is instance-local.
  function cpy(p){return JSON.parse(JSON.stringify(p))}
function lp(a,b,t){return a+(b-a)*t} function ease(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
function smooth3(t){t=clamp(t);return t*t*(3-2*t)}
function smooth5(t){t=clamp(t);return t*t*t*(t*(t*6-15)+10)}
function motionWindow(t,a,b){if(t<=a||t>=b)return 0;const q=Math.sin(Math.PI*(t-a)/(b-a));return q*q}
const POINTS=['head_center','neck','shoulder_L','elbow_L','wrist_L','hand_L_center','shoulder_R','elbow_R','wrist_R','hand_R_center','pelvis','hip_L','knee_L','ankle_L','foot_L_center','hip_R','knee_R','ankle_R','foot_R_center'];
function lerpPose(a,b,t){const r={};POINTS.forEach(k=>{r[k]=[lp(a[k][0],b[k][0],t),lp(a[k][1],b[k][1],t)]});r.head_radius=lp(a.head_radius,b.head_radius,t);return r}
function nearly(a,b,eps=.0001){return Math.abs(a-b)<=eps}
function motionTension(state){if(state==='sleep')return .22;if(state==='error')return .22;if(state==='welcome')return .62;if(state==='success')return .42;return .70}
function findSegment(ks,t){for(let i=0;i<ks.length-1;i++)if(t>=ks[i].t&&t<=ks[i+1].t)return i;return ks.length-2}
function coordAt(ks,key,dim,j){return ks[j].pose[key][dim]}
function scalarAt(ks,key,j){return ks[j].pose[key]}
function derivativeCoord(ks,key,dim,j,state){
  const cur=coordAt(ks,key,dim,j), n=ks.length;
  if(j>0&&nearly(cur,coordAt(ks,key,dim,j-1)))return 0;
  if(j<n-1&&nearly(cur,coordAt(ks,key,dim,j+1)))return 0;
  let d;
  if(j===0){const dt=ks[1].t-ks[0].t;d=(coordAt(ks,key,dim,1)-cur)/dt;}
  else if(j===n-1){const dt=ks[n-1].t-ks[n-2].t;d=(cur-coordAt(ks,key,dim,n-2))/dt;}
  else{const dt=ks[j+1].t-ks[j-1].t;d=(coordAt(ks,key,dim,j+1)-coordAt(ks,key,dim,j-1))/dt;}
  return d*(1-motionTension(state));
}
function derivativeScalar(ks,key,j,state){
  const cur=scalarAt(ks,key,j),n=ks.length;
  if(j>0&&nearly(cur,scalarAt(ks,key,j-1)))return 0;
  if(j<n-1&&nearly(cur,scalarAt(ks,key,j+1)))return 0;
  let d;
  if(j===0)d=(scalarAt(ks,key,1)-cur)/(ks[1].t-ks[0].t);
  else if(j===n-1)d=(cur-scalarAt(ks,key,n-2))/(ks[n-1].t-ks[n-2].t);
  else d=(scalarAt(ks,key,j+1)-scalarAt(ks,key,j-1))/(ks[j+1].t-ks[j-1].t);
  return d*(1-motionTension(state));
}
function hermite(p0,p1,m0,m1,u){const u2=u*u,u3=u2*u;return (2*u3-3*u2+1)*p0+(u3-2*u2+u)*m0+(-2*u3+3*u2)*p1+(u3-u2)*m1}
function pointTime(state,key,t){
  if(state==='success'||state==='sleep'||state==='error')return clamp(t,0,1);
  let off=0,w=0;
  if(state==='welcome'){
    if(t>.14&&t<.32){w=motionWindow(t,.14,.32);if(key==='shoulder_L')off=.006*w;else if(key==='elbow_L')off=.002*w;else if(key==='wrist_L'||key==='hand_L_center')off=-.010*w;else if(key==='wrist_R'||key==='hand_R_center')off=-.003*w;}
    else if(t>.70&&t<.94){w=motionWindow(t,.70,.94);if(key==='shoulder_L')off=.006*w;else if(key==='elbow_L')off=.001*w;else if(key==='wrist_L'||key==='hand_L_center')off=-.012*w;}
  }else if(state==='success'){
    if(t>.15&&t<.45){w=motionWindow(t,.15,.45);if(['pelvis','hip_L','hip_R','knee_L','knee_R','ankle_L','ankle_R','foot_L_center','foot_R_center'].includes(key))off=.007*w;else if(['wrist_L','hand_L_center','wrist_R','hand_R_center'].includes(key))off=-.010*w;else if(key==='head_center'||key==='neck')off=.003*w;}
    else if(t>.59&&t<.88){w=motionWindow(t,.59,.88);if(['pelvis','hip_L','hip_R','knee_L','knee_R','ankle_L','ankle_R'].includes(key))off=.007*w;else if(['head_center','neck','wrist_L','hand_L_center','wrist_R','hand_R_center'].includes(key))off=-.006*w;}
  }else if(state==='error'){
    if(t>.15&&t<.46){w=motionWindow(t,.15,.46);if(key==='head_center'||key==='neck')off=.004*w;else if(key==='shoulder_R')off=.003*w;else if(key==='elbow_R')off=.006*w;else if(key==='wrist_R'||key==='hand_R_center')off=.009*w;else if(key==='wrist_L'||key==='hand_L_center')off=-.004*w;}
    else if(t>.64&&t<.92){w=motionWindow(t,.64,.92);if(key==='head_center'||key==='neck')off=-.003*w;else if(key==='wrist_R'||key==='hand_R_center')off=-.007*w;}
  }else if(state==='empty'){
    if(t>.14&&t<.34){w=motionWindow(t,.14,.34);if(key==='shoulder_L'||key==='shoulder_R')off=.006*w;else if(key==='elbow_L'||key==='elbow_R')off=.002*w;else if(['wrist_L','hand_L_center','wrist_R','hand_R_center'].includes(key))off=-.006*w;else if(key==='head_center')off=.002*w;}
    else if(t>.58&&t<.90){w=motionWindow(t,.58,.90);if(key==='shoulder_L'||key==='shoulder_R')off=.004*w;else if(['wrist_L','hand_L_center','wrist_R','hand_R_center'].includes(key))off=-.006*w;}
  }else if(state==='sleep'){
    if(t>.12&&t<.94){w=motionWindow(t,.12,.94);if(key==='head_center'||key==='neck')off=.010*w;else if(key==='shoulder_L')off=.010*w;else if(key==='elbow_L')off=.017*w;else if(key==='wrist_L'||key==='hand_L_center')off=.024*w;else if(key==='shoulder_R'||key==='elbow_R'||key==='wrist_R'||key==='hand_R_center')off=.007*w;else if(['knee_L','ankle_L','foot_L_center','knee_R','ankle_R','foot_R_center'].includes(key))off=-.006*w;}
  }
  return clamp(t+off,0,1);
}
function samplePoint(ks,key,t,state){
  if(t<=ks[0].t)return ks[0].pose[key].slice();if(t>=ks[ks.length-1].t)return ks[ks.length-1].pose[key].slice();
  const i=findSegment(ks,t),a=ks[i],b=ks[i+1],dt=b.t-a.t,u=(t-a.t)/dt,out=[];
  for(let dim=0;dim<2;dim++){
    const p0=a.pose[key][dim],p1=b.pose[key][dim];
    if(nearly(p0,p1)){out.push(p0);continue;}
    const m0=derivativeCoord(ks,key,dim,i,state)*dt,m1=derivativeCoord(ks,key,dim,i+1,state)*dt;
    out.push(hermite(p0,p1,m0,m1,u));
  }
  return out;
}
function sampleScalar(ks,key,t,state){
  if(t<=ks[0].t)return ks[0].pose[key];if(t>=ks[ks.length-1].t)return ks[ks.length-1].pose[key];
  const i=findSegment(ks,t),a=ks[i],b=ks[i+1],dt=b.t-a.t,u=(t-a.t)/dt,p0=a.pose[key],p1=b.pose[key];
  if(nearly(p0,p1))return p0;
  return hermite(p0,p1,derivativeScalar(ks,key,i,state)*dt,derivativeScalar(ks,key,i+1,state)*dt,u);
}
function addOffset(p,key,dx,dy){if(!p[key])return;p[key][0]+=dx;p[key][1]+=dy}
function applyMotionArcs(state,t,p){
  if(state==='success'||state==='sleep')return p;
  if(state==='welcome'){
    if(t>.14&&t<.32){const w=motionWindow(t,.14,.32);addOffset(p,'wrist_L',-10*w,-6*w);addOffset(p,'hand_L_center',-10*w,-6*w);addOffset(p,'elbow_L',-3*w,-2*w);}
    if(t>.32&&t<.70){const ks=DATA.keyframes.welcome,i=findSegment(ks,t),u=(t-ks[i].t)/(ks[i+1].t-ks[i].t);let arc=Math.sin(Math.PI*u);arc*=arc;addOffset(p,'wrist_L',0,-7*arc);addOffset(p,'hand_L_center',0,-7*arc);}
    if(t>.70&&t<.94){const w=motionWindow(t,.70,.94);addOffset(p,'wrist_L',8*w,-4*w);addOffset(p,'hand_L_center',8*w,-4*w);}
  }else if(state==='success'){
    if(t>.15&&t<.45){const w=motionWindow(t,.15,.45);addOffset(p,'wrist_L',-7*w,-5*w);addOffset(p,'hand_L_center',-7*w,-5*w);addOffset(p,'wrist_R',7*w,-5*w);addOffset(p,'hand_R_center',7*w,-5*w);}
  }else if(state==='sleep'){
    if(t>.40&&t<.94){const w=motionWindow(t,.40,.94);addOffset(p,'head_center',-3*w,0);addOffset(p,'wrist_L',-4*w,1*w);addOffset(p,'hand_L_center',-4*w,1*w);}
  }
  return p;
}
function enforceTopology(state,p){
  if(state==='success'){
    // 1) Head must remain physically connected to the neck.
    const bottom=p.head_center[1]+p.head_radius;
    const gap=p.neck[1]-bottom;
    if(gap>3)p.head_center[1]+=gap-2;

    // 2) Torso endpoint (pelvis) must remain connected to the hip root.
    const hx=(p.hip_L[0]+p.hip_R[0])*.5,hy=(p.hip_L[1]+p.hip_R[1])*.5;
    const dx=p.pelvis[0]-hx,dy=p.pelvis[1]-hy,d=Math.hypot(dx,dy);
    if(d>6.5){
      const s=6.5/d;
      p.pelvis[0]=hx+dx*s;
      p.pelvis[1]=hy+dy*s;
    }
  }
  if(state==='sleep'){
    // During the descent the neck must stay in contact with the head contour.
    // The approved final Sleep target already has its own horizontal geometry.
    const dx=p.neck[0]-p.head_center[0],dy=p.neck[1]-p.head_center[1];
    const d=Math.hypot(dx,dy),allowed=p.head_radius+12;
    if(d>allowed&&d>0){
      const e=d-allowed;
      p.head_center[0]+=dx/d*e;
      p.head_center[1]+=dy/d*e;
    }
  }
  return p;
}
function timelinePose(state,t){
  if(state==='success')return celebrationPose(t);
  if(state==='welcome'&&t<=.32){
    // v15.6: one continuous lift. The old .14 staging point is bypassed,
    // removing the slow pickup / small acceleration break seen at the start.
    const u=clamp(t/.32);
    const q=smooth3(u);
    const target=DATA.keyframes.welcome.find(k=>Math.abs(k.t-.32)<1e-6).pose;
    const r=lerpPose(DATA.poses.idle,target,q);

    // Shallow curved arm path. Offset returns to zero at both endpoints.
    const arc=Math.sin(Math.PI*q);
    addOffset(r,'elbow_L',-2.5*arc,-1.5*arc);
    addOffset(r,'wrist_L',-8*arc,-5*arc);
    addOffset(r,'hand_L_center',-10*arc,-6*arc);
    return r;
  }
  if(state==='error'){
    // Dedicated C2-continuous Error gesture:
    // zero velocity/acceleration at Idle, target arrival, target departure and final settle.
    let q;
    if(t<=.46)q=smooth5(clamp(t/.46));
    else if(t<=.64)q=1;
    else if(t<.94)q=1-smooth5(clamp((t-.64)/.30));
    else q=0;
    const r=lerpPose(DATA.poses.idle,DATA.poses.error,q);

    // Small continuous arm arc; it is driven by q, so it is smooth in both directions.
    const arc=Math.sin(Math.PI*q);
    addOffset(r,'elbow_R',6*arc,-4*arc);
    addOffset(r,'wrist_R',10*arc,-8*arc);
    addOffset(r,'hand_R_center',14*arc,-10*arc);
    return r;
  }
  const ks=DATA.keyframes[state];if(!ks)return DATA.poses[state];
  if(t<=ks[0].t)return cpy(ks[0].pose);if(t>=ks[ks.length-1].t)return cpy(ks[ks.length-1].pose);
  const r={};POINTS.forEach(k=>r[k]=samplePoint(ks,k,pointTime(state,k,t),state));r.head_radius=sampleScalar(ks,'head_radius',t,state);
  return enforceTopology(state,applyMotionArcs(state,t,r));
}
function headRotationFor(state,t,entered=false){
if(state==='thinking'){
  const target=DATA.headRot.thinking||0;
  if(entered)return target+Math.sin(motionNow()/850)*1.1;
  return target*smooth5(clamp(t));
}
if(state==='wake')return (DATA.headRot.sleep||0)*(1-smooth3(clamp(t)));
if(state==='sleep'){if(entered)return DATA.headRot.sleep||0;return (DATA.headRot.sleep||0)*smooth5(clamp((t-.12)/.82));}
if(state==='error'){
  const target=DATA.headRot.error||0;
  if(t<.15)return 0;if(t<.46)return target*smooth5((t-.15)/.31);if(t<=.64)return target;if(t<.92)return target*(1-smooth5((t-.64)/.28));return 0;
}
return DATA.headRot[state]||0;
}
function seg(a,b,cls='bone',dash=false){return `<line class="${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${dash?'stroke-dasharray="15 12"':''}/>`}
function angle(a,b){return Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI}
function faceParts(mode,cx,cy,r,blink=0,eyeOffset=[0,0]){
  const s=r/185;
  const E=(x,y,rx,ry)=>{
    const minRy=2.2*s;
    const bry=Math.max(minRy,ry*(1-blink)+minRy*blink);
    const ox=eyeOffset[0]||0, oy=eyeOffset[1]||0;
    // Kawaii catch-light: a small shine that follows the gaze, hidden when the eye closes.
    const shine=bry>ry*.55?`<circle class="eyeShine" cx="${x+ox-rx*.32}" cy="${y+oy-bry*.38}" r="${rx*.36}"/>`:'';
    return `<ellipse class="eye" cx="${x+ox}" cy="${y+oy}" rx="${rx}" ry="${bry}"/>${shine}`;
  };
  const P=d=>`<path class="faceStroke" d="${d}"/>`;
  const O=d=>`<path class="faceOpenMouth" d="${d}"/>`;

  let brows='',eyes='',mouth='';

  if(mode==='tapSurprised'){
    brows=
      P(`M ${cx-72*s} ${cy-90*s} Q ${cx-48*s} ${cy-112*s} ${cx-24*s} ${cy-90*s}`)+
      P(`M ${cx+22*s} ${cy-90*s} Q ${cx+46*s} ${cy-112*s} ${cx+70*s} ${cy-90*s}`);
    eyes=
      E(cx-48*s,cy-16*s,15*s,32*s)+
      E(cx+45*s,cy-16*s,15*s,32*s);
    mouth=`<ellipse class="faceStroke" cx="${cx+2*s}" cy="${cy+60*s}" rx="${17*s}" ry="${23*s}"/>`;
  }
  else if(mode==='tapPlayful'){
    brows=
      P(`M ${cx-68*s} ${cy-72*s} Q ${cx-48*s} ${cy-88*s} ${cx-28*s} ${cy-72*s}`)+
      P(`M ${cx+24*s} ${cy-76*s} Q ${cx+45*s} ${cy-88*s} ${cx+65*s} ${cy-70*s}`);
    eyes=
      P(`M ${cx-68*s} ${cy-10*s} Q ${cx-48*s} ${cy+12*s} ${cx-28*s} ${cy-10*s}`)+
      E(cx+45*s,cy-10*s,13*s,28*s);
    mouth=P(`M ${cx-45*s} ${cy+52*s} Q ${cx+5*s} ${cy+90*s} ${cx+58*s} ${cy+42*s}`);
  }
  else if(mode==='tapOuch'){
    brows=
      P(`M ${cx-70*s} ${cy-76*s} L ${cx-30*s} ${cy-94*s}`)+
      P(`M ${cx+24*s} ${cy-94*s} L ${cx+64*s} ${cy-74*s}`);
    eyes=
      P(`M ${cx-68*s} ${cy-12*s} Q ${cx-48*s} ${cy+10*s} ${cx-28*s} ${cy-12*s}`)+
      E(cx+45*s,cy-12*s,13*s,28*s);
    mouth=`<ellipse class="faceStroke" cx="${cx+4*s}" cy="${cy+60*s}" rx="${15*s}" ry="${20*s}"/>`;
  }
  else if(mode==='tapSquint'){
    brows=
      P(`M ${cx-66*s} ${cy-72*s} Q ${cx-48*s} ${cy-84*s} ${cx-28*s} ${cy-70*s}`)+
      P(`M ${cx+25*s} ${cy-70*s} Q ${cx+45*s} ${cy-84*s} ${cx+64*s} ${cy-68*s}`);
    eyes=
      P(`M ${cx-68*s} ${cy-12*s} Q ${cx-48*s} ${cy+10*s} ${cx-28*s} ${cy-12*s}`)+
      P(`M ${cx+24*s} ${cy-12*s} Q ${cx+44*s} ${cy+10*s} ${cx+64*s} ${cy-12*s}`);
    mouth=P(`M ${cx-42*s} ${cy+52*s} Q ${cx+4*s} ${cy+84*s} ${cx+52*s} ${cy+48*s}`);
  }
  else if(mode==='thinking'){
    brows=
      P(`M ${cx-68*s} ${cy-78*s} Q ${cx-48*s} ${cy-92*s} ${cx-28*s} ${cy-76*s}`)+
      P(`M ${cx+24*s} ${cy-82*s} Q ${cx+46*s} ${cy-94*s} ${cx+66*s} ${cy-76*s}`);
    eyes=
      E(cx-40*s,cy-30*s,13*s,27*s)+
      E(cx+54*s,cy-34*s,13*s,27*s);
    mouth=P(`M ${cx-18*s} ${cy+60*s} Q ${cx+4*s} ${cy+48*s} ${cx+25*s} ${cy+58*s}`);
  }
  else if(mode==='success'){
    eyes=
      P(`M ${cx-62*s} ${cy-22*s} Q ${cx-43*s} ${cy-45*s} ${cx-23*s} ${cy-22*s}`)+
      P(`M ${cx+23*s} ${cy-22*s} Q ${cx+43*s} ${cy-45*s} ${cx+63*s} ${cy-22*s}`);
    mouth=O(`M ${cx-48*s} ${cy+26*s} Q ${cx} ${cy+90*s} ${cx+50*s} ${cy+16*s} Q ${cx+8*s} ${cy+118*s} ${cx-48*s} ${cy+26*s}`);
  }
  else if(mode==='sleep'){
    eyes=
      P(`M ${cx-72*s} ${cy-16*s} Q ${cx-52*s} ${cy+10*s} ${cx-28*s} ${cy-14*s}`)+
      P(`M ${cx+15*s} ${cy-34*s} Q ${cx+37*s} ${cy-8*s} ${cx+57*s} ${cy-34*s}`);
    mouth=P(`M ${cx-20*s} ${cy+50*s} Q ${cx+18*s} ${cy+72*s} ${cx+52*s} ${cy+35*s}`);
  }
  else if(mode==='error'){
    brows=
      P(`M ${cx-68*s} ${cy-80*s} L ${cx-32*s} ${cy-105*s}`)+
      P(`M ${cx+24*s} ${cy-105*s} L ${cx+65*s} ${cy-82*s}`);
    eyes=
      E(cx-48*s,cy-20*s,13*s,28*s)+
      E(cx+45*s,cy-20*s,13*s,28*s);
    mouth=P(`M ${cx-55*s} ${cy+72*s} Q ${cx} ${cy+22*s} ${cx+55*s} ${cy+72*s}`);
  }
  else if(mode==='empty'){
    brows=
      P(`M ${cx-66*s} ${cy-72*s} Q ${cx-48*s} ${cy-85*s} ${cx-28*s} ${cy-70*s}`)+
      P(`M ${cx+25*s} ${cy-70*s} Q ${cx+45*s} ${cy-84*s} ${cx+64*s} ${cy-68*s}`);
    eyes=
      E(cx-48*s,cy-10*s,13*s,28*s)+
      E(cx+45*s,cy-10*s,13*s,28*s);
    mouth=P(`M ${cx-15*s} ${cy+60*s} Q ${cx} ${cy+42*s} ${cx+17*s} ${cy+60*s}`);
  }
  else if(mode==='welcome'){
    brows=
      P(`M ${cx-66*s} ${cy-70*s} Q ${cx-48*s} ${cy-84*s} ${cx-28*s} ${cy-70*s}`)+
      P(`M ${cx+25*s} ${cy-70*s} Q ${cx+45*s} ${cy-84*s} ${cx+65*s} ${cy-68*s}`);
    eyes=
      E(cx-48*s,cy-10*s,13*s,28*s)+
      E(cx+45*s,cy-10*s,13*s,28*s);
    mouth=O(`M ${cx-50*s} ${cy+30*s} Q ${cx} ${cy+92*s} ${cx+55*s} ${cy+24*s} Q ${cx+12*s} ${cy+112*s} ${cx-50*s} ${cy+30*s}`);
  }
  else{
    brows=
      P(`M ${cx-66*s} ${cy-70*s} Q ${cx-48*s} ${cy-84*s} ${cx-28*s} ${cy-70*s}`)+
      P(`M ${cx+25*s} ${cy-70*s} Q ${cx+45*s} ${cy-84*s} ${cx+65*s} ${cy-68*s}`);
    eyes=
      E(cx-48*s,cy-10*s,13*s,28*s)+
      E(cx+45*s,cy-10*s,13*s,28*s);
    mouth=P(`M ${cx-45*s} ${cy+58*s} Q ${cx} ${cy+84*s} ${cx+55*s} ${cy+50*s}`);
  }

  // Kawaii cheeks, under and outside the eyes (hidden by a beard).
  const cheeks=(typeof APPEARANCE==='undefined'||APPEARANCE.cheeks!==false)&&!wearsBeard()
    ?`<ellipse class="blush" cx="${cx-86*s}" cy="${cy+30*s}" rx="${25*s}" ry="${14*s}"/><ellipse class="blush" cx="${cx+84*s}" cy="${cy+30*s}" rx="${25*s}" ry="${14*s}"/>`:'';
  brows=cheeks+brows;
  return {brows,eyes,mouth};
}

// Beard style: a horseshoe moustache that follows the upper lip of the mouth
// being drawn (any expression, any turn) and drops at the corners into the
// beard. The mouth geometry is recorded (head units, relative to the head
// centre, before head rotation) so the beard opens exactly around it.
const FACE_X={shift:0,scaleX:1};
let BEARD_MOUTH=null;
// Level of detail: below ~200 device pixels wide, the faint texture strokes of the hair (opacity
// ≤ .3) are thinner than a pixel and invisible, but they are most of the DOM of the
// afro, dreadlocks and braids. The runtime sets this flag before each render.
let HAIR_LOD=false;
const hairLod=svg=>svg.indexOf('hairDetail')<0?svg:svg.replace(/<path [^>]*class="hairDetail" style="[^"]*opacity:(0?\.[0-2]\d*|\.30*)"\/>/g,'');
function quadMaxY(y0,qy,y1){const d=y0-2*qy+y1,t=d?clamp((y0-qy)/d):0;return Math.max(y0,y1,(1-t)*(1-t)*y0+2*(1-t)*t*qy+t*t*y1);}
// The beard is one of Uko's hairstyles: the other characters never wear it.
function wearsBeard(){return typeof APPEARANCE!=='undefined'&&APPEARANCE.hairStyle==='barbe'&&!characterDef();}
function beardMoustache(mouth,cx,cy,s){
  if(!wearsBeard()||!mouth)return '';
  let q=null,bottom=-1e9;
  const m=/d="M\s*(-?[\d.]+)\s+(-?[\d.]+)\s*Q\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*Q\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+))?/.exec(mouth);
  if(m){
   const v=m.slice(1).map(Number);q=v.slice(0,6);
   bottom=quadMaxY(v[1],v[3],v[5]);
   if(!isNaN(v[6]))bottom=Math.max(bottom,quadMaxY(v[5],v[7],v[9]));
  }else{
   const e=/cx="(-?[\d.]+)" cy="(-?[\d.]+)" rx="(-?[\d.]+)" ry="(-?[\d.]+)"/.exec(mouth);
   if(e){const [ex,ey,rx,ry]=e.slice(1).map(Number);q=[ex-rx,ey,ex,ey-2*ry,ex+rx,ey];bottom=ey+ry;}
  }
  if(!q)return '';
  let [x0,y0,qx,qy,x1,y1]=q;if(x0>x1)[x0,y0,x1,y1]=[x1,y1,x0,y0];
  const B=t=>[(1-t)*(1-t)*x0+2*(1-t)*t*qx+t*t*x1,(1-t)*(1-t)*y0+2*(1-t)*t*qy+t*t*y1];
  const th=20*s,off=7*s+th/2,side=off+3*s;
  const hole=Math.max(88,(bottom-cy)/s+14);
  const drop=y=>Math.max(y+26*s,cy+(hole+10)*s),pts=[[x0-side,drop(y0)]];
  for(let i=0;i<=10;i++){
   const t=i/10,p=B(t),a=B(Math.max(0,t-.05)),b=B(Math.min(1,t+.05)),l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
   let nx=(b[1]-a[1])/l,ny=-(b[0]-a[0])/l;if(ny>0){nx=-nx;ny=-ny;}
   // Upward above the lip, turning outward at the corners (clear of the eyes).
   const w=smooth5(clamp(Math.min(t,1-t)/.22)),ox=lp(t<.5?-1:1,nx,w),oy=lp(0,ny,w),ol=Math.hypot(ox,oy)||1;
   pts.push([p[0]+ox/ol*off,p[1]+oy/ol*off]);
  }
  pts.push([x1+side,drop(y1)]);
  // Stay on the head: in profile the lip reaches the contour.
  const lim=176*s;
  for(const p of pts){const dx=p[0]-cx,dy=p[1]-cy,d=Math.hypot(dx,dy);if(d>lim){p[0]=cx+dx*lim/d;p[1]=cy+dy*lim/d;}}
  const X=x=>(FACE_X.shift+(x-cx)*FACE_X.scaleX)/s;
  BEARD_MOUTH={x0:X(x0-side),x1:X(x1+side),y0:(y0-cy)/s,y1:(y1-cy)/s,hole};
  return `<path class="moustache" d="${hairSmoothPath(pts)}" style="stroke-width:${th}"${HAIR_OUTLINE_FILTER?` filter="url(#${HAIR_OUTLINE_FILTER})"`:''}/>`;
}

function face(mode,cx,cy,r,rot=0,blink=0,eyeOffset=[0,0]){
  const p=faceParts(mode,cx,cy,r,blink,eyeOffset);
  return `<g transform="rotate(${rot} ${cx} ${cy})">${p.brows}${p.eyes}${beardMoustache(p.mouth,cx,cy,r/185)}${p.mouth}</g>`;
}

function faceBlend(spec,cx,cy,r,rot=0,blink=0,eyeOffset=[0,0]){
  // Animator's trick: the expression changes while the eyes are closed, so the
  // viewer never sees two faces at once (no cross-fade, no ghost eyes).
  const u=clamp(spec.u);
  const shut=smooth5(clamp(1-Math.abs(u-.5)/.2));
  return face(u<.5?spec.from:spec.to,cx,cy,r,rot,Math.max(blink,shut),eyeOffset);
}

function renderFaceSpec(spec,cx,cy,r,rot=0,blink=0,eyeOffset=[0,0]){
  return typeof spec==='string'
    ? face(spec,cx,cy,r,rot,blink,eyeOffset)
    : faceBlend(spec,cx,cy,r,rot,blink,eyeOffset);
}

function faceSpecHasThinking(spec){
  if(typeof spec==='string')return spec==='thinking';
  if(!spec)return false;
  return (spec.from==='thinking'&&spec.u<.88)||(spec.to==='thinking'&&spec.u>.12);
}
const APPEARANCE={
  hairStyle:'mi_long'
};

function screenFaceDirFromYaw(yaw){
  // Yaw is expressed in CHARACTER turn direction: + = character turns right.
  // From the viewer, that means the face points to screen-left, so facial/head
  // projection is the opposite sign. This keeps body near/far depth and the
  // surviving eye anatomically consistent through 3/4 -> profile.
  return yaw<0?1:-1;
}

const HAIR_STYLES=HAIR_CATALOG;
const HAIR_DYNAMICS={model:null,style:null,chains:[],last:0,frame:null,sleepSettled:null,sleepSettleCount:0};
const HAIR_MODELS=new Map();
const hMix=(a,b,t)=>a.length===3?[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]:a.map((v,i)=>v+(b[i]-v)*t);
const hLen=(a,b)=>a.length===3?Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]):a.length===2?Math.hypot(a[0]-b[0],a[1]-b[1]):Math.hypot(...a.map((v,i)=>v-b[i]));
function hairModel(style){
 if(HAIR_MODELS.has(style))return HAIR_MODELS.get(style);
 const m={style,cap:[],locks:[],details:[],curls:[],ink:[],groom:null,bun:null};
 const short=style==='tres_court'||style==='degrade';
 const scalpR=short?188:192;
 const hairline=lon=>{
  const f=Math.max(0,Math.cos(lon));
  // Temples follow the round skull; the nape is lower, without a straight helmet edge.
  if(style==='mi_long')return 1.97-1.08*Math.pow(f,.60)-.12*Math.pow(Math.sin(lon),2);
  if(style==='classique')return 1.67-.80*Math.pow(f,.65)-.14*Math.pow(Math.sin(lon),2);
  if(style==='afro')return 1.55-.87*Math.pow(f,.7)+.25*Math.max(0,-Math.cos(lon));
  if(style==='dreadlocks')return .79+.88*smooth5(clamp((Math.acos(Math.cos(lon))-.68)/1.22));
  return 1.93-.99*Math.pow(f,.65)-.17*Math.pow(Math.sin(lon),2);
 };
 const scalp=(lon,phi,extra=0)=>{
  const crown=Math.pow(Math.max(0,Math.cos(phi)),2);
  const lift=style==='mi_long'?91*crown:style==='classique'?77*crown:style==='degrade'?16*crown:0;
  const rr=scalpR+extra;
  return [rr*Math.sin(phi)*Math.sin(lon),-rr*Math.cos(phi)-lift,rr*Math.sin(phi)*Math.cos(lon)];
 };
 const curve=(a,b,c,d,n=18)=>Array.from({length:n},(_,i)=>{const t=i/(n-1),q=1-t;return a.map((v,j)=>q*q*q*v+3*q*q*t*b[j]+3*q*t*t*c[j]+t*t*t*d[j]);});
 const lock=(points,width,stiffness=30,anchor=2,texture='flow',isStatic=false)=>m.locks.push({points,width,stiffness,anchor,texture,isStatic,lengths:points.slice(1).map((p,i)=>hLen(p,points[i])),bends:points.slice(2).map((p,i)=>hLen(p,points[i]))});
 if(style==='chauve'){HAIR_MODELS.set(style,m);return m;}
 if(style==='original'){
  for(let i=0;i<3;i++){
   const root=scalp(-.65+i*.42,.94-i*.12);
   lock(curve(root,[root[0]-10,root[1]-40,root[2]],[root[0]+30,-215-i*8,root[2]-25],[root[0]+78,-205-i*5,root[2]-45]),13,110,2,'plain');
  }
  HAIR_MODELS.set(style,m);return m;
 }
 // Volume styles (src/core/hair-styles.js): afro, curls, straight, wavy, pixie,
 // ponytail, braids, cornrows, beard.
 if(EXTRA_HAIR[style]){EXTRA_HAIR[style](m,{scalp,curve,lock});HAIR_MODELS.set(style,m);return m;}
 for(let i=0;i<64;i++){
  const a=-Math.PI+i*Math.PI/32,b=a+Math.PI/32,points=[];
  if(style==='mi_long'||style==='classique'||style==='afro')continue;
  for(let j=0;j<=15;j++)points.push(scalp(a,(style==='dreadlocks'?.86:hairline(a))*j/15));
  for(let j=15;j>=0;j--)points.push(scalp(b,(style==='dreadlocks'?.86:hairline(b))*j/15));
  m.cap.push(points);
 }
 // Hand-drawn front silhouettes plus matched profile contours form a 2.5D rig.
 // Corresponding points deform continuously; scalp anchors and tip compliance
 // are shared with the head rig rather than transformed as a floating decal.
 const sample=(d,n,map=p=>p)=>{
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);
  const length=path.getTotalLength();
  return Array.from({length:n},(_,i)=>{const p=path.getPointAtLength(length*i/(n-1));return map([p.x,p.y]);});
 };
 const groom=(outer,inner,profileOuter,profileInner,frontLines,profileLines,map)=>{
  m.groom={outer:sample(outer,150,map),inner:sample(inner,85,map),profileOuter:sample(profileOuter,150),profileInner:sample(profileInner,85),lines:[]};
  const quarter=style==='classique'
   ?'M 170 33 Q 151 -7 123 -29 Q 105 -43 104 -63 L 98 -14 L 88 -31 L 85 -84 Q 57 -120 26 -126 C -39 -144 -108 -141 -155 -119 Q -177 -92 -182 -29'
   :'M 171 92 Q 160 111 149 112 Q 161 86 149 72 Q 158 48 140 30 Q 118 28 123 2 Q 98 -13 88 -56 Q 77 -103 45 -119 Q 4 -138 -33 -127 Q -102 -140 -129 -100 Q -149 -80 -144 -57 Q -135 -33 -148 -15 Q -157 -4 -146 7';
  m.groom.quarterInner=sample(quarter,85);
  // Match endpoints exactly to the outer silhouette at 45 degrees.
  m.groom.quarterInner[0]=hMix(m.groom.outer.at(-1),m.groom.profileOuter.at(-1),.5);
  m.groom.quarterInner[84]=hMix(m.groom.outer[0],m.groom.profileOuter[0],.5);
  // Opposite profiles have their own flow lines: mirroring a sweep would
  // reverse its direction and collapse the curls halfway through the turn.
  const leftLines=style==='classique'?[
   'M -146 -155 C -131 -174 -99 -180 -83 -166 Q -71 -151 -98 -143',
   'M -147 -186 C -117 -213 -57 -214 -29 -181 Q -16 -157 -57 -137',
   'M -113 -219 C -70 -246 -8 -221 23 -181 Q 39 -155 7 -134',
   'M -57 -247 C -4 -260 54 -222 76 -181 Q 93 -155 70 -143',
   'M 1 -254 C 61 -243 115 -195 109 -153',
   'M 74 -220 Q 126 -193 146 -155',
   'M -148 -101 Q -158 -63 -150 -22',
   'M 161 -153 Q 169 -132 163 -119',
   'M -142 -144 Q -130 -130 -110 -136'
  ]:[
   'M -145 -163 C -160 -181 -122 -251 -68 -272 C -11 -288  70 -247 116 -174',
   'M -163 -133 C -169 -166 -119 -227 -72 -247 C -16 -265 64 -221 109 -155',
   'M -177 -97 C -173 -132 -120 -203 -72 -220 C -16 -239 54 -200 96 -144',
   'M -170 -60 C -163 -97 -116 -177 -70 -194 C -17 -214 46 -177  80 -133',
   'M -160 -17 C -178 -48 -110 -139 -53 -151',
   'M -146 38 Q -164 12 -130 -18',
   'M 7 -257 C 58 -250 120 -200 147 -174 Q 162 -157 178 -161',
   'M 53 -222 C 98 -207 127 -176 143 -156 Q 153 -142 168 -141',
   'M  90 -189 Q 139 -156 153 -126',
   'M -145 54 Q -136 81 -130 95'
  ];
  for(let i=0;i<frontLines.length;i++)m.groom.lines.push({front:sample(frontLines[i],35,map),profile:sample(profileLines[i],35),leftProfile:sample(leftLines[i],35,p=>[-p[0],p[1]])});
 };
 if(style==='classique'){
  groom(
   'M 32 208 C 28 191 26 179 26 168 L 22 173 L 25 160 L 21 163 L 25 153 L 22 155 Q 24 148 30 144 L 24 144 Q 27 137 35 136 L 30 133 Q 36 128 44 128 L 40 124 Q 49 126 54 123 L 47 119 Q 58 120 66 123 Q 65 119 61 117 Q 73 116 82 123 Q 83 119 80 117 Q 92 121 96 130 L 95 121 Q 104 127 106 136 L 109 127 Q 115 136 111 146 Q 116 144 118 141 Q 120 149 115 156 L 121 153 Q 120 160 116 164 L 119 165 Q 114 176 113 190 L 110 209',
   'M 110 209 L 109 182 Q 109 166 103 165 C 84 159 58 159 40 164 Q 33 166 33 179 L 32 208',
   'M -168 -101 Q -177 -120 -174 -151 L -186 -145 Q -181 -162 -171 -174 L -188 -171 Q -183 -184 -165 -190 L -181 -195 Q -169 -207 -150 -207 L -160 -217 Q -141 -220 -121 -225 L -137 -238 Q -109 -237 -85 -247 L -92 -256 Q -60 -253 -40 -266 Q -21 -266 -7 -261 L -4 -266 Q 20 -266 41 -251 L 42 -257 Q 68 -248 88 -227 L 90 -234 Q 111 -213 126 -185 L 130 -190 Q 156 -144 162 -103 Q 177 -57 164 7 L 154 19',
   'M 154 19 Q 143 -17 111 -28 Q 65 -40 38 -74 L 27 -25 L 18 -37 L 16 -100 Q -9 -130 -40 -143 Q -88 -157 -139 -139 Q -158 -126 -168 -101',
   [
    'M 29 153 C 38 144 49 145 49 150 C 48 155 39 157 36 157',
    'M 33 144 C 41 137 53 136 62 141 C 73 147 65 156 48 159',
    'M 43 132 C 55 128 73 132 79 141 C 85 151 71 160 60 160',
    'M 58 126 C 73 125 88 133 88 143 C 88 153 80 157 76 158',
    'M 80 127 C 98 133 102 148 91 158',
    'M 101 139 Q 112 151 103 163',
    'M 30 169 Q 33 174 31 189',
    'M 112 167 Q 110 177 111 189',
    'M 27 158 Q 31 162 36 160'
   ],
   [
    'M -167 -174 Q -128 -179 -104 -169',
    'M -160 -202 C -91 -208 -77 -175 -105 -158',
    'M -120 -227 C -43 -236 -13 -185 -45 -153',
    'M -65 -249 C 13 -259 55 -186 19 -137',
    'M 5 -254 C 75 -232 105 -152 49 -95',
    'M 73 -225 Q 144 -129 91 -63',
    'M -151 -147 Q -155 -133 -161 -120',
    'M 140 -111 Q 158 -49 153 -6',
    'M -171 -155 Q -159 -167 -144 -164'
   ],p=>{const y=(p[1]-196)*3.60;return [(p[0]-72)*3.82*(1+.21*smooth5(clamp((y+110)/160))),y];}
  );
 }
 if(style==='mi_long'){
  groom(
   'M 543 234 C 534 233 529 227 530 220 Q 523 222 522 214 Q 517 210 519 201 Q 513 197 517 187 Q 510 183 516 175 Q 511 169 520 164 Q 515 158 524 150 Q 520 150 518 145 Q 525 150 533 141 Q 544 127 565 120 Q 582 112 591 121 Q 597 125 596 134 Q 606 129 612 140 Q 621 151 622 165 Q 632 177 627 190 Q 634 203 626 216 Q 627 226 612 234',
   'M 612 234 Q 617 222 615 214 Q 621 211 619 199 Q 613 197 614 184 Q 613 172 603 165 Q 594 161 585 165 Q 571 160 559 166 Q 550 169 548 181 Q 544 193 536 193 Q 532 204 537 210 Q 533 220 543 234',
   'M -165 -100 Q -179 -106 -178 -124 Q -200 -120 -199 -138 Q -218 -143 -204 -163 Q -217 -158 -219 -173 Q -203 -167 -191 -187 C -169 -222 -111 -280 -67 -289 Q -20 -308 13 -282 Q 66 -270 91 -237 Q 126 -211 142 -163 Q 157 -134 151 -112 Q 178 -94 166 -58 Q 181 -31 171 -11 Q 184 18 175 32 Q 183 52 166 70',
   'M 166 70 Q 169 86 147 101 Q 159 122 129 132 Q 143 107 131 99 Q 112 103 114 84 Q 126 59 112 40 Q 92 32 97 8 Q 86 -10 72 -19 Q 52 -33 31 -72 Q 21 -38 10 -20 Q -2 -31 6 -57 Q 14 -97 -11 -120 Q -77 -152 -125 -133 Q -153 -122 -165 -100',
   [
    'M 522 149 C 535 155 539 138 554 131 C 572 120 588 122 590 136 Q 591 145 585 159',
    'M 519 161 C 535 173 543 151 554 143 C 567 131 580 131 584 144 Q 587 153 582 161',
    'M 517 174 C 534 186 545 165 554 155 C 564 145 575 147 578 163',
    'M 516 187 C 533 198 542 179 550 169 C 561 157 570 156 573 163',
    'M 524 201 C 538 204 542 189 546 181',
    'M 526 215 Q 532 218 533 210',
    'M 591 137 C 602 136 607 146 610 159 C 612 170 618 176 622 175',
    'M 587 159 C 591 146 600 149 606 164 C 612 180 618 185 625 184',
    'M 604 173 Q 610 194 621 193',
    'M 616 211 Q 625 209 621 201'
   ],
   [
    'M -190 -181 C -164 -184 -145 -250 -92 -268 C -35 -292 1 -248 -14 -184',
    'M -200 -161 C -154 -151 -154 -224 -101 -244 C -48 -265 -5 -225 -22 -175',
    'M -190 -141 C -146 -143 -137 -198 -105 -221 C -62 -250 -24 -212 -33 -167',
    'M -175 -122 C -135 -122 -130 -180 -105 -194 C -68 -216 -45 -186 -44 -159',
    'M -139 -140 Q -119 -178 -90 -177',
    'M -155 -131 Q -143 -123 -133 -139',
    'M 7 -260 C 87 -249 107 -184 91 -141 C 73 -87 111 -63 145 -79',
    'M 11 -216 C 48 -216 83 -174  60 -129 C 35 -83 105 -43 150 -48',
    'M 83 -110 C 47 -57 140 -1 163 -25',
    'M 118 23 Q 153 52 141 79'
   ],p=>{const y=(p[1]-201)*3.45;return [(p[0]-572)*3.65*(1+.21*smooth5(clamp((y+110)/160))),y];}
  );
 }
// Dégradé (fade): a short, solid top with a crisp front line; the sides and the
 // back fade to skin through the gradient drawn in projectedHair (no curls).
 if(style==='dreadlocks'){
  const loc=(a,b,c,d,width=16,stiffness=46,isStatic=false)=>{
   const pts=curve(a,b,c,d,22).map(p=>{
    if(p[1]>-153&&Math.abs(p[0])>65){
     p[0]=Math.sign(p[0])*Math.max(Math.abs(p[0]),Math.sqrt(Math.max(0,198*198-p[1]*p[1]-p[2]*p[2])));
     return p;
    }
    if(Math.hypot(...p)<194)p[1]=-Math.sqrt(Math.max(0,194*194-p[0]*p[0]-p[2]*p[2]));
    return p;
   });
   lock(pts,width*1.19,stiffness,3,'loc',isStatic);
  };
  // Back curtain: staggered lengths and separate roots, never in front of the eyes.
  for(let i=0;i<29;i++){
   const lon=1.47+i/28*(Math.PI*2-2.94),root=scalp(lon,.51,3),end=scalp(lon,1.40,5);
   lock(curve(root,scalp(lon,1.04,7),[end[0]*1.04,37,end[2]-7],[end[0]*1.03,112+38*Math.sin(i*2.7),end[2]-11],18),22+2*Math.sin(i*1.7),24,3,'loc',true);
  }
  // A second staggered layer adds body at the temples and through the nape.
  // It has its own roots and free lengths, so the density survives a side view.
  for(let i=0;i<21;i++){
   const lon=1.40+(i+.35)/21*(Math.PI*2-2.80),root=scalp(lon,.63,3),end=scalp(lon,1.46,23);
   const pts=curve(root,scalp(lon+.025*Math.sin(i),1.10,20),[end[0]*1.05,26,end[2]],[end[0]*1.04,95+37*Math.sin(i*2.13),end[2]-9],18);
   lock(pts,23+2*Math.sin(i*1.9),28,3,'loc',true);
  }
  for(const side of [-1,1]){
   for(let i=0;i<7;i++){
    const lon=side*(1.03+i*.052),root=scalp(lon,.57+i*.035,5),out=Math.sign(root[0]);
    loc(root,[root[0]*1.18,-121+i*4,root[2]+out*6],[root[0]*1.31,-43+i*12,root[2]-8],[root[0]*1.28,54+i*15,root[2]-15],19+i%3,34,true);
   }
  }
  // Asymmetric crown spray, copied as distinct curved locs rather than radial spikes.
  const crown=[
   [[-4,-191,35],[-25,-254,24],[-41,-294,8],[-60,-301,0],17],
   [[5,-193,40],[23,-258,26],[39,-289,4],[62,-287,-8],16],
   [[-19,-187,55],[-65,-261,37],[-117,-278,12],[-135,-269,0],17],
   [[17,-188,52],[68,-252,25],[109,-267,6],[132,-263,0],17],
   [[-31,-182,72],[-87,-230,40],[-141,-241,18],[-162,-234,0],15],
   [[31,-182,73],[88,-231,32],[150,-242,12],[166,-225,0],16],
   [[-39,-179,80],[-115,-218,46],[-172,-204,15],[-191,-174,2],17],
   [[37,-180,81],[113,-218,43],[177,-204,10],[193,-173,0],16],
   [[-7,-198,-8],[-7,-244,-12],[22,-272,-14],[37,-269,-15],15],
   [[-20,-191,42],[-70,-241,35],[-127,-263,10],[-155,-254,0],18],
   [[20,-190,36],[78,-244,28],[134,-257,6],[160,-248,0],17],
   [[-32,-184,52],[-112,-223,40],[-178,-218,20],[-192,-191,0],17],
   [[34,-185,51],[122,-215,37],[184,-198,12],[201,-169,0],17],
   [[-39,-177,65],[-131,-189,39],[-204,-159,10],[-209,-115,0],18],
   [[39,-177,64],[136,-187,31],[200,-143,8],[208,-107,0],17]
  ];
  for(let i=0;i<crown.length;i++){
   const [a,b,c,d,w]=crown[i],depth=[-72,82,-115,125,77,-90,30,-25,150,-42,50,-125,125,-57,62][i];
   b[2]=depth*.52;c[2]=depth;d[2]=depth;loc(a,b,c,d,w,110);
  }
  const tails=[
   [-32,-177,-167,-203,-202,-59,-199,53,17],
   [-22,-180,-148,-221,-204,-84,-178,104,15],
   [-7,-179,-143,-205,-179,-33,-168,141,17],
   [7,-178,-116,-201,-160,-66,-150,75,16],
   [-43,-173,-169,-172,-205,-16,-211,84,16],
   [-15,-184,-112,-216,-175,-142,-167,-46,18],
   [-28,-184,-161,-230,-195,-113,-195,13,17],
   [-3,-186,-104,-221,-137,-137,-149,-70,17],
   [34,-178,174,-207,198,-55,197,112,16],
   [22,-182,150,-216,171,-63,181,65,18],
   [11,-180,134,-202,157,-12,166,135,15],
   [42,-174,168,-174,214,-30,214,72,16],
   [13,-184,133,-213,176,-112,176,-19,18],
   [28,-185,175,-222,208,-117,201,17,16]
  ];
  for(let i=0;i<tails.length;i++){
   const [ax,ay,bx,by,cx,cy,dx,dy,w]=tails[i];
   loc([ax,ay,65],[bx,by,50],[cx,cy,13],[dx,dy,9+(i%3)*3],w,27);
  }
 }
 if(style==='chignon'){
  m.bun={center:[0,-220,-89],r:[57,49,53]};
  for(let i=0;i<14;i++){
   const lon=-Math.PI+2*Math.PI*i/14;
   m.details.push(Array.from({length:24},(_,j)=>scalp(lon+.1*Math.sin(j/23*Math.PI),.12+(hairline(lon)-.16)*j/23,2)));
  }
 }
 HAIR_MODELS.set(style,m);return m;
}
function hairFrameBasis(f){
 if(f.basis)return f.basis;
 const a=-f.yaw*Math.PI/2,b=f.rot*Math.PI/180;
 return f.basis={c:Math.cos(a),s:Math.sin(a),cr:Math.cos(b),sr:Math.sin(b),back:1-.15*smooth5(Math.abs(f.yaw)),dir:screenFaceDirFromYaw(f.yaw)};
}
function hairTransform(p,f){
 const {c,s,cr,sr,back,dir}=hairFrameBasis(f);
 let x=p[0]*c+p[2]*s;const y=p[1];
 if(x*dir<0)x*=back;
 return [f.cx+f.scale*(x*cr-y*sr),f.cy+f.scale*(x*sr+y*cr),f.scale*(p[2]*c-p[0]*s)];
}
function hairLocal(p,f){
 const {c,s,cr,sr,back,dir}=hairFrameBasis(f),dx=(p[0]-f.cx)/f.scale,dy=(p[1]-f.cy)/f.scale;
 let x=dx*cr+dy*sr;const y=-dx*sr+dy*cr,z=p[2]/f.scale;
 if(x*dir<0)x/=back;
 return [x*c-z*s,y,x*s+z*c];
}
function updateHairPhysics(now,cx,cy,r,rot,yaw){
 const h=HAIR_DYNAMICS,model=hairModel(APPEARANCE.hairStyle),f={cx,cy,scale:r/185,rot,yaw};
 const reset=h.style!==model.style||!h.frame||Math.hypot(cx-h.frame.cx,cy-h.frame.cy)>100||Math.abs(yaw-(h.frame?.yaw||0))>.8||Math.abs(rot-(h.frame?.rot||0))>50;
 if(reset){h.style=model.style;h.model=model;h.chains=model.locks.map(lock=>{const p=lock.points.map(p=>hairTransform(p,f));return {p,old:p.map(p=>p.slice())};});h.last=now;h.soft={offset:[0,0,0],velocity:[0,0,0],tipOffset:[0,0],tipVelocity:[0,0],base:hairTransform([0,-230,0],f),baseVelocity:[0,0,0]};h.sleepSettled=null;h.sleepSettleCount=0;}
 const dt=Math.min(.05,Math.max(0,(now-h.last)/1000));h.last=now;h.frame=f;
 if(freeze.checked||CLOCK.reduced){h.soft.offset=[0,0,0];h.soft.velocity=[0,0,0];h.soft.tipOffset=[0,0];h.soft.tipVelocity=[0,0];h.soft.base=hairTransform([0,-230,0],f);h.soft.baseVelocity=[0,0,0];for(let k=0;k<model.locks.length;k++){const pts=model.locks[k].points.map(p=>hairTransform(p,f));h.chains[k]={p:pts,old:pts.map(p=>p.slice())};}return;}
 if(!dt)return;
 if(current==='sleep'&&entered){
  if(h.sleepSettleCount<12){
   h.sleepSettleCount++;
  } else {
   if(!h.sleepSettled){
    h.sleepSettled=h.chains.map(c=>({p:c.p.map(pt=>pt.slice()),old:c.old.map(pt=>pt.slice())}));
   }
   for(let k=0;k<h.chains.length;k++){
    h.chains[k].p=h.sleepSettled[k].p.map(pt=>pt.slice());
    h.chains[k].old=h.sleepSettled[k].old.map(pt=>pt.slice());
   }
   return;
  }
 } else {
  h.sleepSettled=null;h.sleepSettleCount=0;
 }
 // A tied bun is firm; a puff has small distributed compliance. Both stay rooted.
 const soft=h.soft,base=hairTransform([0,-230,0],f),vel=base.map((v,i)=>lp(soft.baseVelocity[i],(v-soft.base[i])/dt,1-Math.exp(-dt/.04)));
 const acceleration=vel.map((v,i)=>clamp((v-soft.baseVelocity[i])/dt,-4000,4000));
 // Activity gate: hair only shows secondary motion when the head really moves
 // (jump, walk, turn). Breathing and eye-tracking drift stay below the threshold,
 // so at rest the hair is carried rigidly by the head. Rises fast, settles slowly.
 {
  const rotVel=Math.abs(rot-(h.prevRot===undefined?rot:h.prevRot))/dt;h.prevRot=rot;
  const drive=clamp(Math.max((Math.hypot(acceleration[0],acceleration[1])-120*f.scale)/(700*f.scale),(rotVel-6)/40));
  h.activity=lp(h.activity||0,drive,1-Math.exp(-dt/(drive>(h.activity||0)?.06:.9)));
 }
 const stiffness=model.soft?model.soft.stiffness:model.style==='mi_long'?140:210,limit=(model.soft?model.soft.limit:model.style==='mi_long'?4:2.5)*f.scale;
 for(let i=0;i<3;i++){
  soft.velocity[i]+=(-stiffness*soft.offset[i]-1.6*Math.sqrt(stiffness)*soft.velocity[i]-acceleration[i]*.10)*dt;
  soft.offset[i]=clamp(soft.offset[i]+soft.velocity[i]*dt,-limit,limit);
 }
 if(model.groom||model.sway){
  // The neutral groom already includes gravity. Rotation adds the difference
  // between world gravity and that neutral direction, only at the loose ends.
  const roll=rot*Math.PI/180,k=model.sway?model.sway.k:model.style==='mi_long'?76:205,gravity=420*f.scale;
  const residual=[Math.sin(roll)*gravity,(1-Math.cos(roll))*gravity];
  for(let i=0;i<2;i++){
   soft.tipVelocity[i]+=(-k*soft.tipOffset[i]-1.8*Math.sqrt(k)*soft.tipVelocity[i]-acceleration[i]*.23+residual[i])*dt;
   soft.tipOffset[i]=clamp(soft.tipOffset[i]+soft.tipVelocity[i]*dt,-12*f.scale,12*f.scale);
  }
  // Static gravity equilibrium of the loose ends (always shown, even at rest).
  soft.tipEq=[clamp(residual[0]/k,-12*f.scale,12*f.scale),clamp(residual[1]/k,-12*f.scale,12*f.scale)];
 }
 soft.base=base;soft.baseVelocity=vel;
 const calm=1-(h.activity||0);
 const steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps,damping=Math.exp(-(4.8+34*calm)*step);
 const targets=model.locks.map(lock=>{
  if(lock.isStatic)return null;
  const p=lock.points.map(p=>hairTransform(p,f));
  return {p,lengths:p.slice(1).map((q,i)=>hLen(q,p[i])),bends:p.slice(2).map((q,i)=>hLen(q,p[i]))};
 });
 for(let sub=0;sub<steps;sub++)for(let k=0;k<model.locks.length;k++){
  const lock=model.locks[k];
  if(lock.isStatic)continue;
  const chain=h.chains[k],target=targets[k].p,n=target.length,{lengths,bends}=targets[k];
  for(let i=0;i<n;i++){
   if(i<lock.anchor){chain.p[i]=target[i].slice();chain.old[i]=target[i].slice();continue;}
   const p=chain.p[i],old=chain.old[i],t=(i-lock.anchor+1)/(n-lock.anchor);
   // Groom stiffness falls toward the tip. Gravity remains vertical in world space.
   const stiffness=lock.stiffness*(1.8-.8*t);
   const next=p.map((v,d)=>v+(v-old[d])*damping*(chain.step?step/chain.step:1)+((target[i][d]-v)*stiffness+(d===1?760*f.scale:0))*step*step);
   chain.old[i]=p.slice();chain.p[i]=next;
  }
  chain.step=step;
  for(let pass=0;pass<8;pass++){
   for(let i=1;i<n;i++){
    const a=chain.p[i-1],b=chain.p[i],dist=hLen(a,b)||1,rest=lengths[i-1],diff=(dist-rest)/dist;
    const wa=i-1<lock.anchor?0:.5,wb=i<lock.anchor?0:wa===0?1:.5;
    for(let d=0;d<3;d++){const correction=(b[d]-a[d])*diff;a[d]+=correction*wa;b[d]-=correction*wb;}
   }
   // Second-neighbour distance preserves the groom's curl without fixing it in space.
   for(let i=2;i<n;i++){
    const a=chain.p[i-2],b=chain.p[i],dist=hLen(a,b)||1,rest=bends[i-2];
    const diff=(dist-rest)/dist*.38,wa=i-2<lock.anchor?0:.5,wb=i<lock.anchor?0:wa===0?1:.5;
    for(let d=0;d<3;d++){const correction=(b[d]-a[d])*diff;a[d]+=correction*wa;b[d]-=correction*wb;}
   }
   for(let i=lock.anchor;i<n;i++){
    const p=chain.p[i],local=hairLocal(p,f),radius=185+lock.width*.20,dist=Math.hypot(...local);
    if(dist<radius&&dist>0){const q=hairTransform(local.map(v=>v*radius/dist),f);chain.p[i]=q;}
    // Dissipative floor contact. Preserve tangential movement instead of flattening the whole haircut.
    const floor=1405-lock.width*.25*f.scale;
    if(chain.p[i][1]>floor){
     const p=chain.p[i],prev=chain.p[i-1],vertical=floor-prev[1],length=lengths[i-1];
     p[1]=floor;
     if(vertical>=0&&vertical<length){
      const horizontal=Math.sqrt(Math.max(0,length*length-vertical*vertical));
      let dx=p[0]-prev[0],dz=p[2]-prev[2],d=Math.hypot(dx,dz);
      if(d<.1){dx=Math.sign(target[lock.anchor-1][0]-cx)||1;dz=.15;d=Math.hypot(dx,dz);}
      p[0]=prev[0]+dx/d*horizontal;p[2]=prev[2]+dz/d*horizontal;
     }
     chain.old[i][1]=floor;chain.old[i][0]=p[0];chain.old[i][2]=p[2];
    }
   }
  }
 }
}
// Split a strand precisely at the head's depth plane: no whole-lock popping or ghost crossfade.
function hairDepthRuns(points,front,bias=0){
 // bias > 0 keeps a strand in front a little past the contour (cornrows cover
 // the head outline where they go over it).
 const runs=[];let run=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],inside=front?p[2]>=-bias:p[2]<-bias;
  if(i){const prev=points[i-1],was=front?prev[2]>=-bias:prev[2]<-bias;if(inside!==was){const t=(prev[2]+bias)/(prev[2]-p[2]),edge=hMix(prev,p,t);run.push(edge);if(run.length>1)runs.push(run);run=inside?[edge]:[];}}
  if(inside)run.push(p);
 }
 if(run.length>1)runs.push(run);return runs;
}
// Rounded closed polygon without duplicate or aligned points: the same shape (drift
// under 0.6 viewBox unit, ~0.15 px on screen) with far fewer points to re-parse
// every frame.
function hairPoly(ps){
 const q=[];
 for(const p of ps){
  const x=Math.round(p[0]),y=Math.round(p[1]),l=q[q.length-1];
  if(l&&l[0]===x&&l[1]===y)continue;
  if(q.length>=2){
   const a=q[q.length-2],cr=(l[0]-a[0])*(y-a[1])-(l[1]-a[1])*(x-a[0]);
   if(Math.abs(cr)<=0.6*Math.hypot(x-a[0],y-a[1])){q[q.length-1]=[x,y];continue;}
  }
  q.push([x,y]);
 }
 return q.length<3?'':'M '+q.map(p=>p[0]+' '+p[1]).join(' L ')+' Z ';
}
function hairSmoothPath(points){
 const n=points.length;
 if(n<2)return '';
 // Catmull-Rom → cubic Bézier without temporary arrays. Integer viewBox units:
 // one unit is ~0.3 screen px at usual sizes, so rounding is invisible and the
 // SVG the browser re-parses every frame is much smaller.
 const r=Math.round;
 let d='M'+r(points[0][0])+' '+r(points[0][1]);
 for(let i=0;i<n-1;i++){
  const p0=points[i>0?i-1:0],p1=points[i],p2=points[i+1],p3=points[i+2<n?i+2:n-1];
  d+='C'+r(p1[0]+(p2[0]-p0[0])/6)+' '+r(p1[1]+(p2[1]-p0[1])/6)
    +' '+r(p2[0]-(p3[0]-p1[0])/6)+' '+r(p2[1]-(p3[1]-p1[1])/6)
    +' '+r(p2[0])+' '+r(p2[1]);
 }
 return d;
}
function drawnHairMarkup(model,f){
 const g=model.groom,u=Math.abs(f.yaw),side=f.yaw<0?-1:1;
 const angle=f.rot*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const live=HAIR_DYNAMICS.style===model.style&&HAIR_DYNAMICS.soft;
 const project=(p,root=false)=>{
  const weight=root?0:clamp((Math.hypot(p[0],p[1])-182)/86);
  const q=[f.cx+(p[0]*c-p[1]*s)*f.scale,f.cy+(p[0]*s+p[1]*c)*f.scale];
  if(live){
   const act=HAIR_DYNAMICS.activity||0;
   q[0]+=HAIR_DYNAMICS.soft.offset[0]*weight*act;q[1]+=HAIR_DYNAMICS.soft.offset[1]*weight*act;
   const tipWeight=smooth5(clamp((p[1]+52)/145)),soft=HAIR_DYNAMICS.soft,eq=soft.tipEq||[0,0];
   q[0]+=(eq[0]+act*(soft.tipOffset[0]-eq[0]))*tipWeight;q[1]+=(eq[1]+act*(soft.tipOffset[1]-eq[1]))*tipWeight;
  }
  return q;
 };
 const deform=(front,profile,reverse=false,root=false)=>front.map((a,i)=>{
  const b=profile[reverse?profile.length-1-i:i];return project([lp(a[0],b[0]*side,u),lp(a[1],b[1],u)],root);
 });
 const outer=deform(g.outer,g.profileOuter,side<0);
 const quarter=side<0?g.quarterInner.slice().reverse().map(p=>[-p[0],p[1]]):g.quarterInner;
 const profile=side<0?g.profileInner.slice().reverse().map(p=>[-p[0],p[1]]):g.profileInner;
 const inner=g.inner.map((a,i)=>{
  const p=a.map((v,d)=>lp(v,profile[i][d],u)+4*u*(1-u)*(quarter[i][d]-(v+profile[i][d])*.5));
  if(p[1]>-94&&p[1]<118){
   const back=p[0]*screenFaceDirFromYaw(f.yaw)<0,rx=185*(back?1-.15*smooth5(u):1);
   const inset=model.style==='mi_long'?14:7;
   const edge=rx*Math.sqrt(Math.max(0,1-p[1]*p[1]/(185*185)))-inset;
   if(Math.abs(p[0])>edge)p[0]=Math.sign(p[0])*edge;
  }
  return project(p,true);
 });
 const path=hairSmoothPath(outer)+' L '+inner[0].map(v=>v.toFixed(2)).join(' ')+hairSmoothPath(inner).replace(/^M-?[\d.]+ -?[\d.]+/,'')+' Z';
 const id='groom-'+model.style+'-'+Math.round(f.yaw*10000)+'-'+Math.round(f.cx)+'-'+Math.round(f.cy);
 let svg=`<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><path d="${path}" class="hairFill"/>`;
 svg+=`<g clip-path="url(#${id})">`;
 for(const line of g.lines){
  const points=deform(line.front,side<0?line.leftProfile:line.profile);
  if(!HAIR_LOD)svg+=`<path d="${hairSmoothPath(points)}" class="hairDetail" style="stroke-width:${1.5*f.scale};opacity:.28"/>`;
 }
 return svg+'</g>';
}
const HAIR_FLOOR=1402;   // viewBox y of the ground line
// Face guard (head units, y up = negative): hair in front of the face never comes
// below the brow line (highest brows: -105 in Error), so it never touches the
// eyebrows or the eyes. The limit relaxes at the temples.
function faceGuard(p,margin=0){
  if(p[2]<=12)return p;
  const ax=Math.abs(p[0]);
  if(ax>=128)return p;
  const limit=-118-margin+64*smooth5(clamp((ax-86)/40));
  return p[1]>limit?[p[0],limit,p[2]]:p;
}
function projectedHair(cx,cy,r,rot,yaw,layer='front'){
 const ch=characterDef();if(ch)return ch.hair(cx,cy,r,rot,yaw,layer);
 const model=hairModel(APPEARANCE.hairStyle),f={cx,cy,scale:r/185,rot,yaw},front=layer==='front';
 if(model.style==='chauve')return '';
 if(model.groom)return front?(HAIR_OUTLINE_FILTER?`<g filter="url(#${HAIR_OUTLINE_FILTER})">${drawnHairMarkup(model,f)}</g>`:drawnHairMarkup(model,f)):'';
 const items=[],fmt=p=>`${Math.round(p[0])} ${Math.round(p[1])}`;
 const softLive=HAIR_DYNAMICS.style===model.style&&HAIR_DYNAMICS.soft&&HAIR_DYNAMICS.frame&&Math.abs(HAIR_DYNAMICS.frame.cx-cx)<.01;
 const projectVolume=(p,weight=null,margin=0)=>{
  const q=hairTransform(model.noFaceGuard?p:faceGuard(p,margin),f);
  if(softLive&&(model.soft||model.sway||['chignon','mi_long','classique'].includes(model.style))){
   const act=HAIR_DYNAMICS.activity||0;
   const w=(weight===null?clamp((Math.hypot(...p)-192)/55):weight)*act;
   for(let i=0;i<3;i++)q[i]+=HAIR_DYNAMICS.soft.offset[i]*w;
   // Long hair: the lower it hangs, the more it lags behind the head.
   if(model.sway){const t=smooth5(clamp((p[1]+20)/280)),soft=HAIR_DYNAMICS.soft,eq=soft.tipEq||[0,0];q[0]+=(eq[0]+act*(soft.tipOffset[0]-eq[0]))*t;q[1]+=(eq[1]+act*(soft.tipOffset[1]-eq[1]))*t;}
  }
  // Long hair rests on the floor instead of passing through it (lying down).
  if(q[1]>HAIR_FLOOR)q[1]=HAIR_FLOOR-(q[1]-HAIR_FLOOR)*.04;
  return q;
 };

 const add=(z,svg)=>items.push({z,svg:HAIR_LOD?hairLod(svg):svg});
 if(model.beard)model.cap=model.beard(yaw,BEARD_MOUTH);
 const fill=model.style==='degrade'?`url(#hair-fade-${layer})`:'var(--hairColor)';
 // The whole cap of a layer is ONE path: cells are cut exactly at the depth
 // plane and wound the same way, so there are no seams, holes or stripes.
 if(model.cap.length){
  let mesh='';
  for(const cell of model.cap){
   const raw=cell.map(p=>projectVolume(p)),ps=[];
   for(let i=0;i<raw.length;i++){
    const a=raw[(i+raw.length-1)%raw.length],b=raw[i],inside=front?b[2]>=0:b[2]<0,was=front?a[2]>=0:a[2]<0;
    if(inside!==was)ps.push(hMix(a,b,a[2]/(a[2]-b[2])));
    if(inside)ps.push(b);
   }
   if(ps.length<3)continue;
   let area=0;for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length];area+=a[0]*b[1]-b[0]*a[1];}
   if(Math.abs(area)<1e-3)continue;
   if(area<0)ps.reverse();
   mesh+=hairPoly(ps);
  }
  if(mesh)add(-1e9,`<path d="${mesh}" fill="${fill}"${model.style==='degrade'?'':` stroke="${fill}" stroke-width="${(f.scale*1.4).toFixed(2)}" stroke-linejoin="round"`}/>`);
 }
 if(model.tie){
  const c=projectVolume(model.tie.p,1);
  if((c[2]>=0)===front){const rad=model.tie.r*f.scale;add(c[2]+3,`<circle cx="${c[0]}" cy="${c[1]}" r="${rad}" class="hairFill"/><circle cx="${c[0]}" cy="${c[1]}" r="${rad*.62}" class="hairDetail" style="stroke-width:${3*f.scale};opacity:.55"/>`);}
 }
 if(model.afro){
  // Small surface cells keep front/back occlusion attached to the turning head.
  let mesh='';
  for(const cell of model.afro.cells){
   const raw=cell.map(p=>projectVolume(p)),ps=[];
   for(let i=0;i<raw.length;i++){
    const a=raw[(i+raw.length-1)%raw.length],b=raw[i],inside=front?b[2]>=0:b[2]<0,was=front?a[2]>=0:a[2]<0;
    if(inside!==was)ps.push(hMix(a,b,a[2]/(a[2]-b[2])));
    if(inside)ps.push(b);
   }
   if(ps.length<3)continue;
   mesh+=hairPoly(ps);
  }
  add(0,`<path d="${mesh}" class="hairFill" stroke="var(--hairColor)" stroke-width="${1.1*f.scale}" stroke-linejoin="round"/>`);
  for(const curl of model.afro.curls){
   const p=projectVolume(curl.p,null,curl.r);if((p[2]>=0)!==front)continue;
   const rad=curl.r*f.scale,r1=v=>Math.round(v*10)/10;
   add(p[2]+2,`<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r1(rad)}" class="hairFill"/><path d="M ${r1(p[0]-rad*.32)} ${r1(p[1])} q ${r1(-rad*.1)} ${r1(-rad*.6)} ${r1(rad*.62)} ${r1(-rad*.45)}" class="hairDetail" style="stroke-width:${r1(1.2*f.scale)};opacity:.12"/>`);
  }
 }
 for(const ink of model.ink)for(const run of hairDepthRuns(ink.points.map(p=>projectVolume(p)),front)){
  add(207*f.scale,`<path d="${hairSmoothPath(run)}" class="hairDetail" style="stroke-width:${ink.width*f.scale};opacity:${ink.opacity}"/>`);
 }
 for(const curl of model.curls){
  const p=projectVolume(curl.p,null,curl.r);if((p[2]>=0)!==front)continue;
  const rad=curl.r*f.scale;
  add(p[2],`<circle cx="${p[0]}" cy="${p[1]}" r="${rad}" class="hairFill"/><path d="M ${p[0]-rad*.35} ${p[1]} q ${-rad*.1} ${-rad*.65} ${rad*.65} ${-rad*.5}" class="hairDetail" style="stroke-width:${1.3*f.scale};opacity:.14"/>`);
 }
 if(model.bun){
  const center=projectVolume(model.bun.center,1),[rx,ry]=model.bun.r;
  if((center[2]>=0)===front){
   let svg=`<ellipse cx="${center[0]}" cy="${center[1]}" rx="${rx*f.scale}" ry="${ry*f.scale}" class="hairFill" transform="rotate(${rot} ${center[0]} ${center[1]})"/>`;
   for(let j=-2;j<=2;j++){const pts=Array.from({length:22},(_,i)=>{const t=i/21*Math.PI;return projectVolume([model.bun.center[0]+j*12+Math.sin(t)*12,model.bun.center[1]-Math.cos(t)*43,model.bun.center[2]+Math.sin(t)*48],1);});svg+=`<path d="${hairSmoothPath(pts)}" class="hairDetail" style="stroke-width:${1.6*f.scale};opacity:.25"/>`;}
   add(center[2],svg);
  }
 }
 for(const detail of model.details)for(const run of hairDepthRuns(detail.map(p=>hairTransform(p,f)),front))add(run[0][2],`<path d="${hairSmoothPath(run)}" class="hairDetail" style="stroke-width:${1.8*f.scale};opacity:.20"/>`);
 const live=HAIR_DYNAMICS.style===model.style&&HAIR_DYNAMICS.frame&&Math.abs(HAIR_DYNAMICS.frame.cx-cx)<.01&&Math.abs(HAIR_DYNAMICS.frame.rot-rot)<.01&&Math.abs(HAIR_DYNAMICS.frame.yaw-yaw)<.001;
 for(let k=0;k<model.locks.length;k++){
  const lock=model.locks[k],points=live&&!lock.isStatic?HAIR_DYNAMICS.chains[k].p:lock.points.map(p=>hairTransform(p,f));
  for(const run of hairDepthRuns(points,front,lock.texture==='cornrow'?30*f.scale:0)){
   const z=run.reduce((n,p)=>n+p[2],0)/run.length,w=lock.width*f.scale;
   // A single tapered ribbon avoids bead-like joints and blunt pasted-on ends.
   const left=[],right=[];
   for(let i=0;i<run.length;i++){
    const idx=points.indexOf(run[i]),t=idx<0?.5:idx/(points.length-1),a=run[Math.max(0,i-1)],b=run[Math.min(run.length-1,i+1)];
    const len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/len,ny=(b[0]-a[0])/len;
    const taper=lock.texture==='loc'?1-.18*Math.pow(t,8):lock.texture==='braid'?1-.40*Math.pow(t,12):lock.texture==='cornrow'?(.62+.38*Math.min(1,t/.07))*(1-.55*Math.pow(Math.max(0,t-.82)/.18,1.4)):lock.texture==='tail'?(1-.72*Math.pow(t,1.7))*(1-.35*Math.exp(-t*9)):1-.94*Math.pow(t,3);
    // Cornrow beads pinch every other point, fading out where the row is
    // seen end-on (foreshortened points would bunch into spikes).
    const wi=idx>=0?idx:i===0?Math.max(0,points.indexOf(run[1])-1):Math.min(points.length-1,points.indexOf(run[i-1])+1);
    const fr=lock.texture==='cornrow'?clamp(len/(2*lock.lengths[Math.min(wi,lock.lengths.length-1)]*f.scale)/.55):0;
    const bead=lock.texture==='cornrow'?(lock.widths?lock.widths[wi]/lock.width:1)*(wi%2?1-.2*fr:1):1;
    const width=w*taper*bead*.5,p=run[i];left.push([p[0]+nx*width,p[1]+ny*width]);right.push([p[0]-nx*width,p[1]-ny*width]);
   }
   const outline=hairSmoothPath(left)+' L '+fmt(right[right.length-1])+hairSmoothPath(right.reverse()).replace(/^M-?[\d.]+ -?[\d.]+/,'')+' Z';
   let svg=`<path d="${outline}" class="hairFill"/>`;
   if(lock.texture==='cornrow'){
    // Rounded front end, then one separator per bead (odd points are the pinches).
    if(run[0]===points[0]){const p=run[0];svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="${Math.hypot(left[0][0]-p[0],left[0][1]-p[1])}" class="hairFill"/>`;}
    const n=left.length;
    for(let i=1;i<n-1;i++){
     if(points.indexOf(run[i])%2!==1)continue;
     const L=left[i],Rt=right[n-1-i],a=run[i-1],p=run[i];
     const k=points.indexOf(p);if(Math.hypot(run[i+1][0]-a[0],run[i+1][1]-a[1])<.3*(lock.lengths[k-1]+lock.lengths[k])*f.scale)continue;
     svg+=`<path d="M ${L[0]} ${L[1]} Q ${p[0]+(a[0]-p[0])*.9} ${p[1]+(a[1]-p[1])*.9} ${Rt[0]} ${Rt[1]}" class="hairDetail" style="stroke-width:${1.4*f.scale};opacity:.34"/>`;
    }
   }
   if(lock.texture==='loc'&&run.at(-1)===points.at(-1)){const p=run.at(-1);svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="${w*.41}" class="hairFill"/>`;}
   if(lock.texture==='flow'||lock.texture==='loc'||lock.texture==='tail')svg+=`<path d="${hairSmoothPath(run.slice(2,-1))}" class="hairDetail" style="stroke-width:${1.35*f.scale};opacity:.20"/>`;
   if(lock.texture==='braid')for(let i=1;i<run.length-1;i++){
    const a=run[i-1],b=run[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/len,ny=(b[0]-a[0])/len,p=run[i];
    svg+=`<path d="M ${p[0]-nx*w*.28} ${p[1]-ny*w*.28-2*f.scale} Q ${p[0]} ${p[1]+3*f.scale} ${p[0]+nx*w*.28} ${p[1]+ny*w*.28-2*f.scale}" class="hairDetail" style="stroke-width:${1.2*f.scale};opacity:.26"/>`;
   }
   add(z,svg);
  }
 }
 items.sort((a,b)=>a.z-b.z);
 let defs='';if(model.style==='degrade')defs=`<defs><linearGradient id="hair-fade-${layer}" gradientUnits="userSpaceOnUse" x1="${cx}" y1="${cy-110*f.scale}" x2="${cx}" y2="${cy+35*f.scale}"><stop stop-color="var(--hairColor)"/><stop offset="1" stop-color="var(--hairColor)" stop-opacity="0"/></linearGradient></defs>`;
 return `<g data-hair-layer="${layer}"${HAIR_OUTLINE_FILTER?` filter="url(#${HAIR_OUTLINE_FILTER})"`:''}>${defs}${items.map(i=>i.svg).join('')}</g>`;
}

function headAppearanceMarkup(cx,cy,r,rot=0,yaw=0){return projectedHair(cx,cy,r,rot,yaw);}
// --- StagingOrientation ----------------------------------------------------
// Prototype layer only: validates Face -> 3/4 -> Profile before the geometry
// is reused inside Loading, Sleep and the landing-page Walk cycle.
const ORIENTATION={
  value:0,from:0,target:0,start:motionNow(),duration:760,
  demo:false,demoStart:0,demoDuration:4800,
  lastSampleTime:0,lastSampleYaw:0,velocity:0,headYaw:0,
  // Stable screen-side identity for the face during a turn. This prevents the
  // head-lead offset from briefly flipping which eye is considered front/back.
  faceSide:0
};
// Full validation cycle: face → profile R → face → profile L → face.
// The body yaw is the staging driver; the head gets a small velocity-based lead.
const ORIENTATION_KEYFRAMES=[
  [0.00,0],[0.06,0],[0.18,.55],[0.30,1],[0.37,1],
  [0.48,.55],[0.57,0],[0.63,0],[0.75,-.55],[0.87,-1],
  [0.92,-1],[0.96,-.55],[1.00,0]
];
function orientationLabel(yaw){
  const a=Math.abs(yaw),side=yaw<-.02?'L':yaw>.02?'R':'';
  if(a<.12)return 'Face';
  if(a<.78)return `3/4 ${side}`;
  return `Profile ${side}`;
}
function orientationAngle(yaw){return Math.round(yaw*90)}
function orientationEaseValue(now){
  if(ORIENTATION.demo){
    const u=clamp((now-ORIENTATION.demoStart)/ORIENTATION.demoDuration);
    let value=0;
    if(u<=0.26){
      const p=u/0.26;
      value=smooth5(p);
    }else if(u<=0.74){
      const p=(u-0.26)/(0.74-0.26);
      value=Math.cos(p*Math.PI);
    }else{
      const p=(u-0.74)/(1.0-0.74);
      value=-1+smooth5(p);
    }
    if(u>=1){ORIENTATION.demo=false;ORIENTATION.value=0;ORIENTATION.target=0;ORIENTATION.from=0;value=0;}
    return value;
  }
  const u=clamp((now-ORIENTATION.start)/ORIENTATION.duration);
  ORIENTATION.value=ORIENTATION.from+(ORIENTATION.target-ORIENTATION.from)*smooth5(u);
  if(u>=1)ORIENTATION.value=ORIENTATION.target;
  return ORIENTATION.value;
}
function orientationMotionFrame(now){
  const bodyYaw=orientationEaseValue(now);
  const prevT=ORIENTATION.lastSampleTime||now;
  const dt=Math.max(8,Math.min(42,now-prevT||16.67));
  const rawV=(bodyYaw-ORIENTATION.lastSampleYaw)/dt;
  // Smooth velocity so head lead feels organic instead of jittery during slider input.
  ORIENTATION.velocity=lp(ORIENTATION.velocity||0,rawV,.30);
  const headLead=clamp(ORIENTATION.velocity*75,-.10,.10);
  // Natural, continuous head lead across zero without freezing or snapping:
  const centerBlend=smooth5(clamp(Math.abs(bodyYaw)/0.18));
  const effectiveLead=headLead*(0.55+0.45*centerBlend);
  const headYaw=clamp(bodyYaw+effectiveLead,-1,1);
  const visualSide=Math.abs(headYaw)>.001?Math.sign(headYaw):Math.sign(bodyYaw);
  ORIENTATION.faceSide=visualSide;

  ORIENTATION.lastSampleTime=now;
  ORIENTATION.lastSampleYaw=bodyYaw;
  ORIENTATION.headYaw=headYaw;
  return {bodyYaw,headYaw,velocity:ORIENTATION.velocity,faceSide:visualSide};
}
function ensureOrientationIdle(){
  if(current==='idle'&&!smMode)return;
  smMode=false;smInternal=null;smBridge=null;smExit=null;smFaceHold=null;smLogical='Idle';
  smSetVisual('idle',motionNow());smLogLines=[];smLog.textContent='Direct preview.';smRefresh();
}
function setOrientationTarget(target,duration=720){
  ensureOrientationIdle();
  if(typeof WALK!=='undefined'&&WALK.active)stopWalk();
  // Orientation previews must show a single live silhouette. The target ghost is a
  // frontal debug reference and otherwise appears as a white/grey halo around the
  // turning head, hair and feet. Keep the debug feature for ordinary state QA, but
  // disable it whenever an orientation target is requested.
  if(showG.checked){showG.checked=false;renderGhost();}
  const now=motionNow();
  const live=orientationEaseValue(now);
  ORIENTATION.demo=false;ORIENTATION.from=live;ORIENTATION.value=live;
  ORIENTATION.target=clamp(target,-1,1);
  const dist=Math.abs(ORIENTATION.target-live);
  const effectiveDuration=duration===720?Math.round(lp(380,680,clamp(dist/1.5))):duration;
  ORIENTATION.start=now;ORIENTATION.duration=CLOCK.reduced?1:effectiveDuration;if(CLOCK.reduced)ORIENTATION.start=now-1;
  ORIENTATION.lastSampleTime=now;ORIENTATION.lastSampleYaw=live;ORIENTATION.velocity=0;ORIENTATION.headYaw=live;
  ORIENTATION.faceSide=Math.abs(live)>.02?Math.sign(live):(Math.abs(ORIENTATION.target)>.02?Math.sign(ORIENTATION.target):0);
  resetAttentionTracking(true);
}
function playOrientationTurn(){
  ensureOrientationIdle();
  if(typeof WALK!=='undefined'&&WALK.active)stopWalk();
  // A target ghost here is not a second head animation: it is the static frontal
  // debug reference. Hide it so the Turn can be judged without double silhouettes.
  if(showG.checked){showG.checked=false;renderGhost();}
  const now=motionNow();
  ORIENTATION.demo=true;ORIENTATION.demoStart=now;
  ORIENTATION.value=0;ORIENTATION.from=0;ORIENTATION.target=0;
  ORIENTATION.lastSampleTime=now;ORIENTATION.lastSampleYaw=0;ORIENTATION.velocity=0;ORIENTATION.headYaw=0;ORIENTATION.faceSide=0;
  resetAttentionTracking(true);
}
// --- WalkLab --------------------------------------------------------------
// First gait pass: profile-only, in-place.  The walk layer is additive on top of
// the validated orientation pose so Face / 3/4 / Profile and Turn stay untouched.
const WALK={
  active:false,
  screenDir:1,          // -1 = screen-left, +1 = screen-right
  start:motionNow(),
  cycleMs:1080,
  speed:1,
  phase:0,
  rot:0
};
function walkProfileYaw(){
  // screenFaceDirFromYaw(yaw) = direction the face points on screen.
  return WALK.screenDir>0?-1:1;
}
// Gait: a longer, higher step. Stance and swing join with matching foot
// velocity (no stop at toe-off, no scrape at landing); heel strike → flat foot
// → toe-off roll; the knee drives forward in the swing.
const WALK_GAIT={stride:100,stance:.58,lift:118,kneeDrive:72};
function walkLegSample(phase){
  phase=((phase%1)+1)%1;
  const S=WALK_GAIT.stance,X=WALK_GAIT.stride;
  if(phase<S){
    const q=phase/S;
    const footAngle=q<.18?lp(-18,0,smooth3(q/.18)):q>.68?lp(0,24,smooth3((q-.68)/.32)):0;
    return {x:lp(X,-X,q),lift:0,swing:0,knee:10*Math.sin(Math.PI*q),footAngle};
  }
  const q=(phase-S)/(1-S);
  const v=-2*X/S*(1-S);                                    // stance speed, in swing units
  const h00=2*q*q*q-3*q*q+1,h10=q*q*q-2*q*q+q,h01=-2*q*q*q+3*q*q,h11=q*q*q-q*q;
  const x=h00*(-X)+h10*v+h01*X+h11*v;
  const up=Math.sin(Math.PI*Math.pow(q,.85));             // lifts early, lands softly
  const swing=Math.sin(Math.PI*q);
  const footAngle=q<.3?lp(24,6,smooth3(q/.3)):lp(6,-18,smooth3((q-.3)/.7));
  return {x,lift:WALK_GAIT.lift*up,swing,knee:WALK_GAIT.kneeDrive*swing,footAngle};
}
function stopWalk(){
  WALK.active=false;WALK.rot=0;WALK.phase=0;
  if(typeof walkPlay!=='undefined'&&walkPlay)walkPlay.textContent='Play Walk';
}
function startWalk(screenDir=WALK.screenDir){
  ensureOrientationIdle();
  if(showG.checked){showG.checked=false;renderGhost();}
  stopWalk();
  WALK.screenDir=screenDir<0?-1:1;
  // Turn first; the gait fades in only near profile.
  setOrientationTarget(walkProfileYaw(),380);
  WALK.active=true;
  WALK.start=motionNow()+420;
  WALK.phase=0;WALK.rot=0;
  resetMicroInteractions();
  resetAttentionTracking(true);
  if(typeof walkPlay!=='undefined'&&walkPlay)walkPlay.textContent='Pause Walk';
}
function applyWalkCycle(p,yaw,now){
  if(!WALK.active||current!=='idle'){WALK.rot=0;return p;}
  const profileBlend=smooth5(clamp((Math.abs(yaw)-.68)/.32));
  if(profileBlend<=.001){WALK.rot=0;return p;}

  const elapsed=Math.max(0,now-WALK.start);
  const phase=((elapsed*WALK.speed/WALK.cycleMs)%1+1)%1;
  WALK.phase=phase;
  const screenDir=WALK.screenDir;
  const bodyDir=yaw<0?-1:1;
  const near=bodyDir>0?'L':'R',far=bodyDir>0?'R':'L';
  const nearStep=walkLegSample(phase),farStep=walkLegSample(phase+.5);
  const groundY=Math.max(p.foot_L_center?.[1]||1386,p.foot_R_center?.[1]||1386);
  const axis=p.pelvis[0];

  const strideWave=Math.sin(phase*Math.PI*2);
  // Body is highest when a foot passes under it (mid-stance), lowest at contact.
  const S=WALK_GAIT.stance,pulse=.5+.5*Math.cos(Math.PI*4*(phase-S/2));
  const bob=-14*pulse*profileBlend;
  const forwardLean=screenDir*(10+3*strideWave)*profileBlend;
  ['head_center','neck','shoulder_L','shoulder_R','pelvis','hip_L','hip_R'].forEach(k=>addOffset(p,k,forwardLean*(k==='head_center'?1:k==='neck'?.65:.35),bob));

  function placeLeg(side,sample,isNear){
    const hip=p[`hip_${side}`];
    const depth=(isNear?7:-7)*bodyDir;
    const footX=axis+screenDir*sample.x*profileBlend+depth;
    // Heel/toe roll pivots on the contact point: lift the foot so its lowest
    // point (heel when toe is up, toe when heel is up) stays on the ground.
    const fa=sample.footAngle*Math.PI/180;
    const contact=(Math.max(-50*Math.sin(fa),69*Math.sin(fa))+17*(Math.cos(fa)-1))*profileBlend;
    const footY=groundY-sample.lift*profileBlend-contact;
    const ankleX=footX-screenDir*(12+9*sample.swing)*profileBlend;
    const ankleY=footY-(24+8*sample.swing)*profileBlend;
    const kneeBend=screenDir*(14+sample.knee)*profileBlend;
    // Fixed-length leg: the knee comes from the soft 3D IK; the authored knee
    // placement is only a hint for which way it bends on screen.
    const hint=[lp(hip[0],ankleX,.51)+kneeBend,lp(hip[1],ankleY,.51)-17*sample.swing*profileBlend];
    const leg=solveTwoBone(hip,[ankleX,ankleY],SKELETON.thigh[side],SKELETON.shin[side],hint);
    p[`knee_${side}`]=leg.joint;
    p[`ankle_${side}`]=leg.end;
    p[`foot_${side}_center`]=[footX+leg.end[0]-ankleX,footY+leg.end[1]-ankleY];
    p.walkFootAngle=p.walkFootAngle||{};
    p.walkFootAngle[side]=screenDir*sample.footAngle*profileBlend;
  }
  placeLeg(near,nearStep,true);
  placeLeg(far,farStep,false);

  // Arms counter-swing against the actual foot position, so heel strike,
  // toe-off and swing stay in phase instead of following an unrelated sine wave.
  function swingArm(side,step,isNear){
    const amp=(isNear?96:78)*profileBlend;
    const k=step.x/WALK_GAIT.stride;                        // -1..1, opposite to the leg
    const dx=-screenDir*k*amp;
    const lift=(step.swing*.75+Math.abs(strideWave)*.22)*(isNear?14:11)*profileBlend;
    // The elbow flexes as the arm swings forward (relaxed, not a pendulum stick).
    const flex=smooth3(clamp(-k))*profileBlend;
    addOffset(p,`elbow_${side}`,dx*.44,-lift*.25);
    addOffset(p,`wrist_${side}`,dx+screenDir*22*flex,-lift-40*flex);
    addOffset(p,`hand_${side}_center`,dx*1.06+screenDir*26*flex,-lift*1.04-46*flex);
  }
  swingArm(near,nearStep,true);
  swingArm(far,farStep,false);

  // Tiny head counter-motion keeps the walk alive without compromising the
  // profile silhouette that was already validated.
  const counter=Math.sin(phase*Math.PI*2);
  // The head follows the bounce with a slight lag (secondary motion).
  const lag=.5+.5*Math.cos(Math.PI*4*(phase-S/2-.06));
  addOffset(p,'head_center',-screenDir*3.4*counter*profileBlend,-4*(lag-pulse)*profileBlend);
  WALK.rot=screenDir*1.65*counter*profileBlend;
  return p;
}

function applyOrientationPose(p,yaw){
  const a=Math.abs(yaw);if(a<.001)return p;
  const dir=yaw<0?-1:1,q=cpy(p),base=cpy(p);
  // The turn is a depth collapse, not a lateral spread.  At profile the two
  // shoulders/hips almost share one screen axis; only small fore/aft offsets
  // remain so near/far limbs are readable.
  const u=Math.pow(smooth5(a),.82);
  const axis=(base.neck[0]+base.pelvis[0])*.5;
  const topAxis=axis+dir*4*u;
  const bottomAxis=axis-dir*3*u;
  const near=dir>0?'L':'R',far=dir>0?'R':'L';
  const mix=(key,x,yOff=0)=>{
    if(!q[key])return;
    q[key][0]=lp(base[key][0],x,u);
    q[key][1]=base[key][1]+yOff*u;
  };

  // Head leads the body slightly in the viewing direction.  The neck stays
  // behind the facial mass, which makes the side silhouette understandable
  // even if all facial features are hidden.
  mix('neck',topAxis,0);
  mix('pelvis',bottomAxis,0);
  q.head_center[0]=lp(base.head_center[0],base.head_center[0]+screenFaceDirFromYaw(yaw)*18,u);

  // Near/far shoulders collapse into depth instead of remaining a frontal pair.
  mix(`shoulder_${near}`,topAxis+dir*5,4);
  mix(`shoulder_${far}`, topAxis-dir*4,-4);
  mix(`elbow_${near}`,   topAxis+dir*15,5);
  mix(`elbow_${far}`,    topAxis-dir*7,-5);
  mix(`wrist_${near}`,   topAxis+dir*12,6);
  mix(`wrist_${far}`,    topAxis-dir*5,-6);
  mix(`hand_${near}_center`,topAxis+dir*14,7);
  mix(`hand_${far}_center`, topAxis-dir*6,-7);

  // Hips and legs also collapse.  The near foot sits a little in front of the
  // far foot, rather than producing the frontal V seen in the previous pass.
  mix(`hip_${near}`,bottomAxis+dir*3,2);
  mix(`hip_${far}`, bottomAxis-dir*3,-2);
  mix(`knee_${near}`,bottomAxis+dir*9,2);
  mix(`knee_${far}`, bottomAxis-dir*6,-2);
  mix(`ankle_${near}`,bottomAxis+dir*13,2);
  mix(`ankle_${far}`, bottomAxis-dir*9,-2);
  mix(`foot_${near}_center`,bottomAxis+dir*25,3);
  mix(`foot_${far}_center`, bottomAxis-dir*13,-3);
  return q;
}
function applyTurnDynamics(p,bodyYaw,velocity){
  if(Math.abs(velocity)<.00001)return p;
  const dir=velocity<0?-1:1;
  // Progressive, smooth kinetic energy curve instead of an abrupt step function
  const vMag=Math.abs(velocity);
  const energy=smooth5(clamp(vMag/0.0032));
  // Counter-balance: head/upper body enter the turn first, pelvis resists slightly.
  addOffset(p,'head_center',dir*2.8*energy,-1.1*energy);
  addOffset(p,'neck',dir*1.8*energy,-.6*energy);
  addOffset(p,'shoulder_L',dir*1.3*energy,0);
  addOffset(p,'shoulder_R',dir*1.3*energy,0);
  addOffset(p,'pelvis',-dir*3.2*energy,1.1*energy);
  addOffset(p,'hip_L',-dir*2.5*energy,1.0*energy);
  addOffset(p,'hip_R',-dir*2.5*energy,1.0*energy);

  // Tiny knee compression keeps the turn from reading as a rigid cardboard swivel.
  addOffset(p,'knee_L',0,1.8*energy);
  addOffset(p,'knee_R',0,1.8*energy);
  return p;
}
function orientationLegRestPoints(yaw,basePose){
  const a=Math.abs(yaw);
  if(a<.001){
    return {
      foot_L:[basePose.foot_L_center[0],basePose.foot_L_center[1]],
      foot_R:[basePose.foot_R_center[0],basePose.foot_R_center[1]],
      ankle_L:[basePose.ankle_L[0],basePose.ankle_L[1]],
      ankle_R:[basePose.ankle_R[0],basePose.ankle_R[1]],
      knee_L:[basePose.knee_L[0],basePose.knee_L[1]],
      knee_R:[basePose.knee_R[0],basePose.knee_R[1]],
      hip_L:[basePose.hip_L[0],basePose.hip_L[1]],
      hip_R:[basePose.hip_R[0],basePose.hip_R[1]]
    };
  }
  const dir=yaw<0?-1:1;
  const u=Math.pow(smooth5(a),.82);
  const axis=(basePose.neck[0]+basePose.pelvis[0])*.5;
  const bottomAxis=axis-dir*3*u;
  const near=dir>0?'L':'R',far=dir>0?'R':'L';

  const res={};
  res[`hip_${near}`]=[lp(basePose[`hip_${near}`][0],bottomAxis+dir*3,u),basePose[`hip_${near}`][1]+2*u];
  res[`hip_${far}`]=[lp(basePose[`hip_${far}`][0],bottomAxis-dir*3,u),basePose[`hip_${far}`][1]-2*u];
  res[`knee_${near}`]=[lp(basePose[`knee_${near}`][0],bottomAxis+dir*9,u),basePose[`knee_${near}`][1]+2*u];
  res[`knee_${far}`]=[lp(basePose[`knee_${far}`][0],bottomAxis-dir*6,u),basePose[`knee_${far}`][1]-2*u];
  res[`ankle_${near}`]=[lp(basePose[`ankle_${near}`][0],bottomAxis+dir*13,u),basePose[`ankle_${near}`][1]+2*u];
  res[`ankle_${far}`]=[lp(basePose[`ankle_${far}`][0],bottomAxis-dir*9,u),basePose[`ankle_${far}`][1]-2*u];
  res[`foot_${near}`]=[lp(basePose[`foot_${near}_center`][0],bottomAxis+dir*25,u),basePose[`foot_${near}_center`][1]+3*u];
  res[`foot_${far}`]=[lp(basePose[`foot_${far}_center`][0],bottomAxis-dir*13,u),basePose[`foot_${far}_center`][1]-3*u];
  return res;
}
function applyTurnFootwork(p,now,basePose){
  if(CLOCK.reduced)return;
  if(typeof WALK!=='undefined'&&WALK.active&&Math.abs(ORIENTATION.value)>.68)return;

  const demo=ORIENTATION.demo;
  let stepDef=null;

  if(demo){
    const u=clamp((now-ORIENTATION.demoStart)/ORIENTATION.demoDuration);
    if(u<1){
      if(u<=0.26){
        const s=u/0.26;
        if(s>=0.08&&s<0.48){
          stepDef={stepFoot:'R',stanceFoot:'L',tau:(s-0.08)/0.40,fromYaw:0,toYaw:1,dir:1,maxLift:28};
        }else if(s>=0.48&&s<0.88){
          stepDef={stepFoot:'L',stanceFoot:'R',tau:(s-0.48)/0.40,fromYaw:0,toYaw:1,dir:1,maxLift:24};
        }
      }else if(u<=0.74){
        const s=(u-0.26)/0.48;
        if(s>=0.04&&s<0.23){
          stepDef={stepFoot:'L',stanceFoot:'R',tau:(s-0.04)/0.19,fromYaw:1,toYaw:0.5,dir:-1,maxLift:26};
        }else if(s>=0.27&&s<0.46){
          stepDef={stepFoot:'R',stanceFoot:'L',tau:(s-0.27)/0.19,fromYaw:0.5,toYaw:0,dir:-1,maxLift:26};
        }else if(s>=0.50&&s<0.69){
          stepDef={stepFoot:'L',stanceFoot:'R',tau:(s-0.50)/0.19,fromYaw:0,toYaw:-0.5,dir:-1,maxLift:26};
        }else if(s>=0.73&&s<0.92){
          stepDef={stepFoot:'R',stanceFoot:'L',tau:(s-0.73)/0.19,fromYaw:-0.5,toYaw:-1,dir:-1,maxLift:24};
        }
      }else{
        const s=(u-0.74)/0.26;
        if(s>=0.08&&s<0.48){
          stepDef={stepFoot:'R',stanceFoot:'L',tau:(s-0.08)/0.40,fromYaw:-1,toYaw:0,dir:1,maxLift:28};
        }else if(s>=0.48&&s<0.88){
          stepDef={stepFoot:'L',stanceFoot:'R',tau:(s-0.48)/0.40,fromYaw:-1,toYaw:0,dir:1,maxLift:24};
        }
      }
    }
  }else{
    const elapsed=now-ORIENTATION.start;
    const dur=ORIENTATION.duration;
    if(elapsed<dur){
      const u=clamp(elapsed/dur);
      const dy=ORIENTATION.target-ORIENTATION.from;
      const mag=Math.abs(dy);
      if(mag>=0.12){
        const dir=dy>0?1:-1;
        if(mag>1.2){
          const step1Foot=dir>0?'R':'L', step2Foot=dir>0?'L':'R';
          if(u>=0.04&&u<0.24){
            stepDef={stepFoot:step1Foot,stanceFoot:step2Foot,tau:(u-0.04)/0.20,fromYaw:ORIENTATION.from,toYaw:ORIENTATION.from+dir*0.5,dir,maxLift:26};
          }else if(u>=0.27&&u<0.47){
            stepDef={stepFoot:step2Foot,stanceFoot:step1Foot,tau:(u-0.27)/0.20,fromYaw:ORIENTATION.from+dir*0.5,toYaw:ORIENTATION.from+dir*1.0,dir,maxLift:26};
          }else if(u>=0.50&&u<0.70){
            stepDef={stepFoot:step1Foot,stanceFoot:step2Foot,tau:(u-0.50)/0.20,fromYaw:ORIENTATION.from+dir*1.0,toYaw:ORIENTATION.from+dir*1.5,dir,maxLift:26};
          }else if(u>=0.73&&u<0.93){
            stepDef={stepFoot:step2Foot,stanceFoot:step1Foot,tau:(u-0.73)/0.20,fromYaw:ORIENTATION.from+dir*1.5,toYaw:ORIENTATION.target,dir,maxLift:24};
          }
        }else{
          const step1Foot=dir>0?'R':'L';
          const step2Foot=dir>0?'L':'R';
          const scale=clamp(mag/0.7,0.4,1.0);
          if(u>=0.06&&u<0.48){
            stepDef={stepFoot:step1Foot,stanceFoot:step2Foot,tau:(u-0.06)/0.42,fromYaw:ORIENTATION.from,toYaw:ORIENTATION.target,dir,maxLift:34*scale};
          }else if(u>=0.48&&u<0.92){
            stepDef={stepFoot:step2Foot,stanceFoot:step1Foot,tau:(u-0.48)/0.44,fromYaw:ORIENTATION.from,toYaw:ORIENTATION.target,dir,maxLift:30*scale};
          }
        }
      }
    }
  }

  p.walkFootAngle=p.walkFootAngle||{};

  if(!stepDef){
    p.walkFootAngle.L=0;
    p.walkFootAngle.R=0;
    if(!demo&&(now-ORIENTATION.start)<ORIENTATION.duration&&Math.abs(ORIENTATION.target-ORIENTATION.from)>=0.12){
      const uHold=clamp((now-ORIENTATION.start)/ORIENTATION.duration);
      const holdPos=uHold<0.06?orientationLegRestPoints(ORIENTATION.from,basePose):orientationLegRestPoints(ORIENTATION.target,basePose);
      p.foot_L_center=[...holdPos.foot_L];
      p.foot_R_center=[...holdPos.foot_R];
      p.ankle_L=[...holdPos.ankle_L];
      p.ankle_R=[...holdPos.ankle_R];
      p.knee_L=[...holdPos.knee_L];
      p.knee_R=[...holdPos.knee_R];
    }
    return;
  }

  const {stepFoot,stanceFoot,tau,fromYaw,toYaw,dir,maxLift}=stepDef;
  const tClamped=clamp(tau,0,1);
  const startRest=orientationLegRestPoints(fromYaw,basePose);
  const targetRest=orientationLegRestPoints(toYaw,basePose);

  const stanceIsTarget=(stepFoot===(dir>0?'L':'R'));
  const stancePos=stanceIsTarget?targetRest:startRest;
  p[`foot_${stanceFoot}_center`]=[...stancePos[`foot_${stanceFoot}`]];
  p[`ankle_${stanceFoot}`]=[...stancePos[`ankle_${stanceFoot}`]];
  p[`knee_${stanceFoot}`]=[...stancePos[`knee_${stanceFoot}`]];
  p.walkFootAngle[stanceFoot]=0;

  const lift=Math.sin(Math.PI*tClamped)*maxLift;
  const h=smooth3(tClamped);
  const footStartX=startRest[`foot_${stepFoot}`][0];
  const footTargetX=targetRest[`foot_${stepFoot}`][0];
  const footStartY=startRest[`foot_${stepFoot}`][1];
  const footTargetY=targetRest[`foot_${stepFoot}`][1];

  p[`foot_${stepFoot}_center`]=[
    lp(footStartX,footTargetX,h),
    lp(footStartY,footTargetY,h)-lift
  ];

  const ankleStartX=startRest[`ankle_${stepFoot}`][0];
  const ankleTargetX=targetRest[`ankle_${stepFoot}`][0];
  const ankleStartY=startRest[`ankle_${stepFoot}`][1];
  const ankleTargetY=targetRest[`ankle_${stepFoot}`][1];
  const ankle=[
    lp(ankleStartX,ankleTargetX,h),
    lp(ankleStartY,ankleTargetY,h)-lift
  ];
  p[`ankle_${stepFoot}`]=ankle;

  const hip=p[`hip_${stepFoot}`];
  p[`knee_${stepFoot}`]=[
    lp(hip[0],ankle[0],0.5)+dir*(10+lift*0.25),
    lp(hip[1],ankle[1],0.5)-5-lift*0.14
  ];

  const pitch=Math.sin(Math.PI*tClamped)*(tClamped<0.4?-8:7)*dir;
  p.walkFootAngle[stepFoot]=pitch;

  const stanceX=stancePos[`foot_${stanceFoot}`][0];
  const midX=(startRest.foot_L[0]+startRest.foot_R[0])*0.5;
  const sway=(stanceX-midX)*0.04*Math.sin(Math.PI*tClamped);
  p.pelvis[0]+=sway;
  p.pelvis[1]+=Math.sin(Math.PI*tClamped)*1.5;
}
function orientedHeadMarkup(cx,cy,r,rot=0,yaw=0){
  const ch=characterDef();if(ch&&ch.head)return ch.head(cx,cy,r,rot,yaw);
  const u=smooth5(Math.abs(yaw)),dir=screenFaceDirFromYaw(yaw);
  const f=r*(1-.015*u),b=r*(1-.15*u),k=.55228475;
  const d=`M 0 ${-r} C ${f*k} ${-r} ${f} ${-r*k} ${f} 0 C ${f} ${r*k} ${f*k} ${r} 0 ${r} C ${-b*k} ${r} ${-b} ${r*k} ${-b} 0 C ${-b} ${-r*k} ${-b*k} ${-r} 0 ${-r} Z`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${dir} 1)"><path class="headCircle" d="${d}"/></g>`;
}
function orientationIdleFaceMarkup(cx,cy,r,rot=0,blink=0,eyeOffset=[0,0],yaw=0){
  // Continuous face projection for Face -> 3/4 -> Profile.
  // IMPORTANT: only ONE face is rendered. No opacity crossfade between a 3/4 face
  // and a second profile face, which previously created grey/ghosted duplicate eyes.
  const a=Math.abs(yaw),dir=screenFaceDirFromYaw(yaw),u=smooth5(a),s=r/185;
  const minRy=2.2*s,eyeRy=Math.max(minRy,28*s*(1-blink)+minRy*blink);

  // Validated profile-eye mapping from v16.8.7; Walk Lab does not alter it.
  // Keep head/mouth projection unchanged; ONLY swap which screen-side eye/brow
  // behaves as the surviving near feature versus the receding far feature.
  const eyeDir=dir;
  const nearU=Math.pow(u,.78);
  const nearX=cx+eyeDir*lp(-48,130,nearU)*s;
  const nearY=cy-lp(10,22,nearU)*s;

  const farMoveU=smooth5(clamp((a-.12)/.80));
  const farX=cx+eyeDir*lp(48,170,farMoveU)*s;
  const farY=cy-lp(10,18,farMoveU)*s;
  const farVis=1-smooth5(clamp((a-.24)/.50));
  const farRx=Math.max(0,13*farVis)*s;
  const farRy=Math.max(minRy,eyeRy*lp(.88,1,farVis));

  // Brows use the same near/far depth model. The far brow becomes shorter and
  // slightly higher as it recedes, so it never touches the near brow mid-turn.
  const browY=cy-lp(70,82,nearU)*s;
  const browPeak=cy-lp(88,103,nearU)*s;
  const nearBrow=`<path data-feature="near-brow" class="faceStroke" d="M ${nearX-eyeDir*24*s} ${browY} Q ${nearX-eyeDir*1*s} ${browPeak} ${nearX+eyeDir*27*s} ${browY+5*s}"/>`;
  const farBrowHalf=19*s*Math.sqrt(Math.max(0,farVis));
  const farBrowY=cy-lp(70,84,farMoveU)*s;
  const farBrowPeak=cy-lp(84,101,farMoveU)*s;
  const farBrow=farVis>.16
    ? `<path class="faceStroke" d="M ${farX-eyeDir*farBrowHalf} ${farBrowY} Q ${farX} ${farBrowPeak} ${farX+eyeDir*farBrowHalf} ${farBrowY+1.5*s}"/>`
    : '';

  const trackScale=Math.max(0,1-a*1.08);
  const nex=nearX+(eyeOffset[0]||0)*trackScale,ney=nearY+(eyeOffset[1]||0)*trackScale;
  const nearEye=`<ellipse data-feature="near-eye" class="eye" cx="${nex}" cy="${ney}" rx="${13*s}" ry="${eyeRy}"/>`
    +(eyeRy>15*s?`<circle class="eyeShine" cx="${nex-4.2*s}" cy="${ney-10*s}" r="${4.7*s}"/>`:'');
  const farEye=farRx>.7
    ? `<ellipse data-feature="far-eye" class="eye" cx="${farX+(eyeOffset[0]||0)*trackScale}" cy="${farY+(eyeOffset[1]||0)*trackScale}" rx="${farRx}" ry="${farRy}"/>`
    : '';

  // The mouth joins the turn earlier than in v16.8.1, while keeping the validated
  // low profile endpoint. This keeps the whole face rotating as one unit.
  const mouthU=Math.pow(u,.64);
  const mouthStartX=cx+dir*lp(-50,88,mouthU)*s;
  const mouthCtrlX =cx+dir*lp(0,127,mouthU)*s;
  const mouthEndX  =cx+dir*lp(50,160,mouthU)*s;
  const mouthStartY=cy+lp(55,76,mouthU)*s;
  const mouthCtrlY =cy+lp(84,98,mouthU)*s;
  const mouthEndY  =cy+lp(55,84,mouthU)*s;
  const mouth=`<path class="faceStroke" d="M ${mouthStartX} ${mouthStartY} Q ${mouthCtrlX} ${mouthCtrlY} ${mouthEndX} ${mouthEndY}"/>`;

  const cheeksOn=(typeof APPEARANCE==='undefined'||APPEARANCE.cheeks!==false)&&!wearsBeard();
  const nearCheek=cheeksOn?`<ellipse class="blush" cx="${nearX+eyeDir*lp(-38,-10,nearU)*s}" cy="${cy+30*s}" rx="${lp(25,19,nearU)*s}" ry="${14*s}"/>`:'';
  const farCheek=cheeksOn&&farVis>.2?`<ellipse class="blush" cx="${farX+eyeDir*36*s*farVis}" cy="${cy+30*s}" rx="${25*s*farVis}" ry="${14*s}" opacity="${farVis}"/>`:'';
  return `<g transform="rotate(${rot} ${cx} ${cy})">${farCheek}${nearCheek}${farBrow}${nearBrow}${farEye}${nearEye}${beardMoustache(mouth,cx,cy,s)}${mouth}</g>`;
}
function profileFaceMarkup(mode,cx,cy,r,rot=0,blink=0,dir=1){
  const s=r/185;
  const P=d=>`<path class="faceStroke" d="${d}"/>`;
  // Profile reference: eye and brow sit close to the leading contour; the mouth
  // is lower and its front end nearly meets the cheek outline.
  const eyeX=cx+dir*130*s,eyeRy=Math.max(2.2*s,27*s*(1-blink)+2.2*s*blink);
  let brow=P(`M ${eyeX-dir*25*s} ${cy-82*s} Q ${eyeX-dir*2*s} ${cy-104*s} ${eyeX+dir*29*s} ${cy-77*s}`);
  let eye=`<ellipse class="eye" cx="${eyeX}" cy="${cy-22*s}" rx="${12*s}" ry="${eyeRy}"/>`+(eyeRy>15*s?`<circle class="eyeShine" cx="${eyeX-dir*3.5*s}" cy="${cy-32*s}" r="${4.3*s}"/>`:'');
  const cheek=(typeof APPEARANCE==='undefined'||APPEARANCE.cheeks!==false)&&!wearsBeard()?`<ellipse class="blush" cx="${eyeX-dir*14*s}" cy="${cy+26*s}" rx="${19*s}" ry="${13*s}"/>`:'';
  let mouth=P(`M ${cx+dir*88*s} ${cy+76*s} Q ${cx+dir*127*s} ${cy+98*s} ${cx+dir*164*s} ${cy+84*s}`);
  if(mode==='sleep'){
    eye=P(`M ${eyeX-dir*13*s} ${cy-12*s} Q ${eyeX} ${cy+7*s} ${eyeX+dir*18*s} ${cy-12*s}`);brow='';
    mouth=P(`M ${cx+dir*90*s} ${cy+75*s} Q ${cx+dir*128*s} ${cy+91*s} ${cx+dir*163*s} ${cy+82*s}`);
  }else if(mode==='success'||mode==='welcome'){
    eye=P(`M ${eyeX-dir*13*s} ${cy-20*s} Q ${eyeX} ${cy-40*s} ${eyeX+dir*19*s} ${cy-20*s}`);
    mouth=P(`M ${cx+dir*87*s} ${cy+67*s} Q ${cx+dir*128*s} ${cy+101*s} ${cx+dir*166*s} ${cy+77*s}`);
  }else if(mode==='error'){
    brow=P(`M ${eyeX-dir*20*s} ${cy-76*s} L ${eyeX+dir*25*s} ${cy-99*s}`);
    mouth=P(`M ${cx+dir*89*s} ${cy+89*s} Q ${cx+dir*128*s} ${cy+65*s} ${cx+dir*164*s} ${cy+88*s}`);
  }else if(mode==='thinking'){
    mouth=P(`M ${cx+dir*91*s} ${cy+80*s} Q ${cx+dir*128*s} ${cy+73*s} ${cx+dir*163*s} ${cy+80*s}`);
  }
  return `<g transform="rotate(${rot} ${cx} ${cy})">${cheek}${brow}${eye}${beardMoustache(mouth,cx,cy,s)}${mouth}</g>`;
}
function orientedFaceSpec(spec,cx,cy,r,rot=0,blink=0,eyeOffset=[0,0],yaw=0){
  const ch=characterDef();
  return ch&&ch.face?ch.face(spec,cx,cy,r,rot,blink,eyeOffset,yaw):ukoOrientedFaceSpec(spec,cx,cy,r,rot,blink,eyeOffset,yaw);
}
function ukoOrientedFaceSpec(spec,cx,cy,r,rot=0,blink=0,eyeOffset=[0,0],yaw=0){
  const a=Math.abs(yaw);if(typeof spec==='string'&&spec==='idle')return orientationIdleFaceMarkup(cx,cy,r,rot,blink,eyeOffset,yaw);
  if(a<.015)return renderFaceSpec(spec,cx,cy,r,rot,blink,eyeOffset);
  const dir=screenFaceDirFromYaw(yaw);

  if(typeof spec==='string'&&spec==='idle'){
    // One continuous face through the entire turn. Never crossfade a second face.
    return orientationIdleFaceMarkup(cx,cy,r,rot,blink,eyeOffset,yaw);
  }

  const shift=dir*44*a,scaleX=1-.25*a;
  FACE_X.shift=shift;FACE_X.scaleX=scaleX;
  const frontal=renderFaceSpec(spec,cx,cy,r,rot,blink,a>.55?[0,0]:eyeOffset);
  FACE_X.shift=0;FACE_X.scaleX=1;
  const frontalMouth=BEARD_MOUTH;
  const transformed=`<g transform="translate(${shift} 0) translate(${cx} ${cy}) scale(${scaleX} 1) translate(${-cx} ${-cy})">${frontal}</g>`;
  if(a<=.60)return transformed;
  const u=smooth5(clamp((a-.60)/.40));
  const mode=typeof spec==='string'?spec:(spec.u<.5?spec.from:spec.to);
  const profile=profileFaceMarkup(mode,cx,cy,r,rot,blink,dir);
  if(u<.5)BEARD_MOUTH=frontalMouth;
  return `<g><g opacity="${(1-u).toFixed(3)}">${transformed}</g><g opacity="${u.toFixed(3)}">${profile}</g></g>`;
}

function loadingLaptopMarkup(raw=false){
  // The laptop follows the body (life layer), not the typing hands.
  const sh=raw||typeof LIFE==='undefined'?[0,0]:LIFE.laptopShift;
  return `<g class="loadingLaptop" transform="translate(${sh[0].toFixed(2)} ${sh[1].toFixed(2)})">
    <!-- Modern thin laptop: one shallow keyboard plane + one angled screen. -->
    <path class="laptopSurface"
      d="M 526 716
         L 748 724
         L 790 746
         L 520 739
         Z"/>

    <!-- Broad rear screen, angled away from the mascot. -->
    <path class="laptopSurface"
      d="M 735 726
         L 781 579
         L 874 590
         L 828 742
         Z"/>

    <!-- One subtle hinge cue only. -->
    <line class="laptopDetail"
      x1="724" y1="727"
      x2="830" y2="742"/>

    <!-- Very subtle keyboard-plane cue; kept below the hands. -->
    <line class="laptopDetail"
      x1="562" y1="728"
      x2="692" y2="734"
      opacity=".38"/>
  </g>`;
}

function orientationHandMarkup(p,side,isNear,yaw){
  const a=Math.abs(yaw),c=p[`hand_${side}_center`]||p[`wrist_${side}`],ang=angle(p[`elbow_${side}`],c);
  const rx=lp(46,isNear?39:32,smooth5(a)),ry=lp(26,isNear?23:19,smooth5(a));
  const opacity=1;
  return `<ellipse class="hand" opacity="${opacity.toFixed(3)}" cx="${c[0]}" cy="${c[1]}" rx="${rx}" ry="${ry}" transform="rotate(${ang} ${c[0]} ${c[1]})"/>`;
}
function orientationFootMarkup(p,side,isNear,yaw){
  const a=Math.abs(yaw),dir=yaw<0?-1:1,c=p[`foot_${side}_center`]||p[`ankle_${side}`];
  const walkAngle=p.walkFootAngle?.[side]||0;
  const rotAttr=Math.abs(walkAngle)>.1?` transform="rotate(${walkAngle.toFixed(2)} ${c[0]} ${c[1]})"`:'';
  if(a<=.32)return `<ellipse class="foot" cx="${c[0]}" cy="${c[1]}" rx="58" ry="22"${rotAttr}/>`;
  const u=smooth5(clamp((a-.32)/.68)),opacity=1,scale=isNear?1:lp(1,.86,u);
  const frontal=`<ellipse class="foot" cx="${c[0]}" cy="${c[1]}" rx="58" ry="22"${rotAttr}/>`;
  const d=`M -31 -15 C -45 -14 -52 -6 -50 4 C -48 13 -35 17 -18 17 L 38 17 C 55 17 68 10 69 1 C 69 -9 56 -15 39 -16 Z`;
  const profile=`<g transform="translate(${c[0]} ${c[1]}) rotate(${walkAngle.toFixed(2)}) scale(${screenFaceDirFromYaw(yaw)*scale} ${scale})"><path class="foot" d="${d}"/></g>`;
  return `<g opacity="${opacity.toFixed(3)}"><g opacity="${(1-u).toFixed(3)}">${frontal}</g><g opacity="${u.toFixed(3)}">${profile}</g></g>`;
}
function renderOrientationIdleRig(p,faceMode,rot,blink,eyeOffset,yaw,headYaw=yaw){
  const dir=yaw<0?-1:1,a=Math.abs(yaw),near=dir>0?'L':'R',far=dir>0?'R':'L';
  const farOpacity=1;
  const [cx,cy]=p.head_center;
  // Hair behind the head is also behind the body (long hair, ponytails, braids).
  let out=projectedHair(cx,cy,p.head_radius,rot,headYaw,"back");
  const chBody=characterDef();if(chBody)out+=chBody.body(p,yaw);

  // Far limbs are painted first: they live behind the torso in depth.
  out+=`<g opacity="${farOpacity.toFixed(3)}">`
    +seg(p[`shoulder_${far}`],p[`elbow_${far}`])
    +seg(p[`elbow_${far}`],p[`wrist_${far}`])
    +seg(p[`hip_${far}`],p[`knee_${far}`])
    +seg(p[`knee_${far}`],p[`ankle_${far}`])
    +orientationHandMarkup(p,far,false,yaw)
    +orientationFootMarkup(p,far,false,yaw)
    +`</g>`;

  // Torso becomes the depth separator.
  out+=seg(p.neck,p.pelvis);

  // Near limbs sit in front and remain full contrast.
  out+=seg(p[`shoulder_${near}`],p[`elbow_${near}`])
    +seg(p[`elbow_${near}`],p[`wrist_${near}`])
    +seg(p[`hip_${near}`],p[`knee_${near}`])
    +seg(p[`knee_${near}`],p[`ankle_${near}`])
    +orientationHandMarkup(p,near,true,yaw)
    +orientationFootMarkup(p,near,true,yaw);

  out+=orientedHeadMarkup(cx,cy,p.head_radius,rot,headYaw);
  // The face is built first: the beard opens around the mouth it draws.
  const faceSvg=orientedFaceSpec(faceMode,cx,cy,p.head_radius,rot,blink,eyeOffset,headYaw);
  out+=headAppearanceMarkup(cx,cy,p.head_radius,rot,headYaw);
  out+=faceSvg;
  return out;
}

function renderRig(p,faceMode,rot=0,blink=0,showLoadingLaptop=false,eyeOffset=[0,0],yaw=0,headYaw=yaw){
  const hcL=p.hand_L_center||p.wrist_L,hcR=p.hand_R_center||p.wrist_R,fcL=p.foot_L_center||p.ankle_L,fcR=p.foot_R_center||p.ankle_R;
  const hL=angle(p.elbow_L,hcL),hR=angle(p.elbow_R,hcR);

  // Foreground ordering is a body-layer concern, not a face-expression concern.
  // Keep the Thinking hand in front while the body is still leaving Thinking.
  const thinkingFront=
    faceSpecHasThinking(faceMode) ||
    (current==='thinking' && (thinkExitStart || (smMode&&smInternal==='bridge'))) ||
    HOLD_THINKING_FRONT;

  // Orientation Lab gets a real depth-aware body renderer.  Face view and every
  // production state keep the previous renderer byte-for-byte in behaviour.
  const hasFootTilt=p.walkFootAngle&&(Math.abs(p.walkFootAngle.L||0)>.1||Math.abs(p.walkFootAngle.R||0)>.1);
  if(current==='idle'&&(Math.abs(yaw)>.015||hasFootTilt)&&!showLoadingLaptop&&!thinkingFront){
    return renderOrientationIdleRig(p,faceMode,rot,blink,eyeOffset,yaw,headYaw);
  }

  // A hand touching the head or the face (scratching, chin) is in front of it:
  // the character faces the camera. Lying down, a hand near the head is a pillow
  // and stays under it.
  const [cx,cy]=p.head_center;
  const touchesHead=h=>current!=='sleep'&&current!=='wake'&&Math.hypot(h[0]-cx,h[1]-cy)<p.head_radius+34;
  // A raised hand inside a big hairstyle's silhouette (afro, curls…) stays readable:
  // its forearm and hand are drawn over the hair, the upper arm stays behind.
  const reachPx=hairReach()*p.head_radius/185;
  const raisedInHair=h=>current!=='sleep'&&current!=='wake'&&h[1]<p.neck[1]-40&&(characterDef()?characterCovers(p,h,rot,40):Math.hypot(h[0]-cx,h[1]-cy)<reachPx+40);
  // A scripted move (climb) draws both forearms in front: hands gripping above the head.
  const front={L:MOVE_FRONT_ARMS||touchesHead(hcL)||raisedInHair(hcL),R:MOVE_FRONT_ARMS||thinkingFront||touchesHead(hcR)||raisedInHair(hcR)};
  const hand=(c,a)=>`<ellipse class="hand" cx="${c[0]}" cy="${c[1]}" rx="46" ry="26" transform="rotate(${a} ${c[0]} ${c[1]})"/>`;

  // Hair behind the head is also behind the body (long hair, ponytails, braids).
  let out=projectedHair(cx,cy,p.head_radius,rot,headYaw,"back");
  const chBody=characterDef();if(chBody)out+=chBody.body(p,yaw);

  out+=seg(p.neck,p.pelvis);

  // Loading uses mixed occlusion:
  // upper arm stays behind the device, but the typing forearm is on top of the keyboard plane.
  out+=seg(p.shoulder_L,p.elbow_L);
  if(!showLoadingLaptop&&!front.L)out+=seg(p.elbow_L,p.wrist_L);

  out+=seg(p.shoulder_R,p.elbow_R);
  if(!front.R)out+=seg(p.elbow_R,p.wrist_R);

  out+=seg(p.hip_L,p.knee_L)+seg(p.knee_L,p.ankle_L);
  out+=seg(p.hip_R,p.knee_R)+seg(p.knee_R,p.ankle_R);

  // Physical occlusion order for Loading:
  // body + upper arms → opaque laptop → typing forearm → opaque hands.
  if(showLoadingLaptop)out+=loadingLaptopMarkup();
  if(showLoadingLaptop&&!front.L)out+=seg(p.elbow_L,p.wrist_L);

  if(!front.L)out+=hand(hcL,hL);
  if(!front.R)out+=hand(hcR,hR);

  out+=`<ellipse class="foot" cx="${fcL[0]}" cy="${fcL[1]}" rx="58" ry="22"/>`
      +`<ellipse class="foot" cx="${fcR[0]}" cy="${fcR[1]}" rx="58" ry="22"/>`;

  out+=orientedHeadMarkup(cx,cy,p.head_radius,rot,headYaw);
  // The face is built first: the beard opens around the mouth it draws.
  const faceSvg=orientedFaceSpec(faceMode,cx,cy,p.head_radius,rot,blink,eyeOffset,headYaw);
  out+=headAppearanceMarkup(cx,cy,p.head_radius,rot,headYaw);
  out+=faceSvg;

  if(front.L||front.R){
    // Sticker outline: a halo in the page colour keeps the arm readable over the face
    // and the hair. It is clipped to the head and hair so it never shows over the
    // page itself (on a coloured page it would look like a sleeve).
    // Clip shape: the head (a bit larger than its outline) plus the hair's filled shapes.
    const clipId=`${INSTANCE_ID}-halo`;
    const hairShapes=[...(projectedHair(cx,cy,p.head_radius,rot,headYaw,'front')+projectedHair(cx,cy,p.head_radius,rot,headYaw,'back')).matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map(m=>`<path d="${m[1]}"/>`).join('');
    const halo=(a,b)=>`<g clip-path="url(#${clipId})">${seg(a,b,'boneHalo')}</g>`;
    out+=`<g class="thinkingForeground"><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${p.head_radius+12}"/>${hairShapes}</clipPath>`;
    if(front.L)out+=halo(p.elbow_L,p.wrist_L)+seg(p.elbow_L,p.wrist_L)+hand(hcL,hL);
    if(front.R)out+=halo(p.elbow_R,p.wrist_R)+seg(p.elbow_R,p.wrist_R)+hand(hcR,hR);
    out+=`</g>`;
  }

  return out
}
function renderPivots(p){if(!showP.checked){piv.innerHTML='';return}const arr=POINTS.map(k=>`<circle class="pivot" cx="${p[k][0]}" cy="${p[k][1]}" r="6"/>`).join('');piv.innerHTML=arr}
function targetFxStrength(state,t,entered=false){
  const fade=(x,a,b)=>x<=a?0:x>=b?1:(x-a)/(b-a);
  const fadeOut=(x,a,b)=>x<=a?1:x>=b?0:1-(x-a)/(b-a);
  if(state==='idle')return 0;
  // Secondary visual effects are target-synchronous: no early anticipation FX.
  if(state==='welcome'){
    // Arm is fully raised at .32; wave happens until the lowering phase starts after .70.
    if(t<.32||t>.70)return 0;
    return Math.min(fade(t,.32,.35),fadeOut(t,.67,.70));
  }
  if(state==='loading'){
    // The laptop/spinner become visible only once the Loading target has been reached.
    return entered?1:0;
  }
  if(state==='success'){
    // From take-off through the victory pumps (celebration jump, .22 → .66).
    if(t<.22||t>.66)return 0;
    return Math.min(fade(t,.22,.24),fadeOut(t,.62,.66));
  }
  if(state==='error'){
    // Exact Error target hold: .46 → .64.
    if(t<.46||t>.64)return 0;
    return Math.min(fade(t,.46,.48),fadeOut(t,.62,.64));
  }
  if(state==='empty'){
    // Exact Empty target hold: .34 → .58. FX disappear the instant return begins.
    if(t<.34||t>.58)return 0;
    return Math.min(fade(t,.34,.36),fadeOut(t,.56,.58));
  }
  if(state==='sleep'){
    // Final Sleep target starts at .94 and remains visible through the breathing loop.
    if(entered)return 1;
    if(t<.94)return 0;
    return fade(t,.94,.98);
  }
  return 0;
}
function faceBlendSpec(from,to,u){
  return {from,to,u:clamp(u)};
}

function nativeFaceSpec(state,t,entered=false){
  if(state==='idle'||state==='loading')return'idle';

  if(state==='thinking'){
    if(thinkExitStart){
      if(t<.48)return faceBlendSpec('thinking','idle',t/.48);
      return'idle';
    }
    if(entered)return'thinking';
    if(t<.24)return'idle';
    if(t<.58)return faceBlendSpec('idle','thinking',(t-.24)/.34);
    return'thinking';
  }

  if(state==='sleep'){
    if(entered)return'sleep';
    if(t<.64)return'idle';
    if(t<.82)return faceBlendSpec('idle','sleep',(t-.64)/.18);
    return'sleep';
  }

  if(state==='wake'){
    if(t<.08)return'sleep';
    if(t<.34)return faceBlendSpec('sleep','idle',(t-.08)/.26);
    return'idle';
  }

  const target=DATA.faceModes[state]||'idle';

  // One-shot expressions ease in after anticipation, hold, then ease back to neutral
  // during the physical settle. Endpoint face artwork remains unchanged.
  if(t<.22)return'idle';
  if(t<.34)return faceBlendSpec('idle',target,(t-.22)/.12);
  if(t<.72)return target;
  if(t<.84)return faceBlendSpec(target,'idle',(t-.72)/.12);
  return'idle';
}

function faceSpecFor(state,t,entered,now){
  // Direct persistent-state resolution owns the facial transition.
  // This is the key fix for Thinking → Success/Error and Loading → Success/Error:
  // never route through Idle unless Idle is actually the source expression.
  if(smMode&&smInternal==='bridge'&&smBridge&&smBridge.faceFrom){
    const u=clamp((now-smBridge.start)/smBridge.duration);
    return faceBlendSpec(smBridge.faceFrom,smBridge.faceTo,u);
  }

  if(smFaceHold){
    if(state===smFaceHold.state&&t<smFaceHold.until)return smFaceHold.mode;
    if(state!==smFaceHold.state||t>=smFaceHold.until)smFaceHold=null;
  }

  return nativeFaceSpec(state,t,entered);
}
// How far the current hairstyle reaches above/around the head (head units),
// so effects never land on the hair.
function hairReach(){
  const ch=characterDef();if(ch)return ch.reach;
  const m=hairModel(APPEARANCE.hairStyle);
  if(m.reach!==undefined)return m.reach;
  let r=185;
  const upd=(p,extra=0)=>{if(p[1]<60){const d=Math.hypot(p[0],p[1])+extra;if(d>r)r=d;}};
  m.cap.forEach(c=>c.forEach(p=>upd(p)));
  m.locks.forEach(l=>l.points.forEach(p=>upd(p,l.width*.5)));
  m.curls.forEach(c=>upd(c.p,c.r));
  if(m.bun)r=Math.max(r,Math.hypot(m.bun.center[0],m.bun.center[1])+60);
  if(m.groom)m.groom.outer.forEach(p=>upd(p));
  return (m.reach=r);
}
function fxMarkup(state,p,t,loop,entered=false){
// Thinking is intentionally artifact-free: pose + face + motion carry the state.
if(state==='thinking')return '';
const a=targetFxStrength(state,t,entered);
if(a<=.001)return '';

if(state==='welcome'){
  // Three ripples travelling outwards, on the far side of the waving hand.
  const h=p.hand_L_center||p.wrist_L,hc=p.head_center;
  const dir=Math.atan2(h[1]-hc[1],h[0]-hc[0]),ms=t*DUR.welcome;
  let arcs='';
  for(let i=0;i<3;i++){
    const ph=((ms/620)+i/3)%1,rad=66+ph*62,op=Math.sin(Math.PI*ph);
    const a0=dir-.55,a1=dir+.55;
    arcs+=`<path class="accessory" style="opacity:${(op*a).toFixed(3)}" d="M ${h[0]+Math.cos(a0)*rad} ${h[1]+Math.sin(a0)*rad} A ${rad} ${rad} 0 0 1 ${h[0]+Math.cos(a1)*rad} ${h[1]+Math.sin(a1)*rad}"/>`;
  }
  return `<g class="fxWelcome">${arcs}</g>`;
}

if(state==='loading'){
  const spin=loop*360;
  return `<g class="fxLoading" opacity="${a}">
    <!-- The device itself is rendered inside the rig for correct hand occlusion. -->
    <g class="loadingSpinner" transform="translate(${LIFE.laptopShift[0].toFixed(2)} ${LIFE.laptopShift[1].toFixed(2)}) rotate(${spin} 810 455)">
      ${[0,45,90,135,180,225,270,315].map(d=>`<line x1="810" y1="410" x2="810" y2="383" transform="rotate(${d} 810 455)"/>`).join('')}
    </g>
  </g>`;
}

if(state==='success'){
  // Sparkles pop around the raised hands and above the head (overshoot, then twinkle).
  const hl=p.hand_L_center||p.wrist_L,hr=p.hand_R_center||p.wrist_R,hc=p.head_center,el=p.elbow_L||p.shoulder_L,er=p.elbow_R||p.shoulder_R;
  const ms=t*DUR.success,pop=x=>{x=clamp(x);const c=1.9;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
  const spark=(x,y,size,delay)=>{
    const since=ms-.3*DUR.success-delay*1000;                   // ms since the apex
    const k=pop(since/320)*(t>.55?a:1)*(1+.08*Math.sin(ms/90+delay*20));
    if(k<=.01)return '';
    const r=size*k,q=r*.18;
    return `<path class="fxSpark" d="M ${x} ${y-r} Q ${x+q} ${y-q} ${x+r} ${y} Q ${x+q} ${y+q} ${x} ${y+r} Q ${x-q} ${y+q} ${x-r} ${y} Q ${x-q} ${y-q} ${x} ${y-r} Z"/>`;
  };
  const around=(h,e,side)=>{
    const ang=Math.atan2(h[1]-e[1],h[0]-e[0]);
    return spark(h[0]+Math.cos(ang-.55*side)*92,h[1]+Math.sin(ang-.55*side)*92,26,0)
      +spark(h[0]+Math.cos(ang+.35*side)*118,h[1]+Math.sin(ang+.35*side)*118,17,.08)
      +spark(h[0]+Math.cos(ang-.05)*150,h[1]+Math.sin(ang-.05)*150,12,.15);
  };
  const reach=hairReach();
  // Ground shadow while airborne: shrinks and fades as the mascot rises.
  const lift=p.celebrationLift||0,k=clamp(lift/CELEBRATION.HEIGHT),sx=p.pelvis?p.pelvis[0]:512;
  const shadow=lift>1?`<ellipse cx="${sx}" cy="1409" rx="${120*(1-.35*k)}" ry="${17*(1-.35*k)}" fill="var(--bodyStrokeColor, #0B0B0B)" opacity="${(.16*(1-.4*k)).toFixed(3)}"/>`:'';
  return `<g class="fxSuccess">${shadow}${around(hl,el,1)}${around(hr,er,-1)}${spark(hc[0]-30,hc[1]-reach-46,20,.1)}${spark(hc[0]+48,hc[1]-reach-22,13,.18)}</g>`;
}

if(state==='error'){
  // Anchored to the head, just outside the hairstyle's silhouette (top right).
  const hc=p.head_center,reach=hairReach(),ang=-0.86+.42*clamp((reach-230)/140);   // big hair: move to the side
  const bx=hc[0]+Math.cos(ang)*(reach+96),by=hc[1]+Math.sin(ang)*(reach+74);
  const bob=Math.sin(t*DUR.error/260)*4,sc=.7+.3*a;
  return `<g class="fxError fxThoughtBubble" opacity="${a}" transform="translate(${bx} ${by+bob}) scale(${sc}) translate(-832 -276)">
    <!-- Thought bubble: the question mark belongs to one intentional artifact, not a loose symbol. -->
    <path class="bubble"
      d="M 766 301
         C 751 295 745 281 750 268
         C 752 253 764 243 779 243
         C 786 230 800 224 814 229
         C 825 218 842 218 853 228
         C 868 223 884 231 889 245
         C 903 247 912 259 909 273
         C 918 284 914 299 904 307
         C 899 321 883 326 870 321
         C 859 332 842 333 830 324
         C 817 333 800 329 792 318
         C 781 319 770 312 766 301 Z"/>
    <circle class="bubbleTail" cx="770" cy="338" r="10"/>
    <circle class="bubbleTail" cx="742" cy="362" r="6"/>
    <path class="question"
      d="M 812 258
         C 816 248 826 243 837 244
         C 850 245 858 253 858 264
         C 858 275 852 281 843 286
         C 835 291 832 296 832 304"/>
    <circle class="questionDot" cx="832" cy="314" r="5"/>
  </g>`;
}

if(state==='empty'){
  const hl=p.hand_L_center||p.wrist_L,hr=p.hand_R_center||p.wrist_R;
  const lx=hl[0]-110,ly=hl[1]-22,rx=hr[0]+110,ry=hr[1]-22;
  return `<g class="fxEmpty" opacity="${a}">
    <line class="accessory" x1="${lx}" y1="${ly}" x2="${lx-32}" y2="${ly-38}"/>
    <line class="accessory" x1="${lx-12}" y1="${ly+28}" x2="${lx-48}" y2="${ly+10}"/>
    <line class="accessory" x1="${rx}" y1="${ry}" x2="${rx+32}" y2="${ry-38}"/>
    <line class="accessory" x1="${rx+12}" y1="${ry+28}" x2="${rx+48}" y2="${ry+10}"/>
  </g>`;
}

if(state==='sleep'){
  // Z's are born near the head one after another, drift up and fade out.
  const hc=p.head_center,reach=Math.min(hairReach(),260);
  let zs='';
  for(let i=0;i<3;i++){
    const ph=((loop||0)+i/3)%1,size=30+ph*46,op=Math.sin(Math.PI*ph)*a;
    const x=hc[0]+reach*.55+ph*120,y=hc[1]-reach*.55-ph*190;
    zs+=`<path class="accessory" style="opacity:${op.toFixed(3)};stroke-width:${9+ph*4}" d="M ${x} ${y} L ${x+size} ${y} L ${x} ${y+size} L ${x+size} ${y+size}"/>`;
  }
  return `<g class="fxSleep">${zs}</g>`;
}
return ''
}
const MICRO={
  blink:{next:0,active:false,start:0,double:false,secondStart:0},
  tap:{
    active:false,
    start:0,
    duration:760,
    zone:'body',
    variant:'bounce',
    point:[505,760],
    direction:1,
    lastByFamily:{}
  },
  idleVariation:{active:false,start:0,duration:1800,next:0,direction:1},
  eyeTracking:{
    enabled:true,
    eyeTarget:[0,0],
    eyeCurrent:[0,0],
    headTarget:[0,0,0],
    headCurrent:[0,0,0],
    pointer:[505,420],
    pointerInside:false,
    // true only while the pointer is over the mascot itself (pauses its idle gestures)
    hovering:false,
    // 'full' = eyes and head (idle), 'eyes' = eyes only (other states, lookAt)
    reach:'full',
    // lookAt(): the head turns towards the target in any awake state, not only idle
    headToo:false,
    // small mascots: gaze amplified like the life gestures (1 at 220 px and above)
    gain:1,
    lastTime:motionNow()
  },
  autoIdleEnabled:true
};

const TAP_REACTIONS={
  head:[
    {id:'boop',label:'Boop',duration:720,face:'tapSurprised'},
    {id:'giggle',label:'Giggle',duration:900,face:'tapPlayful'},
    {id:'squint',label:'Squint',duration:760,face:'tapSquint'}
  ],
  hand:[
    {id:'wave',label:'Little wave',duration:920,face:'tapPlayful'},
    {id:'highFive',label:'High five',duration:860,face:'success'},
    {id:'recoil',label:'Hand recoil',duration:720,face:'tapSurprised'}
  ],
  foot:[
    {id:'hop',label:'Tiny hop',duration:860,face:'tapSurprised'},
    {id:'kick',label:'Tiny kick',duration:820,face:'tapPlayful'},
    {id:'ouch',label:'Ouch',duration:760,face:'tapOuch'}
  ],
  body:[
    {id:'bounce',label:'Bounce',duration:820,face:'tapPlayful'},
    {id:'shimmy',label:'Shimmy',duration:940,face:'tapPlayful'},
    {id:'surprise',label:'Surprise',duration:760,face:'tapSurprised'}
  ]
};
const BLINK=MICRO.blink;
function rand(min,max){return min+Math.random()*(max-min)}

function microAllowed(){
  return current==='idle' && !freeze.checked && !smInternal && !(typeof WALK!=='undefined'&&WALK.active);
}
function scheduleIdleVariation(now=motionNow()){
  MICRO.idleVariation.next=now+rand(15000,30000);
}
function resetMicroInteractions(now=motionNow()){
  MICRO.tap.active=false;
  MICRO.tap.start=0;
  MICRO.tap.zone='body';
  MICRO.tap.variant='bounce';
  MICRO.idleVariation.active=false;
  MICRO.idleVariation.start=0;
  scheduleIdleVariation(now);
  updateMicroUI(now);
}
function tapFamily(zone){
  if(zone==='head')return'head';
  if(zone.startsWith('hand_'))return'hand';
  if(zone.startsWith('foot_'))return'foot';
  return'body';
}
function zoneLabel(zone){
  return ({
    head:'Face',
    hand_L:'Left hand',
    hand_R:'Right hand',
    foot_L:'Left foot',
    foot_R:'Right foot',
    body:'Body'
  })[zone]||'Body';
}
function chooseTapReaction(zone){
  const family=tapFamily(zone);
  const list=TAP_REACTIONS[family];
  const previous=MICRO.tap.lastByFamily[family];
  const options=list.filter(v=>v.id!==previous);
  const pool=options.length?options:list;
  const chosen=pool[Math.floor(Math.random()*pool.length)];
  MICRO.tap.lastByFamily[family]=chosen.id;
  return chosen;
}
function triggerTapReaction(zone='body',point=null,now=motionNow()){
  if(!microAllowed())return false;

  const reaction=chooseTapReaction(zone);
  MICRO.idleVariation.active=false;
  MICRO.tap.active=true;
  MICRO.tap.start=now;
  MICRO.tap.zone=zone;
  MICRO.tap.variant=reaction.id;
  MICRO.tap.duration=reaction.duration;
  MICRO.tap.point=point||[lastPose?.head_center?.[0]||505,lastPose?.pelvis?.[1]||760];

  if(zone.endsWith('_L'))MICRO.tap.direction=-1;
  else if(zone.endsWith('_R'))MICRO.tap.direction=1;
  else if(zone==='head'&&point&&lastPose?.head_center){
    MICRO.tap.direction=point[0]<lastPose.head_center[0]?-1:1;
  }else{
    MICRO.tap.direction=Math.random()<.5?-1:1;
  }

  scheduleIdleVariation(now);
  updateMicroUI(now,`${zoneLabel(zone)} · ${reaction.label}`);
  return true;
}

function pointSegmentDistance(px,py,a,b){
  const vx=b[0]-a[0],vy=b[1]-a[1];
  const wx=px-a[0],wy=py-a[1];
  const vv=vx*vx+vy*vy||1;
  const t=clamp((wx*vx+wy*vy)/vv);
  const dx=px-(a[0]+t*vx),dy=py-(a[1]+t*vy);
  return Math.hypot(dx,dy);
}
function inEllipse(px,py,c,rx,ry){
  const dx=(px-c[0])/rx,dy=(py-c[1])/ry;
  return dx*dx+dy*dy<=1;
}
function hitTestMascot(px,py,p){
  if(!p)return null;

  // Head includes the small hair overhang so a "boop" on the hair still counts.
  const hc=p.head_center,r=p.head_radius;
  if(Math.hypot(px-hc[0],py-hc[1])<=r*1.18)return'head';

  if(inEllipse(px,py,p.hand_L_center||p.wrist_L,72,48))return'hand_L';
  if(inEllipse(px,py,p.hand_R_center||p.wrist_R,72,48))return'hand_R';
  if(inEllipse(px,py,p.foot_L_center||p.ankle_L,84,46))return'foot_L';
  if(inEllipse(px,py,p.foot_R_center||p.ankle_R,84,46))return'foot_R';

  const segments=[
    [p.neck,p.pelvis],
    [p.shoulder_L,p.elbow_L],[p.elbow_L,p.wrist_L],
    [p.shoulder_R,p.elbow_R],[p.elbow_R,p.wrist_R],
    [p.hip_L,p.knee_L],[p.knee_L,p.ankle_L],
    [p.hip_R,p.knee_R],[p.knee_R,p.ankle_R]
  ];
  if(segments.some(([a,b])=>pointSegmentDistance(px,py,a,b)<=34))return'body';

  return null;
}
function pointerToSvg(e){
  const svg=(e&&e.currentTarget&&e.currentTarget.closest?e.currentTarget.closest('svg'):null)||document.querySelector('.uko-mascot-svg');if(!svg||!svg.createSVGPoint)return null;
  const pt=svg.createSVGPoint();
  pt.x=e.clientX;pt.y=e.clientY;
  const ctm=svg.getScreenCTM();
  if(!ctm)return null;
  const local=pt.matrixTransform(ctm.inverse());
  return[local.x,local.y];
}
function triggerIdleVariation(now=motionNow(),manual=true){
  if(!microAllowed()||MICRO.tap.active)return false;
  MICRO.idleVariation.active=true;
  MICRO.idleVariation.start=now;
  MICRO.idleVariation.direction=Math.random()<.5?-1:1;
  scheduleIdleVariation(now);
  updateMicroUI(now,manual?'Idle variation':'Auto idle variation');
  return true;
}

function applyIdleLife(p,phase){
  if(current!=='idle'||freeze.checked)return 0;

  // Keep the baseline alive without turning Idle into a visible dance.
  // Tap / IdleVariation temporarily reduce this layer so larger reactions stay readable.
  const scale=(MICRO.tap.active||MICRO.idleVariation.active)?.35:1;

  const breath=Math.sin(phase*Math.PI*2);
  const sway=Math.sin(phase*Math.PI*2+Math.PI/2);
  const armSwing=Math.sin(phase*Math.PI*2+Math.PI/3);
  const kneeWave=Math.sin(phase*Math.PI*2-Math.PI/4);
  const second=Math.sin(phase*Math.PI*4+.35);

  // Torso / weight shift.
  addOffset(p,'head_center',1.2*sway*scale,3.2*breath*scale);
  addOffset(p,'neck',1.7*sway*scale,2.4*breath*scale);
  addOffset(p,'shoulder_L',2.0*sway*scale,1.5*breath*scale);
  addOffset(p,'shoulder_R',2.0*sway*scale,1.5*breath*scale);
  addOffset(p,'pelvis',2.4*sway*scale,.9*breath*scale);
  addOffset(p,'hip_L',2.4*sway*scale,.9*breath*scale);
  addOffset(p,'hip_R',2.4*sway*scale,.9*breath*scale);

  // Arms: opposite pendulum motion, wrists and hands remain connected.
  const lArmX=6.5*armSwing*scale;
  const rArmX=-6.5*armSwing*scale;
  const armY=1.8*second*scale;

  addOffset(p,'elbow_L',lArmX*.45,armY*.55);
  addOffset(p,'wrist_L',lArmX,armY);
  addOffset(p,'hand_L_center',lArmX,armY);

  addOffset(p,'elbow_R',rArmX*.45,-armY*.55);
  addOffset(p,'wrist_R',rArmX,-armY);
  addOffset(p,'hand_R_center',rArmX,-armY);

  // Legs: tiny alternating knee flex / weight transfer.
  // Feet move only fractionally so they still feel planted.
  const kneeX=3.6*kneeWave*scale;
  const kneeY=2.3*second*scale;

  addOffset(p,'knee_L',kneeX,kneeY);
  addOffset(p,'knee_R',-kneeX,-kneeY);

  const footShift=.9*kneeWave*scale;
  addOffset(p,'ankle_L',footShift,0);
  addOffset(p,'foot_L_center',footShift,0);
  addOffset(p,'ankle_R',-footShift,0);
  addOffset(p,'foot_R_center',-footShift,0);

  // A nearly imperceptible body lean ties the whole motion together.
  return 1.15*sway*scale;
}

function applyMicroInteractions(p,now){
  let rotOffset=0;

  if(!microAllowed()){
    MICRO.tap.active=false;
    MICRO.idleVariation.active=false;
    return rotOffset;
  }

  if(MICRO.autoIdleEnabled &&
     !MICRO.tap.active &&
     !MICRO.idleVariation.active &&
     now>=MICRO.idleVariation.next){
    triggerIdleVariation(now,false);
  }

  if(MICRO.tap.active){
    const q=clamp((now-MICRO.tap.start)/MICRO.tap.duration);
    if(q>=1){
      MICRO.tap.active=false;
      updateMicroUI(now);
    }else{
      // Amplified (core/touch.js) so that reactions read at app size.
      const amp=typeof TAP_AMP!=='undefined'?TAP_AMP:1;
      const env=Math.pow(Math.sin(Math.PI*q),.9)*amp;
      const wave=Math.sin(Math.PI*2*q)*env;
      const quick=Math.sin(Math.PI*3*q)*env;
      const d=MICRO.tap.direction;
      const zone=MICRO.tap.zone;
      const v=MICRO.tap.variant;

      const moveArm=(side,elbowDx,elbowDy,handDx,handDy)=>{
        const suffix=side<0?'L':'R';
        addOffset(p,'elbow_'+suffix,elbowDx,elbowDy);
        addOffset(p,'wrist_'+suffix,handDx,handDy);
        addOffset(p,'hand_'+suffix+'_center',handDx,handDy);
      };
      const moveLeg=(side,kneeDx,kneeDy,footDx,footDy)=>{
        const suffix=side<0?'L':'R';
        addOffset(p,'knee_'+suffix,kneeDx,kneeDy);
        addOffset(p,'ankle_'+suffix,footDx,footDy);
        addOffset(p,'foot_'+suffix+'_center',footDx,footDy);
      };

      if(typeof TAP_COMBOS!=='undefined'&&TAP_COMBOS[v]){
        rotOffset+=comboPose(v,p,q,env,d,moveArm);
      }
      else if(zone==='head'){
        if(v==='boop'){
          addOffset(p,'head_center',d*9*env,-14*env);
          addOffset(p,'neck',d*3*env,-4*env);
          addOffset(p,'shoulder_L',d*1.3*env,-2*env);
          addOffset(p,'shoulder_R',d*1.3*env,-2*env);
          moveArm(-1,-d*1.5*env,-2*env,-d*4*env,-3*env);
          moveArm(1,-d*1.5*env,-2*env,-d*4*env,-3*env);
          rotOffset+=d*9*env-quick*1.5;
        }else if(v==='giggle'){
          addOffset(p,'head_center',wave*8,-5*env);
          addOffset(p,'neck',wave*3,-2*env);
          moveArm(-1,-7*env,-5*env,-11*env,-10*env);
          moveArm(1,7*env,-5*env,11*env,-10*env);
          rotOffset+=wave*7;
        }else{
          addOffset(p,'head_center',d*4*wave,4*env);
          addOffset(p,'neck',d*2*wave,2*env);
          addOffset(p,'shoulder_L',0,2*env);
          addOffset(p,'shoulder_R',0,2*env);
          rotOffset+=d*4*wave;
        }
      }
      else if(zone.startsWith('hand_')){
        const side=zone==='hand_L'?-1:1;
        if(v==='wave'){
          moveArm(side,side*15*env,-30*env,side*(28*env+8*wave),-62*env+5*wave);
          addOffset(p,'head_center',-side*4*env,-3*env);
          rotOffset+=-side*4*env;
        }else if(v==='highFive'){
          moveArm(side,side*10*env,-44*env,side*16*env,-92*env);
          addOffset(p,'head_center',-side*3*env,-7*env);
          addOffset(p,'neck',-side*1.5*env,-3*env);
          rotOffset+=-side*3*env;
        }else{
          moveArm(side,-side*12*env,-16*env,-side*34*env,-28*env);
          addOffset(p,'head_center',-side*7*env,-4*env);
          rotOffset+=-side*7*env;
        }
      }
      else if(zone.startsWith('foot_')){
        const side=zone==='foot_L'?-1:1;
        if(v==='hop'){
          moveLeg(side,-side*5*env,-18*env,side*4*wave,-34*env);
          addOffset(p,'pelvis',-side*3*env,-9*env);
          addOffset(p,'neck',-side*2*env,-7*env);
          addOffset(p,'head_center',-side*3*env,-8*env);
          moveArm(-1,-5*env,-4*env,-8*env,-7*env);
          moveArm(1,5*env,-4*env,8*env,-7*env);
          rotOffset+=-side*3*env;
        }else if(v==='kick'){
          moveLeg(side,side*13*env,-10*env,side*(34*env+6*wave),-20*env);
          addOffset(p,'pelvis',-side*4*env,-3*env);
          addOffset(p,'head_center',-side*3*env,-2*env);
          rotOffset+=-side*4*env;
        }else{
          moveLeg(side,-side*15*env,-22*env,-side*24*env,-29*env);
          addOffset(p,'head_center',-side*6*env,-3*env);
          addOffset(p,'neck',-side*3*env,-2*env);
          rotOffset+=-side*7*env;
        }
      }
      else{
        if(v==='bounce'){
          addOffset(p,'head_center',0,-15*env);
          addOffset(p,'neck',0,-10*env);
          addOffset(p,'pelvis',0,-7*env);
          addOffset(p,'shoulder_L',-3*env,-8*env);
          addOffset(p,'shoulder_R',3*env,-8*env);
          moveArm(-1,-8*env,-10*env,-14*env,-15*env);
          moveArm(1,8*env,-10*env,14*env,-15*env);
        }else if(v==='shimmy'){
          addOffset(p,'head_center',wave*10,-3*env);
          addOffset(p,'neck',wave*7,-1*env);
          addOffset(p,'pelvis',-wave*4,0);
          addOffset(p,'shoulder_L',wave*5,-2*env);
          addOffset(p,'shoulder_R',wave*5,-2*env);
          moveArm(-1,-wave*5,-2*env,-wave*12,-4*env);
          moveArm(1,-wave*5,-2*env,-wave*12,-4*env);
          rotOffset+=wave*6;
        }else{
          addOffset(p,'head_center',d*5*env,-12*env);
          addOffset(p,'neck',d*2*env,-5*env);
          addOffset(p,'shoulder_L',-10*env,-5*env);
          addOffset(p,'shoulder_R',10*env,-5*env);
          moveArm(-1,-18*env,-12*env,-28*env,-20*env);
          moveArm(1,18*env,-12*env,28*env,-20*env);
          rotOffset+=d*4*env;
        }
      }
    }
  }

  if(MICRO.idleVariation.active){
    const q=clamp((now-MICRO.idleVariation.start)/MICRO.idleVariation.duration);
    if(q>=1){
      MICRO.idleVariation.active=false;
      updateMicroUI(now);
    }else{
      const envelope=Math.pow(Math.sin(Math.PI*q),2);
      const d=MICRO.idleVariation.direction;

      // Rare curious lean. Keep it intentionally smaller than a real state.
      addOffset(p,'head_center',d*7.0*envelope,-1.5*envelope);
      addOffset(p,'neck',d*3.2*envelope,-.6*envelope);
      addOffset(p,'shoulder_L',d*1.5*envelope,0);
      addOffset(p,'shoulder_R',d*1.5*envelope,0);
      rotOffset+=d*4.0*envelope;
    }
  }

  return rotOffset;
}
function tapReactionDef(){
  if(!MICRO.tap.active)return null;
  const family=tapFamily(MICRO.tap.zone);
  return TAP_REACTIONS[family].find(v=>v.id===MICRO.tap.variant)||(typeof TAP_COMBOS!=='undefined'&&TAP_COMBOS[MICRO.tap.variant])||null;
}
function applyMicroFace(baseFace,now){
  if(!MICRO.tap.active)return baseFace;
  const def=tapReactionDef();
  if(!def)return baseFace;

  const q=clamp((now-MICRO.tap.start)/MICRO.tap.duration);
  const target=def.face||'tapPlayful';

  if(q<.18)return faceBlendSpec('idle',target,q/.18);
  if(q>.72)return faceBlendSpec(target,'idle',(q-.72)/.28);
  return target;
}
function microFxMarkup(now){
  const touch=typeof touchFxMarkup==='function'?touchFxMarkup(now):'';
  return microRippleMarkup(now)+touch;
}
function microRippleMarkup(now){
  if(!MICRO.tap.active||!MICRO.tap.point)return'';

  const q=clamp((now-MICRO.tap.start)/MICRO.tap.duration);
  if(q>.42)return'';

  const u=q/.42;
  const ease=1-Math.pow(1-u,3);
  const alpha=1-u;
  const r=18+34*ease;
  const [x,y]=MICRO.tap.point;

  return `<g class="microTapFx" opacity="${alpha.toFixed(3)}" pointer-events="none">
    <circle cx="${x}" cy="${y}" r="${r.toFixed(1)}"
      fill="none" stroke="var(--accentColor)" stroke-width="6"/>
    <circle cx="${x}" cy="${y}" r="${(r*.38).toFixed(1)}"
      fill="var(--accentColor)" opacity="${(.16*alpha).toFixed(3)}"/>
  </g>`;
}

function attentionTrackingEligible(faceSpec){
  if(!MICRO.eyeTracking.enabled)return false;
  if(freeze.checked)return false;
  if(typeof WALK!=='undefined'&&WALK.active)return false;
  if(MICRO.tap.active||MICRO.idleVariation.active)return false;
  if(typeof faceSpec!=='string')return false;
  // Idle: eyes and head. Other awake states: the eyes only (lookAt, page follow).
  if(current==='idle')return faceSpec==='idle';
  if(MICRO.eyeTracking.reach!=='eyes')return false;
  return !['sleep','wake','success','welcome'].includes(current)&&!['sleep','success','welcome'].includes(faceSpec);
}

function updateAttentionTracking(now,faceSpec,p){
  const a=MICRO.eyeTracking;
  const dt=Math.min(40,Math.max(0,now-a.lastTime||16));
  a.lastTime=now;

  let eyeTX=0,eyeTY=0;
  let headTX=0,headTY=0,headTR=0;

  if(attentionTrackingEligible(faceSpec) && a.pointerInside && p?.head_center){
    const hx=p.head_center[0], hy=p.head_center[1];
    const dx=a.pointer[0]-hx, dy=a.pointer[1]-hy;
    const len=Math.hypot(dx,dy)||1;

    const strength=clamp((len-24)/250);
    const nx=(dx/len)*strength;
    const ny=(dy/len)*strength;

    // Eyes lead.
    const g=a.gain||1;
    eyeTX=nx*8.0*Math.min(g,1.4);
    eyeTY=ny*5.5*Math.min(g,1.4);

    // Head follows more slowly and more visibly (idle, or when asked to look at something).
    if(current==='idle'||a.headToo){
      headTX=nx*9.0*g;
      headTY=ny*8.0*g;
      headTR=nx*8.5*g;
    }
  }

  a.eyeTarget[0]=eyeTX;a.eyeTarget[1]=eyeTY;
  a.headTarget[0]=headTX;a.headTarget[1]=headTY;a.headTarget[2]=headTR;

  const eyeAlpha=1-Math.exp(-dt/65);
  const headAlpha=1-Math.exp(-dt/175);

  a.eyeCurrent[0]+=(a.eyeTarget[0]-a.eyeCurrent[0])*eyeAlpha;
  a.eyeCurrent[1]+=(a.eyeTarget[1]-a.eyeCurrent[1])*eyeAlpha;

  for(let i=0;i<3;i++){
    a.headCurrent[i]+=(a.headTarget[i]-a.headCurrent[i])*headAlpha;
  }

  for(let i=0;i<2;i++){
    if(Math.abs(a.eyeCurrent[i])<.02)a.eyeCurrent[i]=0;
    if(Math.abs(a.headCurrent[i])<.02)a.headCurrent[i]=0;
  }
  if(Math.abs(a.headCurrent[2])<.02)a.headCurrent[2]=0;

  return {
    eye:[a.eyeCurrent[0],a.eyeCurrent[1]],
    head:[a.headCurrent[0],a.headCurrent[1],a.headCurrent[2]]
  };
}

function applyAttentionPose(p,attention){
  if(!attention)return 0;
  const [hx,hy,rot]=attention.head;

  addOffset(p,'head_center',hx,hy);
  addOffset(p,'neck',hx*.48,hy*.46);
  addOffset(p,'shoulder_L',hx*.16,hy*.13);
  addOffset(p,'shoulder_R',hx*.16,hy*.13);

  return rot;
}

function resetAttentionTracking(keepPointer=false){
  const a=MICRO.eyeTracking;
  a.eyeTarget=[0,0];
  a.eyeCurrent=[0,0];
  a.headTarget=[0,0,0];
  a.headCurrent=[0,0,0];
  if(!keepPointer)a.pointerInside=false;
  a.lastTime=motionNow();
}

function updateMicroUI(now=motionNow(),message=''){
  if(!microTapBtn)return;
  const allowed=microAllowed();
  microTapBtn.disabled=!allowed;
  microVariationBtn.disabled=!allowed || MICRO.tap.active;

  if(message){
    microStatus.textContent=message;
  }else if(typeof WALK!=='undefined'&&WALK.active){
    microStatus.textContent='Paused · Walk Lab active';
  }else if(current!=='idle'){
    microStatus.textContent='Idle only · paused in '+stateName(current);
  }else if(MICRO.tap.active){
    const def=tapReactionDef();
    microStatus.textContent=`${zoneLabel(MICRO.tap.zone)} · ${def?.label||MICRO.tap.variant}`;
  }else if(MICRO.idleVariation.active){
    microStatus.textContent='Idle variation';
  }else{
    microStatus.textContent=MICRO.autoIdleEnabled
      ? 'Ready · proactive head + eyes + body life'
      : 'Ready · body life + Blink · idle variation manual';
  }
}
function resetBlink(now=motionNow()){BLINK.next=now+rand(2500,5000);BLINK.active=false;BLINK.start=0;BLINK.double=false;BLINK.secondStart=0}
function blinkCurve(dt){
  const close=90,hold=45,open=110,total=close+hold+open;
  if(dt<0||dt>total)return 0;
  if(dt<close){const x=dt/close;return x*x*(3-2*x)}
  if(dt<close+hold)return 1;
  const x=(dt-close-hold)/open;const e=x*x*(3-2*x);return 1-e;
}
function blinkAmount(now,faceMode){
  if(typeof faceMode!=='string')return 0;
  const eligible=!freeze.checked && faceMode!=='sleep' && faceMode!=='success';
  if(!eligible){
    if(now>=BLINK.next) BLINK.next=now+1200;
    return 0;
  }
  if(!BLINK.active && now>=BLINK.next){
    BLINK.active=true;BLINK.start=now;BLINK.double=Math.random()<0.18;BLINK.secondStart=BLINK.start+330;
  }
  if(!BLINK.active)return 0;
  let amount=blinkCurve(now-BLINK.start);
  if(BLINK.double) amount=Math.max(amount,blinkCurve(now-BLINK.secondStart));
  const end=BLINK.double?BLINK.secondStart+245:BLINK.start+245;
  if(now>end){resetBlink(now);return 0}
  return amount;
}
function renderGhost(){
if(!showG.checked){ghost.innerHTML='';return}
// The idle target ghost is always the frontal reference. During Orientation Lab
// it would overlap the live 3/4/profile silhouette and look like a rendering bug.
if(current==='idle' && (ORIENTATION.demo || Math.abs(ORIENTATION.value)>.015 || Math.abs(ORIENTATION.target)>.015)){ghost.innerHTML='';return}
if(current==='thinking'){ghost.innerHTML=`<g class="ghost">${renderRig(DATA.poses.thinking,'thinking',DATA.headRot.thinking||0,0)}</g>`;return}
if(current==='wake'){ghost.innerHTML=`<g class="ghost">${renderRig(DATA.poses.idle,'idle',0,0)}</g>`;return}
ghost.innerHTML=`<g class="ghost">${DATA.refs[current]}</g>`}
function phaseName(state,t,entered){
if(state==='idle')return'idle breathing loop';
if(state==='loading')return entered?'loading sustain loop':'entering loading';
if(state==='thinking'){
if(thinkExitStart)return'thinking exit → idle';
return entered?'thinking persistent loop':'thinking enter';
}
if(state==='wake'){
if(t<.18)return'head lifts from support';
if(t<.48)return'upper body recovery';
if(t<.75)return'pelvis / legs follow';
if(t<1)return'final upright settle';
return'idle reached';
}
if(state==='success'){
  if(t<.10)return'anticipation';
  if(t<.18)return'deep anticipation';
  if(t<.36)return'launch / rise';
  if(t<.45)return'apex → target';
  if(t<.59)return'success target hold';
  if(t<.75)return'descent / landing';
  if(t<.89)return'rebound / settle';
  return'idle pause';
}
if(state==='error'){
  if(t<.46)return'raise arm · smooth acceleration';
  if(t<.64)return'error target hold';
  if(t<.94)return'lower arm · smooth deceleration';
  return'idle settle';
}
if(state==='sleep'){
  if(t<.10)return'drowsy';
  if(t<.20)return'knees unlock';
  if(t<.32)return'crouch / weight shift';
  if(t<.45)return'lowering to support';
  if(t<.58)return'pillow arm plants';
  if(t<.70)return'torso lowers';
  if(t<.82)return'head approaches floor';
  if(t<.94)return'final settle';
  return'sleep breathing loop';
}
if(t<.18)return'anticipation';
if(t<.68)return'action / target';
if(t<.88)return'return / landing';
return'idle pause'}
// MainMotion is the single owner of the mascot's primary body pose and state timeline.
// Secondary systems are deliberately applied later and never write state progression:
// FaceExpression, Blink, AttentionTracking, IdleLife/MicroInteractions and Artifacts.
const MAIN_MOTION_CONTRACT=Object.freeze({
  name:'MainMotion',
  owns:Object.freeze(['primary pose','entry/loop/exit timeline','state-machine visual progression','base head rotation']),
  secondary:Object.freeze(['FaceExpression','Blink','AttentionTracking','IdleLife','MicroInteractions','Artifacts'])
});

function resolveMainMotionFrame(now,speed){
  if(CLOCK.reduced)return {pose:cpy(DATA.poses[current==='wake'?'idle':current]),t:1,loop:0,entered:true,elapsed:0,marker:'REDUCED MOTION'};
  let elapsed=(now-start)*speed;
  let p,t=0,loop=0,frameEntered=false,marker='TARGET-SYNC FX';

  if(smMode&&smInternal==='bridge'){
    const e=(now-smBridge.start)*speed;
    t=clamp(e/smBridge.duration);
    const targetT=smBridge.targetStart*t;
    const targetPose=timelinePose(smBridge.target,targetT);
    p=lerpPose(smBridge.from,targetPose,smooth5(t));
    frameEntered=false;
    marker='TRANSITION BLEND';

    if(t>=1){
      const target=smBridge.target, targetStart=smBridge.targetStart, targetFace=smBridge.faceTo;
      smInternal=null;
      smBridge=null;
      smLogical=target==='loading'?'LoadingLoop':(target==='thinking'?'ThinkingLoop':target[0].toUpperCase()+target.slice(1));
      smSetVisual(target,now-targetStart*DUR[target]/speed);

      // FaceExpression is a separate layer. Hold its resolved expression long enough
      // for the destination clip's native face timing to catch up, avoiding a flash.
      smFaceHold={state:target,mode:targetFace,until:.34};

      elapsed=(now-start)*speed;
      t=clamp(elapsed/DUR[target]);
      p=timelinePose(target,t);
      frameEntered=target==='loading'||target==='thinking';
      if(frameEntered)entered=true;
      smWrite(`blend complete → ${smLogical}`);
      smRefresh();
    }
  }
  else if(smMode&&smInternal==='loadingExit'){
    const e=(now-smExit.start)*speed;
    t=clamp(e/smExit.duration);
    p=lerpPose(smExit.from,DATA.poses.idle,smooth5(t));
    frameEntered=false;
    marker='LOADING EXIT';
    if(t>=1)smToIdle('LoadingExit complete');
  }
  else if(freeze.checked){
    p=cpy(current==='wake'?DATA.poses.idle:DATA.poses[current]);
    t=1;
    frameEntered=true;
    marker='FROZEN TARGET';
  }
  else if(current==='idle'){
    loop=(elapsed%DUR.idle)/DUR.idle;
    p=cpy(DATA.poses.idle);
    t=loop;
    marker='MAINMOTION · IDLE LOOP';
  }
  else if(current==='loading'){
    const entry=1000;
    if(elapsed<entry){
      t=elapsed/entry;
      p=lerpPose(DATA.poses.idle,DATA.poses.loading,ease(t));
      frameEntered=false;
    }else{
      frameEntered=true;
      loop=((elapsed-entry)%1250)/1250;
      p=cpy(DATA.poses.loading);

      // MainMotion owns the persistent typing/body motion. The laptop remains a prop.
      const tap=Math.sin(loop*Math.PI*2);
      const sway=Math.cos(loop*Math.PI*2);
      const ldx=sway*1.2, ldy=tap*4.0;
      p.wrist_L[0]+=ldx; p.wrist_L[1]+=ldy;
      p.hand_L_center[0]+=ldx; p.hand_L_center[1]+=ldy;
      p.head_center[1]+=tap*2;
      t=1;
    }
    marker='MAINMOTION · LOADING';
  }
  else if(current==='thinking'){
    if(thinkExitStart){
      const exitElapsed=(now-thinkExitStart)*speed;
      t=clamp(exitElapsed/900);
      p=lerpPose(thinkExitPose||DATA.poses.thinking,DATA.poses.idle,smooth5(t));
      frameEntered=false;
      if(t>=1&&!smMode){
        current='idle';start=now;thinkExitStart=0;thinkExitPose=null;
        thinkingExit.classList.add('hidden');badge.textContent='Idle';desc.textContent=DESC.idle;
        durationEl.textContent=DURATION_LABEL.idle;tabsRender();renderGhost();
      }
    }else if(elapsed<1000){
      t=clamp(elapsed/1000);
      p=lerpPose(DATA.poses.idle,DATA.poses.thinking,smooth5(t));
      frameEntered=false;
    }else{
      frameEntered=true;t=1;loop=((elapsed-1000)%2400)/2400;p=cpy(DATA.poses.thinking);
      const breath=Math.sin(loop*Math.PI*2);
      p.head_center[1]+=breath*2.5;p.neck[1]+=breath*2.0;
      p.shoulder_L[1]+=breath*1.5;p.shoulder_R[1]+=breath*1.5;
      const micro=Math.sin(loop*Math.PI*2+.8)*2.0;
      p.wrist_R[0]+=micro;p.hand_R_center[0]+=micro;
    }
    marker='MAINMOTION · THINKING';
  }
  else if(current==='sleep'){
    const dur=DUR.sleep;
    if(elapsed<dur){
      t=Math.min(1,elapsed/dur);p=timelinePose('sleep',t);frameEntered=false;
    }else{
      frameEntered=true;t=1;loop=((elapsed-dur)%2600)/2600;p=cpy(DATA.poses.sleep);
      const dy=Math.sin(loop*Math.PI*2)*3;
      p.neck[1]+=dy*.8;
      p.shoulder_L[1]+=dy*.6;p.shoulder_R[1]+=dy*.6;
    }
    marker='MAINMOTION · SLEEP';
  }
  else if(current==='wake'){
    const dur=DUR.wake;
    t=smMode?clamp(elapsed/dur):(elapsed%dur)/dur;
    const q=smooth3(t), sleepT=.94*(1-q);
    p=timelinePose('sleep',sleepT);
    frameEntered=t>=1;
    if(frameEntered&&smMode)p=cpy(DATA.poses.idle);
    marker='MAINMOTION · WAKE';
  }
  else{
    const dur=DUR[current];
    t=(elapsed%dur)/dur;
    p=timelinePose(current,t);
    marker=`MAINMOTION · ${current.toUpperCase()}`;
  }

  return {pose:p,t,loop,entered:frameEntered,elapsed,marker};
}

function settleStateMachineFrame(frame,now,speed){
  // Publish MainMotion's persistent-state phase for the QA state-machine UI.
  entered=frame.entered;
  smRefreshPersistentPhase();

  let {pose:p,t,loop,elapsed}=frame;
  if(smMode&&!smInternal){
    if((current==='welcome'||current==='success'||current==='error'||current==='empty')&&elapsed>=DUR[current]){
      const completed=stateName(current);
      smToIdle(`${completed} complete`);
      p=cpy(DATA.poses.idle);t=0;loop=0;entered=false;
    }else if(current==='wake'&&elapsed>=DUR.wake){
      smToIdle('Wake complete');
      p=cpy(DATA.poses.idle);t=0;loop=0;entered=false;
    }else if(current==='thinking'&&thinkExitStart&&((now-thinkExitStart)*speed)>=900){
      smToIdle('ThinkingExit complete');
      p=cpy(DATA.poses.idle);t=0;loop=0;entered=false;
    }
  }
  return {pose:p,t,loop,elapsed,entered};
}


