// Animation de chargement (15 octobre 2026, GIF de Mauro : l'icône de l'application, cadre bleu, maison et cube, tourne sur
// un fond sombre avec son reflet) : affichée au milieu de l'écran pendant le chargement des éléments, après la structure
// (meubles de la maquette, puis objets de l'Appart Base dont les fichiers 3D arrivent un à un), et retirée dès que 90 %
// des objets sont prêts (demande de Mauro ; le reste finit de se charger derrière). Fichier icones/chargement2.webp (WebP
// animé transparent : seuls le cadre bleu et les traits blancs de la maison, sans fond, ni reflet, ni intérieur sombre :
// « fond transparent » puis « il y a un fond noir encore » (Mauro) ; 256 px, 25 images, ≈ 385 Ko, fait par
// outils/icone_anim.py ; cache d'abord par sw.js comme les autres icônes : nouveau nom de fichier à chaque version, sinon
// l'appareil garde l'ancienne).
import {app,$} from './app.js';

const SEUIL=0.9;                      // part des objets prêts à partir de laquelle l'animation disparaît
let total=0, prets=new Set(), actif=false, fini=false;
const el=()=>$('chargement-anim');

// après la structure (modele.js) : l'animation apparaît
export function montrerChargement(){ const e=el(); if(!e||fini) return; actif=true; e.hidden=false; e.classList.remove('sortie'); maj(); }
// après installerBase() : les objets attendus sont ceux de la base dont le fichier 3D arrive après coup (objet-pret) ; les
// autres (formes, aucun aujourd'hui) comptent prêts tout de suite ; sans objet, l'animation s'efface
export function elementsAttendus(){
  const base=Object.values(app.items).filter(it=>it.base);
  for(const it of base) if(!(it.ajout?.t==='glb'||it.ajout?.t==='photo')) prets.add(it.name);
  total=base.length; if(!total) cacherChargement(); else maj();
}
export function cacherChargement(){ const e=el(); if(!e||fini) return; fini=true; actif=false; e.classList.add('sortie'); setTimeout(()=>{ e.hidden=true; },400); }
export const etatChargement=()=>({total,prets:prets.size,actif,fini});   // pour les tests
function maj(){
  if(!actif) return;
  const t=$('chargement-pct'); if(t) t.textContent=total?Math.round(100*prets.size/total)+' %':'…';
  if(total&&prets.size>=Math.ceil(total*SEUIL)) cacherChargement();
}
const compter=ev=>{ const it=ev.detail?.it; if(it?.base&&!prets.has(it.name)){ prets.add(it.name); maj(); } };
addEventListener('objet-pret',compter);
addEventListener('objet-echec',compter);   // un fichier qui n'arrive pas compte aussi : l'animation ne reste pas bloquée
