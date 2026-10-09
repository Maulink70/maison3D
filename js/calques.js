// Calques (livraison 6) : noms des pièces, surfaces (au sol et libre), hauteurs sous plafond, et cotes en quatre familles
// (dimensions des pièces, longueur des murs, meuble sélectionné avec ses distances aux murs, portes et fenêtres).
// Ils sont dessinés en pixels d'écran dans un calque SVG au-dessus de la vue (#calques), en maquette et sur le plan :
// chaque point est placé au sol en mètres puis projeté (caméra de la maquette, ou échelle du plan). En 1re personne, un
// bandeau donne la pièce où l'on est. Toucher une cote la masque ; « Réafficher » les remet (choix mémorisés).
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR, GARDE_CORPS} from './config.js';
import {PIECES, surface, pieceEn} from './pieces.js';
import {versEcran, niveauDuPlan, murs, empreinte, boucles} from './plan.js';
import {yToitSud, ESC} from './rez_structure.js';
import {isolement, isolementActif, dansIsolement} from './isoler.js';
import {decalage} from './eclate.js';

const OPTIONS=[['noms','Noms des pièces'],['surfaces','Surfaces (au sol et libre)'],['hauteurs','Hauteurs sous plafond'],
  ['cPieces','Dimensions des pièces'],['cMurs','Longueur des murs'],['cMeuble','Meuble sélectionné et distances aux murs'],['cOuv','Portes et fenêtres'],['mesures','Mesures de la règle'],['murs','Murs transparents (maquette)']];
const CLE='maison3d-calques', NS='http://www.w3.org/2000/svg';
export const etat={noms:true,surfaces:true,hauteurs:false,cPieces:false,cMurs:false,cMeuble:false,cOuv:false,mesures:true,murs:false,lumiere:'normale',eclat:0};
const AFFICHAGE=['mesures','murs','lumiere','eclat'];   // réglages d'affichage du menu, pas des calques dessinés ici
const masquees=new Set();
const m=v=>v.toFixed(2).replace('.',',')+' m', m2=v=>v.toFixed(1).replace('.',',')+' m²';
const sol=niv=>niv==='etage'?ETAGE_FLOOR:0, niveauDe=it=>it.lvl==='Étage'?'etage':'rez';
// calculs lourds (surface libre, hauteurs) : une pièce par image au plus, pour ne pas figer l'affichage à l'ouverture
let budget=0;

// ---------- mémoire ----------
function garder(){ try{ localStorage.setItem(CLE,JSON.stringify({etat,masquees:[...masquees]})); }catch{} }
function relire(){ try{ const d=JSON.parse(localStorage.getItem(CLE)||'{}'); Object.assign(etat,d.etat||{}); for(const k of d.masquees||[]) masquees.add(k); }catch{} }

