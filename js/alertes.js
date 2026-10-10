// Alertes de passage (étape 2), en Éditer : un meuble déplacé ou tourné qui chevauche un mur ou un autre meuble passe
// en rouge (voile rouge en 3D, rouge sur le plan) ; un passage de moins de 80 cm laissé par un meuble déplacé est
// signalé (moins de 70 cm : trop étroit) ; une porte que les meubles empêchent de s'ouvrir en grand aussi.
// La disposition d'origine (photos de Mauro) sert de référence : ce qui s'y chevauchait déjà (chaise sous la table,
// lampe sur le buffet, armoire encastrée) n'est jamais signalé, seules les situations nouvelles le sont.
// Calcul au sol, sur les emprises vues de dessus (grille de 2 cm de chaque meuble, plan.js) et la grille des murs
// coupés à 1 m ; refait quand la disposition change (au plus 4 fois par seconde pendant un glisser).
// Liste des alertes en tête du panneau des meubles ; toucher une alerte sélectionne le meuble.
// Étape 4 (règles validées par Mauro le 10 octobre 2026) : une chaise, un tabouret ou une banquette rangé sous une table
// (plateau plus haut que l'assise) n'est pas signalé ; chaque alerte peut être ignorée (« Ignorer ») : elle passe en gris
// dans « Alertes ignorées (n) », d'où on peut la réactiver ; le choix est gardé avec la variante (élément « alertes » de la
// disposition, synchronisé) et tombe de lui-même si l'un des meubles en cause bouge de plus de 10 cm (ou tourne de 10°).
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR} from './config.js';
import {empreinte, murs} from './plan.js';
import {select} from './edition.js';
import {save} from './sauvegarde.js';

const PAS=0.02, X0=10.9, Z0=-28.4, NX=Math.ceil((19.9-X0)/PAS), NZ=Math.ceil((-13.9-Z0)/PAS), MINI=4;   // MINI cellules : 16 cm²
const sol=niv=>niv==='etage'?ETAGE_FLOOR:0, niveauDe=it=>it.lvl==='Étage'?'etage':'rez';
const m=v=>Math.round(v*100)+' cm';
let base=null, alertes=[], derniere=0, signature='';
export const lesAlertes=()=>alertes;

// meubles qui comptent : posés (base sous 1 m), de plus de 5 cm de haut (le tapis ne gêne pas), visibles
const poses=it=>it.meta.c==='meuble'&&!it.hidden&&it.g.position.y-sol(niveauDe(it))<1.0&&it.size.y>=0.05;
const poseActuelle=it=>({x:it.g.position.x,z:it.g.position.z,r:it.g.rotation.y});
const poseOrigine=it=>({x:it.home.x,z:it.home.z,r:0});
// examinés : meubles déplacés, tournés, redimensionnés, et tous les objets ajoutés (étape 4)
const echelle=it=>it.g.scale.x!==1||it.g.scale.y!==1||it.g.scale.z!==1;
const deplace=it=>{ if(it.ajout||echelle(it)||Math.abs(it.g.position.y-it.home.y)>1e-3) return true; const p=poseActuelle(it); return Math.hypot(p.x-it.home.x,p.z-it.home.z)>0.005||Math.abs(p.r)>1e-4; };
// cellules (centres, repère du meuble) de son emprise, gardées une fois
function cellules(it){
  if(it.cellules) return it.cellules;
  const e=empreinte(it), l=[]; for(let j=0;j<e.nz;j++) for(let i=0;i<e.nx;i++) if(e.plein[j*e.nx+i]) l.push(-e.hx+(i+0.5)*e.pas,-e.hz+(j+0.5)*e.pas);
  return it.cellules=new Float32Array(l);
}
function* auSol(it,p){ const c=cellules(it), co=Math.cos(p.r), si=Math.sin(p.r);
  for(let k=0;k<c.length;k+=2){ const lx=c[k], lz=c[k+1]; yield [p.x+lx*co+lz*si, p.z-lx*si+lz*co]; } }
const indice=(x,z)=>{ const i=Math.floor((x-X0)/PAS), j=Math.floor((z-Z0)/PAS); return i<0||j<0||i>=NX||j>=NZ?-1:j*NX+i; };
// mur sous un point (grille des murs du plan, 1 cm)
function estMur(g,x,z){ const i=Math.floor((x-g.x0)/g.pas), j=Math.floor((z-g.z0)/g.pas); return i>=0&&j>=0&&i<g.nx&&j<g.nz&&g.plein[j*g.nx+i]===1; }

