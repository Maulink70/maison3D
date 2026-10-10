// Photo par-dessus la maquette, et calage de la caméra (étape 5, livraison 1 ; calage manuel choisi par Mauro le
// 10 octobre 2026). La photo est posée sur la vue en 1re personne, dans un cadre aux proportions de la photo (partie
// libre de l'écran, sous les bandeaux), avec une transparence réglable (curseur Photo ↔ Maquette). La caméra prend
// l'angle de vue et les proportions de la photo : setViewOffset fait du cadre l'image de la caméra, la 3D débordant
// autour. On marche jusqu'à l'endroit de la prise de vue (pas, téléportation, pavé), puis on ajuste finement : tourner,
// incliner, pencher, avancer, de côté, hauteur des yeux, angle de vue (zoom, molette ou pincement). « Valider » garde
// le calage avec la photo (table Photos) ; « Voir avec la maquette » y revient ; « Fermer » rend la vue d'avant.
import {app, $, champVisite} from './app.js';
import {setMode} from './vues.js';
import {etatVisite, reprendreVisite, allerA, etatCalage, poserCalage, ajusterCalage, finCalage, glisserVers} from './visite.js';
import {PIECES} from './pieces.js';
import {imagePhoto, enregistrerPhoto} from './galerie.js';
import {select, openSheet, viser} from './edition.js';
import {basculerPorte} from './portes.js';

const FOV0=68;   // angle de vue horizontal d'un téléphone (objectif « 1x ») au départ d'un calage
const DEG=Math.PI/180;
let actif=null;   // {photo, mode:'caler'|'voir', avant, fov}
export const calageActif=()=>!!actif;
export const fovCalage=()=>actif?.fov||FOV0;
export function zoomCalage(f){ if(actif) actif.fov=Math.min(110,Math.max(20,f)); }

const fmt=v=>v.toFixed(2).replace('.',',');
// message du bandeau : un message passager (enregistrement…), sinon où l'on en est (hauteur des yeux, angle de vue)
function dire(t,duree=4000){ if(actif){ actif.msg=t; actif.msgT=performance.now()+duree; } majTexte(); }
function majTexte(){ if(!actif) return; const t=actif.msg&&performance.now()<actif.msgT?actif.msg:texte(); if($('calage-texte').textContent!==t) $('calage-texte').textContent=t; }
function texte(){
  const p=actif.photo, e=etatCalage();
  return (actif.mode==='caler'?'Calage de « '+p.nom+' »':'« '+p.nom+' » sur la maquette')+' · yeux à '+fmt(e.y-e.sol)+' m · angle '+Math.round(actif.fov)+'°';
}
function majBandeau(){
  const caler=actif.mode==='caler';
  $('bandeau-calage').hidden=false; $('calage-fins').hidden=!caler;
  $('calage-valider').hidden=!caler; $('calage-fermer').textContent=caler?'Annuler':'Fermer';
  $('calage-recaler').hidden=caler||!app.edition;
  $('calage-aide').hidden=!caler; majTexte();
}

async function demarrer(p,mode){
  if(!p) return;
  if(actif) arreter(false);
  const avant={mode:app.mode,level:app.level,walk:app.mode==='walk'?etatVisite():null,
    orbit:{p:app.camera.position.clone(),t:app.orbit.target.clone()},panneau:!$('panel').hidden};
  select(null); openSheet(false);
  const piece=PIECES.find(q=>q.id===p.piece);
  if(app.mode!=='walk'){ app.level=piece?.niveau||(p.calage&&p.calage.sol>2?'etage':'rez'); setMode('walk'); }
  actif={photo:p,mode,avant,fov:p.calage?.fov||FOV0};
  if(p.calage) poserCalage(p.calage);
  else if(piece) allerA(piece.arrivee[0],piece.arrivee[1],piece.niveau,piece.vers[0],piece.vers[1],0);
  const img=$('calage-img'); img.src=p.vignette||''; $('calage-cadre').hidden=false;
  imagePhoto(p).then(u=>{ if(actif?.photo===p&&u) img.src=u; });
  $('calage-opacite').value=String(mode==='voir'?0:50); majOpacite();
  majBandeau();
}
export const caler=p=>demarrer(p,'caler');
export const voirAvecMaquette=p=>demarrer(p,'voir');

// fin : caméra normale ; restaurer = revenir à la vue d'avant (sinon on reste où l'on est)
function arreter(restaurer=true){
  if(!actif) return; const a=actif; actif=null;
  const cam=app.camera, r=app.canvas.getBoundingClientRect(); cam.clearViewOffset(); cam.aspect=r.width/r.height; finCalage();
  if(app.mode==='walk') champVisite(); else { cam.fov=50; cam.updateProjectionMatrix(); }
  $('calage-cadre').hidden=true; $('bandeau-calage').hidden=true; $('calage-img').removeAttribute('src');
  if(!restaurer) return;
  const v=a.avant;
  if(v.mode==='walk'){ if(v.walk) reprendreVisite(v.walk); }
  else { app.level=v.level; setMode(v.mode); if(v.mode==='orbit'){ cam.position.copy(v.orbit.p); app.orbit.target.copy(v.orbit.t); app.orbit.update(); } }
  if(v.panneau&&app.edition) openSheet(true);
}
async function valider(){
  if(!actif) return; const a=actif, e=etatCalage(), r3=v=>+v.toFixed(3), r4=v=>+v.toFixed(4);
  const cal={x:r3(e.x),y:r3(e.y),z:r3(e.z),sol:r3(e.sol),yaw:r4(e.yaw),pitch:r4(e.pitch),roll:r4(e.roll),fov:+a.fov.toFixed(2)};
  $('calage-valider').disabled=true; dire('Enregistrement du calage…',60000);
  const r=await enregistrerPhoto(a.photo,{calage:cal}); $('calage-valider').disabled=false;
  if(actif!==a) return;
  if(!r.ok){ dire((r.horsLigne?'Pas de connexion : ':'')+(r.erreur||'Calage non enregistré')+' — réessayez.',8000); return; }
  a.mode='voir'; majBandeau(); dire('Calage enregistré : il servira aux rendus réalistes.');
}

