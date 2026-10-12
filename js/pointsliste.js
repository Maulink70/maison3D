// Écran « Points de vue des photos » (11 octobre 2026, demande de Mauro : « un écran où je sélectionne les points de vue
// où on a calé une photo, je clique dessus, je m'y rends, et ça m'ouvre la photo en grand ») : fenêtre ouverte depuis les
// menus « Aller à » et « Vues » ; une carte par photo calée (vignette, nom, pièce), rangées par pièce, filtre par niveau.
// Toucher une carte : on va au point de vue dans la vue affichée, comme pour un meuble choisi dans la liste (cadrerObjet) —
// maquette : niveau de la photo, cadrage animé dans le sens de la photo, en plongée, l'appareil photo au premier plan ;
// 1re personne : debout à l'endroit de la prise de vue, regard et angle de vue de la photo ; plan : son niveau, centré et
// rapproché — puis la photo s'ouvre en grand (visionneuse : « Faire un montage », « Voir dans la maquette », « Partager »…).
import * as THREE from 'three';
import {app, $, champVisite} from './app.js';
import {ETAGE_FLOOR} from './config.js';
import {PIECES} from './pieces.js';
import {chargerPhotos, lesPhotos, voirPhoto} from './galerie.js';
import {setLevel} from './vues.js';
import {reprendreVisite} from './visite.js';
import {cadrerPlan} from './plan.js';
import {animerVers} from './aller.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const nomPiece=id=>PIECES.find(p=>p.id===id)?.nom||'Sans pièce';
const calee=p=>p.calage&&['x','y','z','yaw'].every(k=>Number.isFinite(+p.calage[k]));
const niveauDe=p=>(+p.calage.sol||0)>ETAGE_FLOOR-0.3?'etage':'rez';
const ordrePiece=id=>{ const i=PIECES.findIndex(q=>q.id===id); return i<0?99:i; };

let fen=null, niveau='tout', etat='';
function construire(){
  fen=el('div',{id:'pv-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Points de vue des photos'});
  fen.innerHTML=`<div class="fenetre-carte gal-carte">
    <div class="fenetre-tete"><h2>Points de vue des photos</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <p class="pv-aide">Touchez une photo : vous allez à l’endroit d’où elle a été prise, dans la vue affichée (maquette, 1re personne ou plan), puis elle s’ouvre en grand.</p>
    <div class="tab-outils"><div class="seg" role="group" aria-label="Niveau"><button type="button" data-niv="tout">Tout</button><button type="button" data-niv="rez">Rez</button><button type="button" data-niv="etage">Étage</button></div>
      <span class="spacer"></span><span class="pv-compte" role="status"></span></div>
    <div class="gal-grille pv-grille"></div></div>`;
  document.body.append(fen);
  fen.querySelector('.fermer').onclick=()=>ouvrirPointsVue(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirPointsVue(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirPointsVue(false); });
  for(const b of fen.querySelectorAll('[data-niv]')) b.onclick=()=>{ niveau=b.dataset.niv; majGrille(); };
}
function majGrille(){
  if(!fen||fen.hidden) return;
  for(const b of fen.querySelectorAll('[data-niv]')) b.setAttribute('aria-pressed',String(b.dataset.niv===niveau));
  const g=fen.querySelector('.pv-grille'); g.replaceChildren();
  if(etat){ g.append(el('p',{class:'vide'},etat)); fen.querySelector('.pv-compte').textContent=''; return; }
  const toutes=lesPhotos(), calees=toutes.filter(calee), l=calees.filter(p=>niveau==='tout'||niveauDe(p)===niveau)
    .sort((a,b)=>ordrePiece(a.piece)-ordrePiece(b.piece)||(a.ordre||0)-(b.ordre||0)||String(a.nom).localeCompare(String(b.nom),'fr',{numeric:true}));
  fen.querySelector('.pv-compte').textContent=`${calees.length} photo${calees.length>1?'s':''} calée${calees.length>1?'s':''} sur ${toutes.length}`;
  if(!l.length){ g.append(el('p',{class:'vide'},calees.length?'Aucune photo calée à ce niveau.':'Aucune photo calée pour l’instant : elles apparaîtront ici une fois calées sur la maquette.')); return; }
  let piece;
  for(const p of l){
    if(p.piece!==piece){ piece=p.piece; g.append(el('h3',{class:'gal-titre'},nomPiece(piece)+(niveau==='tout'?' · '+(niveauDe(p)==='etage'?'étage':'rez'):''))); }
    const b=el('button',{type:'button',class:'gal-photo','data-photo':p.id,'aria-label':'Aller au point de vue de la photo « '+p.nom+' » ('+nomPiece(p.piece)+')'});
    const cadre=el('span',{class:'gal-image'}); cadre.append(el('img',{src:p.vignette||'',alt:'',loading:'lazy'}));
    b.append(cadre,el('span',{class:'cat-titre'},p.nom));
    b.onclick=()=>{ ouvrirPointsVue(false); allerAuPoint(p); };
    g.append(b);
  }
}
export async function ouvrirPointsVue(oui=true){
  if(oui&&!app.mobilierPret) return;
  if(oui&&!fen) construire(); if(!fen) return;
  fen.hidden=!oui; if(!oui) return;
  if(!lesPhotos().length){ etat='Chargement des photos…'; majGrille(); }
  try{ await chargerPhotos(); etat=''; }catch(e){ if(!lesPhotos().length) etat=e.message||'Lecture des photos impossible'; }
  majGrille();
}

// aller au point de vue d'une photo calée, dans la vue affichée, puis l'ouvrir en grand
export function allerAuPoint(p){
  const k=p.calage, niv=niveauDe(p), x=+k.x, z=+k.z, sol=Number.isFinite(+k.sol)?+k.sol:(niv==='etage'?ETAGE_FLOOR:0);
  const yaw=+k.yaw, pitch=+k.pitch||0, dx=-Math.sin(yaw), dz=-Math.cos(yaw);   // direction regardée par la photo
  if(app.mode==='walk'){
    reprendreVisite({x,y:sol,z,yaw,pitch});
    if(+k.fov>0) champVisite(Math.min(95,+k.fov));   // angle de vue de la photo (horizontal) : on voit ce qu'elle montre
  } else if(app.mode==='plan'){
    if(app.level!==niv) setLevel(niv,false);
    cadrerPlan({x0:x-3,x1:x+3,z0:z-3,z1:z+3});
  } else {
    if(app.level!==niv) setLevel(niv,false);
    // on regarde un peu devant l'appareil, depuis derrière lui et au-dessus : l'icône au premier plan, ce que montre la photo derrière
    const c=new THREE.Vector3(x+dx*1.5,sol+0.8,z+dz*1.5), el=THREE.MathUtils.degToRad(55), D=6.5;
    const pos=c.clone().add(new THREE.Vector3(-dx*Math.cos(el)*D,Math.sin(el)*D,-dz*Math.cos(el)*D));
    animerVers(pos.toArray(),c.toArray());
  }
  const memePiece=lesPhotos().filter(q=>calee(q)&&q.piece===p.piece);
  voirPhoto(p,memePiece.length?memePiece:[p]);
}
// bouton de la barre, à côté de « Aller à » (Mauro, 12 octobre 2026) ; aussi dans les menus « Aller à », « Vues » et « Photo réaliste »
export function initPointsListe(){ addEventListener('photos',()=>majGrille());
  document.getElementById('points-vue')?.addEventListener('click',()=>ouvrirPointsVue(true)); }