// ---------- données des pièces : point d'étiquette, contour, hauteurs, surface libre ----------
const plusGrand=p=>p.rects.reduce((a,r)=>(r[2]-r[0])*(r[3]-r[1])>(a[2]-a[0])*(a[3]-a[1])?r:a);
const centre=p=>{ const r=plusGrand(p); return [(r[0]+r[2])/2,(r[1]+r[3])/2]; };
const contoursPieces=new Map();
function contourPiece(p){   // polygone de la pièce (réunion de ses rectangles), grille de 1 cm
  if(contoursPieces.has(p.id)) return contoursPieces.get(p.id);
  const P=0.01, xs=p.rects.flatMap(r=>[r[0],r[2]]), zs=p.rects.flatMap(r=>[r[1],r[3]]), x0=Math.min(...xs)-P, z0=Math.min(...zs)-P;
  const nx=Math.ceil((Math.max(...xs)+P-x0)/P), nz=Math.ceil((Math.max(...zs)+P-z0)/P), plein=new Uint8Array(nx*nz);
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){ const x=x0+(i+0.5)*P, z=z0+(j+0.5)*P; if(p.rects.some(r=>x>r[0]&&x<r[2]&&z>r[1]&&z<r[3])) plein[j*nx+i]=1; }
  const b=boucles(plein,nx,nz,x0,z0,P,0.004).sort((a,c)=>c.length-a.length)[0]||[];
  contoursPieces.set(p.id,b); return b;
}
// Hauteur sous plafond : rayons vers le haut sur une grille de 40 cm (structure, dont la pente nord du toit, qui descend
// aussi dans la chambre et la salle de bain du rez), et pan sud du toit, construit en code ; l'escalier est écarté
const hauteurs=new Map(), rcH=new THREE.Raycaster(), haut=new THREE.Vector3(0,1,0), o=new THREE.Vector3();
function hauteur(p){
  if(hauteurs.has(p.id)) return hauteurs.get(p.id);
  if(budget<=0) return undefined; budget--;
  const f=sol(p.niveau); let mn=Infinity, mx=-Infinity;
  for(const r of p.rects) for(let x=r[0]+0.15;x<r[2]-0.1;x+=0.4) for(let z=r[1]+0.15;z<r[3]-0.1;z+=0.4){
    if(p.niveau==='rez'&&x>ESC.x0-0.05&&x<ESC.x1+0.05&&z<ESC.zBas+0.05&&z>ESC.zHaut-0.05) continue;
    rcH.set(o.set(x,f+0.3,z),haut); rcH.far=6;
    const h=rcH.intersectObjects(app.floors,false).find(h=>h.point.y>f+0.5);
    let y=h?h.point.y:Infinity; if(z<=-14.14&&z>=-25.5) y=Math.min(y,yToitSud(z));
    if(y===Infinity) continue; mn=Math.min(mn,y-f); mx=Math.max(mx,y-f);
  }
  const res=mn===Infinity?null:{mn,mx}; hauteurs.set(p.id,res); return res;
}
const texteHauteur=h=>h===undefined?'h. …':!h?'':Math.abs(h.mx-h.mn)<0.05?'h. '+m(h.mn):'h. '+h.mn.toFixed(2).replace('.',',')+' → '+m(h.mx);
// Surface libre : surface au sol moins l'emprise des meubles posés (sous 1 m ; tapis compris comme libre), grille de 5 cm
const libres=new Map();
function meublesPoses(niv){ return Object.values(app.items).filter(it=>it.meta.c==='meuble'&&!it.hidden&&niveauDe(it)===niv&&it.home.y-sol(niv)<1.0&&it.size.y>=0.05); }
function surfaceLibre(p){
  const items=meublesPoses(p.niveau), sig=items.map(it=>`${it.name}${it.g.position.x.toFixed(3)}${it.g.position.z.toFixed(3)}${it.g.rotation.y.toFixed(3)}`).join('|');
  const c=libres.get(p.id), t=performance.now(); if(c&&(c.sig===sig||t-c.t<300||budget<=0)) return c.v;
  if(budget<=0) return null; budget--;
  const P=0.05, emp=items.map(it=>({it,e:empreinte(it),c:Math.cos(it.g.rotation.y),s:Math.sin(it.g.rotation.y),x:it.g.position.x,z:it.g.position.z,r:Math.hypot(it.size.x,it.size.z)/2+0.05}));
  let pris=0, tous=0;
  for(const r of p.rects) for(let x=r[0]+P/2;x<r[2];x+=P) for(let z=r[1]+P/2;z<r[3];z+=P){ tous++;
    for(const q of emp){ const dx=x-q.x, dz=z-q.z; if(Math.abs(dx)>q.r||Math.abs(dz)>q.r) continue;
      const lx=dx*q.c-dz*q.s, lz=dx*q.s+dz*q.c, e=q.e, i=Math.floor((lx+e.hx)/e.pas), j=Math.floor((lz+e.hz)/e.pas);
      if(i>=0&&j>=0&&i<e.nx&&j<e.nz&&e.plein[j*e.nx+i]){ pris++; break; } } }
  const v=surface(p)*(1-pris/Math.max(1,tous)); libres.set(p.id,{sig,t,v}); return v;
}
function lignesPiece(p){
  const l=[];
  if(etat.noms) l.push(p.nom);
  if(etat.surfaces){ const v=surfaceLibre(p); l.push(m2(surface(p))+' · libre '+(v===null?'…':m2(v))); }
  if(etat.hauteurs){ const t=texteHauteur(hauteur(p)); if(t) l.push(t); }
  return l;
}

