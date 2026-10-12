// Points de vue des photos dans la 3D (11 octobre 2026, « Photo réaliste », demande de Mauro : « je me balade dans
// l'appartement, si je veux un rendu réaliste je m'arrête ») : chaque photo calée est marquée par une icône d'appareil
// photo à l'endroit d'où elle a été prise, avec une petite pointe vers ce qu'elle regarde. En maquette (niveaux affichés)
// et sur le plan (son niveau) : toutes ; en 1re personne : même étage, à moins de 12 m, devant soi et non cachée par un
// mur. Toucher l'icône ouvre la photo en grand (« Voir en vrai ici », puis « Faire un montage » en Éditer). En
// 1re personne, à moins de 1 m du point de vue, un bandeau propose « Voir en vrai ici » (× : plus proposé tant qu'on ne
// s'est pas éloigné). La liste vient de la galerie si elle est lue, sinon d'une lecture légère (sans les vignettes) faite
// après le chargement des meubles. Calque « Points de vue des photos » du menu « Calques » (coché par défaut).
import * as THREE from 'three';
import {app, $} from './app.js';
import {appel} from './api.js';
import {ETAGE_FLOOR} from './config.js';
import {lesPhotos, photosChargees, voirPhoto} from './galerie.js';
import {etat} from './calques.js';
import {poserIcone, nommer} from './icones.js';
import {calageActif} from './calage.js';
import {comparaisonActive} from './comparer.js';
import {isolementActif, dansIsolement} from './isoler.js';
import {decaler} from './eclate.js';
import {versEcran, niveauDuPlan} from './plan.js';
import {PIECES} from './pieces.js';

const PORTEE=12, ICI=1.0, LOIN=2.0;   // m : icônes visibles en 1re personne ; bandeau « Voir en vrai ici » ; il revient au-delà
const nomPiece=id=>PIECES.find(p=>p.id===id)?.nom||'';
const niveauDe=p=>(+p.calage.sol||0)>ETAGE_FLOOR-0.3?'etage':'rez';

// ---------- la liste des photos calées ----------
let legere=null, enCours=false, prochainEssai=0;
async function chargerLegere(){
  enCours=true;
  try{
    const tout=[]; let offset=null;
    do{ const r=await appel('photo',{op:'liste',leger:true,...(offset?{offset}:{})});
      if(!r.ok){ prochainEssai=performance.now()+60000; return; }   // hors connexion : nouvel essai dans une minute
      tout.push(...(r.photos||[])); offset=r.offset; }while(offset);
    legere=tout.filter(p=>p.id&&p.image&&p.image.id);
  }catch{ prochainEssai=performance.now()+60000; }
  finally{ enCours=false; }
}
const source=()=>photosChargees()?lesPhotos():legere||[];
let calees=[];
function majListe(){ calees=source().filter(p=>p.calage&&['x','y','z','yaw'].every(k=>Number.isFinite(+p.calage[k]))); }

// ---------- les icônes ----------
const icones=new Map();   // id de la photo → {b, pointe, vu, rayonA}
function icone(p){
  let m=icones.get(p.id);
  if(!m){ const b=document.createElement('button'); b.type='button'; b.className='ib pv-photo'; b.dataset.photo=p.id;
    poserIcone(b,'camera'); const pointe=document.createElement('span'); pointe.className='pv-pointe'; pointe.setAttribute('aria-hidden','true'); b.append(pointe);
    b.onclick=e=>{ e.stopPropagation(); ouvrir(b.dataset.photo); };
    $('points-photo').append(b); m={b,pointe,vu:true,rayonA:0}; icones.set(p.id,m); }
  const nom=`Voir en vrai ici : photo « ${p.nom} »`+(nomPiece(p.piece)?' ('+nomPiece(p.piece)+')':'');
  if(m.b.getAttribute('aria-label')!==nom) nommer(m.b,nom);
  return m;
}
function ouvrir(id){
  const l=source(), p=l.find(x=>x.id===id); if(!p) return;
  voirPhoto(p,l.filter(x=>x.piece===p.piece));
}
// une photo cachée par un mur, en 1re personne (rayon vers son point de vue, 4 fois par seconde au plus)
const rc=new THREE.Raycaster(), dv=new THREE.Vector3();
function cachee(m,pt){
  const t=performance.now(); if(t-m.rayonA<250) return m.cache; m.rayonA=t;
  const c=app.camera.position, d=dv.subVectors(pt,c), L=d.length(); if(L<0.2){ m.cache=false; return false; }
  rc.set(c,d.normalize()); rc.far=L-0.1; m.cache=rc.intersectObjects(app.colliders,false).length>0; return m.cache;
}