// toucher pendant le calage : une porte s'ouvre ou se ferme, le sol fait un pas (rien n'est sélectionné)
export function toucherCalage(e){ const h=viser(e.clientX,e.clientY); if(h?.object.userData.porte) basculerPorte(h.object.userData.porte); else if(h) glisserVers(h.point); }

function majOpacite(){ $('calage-img').style.opacity=String(1-(+$('calage-opacite').value)/100); }

// à chaque image : cadre de la photo (partie libre de l'écran) et caméra à ses proportions et à son angle de vue
export function majCalage(){
  if(!actif) return;
  if(app.mode!=='walk'){ arreter(false); return; }   // autre vue choisie : le calage s'arrête
  const p=actif.photo, cv=app.canvas.getBoundingClientRect(), W=cv.width, H=cv.height, ap=(p.image.w||4)/(p.image.h||3);
  let haut=$('bandeaux').getBoundingClientRect().bottom-cv.top+8, bas=H-8, gauche=8, droite=W-8;
  const pn=$('panel'); if(!pn.hidden&&innerWidth>760) droite=Math.min(droite,pn.getBoundingClientRect().left-cv.left-10);
  if(bas-haut<120) haut=bas-120;
  let w=droite-gauche, h=bas-haut; if(w/h>ap) w=h*ap; else h=w/ap;
  const x=gauche+(droite-gauche-w)/2, y=haut+(bas-haut-h)/2, c=$('calage-cadre').style;
  c.left=x+'px'; c.top=y+'px'; c.width=w+'px'; c.height=h+'px';
  const cam=app.camera, fv=2*Math.atan(Math.tan(actif.fov*DEG/2)/ap)/DEG;
  cam.fov=fv; cam.aspect=ap; cam.setViewOffset(w,h,-x,-y,W,H); cam.updateProjectionMatrix();
  majTexte();
}

// réglages fins : un toucher = un petit pas ; doigt gardé = répété, de plus en plus vite
const FINS=[
  ['Tourner',[['yaw',1,'⟲','Tourner à gauche'],['yaw',-1,'⟳','Tourner à droite']]],
  ['Incliner',[['pitch',1,'▲','Regarder plus haut'],['pitch',-1,'▼','Regarder plus bas']]],
  ['Pencher',[['roll',1,'↶','Pencher à gauche'],['roll',-1,'↷','Pencher à droite']]],
  ['Avancer',[['avant',1,'＋','Avancer'],['avant',-1,'－','Reculer']]],
  ['De côté',[['cote',-1,'◀','Aller à gauche'],['cote',1,'▶','Aller à droite']]],
  ['Hauteur',[['hauteur',1,'▲','Plus haut'],['hauteur',-1,'▼','Plus bas']]],
  ['Angle',[['fov',-1,'＋','Zoomer (angle plus étroit)'],['fov',1,'－','Dézoomer (angle plus large)']]],
];
const PAS={yaw:0.25*DEG,pitch:0.25*DEG,roll:0.25*DEG,avant:0.02,cote:0.02,hauteur:0.01,fov:0.5};
function pas(k,s,f){ if(!actif) return; if(k==='fov') zoomCalage(actif.fov+s*PAS.fov*f); else ajusterCalage({[k]:s*PAS[k]*f}); }
function construireFins(){
  const z=$('calage-fins');
  for(const [titre,bs] of FINS){
    const g=document.createElement('span'); g.className='cal-groupe'; g.append(Object.assign(document.createElement('span'),{className:'cal-nom',textContent:titre}));
    for(const [k,s,t,nom] of bs){
      const b=document.createElement('button'); b.type='button'; b.className='btn cal-b'; b.textContent=t; b.setAttribute('aria-label',nom); b.title=nom; b.dataset.k=k; b.dataset.s=String(s);
      let minut=0, t0=0;
      const stop=()=>{ clearTimeout(minut); minut=0; };
      const boucle=()=>{ const f=performance.now()-t0>1500?4:1; pas(k,s,f); minut=setTimeout(boucle,60); };
      b.addEventListener('pointerdown',e=>{ e.preventDefault(); b.setPointerCapture?.(e.pointerId); t0=performance.now(); pas(k,s,1); minut=setTimeout(boucle,380); });
      for(const ev of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(ev,stop);
      b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pas(k,s,1); } });
      b.addEventListener('contextmenu',e=>e.preventDefault());
      g.append(b);
    }
    z.append(g);
  }
}

export function initCalage(){
  construireFins();
  $('calage-opacite').oninput=majOpacite;
  $('calage-valider').onclick=valider;
  $('calage-fermer').onclick=()=>arreter(true);
  $('calage-recaler').onclick=()=>{ if(actif){ actif.mode='caler'; $('calage-opacite').value='50'; majOpacite(); majBandeau(); } };
  addEventListener('keydown',e=>{ if(actif&&e.key==='Escape'&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) arreter(true); });
  addEventListener('edition',()=>{ if(actif) majBandeau(); });
}