// ---------- distances aux murs (grille des murs du plan, coupe à 1 m) ----------
function versMur(niv,x,z,dx,dz){
  const g=murs(niv);
  for(let d=0;d<8;d+=g.pas){ const px=x+dx*d, pz=z+dz*d, i=Math.floor((px-g.x0)/g.pas), j=Math.floor((pz-g.z0)/g.pas);
    if(i<0||j<0||i>=g.nx||j>=g.nz) return null; if(g.plein[j*g.nx+i]) return d;
    if(niv==='etage'&&px>=GARDE_CORPS.x0&&px<=GARDE_CORPS.x1&&pz>=GARDE_CORPS.z0-0.01&&pz<=GARDE_CORPS.z1+0.01) return d; }
  return null;
}

// ---------- ce qu'il faut dessiner : étiquettes et cotes, points en mètres (x, z) au sol d'un niveau ----------
function aDessiner(niveaux,seule=null){
  const out=[];
  for(const p of PIECES.filter(q=>niveaux.includes(q.niveau)&&(!seule||q.id===seule))){
    const y=sol(p.niveau)+0.05, [cx,cz]=centre(p), l=lignesPiece(p);
    if(l.length) out.push({type:'etiquette',id:'et:'+p.id,y,x:cx,z:cz,lignes:l,titre:etat.noms});
    if(etat.cPieces) for(const [k,r] of p.rects.entries()){ if((r[2]-r[0])*(r[3]-r[1])<1.5) continue;
      const zh=r[1]+(r[3]-r[1])*0.25, xv=r[0]+(r[2]-r[0])*0.25;
      out.push({type:'cote',id:`pi:${p.id}:${k}:l`,y,a:[r[0],zh],b:[r[2],zh],texte:m(r[2]-r[0])});
      out.push({type:'cote',id:`pi:${p.id}:${k}:p`,y,a:[xv,r[1]],b:[xv,r[3]],texte:m(r[3]-r[1])}); }
    if(etat.cMurs){ const c=contourPiece(p);
      for(let k=0;k<c.length;k++){ const a=c[k], b=c[(k+1)%c.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<0.3) continue;
        out.push({type:'cote',id:`mu:${p.id}:${k}`,y,a,b,dedans:[cx,cz],decal:13,texte:m(L)}); } }
  }
  if(etat.cOuv){
    for(const pt of app.portes){ const d=pt.def; if(d.fenetre) continue; const niv=d.y0>1?'etage':'rez'; if(!niveaux.includes(niv)) continue;
      const h=d.axe==='x'?[d.plan,d.charniere]:[d.charniere,d.plan], autre=d.charniere===d.a0?d.a1:d.a0, f=d.axe==='x'?[d.plan,autre]:[autre,d.plan];
      const vx=f[0]-h[0], vz=f[1]-h[1], c=Math.cos(pt.ouvert), s=Math.sin(pt.ouvert), ov=[vx*c+vz*s,-vx*s+vz*c];
      out.push({type:'cote',id:'po:'+pt.nom,y:sol(niv)+0.05,a:h,b:f,dedans:[h[0]-ov[0],h[1]-ov[1]],decal:10,texte:m(Math.abs(d.a1-d.a0))}); }
    for(const it of Object.values(app.items)){
      if(it.meta.c!=='ouverture'||it.hidden||!/fenetre|baie|velux/i.test(it.name)||!niveaux.includes(niveauDe(it))) continue;
      const b=new THREE.Box3().setFromObject(it.g), lx=b.max.x-b.min.x, lz=b.max.z-b.min.z, y=sol(niveauDe(it))+0.05;
      if(lx>=lz){ const z=Math.abs(b.min.z+21.2)<Math.abs(b.max.z+21.2)?b.min.z:b.max.z; out.push({type:'cote',id:'fe:'+it.name,y,a:[b.min.x,z],b:[b.max.x,z],dedans:[15.4,-21.2],decal:10,texte:m(lx)}); }
      else { const x=Math.abs(b.min.x-15.4)<Math.abs(b.max.x-15.4)?b.min.x:b.max.x; out.push({type:'cote',id:'fe:'+it.name,y,a:[x,b.min.z],b:[x,b.max.z],dedans:[15.4,-21.2],decal:10,texte:m(lz)}); }
    }
  }
  const it=app.selected;
  if(etat.cMeuble&&it&&!it.hidden&&niveaux.includes(niveauDe(it))){
    const niv=niveauDe(it), y=sol(niv)+0.05, g=it.g, c=Math.cos(g.rotation.y), s=Math.sin(g.rotation.y), hx=it.size.x/2, hz=it.size.z/2;
    const P=(lx,lz)=>[g.position.x+lx*c+lz*s, g.position.z-lx*s+lz*c], mil=[g.position.x,g.position.z];
    out.push({type:'cote',id:'me:'+it.name+':l',y,a:P(-hx,-hz),b:P(hx,-hz),dedans:mil,decal:-12,texte:m(it.size.x)});
    out.push({type:'cote',id:'me:'+it.name+':p',y,a:P(hx,-hz),b:P(hx,hz),dedans:mil,decal:-12,texte:m(it.size.z)});
    out.push({type:'etiquette',id:'me:'+it.name+':h',y,x:mil[0],z:mil[1],lignes:['H '+m(it.size.y)],petit:true});
    const cs=[P(-hx,-hz),P(hx,-hz),P(hx,hz),P(-hx,hz)], x0=Math.min(...cs.map(q=>q[0])), x1=Math.max(...cs.map(q=>q[0])), z0=Math.min(...cs.map(q=>q[1])), z1=Math.max(...cs.map(q=>q[1]));
    for(const [k,px,pz,dx,dz] of [['o',x0,mil[1],-1,0],['e',x1,mil[1],1,0],['n',mil[0],z0,0,-1],['s',mil[0],z1,0,1]]){
      const d=versMur(niv,px+dx*0.005,pz+dz*0.005,dx,dz); if(d===null||d<0.02) continue;
      out.push({type:'cote',id:`di:${it.name}:${k}`,y,a:[px,pz],b:[px+dx*(d+0.005),pz+dz*(d+0.005)],texte:m(d+0.005),distance:true}); }
  }
  return out.filter(e=>(e.type!=='cote'||!masquees.has(e.id))&&(!seule||e.type!=='cote'||dansIsolement({x:(e.a[0]+e.b[0])/2,z:(e.a[1]+e.b[1])/2})));
}