// ---------- à chaque image ----------
const v3=new THREE.Vector3(), v4=new THREE.Vector3();
let ignoree=null;   // photo dont on a refusé le bandeau (jusqu'à ce qu'on s'éloigne)
export function majPointsVue(){
  const z=$('points-photo'), actif=app.mobilierPret&&etat.photos!==false&&!calageActif()&&!comparaisonActive()&&!app.mesure;
  if(actif&&!legere&&!enCours&&!photosChargees()&&performance.now()>prochainEssai) chargerLegere();
  if(actif) majListe();
  const montrees=new Set(); let ici=null;
  if(actif&&calees.length){
    const r=z.getBoundingClientRect(), cam=app.camera, walk=app.mode==='walk', plan=app.mode==='plan';
    const c=cam.position, monNiveau=c.y>ETAGE_FLOOR+0.5?'etage':'rez';
    for(const p of calees){
      const k=p.calage, niv=niveauDe(p), pt=v3.set(+k.x,+k.y,+k.z);
      let e=null, e2=null;
      if(plan){ if(niv!==niveauDuPlan()) continue; e=versEcran(pt.x,pt.z); e2=versEcran(pt.x-Math.sin(k.yaw)*0.6,pt.z-Math.cos(k.yaw)*0.6); }
      else if(walk){
        if(niv!==monNiveau) continue;
        const dh=Math.hypot(pt.x-c.x,pt.z-c.z);
        if(dh<ICI){ if(ignoree!==p.id&&(!ici||dh<ici.d)) ici={p,d:dh}; continue; }   // on y est : le bandeau prend le relais
        if(dh>PORTEE) continue;
        pt.y=+k.y-0.25;   // un peu sous les yeux : l'icône ne cache pas ce qu'on regarde
        if(cachee(icone(p),pt)) continue;
      } else {
        if(app.level!=='all'&&app.level!==niv) continue;
        if(isolementActif()&&!dansIsolement(pt)) continue;
        decaler(pt);
      }
      if(!plan){
        v4.set(pt.x-Math.sin(k.yaw)*0.6,pt.y,pt.z-Math.cos(k.yaw)*0.6);
        const a=pt.clone().project(cam); if(a.z>1||a.z<-1) continue;
        const b=v4.project(cam); e={x:(a.x+1)/2*r.width,y:(1-a.y)/2*r.height}; e2=b.z<=1&&b.z>=-1?{x:(b.x+1)/2*r.width,y:(1-b.y)/2*r.height}:null;
      }
      if(!e||e.x<-20||e.y<-20||e.x>r.width+20||e.y>r.height+20) continue;
      const m=icone(p); montrees.add(p.id);
      m.b.style.transform=`translate(${Math.round(e.x)}px,${Math.round(e.y)}px)`;
      if(e2){ const ang=Math.atan2(e2.y-e.y,e2.x-e.x); m.pointe.hidden=false; m.pointe.style.transform=`rotate(${ang.toFixed(3)}rad)`; } else m.pointe.hidden=true;
    }
  }
  for(const [id,m] of icones){ const vu=montrees.has(id); if(m.vu!==vu){ m.b.hidden=!vu; m.vu=vu; } }
  z.hidden=!montrees.size;
  // bandeau « Voir en vrai ici » (1re personne, à moins de 1 m d'un point de vue)
  if(ignoree&&app.mode==='walk'){ const p=calees.find(x=>x.id===ignoree), c=app.camera.position; if(!p||Math.hypot(+p.calage.x-c.x,+p.calage.z-c.z)>LOIN) ignoree=null; }
  const b=$('bandeau-photo');
  if(ici){ b.dataset.photo=ici.p.id; const t=`📷 La photo « ${ici.p.nom} » a été prise d’ici.`; if($('photo-ici-texte').textContent!==t) $('photo-ici-texte').textContent=t; }
  if(b.hidden!==!ici) b.hidden=!ici;
}

export function initPointsVue(){
  $('photo-ici-voir').onclick=()=>ouvrir($('bandeau-photo').dataset.photo);
  $('photo-ici-non').onclick=()=>{ ignoree=$('bandeau-photo').dataset.photo; $('bandeau-photo').hidden=true; };
}