// occupation d'un niveau : numéro du meuble + 1 dans chaque cellule de 2 cm, pour les poses données
function occupation(liste,pose,sauf){
  const o=new Int16Array(NX*NZ);
  liste.forEach((it,k)=>{ if(it===sauf) return; for(const [x,z] of auSol(it,pose(it))){ const i=indice(x,z); if(i>=0) o[i]=k+1; } });
  return o;
}
function chevauchements(it,pose,liste,poseDe,g){
  const p=pose(it), y0=it.g.position.y, y1=y0+it.size.y, r=Math.hypot(it.size.x,it.size.z)/2;
  let mur=0; const autres=new Map();
  const proches=liste.filter(n=>n!==it&&n.g.position.y<y1-0.01&&n.g.position.y+n.size.y>y0+0.01&&Math.hypot(poseDe(n).x-p.x,poseDe(n).z-p.z)<r+Math.hypot(n.size.x,n.size.z)/2)
    .map(n=>{ const q=poseDe(n), e=empreinte(n); return {n,q,e,c:Math.cos(q.r),s:Math.sin(q.r)}; });
  for(const [x,z] of auSol(it,p)){
    if(estMur(g,x,z)) mur++;
    for(const o of proches){ const dx=x-o.q.x, dz=z-o.q.z, lx=dx*o.c-dz*o.s, lz=dx*o.s+dz*o.c, e=o.e;
      const i=Math.floor((lx+e.hx)/e.pas), j=Math.floor((lz+e.hz)/e.pas);
      if(i>=0&&j>=0&&i<e.nx&&j<e.nz&&e.plein[j*e.nx+i]) autres.set(o.n,(autres.get(o.n)||0)+1); }
  }
  return {mur,autres};
}
// passage laissé de chaque côté (ouest, est, nord, sud) jusqu'au prochain mur ou meuble, depuis le milieu des côtés
function passages(it,pose,occ,g){
  const p=pose(it), co=Math.cos(p.r), si=Math.sin(p.r), hx=it.size.x/2, hz=it.size.z/2;
  const cs=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([lx,lz])=>[p.x+lx*co+lz*si,p.z-lx*si+lz*co]);
  const x0=Math.min(...cs.map(q=>q[0])), x1=Math.max(...cs.map(q=>q[0])), z0=Math.min(...cs.map(q=>q[1])), z1=Math.max(...cs.map(q=>q[1]));
  const res={};
  for(const [nom,dx,dz] of [['ouest',-1,0],['est',1,0],['nord',0,-1],['sud',0,1]]){
    const ds=[];
    for(const t of [0.35,0.5,0.65]){
      const sx=dx<0?x0:dx>0?x1:x0+(x1-x0)*t, sz=dz<0?z0:dz>0?z1:z0+(z1-z0)*t;
      let d=null; for(let s=0.01;s<1.2;s+=PAS){ const x=sx+dx*s, z=sz+dz*s, i=indice(x,z); if(i<0) break; if(occ[i]||estMur(g,x,z)){ d=s; break; } }
      if(d!==null) ds.push(d);
    }
    if(ds.length) res[nom]=Math.min(...ds);
  }
  return res;
}
// angle d'ouverture possible de chaque porte (degrés), et le meuble qui l'arrête
function ouvertures(occ,liste,niv){
  const out=new Map();
  for(const pt of app.portes){ const d=pt.def; if(d.fenetre||d.charniere===undefined||(d.y0>1)!==(niv==='etage')) continue;
    const h=d.axe==='x'?[d.plan,d.charniere]:[d.charniere,d.plan], autre=d.charniere===d.a0?d.a1:d.a0, f=d.axe==='x'?[d.plan,autre]:[autre,d.plan];
    const vx=f[0]-h[0], vz=f[1]-h[1], A=pt.ouvert, n=Math.ceil(Math.abs(A)/(3*Math.PI/180));
    let max=Math.abs(A), par=null;
    pas: for(let k=1;k<=n;k++){ const a=A*k/n, c=Math.cos(a), s=Math.sin(a), ox=vx*c+vz*s, oz=-vx*s+vz*c;
      for(let t=0.12;t<=1.001;t+=0.04){ const i=indice(h[0]+ox*t,h[1]+oz*t); if(i>=0&&occ[i]){ max=Math.abs(A)*(k-1)/n; par=liste[occ[i]-1]; break pas; } } }
    out.set(pt,{deg:Math.round(max*180/Math.PI),par,plein:Math.round(Math.abs(A)*180/Math.PI)});
  }
  return out;
}
const nomPorte=pt=>app.items[pt.nom]?.meta.l||pt.nom;