// ---------- dessin (éléments SVG réutilisés d'une image à l'autre) ----------
const pools={ecran:new Map()}, pool=pools.ecran;
const el=(nom,attrs,parent)=>{ const n=document.createElementNS(NS,nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); parent?.append(n); return n; };
function noeud(e,svg,pool){
  let n=pool.get(e.id); if(n&&n.type===e.type) return n;
  n?.g.remove();
  const g=el('g',{class:e.type==='cote'?'cote'+(e.distance?' distance':''):'etiquette'+(e.petit?' petit':''),'data-id':e.id},svg);
  n={type:e.type,g}; if(e.type==='cote'){ n.trait=el('path',{class:'trait'},g); n.texte=el('text',{class:'valeur','data-cote':e.id},g); n.texte.append(Object.assign(document.createElementNS(NS,'title'),{textContent:'Toucher pour masquer cette cote'})); }
  else n.texte=el('text',{},g);
  pool.set(e.id,n); return n;
}
function dessiner(liste,proj,svg=$('calques'),pool=pools.ecran,court=34){
  const vus=new Set();
  for(const e of liste){
    if(e.type==='etiquette'){ const p=proj(e.x,e.y,e.z); if(!p) continue; const n=noeud(e,svg,pool); vus.add(e.id);
      const cle=e.lignes.join('\n'); if(n.cle!==cle){ n.cle=cle; n.texte.replaceChildren(...e.lignes.map((t,k)=>{ const s=el('tspan',{x:0,dy:k?'1.25em':'0','class':k===0&&e.titre?'nom':''}); s.textContent=t; return s; })); }
      n.g.setAttribute('transform',`translate(${p.x.toFixed(1)} ${(p.y-(e.lignes.length-1)*7).toFixed(1)})`); continue; }
    const A=proj(e.a[0],e.y,e.a[1]), B=proj(e.b[0],e.y,e.b[1]); if(!A||!B) continue;
    let ux=B.x-A.x, uy=B.y-A.y; const L=Math.hypot(ux,uy); if(L<court) continue; ux/=L; uy/=L;   // trop courte à l'écran : on zoome pour la voir
    let nx=-uy, ny=ux, d=e.decal||0;
    if(e.dedans){ const C=proj(e.dedans[0],e.y,e.dedans[1]); if(C&&(nx*(C.x-A.x)+ny*(C.y-A.y))<0){ nx=-nx; ny=-ny; } if(d<0){ nx=-nx; ny=-ny; d=-d; } }
    const a=[A.x+nx*d,A.y+ny*d], b=[B.x+nx*d,B.y+ny*d], t=5;
    const n=noeud(e,svg,pool); vus.add(e.id);
    // trait, petites barres obliques aux extrémités (cote d'architecte) et lignes de rappel
    n.trait.setAttribute('d',`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`+
      [a,b].map(q=>`M${(q[0]-(ux+nx)*t*0.7).toFixed(1)} ${(q[1]-(uy+ny)*t*0.7).toFixed(1)}L${(q[0]+(ux+nx)*t*0.7).toFixed(1)} ${(q[1]+(uy+ny)*t*0.7).toFixed(1)}`).join('')+
      (d?`M${A.x.toFixed(1)} ${A.y.toFixed(1)}L${(a[0]+nx*3).toFixed(1)} ${(a[1]+ny*3).toFixed(1)}M${B.x.toFixed(1)} ${B.y.toFixed(1)}L${(b[0]+nx*3).toFixed(1)} ${(b[1]+ny*3).toFixed(1)}`:''));
    let ang=Math.atan2(uy,ux)*180/Math.PI; if(ang>90) ang-=180; if(ang<-90) ang+=180;
    const mx=(a[0]+b[0])/2+nx*7, my=(a[1]+b[1])/2+ny*7;   // valeur à côté du trait, jamais dessus
    n.texte.textContent=e.texte; n.texte.setAttribute('transform',`translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(1)})`);
  }
  for(const [id,n] of pool) if(!vus.has(id)){ n.g.remove(); pool.delete(id); }
}