// référence : la disposition d'origine
function reference(){
  base={paires:new Set(),murs:new Map(),passages:new Map(),portes:new Map()};
  for(const niv of ['rez','etage']){
    const liste=Object.values(app.items).filter(it=>poses(it)&&!it.ajout&&niveauDe(it)===niv), g=murs(niv), occ=occupation(liste,poseOrigine);   // objets ajoutés : absents de l'origine
    for(const it of liste){ const c=chevauchements(it,poseOrigine,liste,poseOrigine,g); base.murs.set(it,c.mur);
      for(const [n,k] of c.autres) if(k>=MINI) base.paires.add(it.name+'|'+n.name); }
    for(const [pt,o] of ouvertures(occ,liste,niv)) base.portes.set(pt,o.deg);
  }
}
// chaise rangée sous une table : un siège (chaise, tabouret, banquette) et une table, un bureau ou un bar dont le plateau
// (de 60 cm à 1,20 m) est plus haut que l'assise (environ 47 cm, 80 cm pour un tabouret de bar)
const siege=it=>it.ajout?.f==='chaise'||/chaise|tabouret|banquette/i.test(it.name);
const table=it=>(['table','table_ronde'].includes(it.ajout?.f)||/table|bureau|bar_cuisine/i.test(it.name))&&!/table_basse/i.test(it.name)&&it.size.y>=0.6&&it.size.y<=1.2;
const assise=it=>/tabouret/i.test(it.name)?0.8:0.47;
const range=(a,b)=>(siege(a)&&table(b)&&b.size.y>assise(a))||(siege(b)&&table(a)&&a.size.y>assise(b));

// ---------- alertes ignorées ----------
let ignorees=[];   // [{k: clé de l'alerte, t: texte, p: {élément: [x, z, rotation]}}]
const poseDe=n=>{ const it=app.items[n]; return it?[+it.g.position.x.toFixed(3),+it.g.position.z.toFixed(3),+it.g.rotation.y.toFixed(3)]:null; };
const bouge=(a,b)=>!a||!b||Math.hypot(a[0]-b[0],a[1]-b[1])>0.1||Math.abs(a[2]-b[2])>Math.PI/18;
export const etatAlertes=()=>ignorees.length?{g:ignorees}:null;
export function appliquerAlertes(e){ ignorees=Array.isArray(e?.g)?JSON.parse(JSON.stringify(e.g)):[]; signature=''; derniere=0; }
function ignorer(a){ ignorees.push({k:a.k,t:a.texte,p:Object.fromEntries(a.noms.map(n=>[n,poseDe(n)]))}); signature=''; derniere=0; save(); }
function reactiver(k){ ignorees=ignorees.filter(e=>e.k!==k); signature=''; derniere=0; save(); }

function calculer(){
  const out=[];
  if(!Object.values(app.items).some(it=>poses(it)&&deplace(it))){ alertes=out; majAffichage(); return; }   // rien de déplacé : rien à signaler
  if(!base) reference();
  for(const niv of ['rez','etage']){
    const liste=Object.values(app.items).filter(it=>poses(it)&&niveauDe(it)===niv), g=murs(niv);
    const bouges=liste.filter(deplace); if(!bouges.length) continue;
    const occ=occupation(liste,poseActuelle);
    for(const it of bouges){
      const c=chevauchements(it,poseActuelle,liste,poseActuelle,g);
      if(c.mur>=MINI&&c.mur>(base.murs.get(it)||0)+MINI) out.push({it,grave:true,k:'mur|'+it.name,noms:[it.name],texte:`${it.meta.l} chevauche un mur`});
      for(const [n,k] of c.autres) if(k>=MINI&&!base.paires.has(it.name+'|'+n.name)&&!base.paires.has(n.name+'|'+it.name)&&!range(it,n)){
        const cle='meuble|'+[it.name,n.name].sort().join('|'); if(!out.some(a=>a.k===cle)) out.push({it,autre:n,grave:true,k:cle,noms:[it.name,n.name],texte:`${it.meta.l} chevauche ${n.meta.l.toLowerCase()}`}); }
      // passages : ce meuble retiré de l'occupation (on mesure ce qu'il laisse autour de lui)
      const o2=occupation(liste,poseActuelle,it), av=it.ajout?{}:passages(it,poseOrigine,occupation(liste.filter(n=>!n.ajout),poseOrigine,it),g), ap=passages(it,poseActuelle,o2,g);
      for(const [cote,d] of Object.entries(ap)){ if(d<0.05||d>=0.8) continue; const avant=av[cote];
        if(avant!==undefined&&avant<0.8&&d>=avant-0.05) continue;   // déjà étroit à l'origine, pas plus étroit
        out.push({it,grave:d<0.7,k:'passage|'+it.name+'|'+cote,noms:[it.name],texte:`${it.meta.l} : passage de ${m(d)} côté ${cote} (${d<0.7?'trop étroit, ':''}70 à 80 cm conseillés)`}); }
    }
    for(const [pt,o] of ouvertures(occ,liste,niv)){ const b=base.portes.get(pt)??o.plein;
      if(o.deg<b-5&&o.par) out.push({it:o.par,grave:true,porte:pt,k:'porte|'+pt.nom+'|'+o.par.name,noms:[o.par.name],texte:`${nomPorte(pt)} : ne s'ouvre plus qu'à ${o.deg}° (au lieu de ${b}°), ${o.par.meta.l.toLowerCase()} la gêne`}); }
  }
  // alertes ignorées : gardées tant qu'aucun des meubles en cause n'a bougé de plus de 10 cm (ou tourné de 10°)
  const avant=ignorees.length;
  ignorees=ignorees.filter(e=>Object.entries(e.p||{}).every(([n,q])=>!app.items[n]||!bouge(q,poseDe(n))));
  for(const a of out) a.ignoree=ignorees.some(e=>e.k===a.k);
  alertes=out; majAffichage();
  if(ignorees.length!==avant) setTimeout(()=>save(),0);   // une alerte ignorée revient : la variante le garde
}