// Impression (livraison 8) : les calques cochés d'un niveau, tout calculé tout de suite (surfaces libres, hauteurs),
// dessinés dans le groupe svg ; proj(x, y, z) donne le point sur le papier, dans les unités du dessin
export function calquesImpression(niv,svg,proj){
  const b=budget; budget=Infinity; const liste=aDessiner([niv]); budget=b;
  dessiner(liste,proj,svg,new Map());
}
export {versMur};

// ---------- à chaque image ----------
const v3=new THREE.Vector3();
let dernierBandeau=0;
export function majCalques(){
  budget=1;
  const actif=Object.entries(etat).some(([k,v])=>v&&!AFFICHAGE.includes(k)), svg=$('calques');   // mesures : mesure.js ; murs, lumière, éclaté : leurs modules
  if(app.mode==='walk'||!actif||!app.mobilierPret){ if(pool.size){ for(const n of pool.values()) n.g.remove(); pool.clear(); } svg.toggleAttribute('hidden',true); majBandeau(); return; }
  $('bandeau-piece').hidden=true; svg.toggleAttribute('hidden',false);
  let niveaux, proj;
  if(app.mode==='plan'){ niveaux=[niveauDuPlan()]; proj=(x,y,z)=>versEcran(x,z); }
  else { niveaux=app.level==='all'?['rez','etage']:[app.level]; const r=svg.getBoundingClientRect(), cam=app.camera;
    proj=(x,y,z)=>{ v3.set(x,y+decalage(y),z).project(cam); if(v3.z>1||v3.z<-1) return null; return {x:(v3.x+1)/2*r.width,y:(1-v3.y)/2*r.height}; }; }
  dessiner(aDessiner(niveaux,app.mode==='orbit'&&isolementActif()?isolement.piece:null),proj);   // pièce isolée : ses calques seulement
}
// 1re personne : pièce où l'on est (nom, surfaces, hauteur), en haut à gauche sous la barre
function majBandeau(){
  const b=$('bandeau-piece'), on=app.mode==='walk'&&app.mobilierPret&&(etat.noms||etat.surfaces||etat.hauteurs);
  if(!on){ b.hidden=true; return; }
  const t=performance.now(); if(t-dernierBandeau<400&&!b.hidden) return; dernierBandeau=t;
  const c=app.camera.position, p=pieceEn(c.x,c.z,c.y>ETAGE_FLOOR+0.5?'etage':'rez');
  if(!p){ b.hidden=true; return; }
  b.textContent=lignesPiece(p).join(' · '); b.hidden=false;
}

// ---------- menu « Calques » ----------
// sur un grand écran, un menu qui dépasserait à droite est aligné sur le bord droit de son bouton
export function caler(menu){ menu.style.left=menu.style.right=''; if(innerWidth<=760) return; if(menu.getBoundingClientRect().right>innerWidth-8){ menu.style.left='auto'; menu.style.right='0'; } }
export function initCalques(){
  relire();
  const bt=$('calques-bouton'), menu=$('calques-menu');
  const ouvrir=oui=>{ menu.hidden=!oui; bt.setAttribute('aria-expanded',String(oui)); if(oui){ majMenu(); caler(menu); } };
  const groupes=[['Affichage',OPTIONS.slice(8)],['Pièces',OPTIONS.slice(0,3)],['Cotes',OPTIONS.slice(3,7)],['Règle',OPTIONS.slice(7,8)]];
  for(const [titre,opts] of groupes){
    const g=document.createElement('div'); g.className='menu-groupe';
    const t=document.createElement('div'); t.className='menu-titre'; t.textContent=titre; g.append(t);
    for(const [k,l] of opts){ const lab=document.createElement('label'); lab.className='case';
      const c=document.createElement('input'); c.type='checkbox'; c.id='cq-'+k; c.checked=!!etat[k]; c.onchange=()=>{ etat[k]=c.checked; garder(); };
      lab.append(c,document.createTextNode(l)); g.append(lab); }
    menu.append(g);
    if(titre==='Affichage'){
      // lumière du jour (lumiere.js) et vue éclatée (eclate.js)
      const l=document.createElement('div'); l.className='impr-ligne';
      l.innerHTML='<span id="cq-t-lumiere">Lumière</span><div class="seg" role="group" aria-labelledby="cq-t-lumiere">'+
        [['normale','Normale'],['matin','Matin'],['midi','Midi'],['soir','Soir'],['nuit','Nuit']].map(([k,t])=>`<button type="button" id="cq-lum-${k}" data-lumiere="${k}">${t}</button>`).join('')+'</div>';
      l.querySelectorAll('[data-lumiere]').forEach(b=>b.onclick=()=>{ etat.lumiere=b.dataset.lumiere; garder(); majMenu(); });
      const e=document.createElement('label'); e.className='case eclat';
      e.innerHTML='<span>Vue éclatée</span><input type="range" id="cq-eclat" min="0" max="3" step="0.1" value="0"><output id="cq-eclat-val">0 m</output>';
      e.querySelector('input').oninput=ev=>{ etat.eclat=+ev.target.value; garder(); majMenu(); };
      g.append(l,e);
    }
  }
  const pied=document.createElement('div'); pied.className='menu-pied';
  const re=document.createElement('button'); re.type='button'; re.id='cq-reafficher'; re.className='btn';
  re.onclick=()=>{ masquees.clear(); garder(); majMenu(); };
  const aide=document.createElement('p'); aide.textContent='Touchez une cote pour la masquer.';
  pied.append(re,aide); menu.append(pied);
  function majMenu(){ re.hidden=!masquees.size; re.textContent=`Réafficher les cotes masquées (${masquees.size})`; for(const [k] of OPTIONS) $('cq-'+k).checked=!!etat[k];
    for(const b of menu.querySelectorAll('[data-lumiere]')) b.setAttribute('aria-pressed',String((etat.lumiere||'normale')===b.dataset.lumiere));
    const ok=app.mode==='orbit'&&app.level==='all', r=$('cq-eclat'); r.disabled=!ok; r.value=String(+etat.eclat||0);
    $('cq-eclat-val').textContent=ok?(+etat.eclat||0).toFixed(1).replace('.',',')+' m':'maquette, Tout'; }
  bt.onclick=e=>{ e.stopPropagation(); ouvrir(menu.hidden); };
  addEventListener('pointerdown',e=>{ if(!menu.hidden&&!menu.contains(e.target)&&!bt.contains(e.target)) ouvrir(false); });
  menu.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); ouvrir(false); bt.focus(); } });
  // toucher une cote la masque (sans faire glisser le plan ni tourner la maquette)
  $('calques').addEventListener('pointerdown',e=>{ const c=e.target.closest?.('[data-cote]'); if(!c) return;
    e.preventDefault(); e.stopPropagation(); masquees.add(c.dataset.cote); garder(); });
}