// ---------- affichage : voile rouge en 3D (Éditer), rouge sur le plan, liste du panneau ----------
const rouge=new THREE.MeshBasicMaterial({color:0xd0341f,transparent:true,opacity:0.42,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
function voiler(it,oui){
  if(!it.voiles){ if(!oui) return; it.voiles=it.mats.map(o=>{ const v=new THREE.Mesh(o.geometry,rouge); v.raycast=()=>{}; v.name='alerte'; v.renderOrder=3; v.visible=false; o.add(v); return v; }); }
  for(const v of it.voiles) v.visible=oui;
}
let voirIgnorees=false;
function majAffichage(){
  const actives=alertes.filter(a=>!a.ignoree), grises=alertes.filter(a=>a.ignoree);
  const enRouge=new Set(actives.filter(a=>a.grave).map(a=>a.it));
  for(const it of Object.values(app.items)){ const r=enRouge.has(it); it.alerte=r; voiler(it,r&&app.edition); }
  const b=$('alertes'); b.hidden=!alertes.length; if(!alertes.length) return;
  $('alertes-titre').textContent=actives.length?`⚠ Alertes (${actives.length})`:'Aucune alerte active';
  b.classList.toggle('calme',!actives.length);
  const l=$('alertes-liste'); l.replaceChildren();
  const ligne=(a,gris)=>{ const r=document.createElement('div'); r.className='alerte-ligne';
    const x=document.createElement('button'); x.type='button'; x.className='alerte'+(a.grave&&!gris?' grave':'')+(gris?' ignoree':''); x.textContent=a.texte;
    x.onclick=()=>{ if(!a.it.hidden) select(a.it.name); };
    const y=document.createElement('button'); y.type='button'; y.className='alerte-ignorer'; y.textContent=gris?'Réactiver':'Ignorer';
    y.title=gris?'L’alerte redevient active':'L’alerte passe en gris ; elle revient si l’un des meubles bouge de plus de 10 cm';
    y.onclick=()=>gris?reactiver(a.k):ignorer(a); r.append(x,y); l.append(r); };
  for(const a of actives) ligne(a,false);
  if(grises.length){ const t=document.createElement('button'); t.type='button'; t.className='alertes-ignorees'; t.setAttribute('aria-expanded',String(voirIgnorees));
    t.textContent=`Alertes ignorées (${grises.length})`; t.onclick=()=>{ voirIgnorees=!voirIgnorees; majAffichage(); }; l.append(t);
    if(voirIgnorees) for(const a of grises) ligne(a,true); }
}
// à chaque image : refaire le calcul si un meuble a bougé (au plus toutes les 250 ms) ; voile selon le mode
let editionVue=null;
export function majAlertes(){
  if(!app.mobilierPret) return;
  if(editionVue!==app.edition){ editionVue=app.edition; majAffichage(); }
  const t=performance.now(); if(t-derniere<250) return;
  let s=''; for(const it of Object.values(app.items)) if(it.meta.c==='meuble') s+=`${it.name}${it.g.position.x.toFixed(3)},${it.g.position.z.toFixed(3)},${it.g.rotation.y.toFixed(3)},${it.hidden?1:0},${it.size.x.toFixed(3)},${it.size.y.toFixed(3)},${it.size.z.toFixed(3)};`;
  s+=ignorees.length; if(s===signature) return; signature=s; derniere=t; calculer();
}
export function initAlertes(){ addEventListener('disposition',()=>{ signature=''; derniere=0; }); }
