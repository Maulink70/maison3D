// Barre du haut toujours sur UNE ligne, sur tous les appareils (Mauro, 14 octobre 2026 : « je ne veux en aucun cas que ça
// passe sur deux »). Le contenu change (Éditer ajoute « + » et « Meubles », le plan ses deux styles, les stores leur bouton…),
// d'où une mesure en direct plutôt que des tailles fixes : on essaie les paliers dans l'ordre, et l'on garde le premier où
// tout tient. n1 : noms plus serrés (PC) ; n2 : icônes seules ; n3 : boutons plus étroits, nom de l'appartement caché ;
// n4 et n5 : boutons étroits puis très étroits ; n6 (téléphone) : la ligne défile au doigt, toujours une seule ligne, les menus restent entiers.
// Les boutons sont rangés dans .bar-ligne (display:contents tant qu'elle ne défile pas : rien ne change pour le reste).
import {caler} from './calques.js';
import {poserIcone, nommer} from './icones.js';
const PALIERS=['n1','n2','n3','n4','n5','n6'];
let bar=null, ligne=null, enCours=false;

function tient(){
  const W=bar.clientWidth, gap=parseFloat(getComputedStyle(bar).columnGap)||0; let total=0, n=0;
  for(const c of ligne.children){
    if(c.classList.contains('spacer')){ n++; continue; }   // vide, mais il compte un écart de plus
    const w=c.getBoundingClientRect().width; if(!w) continue; total+=w; n++; }
  return total+gap*Math.max(0,n-1)<=W+0.5;
}
export function ajusterBarre(){
  if(!bar||enCours) return; enCours=true;
  bar.classList.remove(...PALIERS);
  let i=-1;
  while(!tient()&&i<PALIERS.length-1){ i++; bar.classList.add(PALIERS[i]); }
  bar.dataset.palier=i<0?'0':PALIERS[i];
  enCours=false;
}
let attente=0;
const plusTard=()=>{ if(attente) return; attente=requestAnimationFrame(()=>{ attente=0; ajusterBarre(); }); };

// bouton « Ouvrir » : portes, fenêtres et stores réunis (Mauro, 14 octobre 2026 : « on gagne de la place, je clique dessus et
// j'ai les trois choix »). Les boutons #portes, #fenetres, #stores et #auto sont dans son menu (vues.js et stores.js les
// règlent comme avant) ; le menu reste ouvert après un choix (on voit l'état changer), il se ferme en touchant ailleurs ou par Échap.
// Bouton « Lumière » : même menu, refermé après le choix (un seul choix possible). Bouton « Réaliste » : rendu réaliste et
// ombres (realiste.js, ombres.js), menu gardé ouvert comme « Ouvrir » (15 octobre 2026).
function menuBarre(idBt,idMenu,fermerApres=false){
  const bt=document.getElementById(idBt), menu=document.getElementById(idMenu); if(!bt||!menu) return;
  const ouvrir=oui=>{ menu.hidden=!oui; bt.setAttribute('aria-expanded',String(oui)); if(oui) caler(menu); };
  bt.addEventListener('click',()=>ouvrir(menu.hidden));
  if(fermerApres) menu.addEventListener('click',e=>{ if(e.target.closest('button')) ouvrir(false); });
  addEventListener('pointerdown',e=>{ if(!menu.hidden&&!menu.contains(e.target)&&!bt.contains(e.target)) ouvrir(false); });
  addEventListener('keydown',e=>{ if(e.key==='Escape'&&!menu.hidden){ ouvrir(false); bt.focus(); } });
}
// Échap ferme la fenêtre ouverte (Photo réaliste, Produits, Blender, catalogue, fichier 3D, visionneuse, montage…) même quand
// le clavier est resté sur le bouton de la barre (audit du 15 octobre 2026, « Ok » de Mauro) : chaque fenêtre ne voyait Échap
// que si le clavier était dedans. Si le clavier est dans une fenêtre, c'est elle qui agit (ses écouteurs arrêtent la propagation).
function fenetreEchap(e){
  if(e.key!=='Escape'||e.target.closest?.('[role="dialog"]')) return;
  const ouvertes=[...document.querySelectorAll('.fenetre:not([hidden]),.visionneuse:not([hidden])')]; if(!ouvertes.length) return;
  const z=d=>parseInt(getComputedStyle(d).zIndex)||0;
  const dessus=ouvertes.reduce((a,d)=>z(d)>=z(a)?d:a);   // la plus haute (dernière du document à égalité)
  const b=dessus.querySelector('.fenetre-tete .fermer, #vis-fermer, #mi-fermer'); if(b){ e.preventDefault(); b.click(); }
}
// bouton « Plein écran » en bout de barre (Mauro, 21 octobre 2026) : le même bouton y entre et en sort
function pleinEcran(){
  const b=document.getElementById('plein-ecran'), d=document.documentElement;
  if(!b||!document.fullscreenEnabled||!d.requestFullscreen) return;
  b.hidden=false;
  const maj=()=>{ const oui=!!document.fullscreenElement; poserIcone(b,oui?'minimize':'maximize'); nommer(b,oui?'Quitter le plein écran':'Plein écran'); b.setAttribute('aria-pressed',oui); };
  b.addEventListener('click',()=>{ (document.fullscreenElement?document.exitFullscreen():d.requestFullscreen({navigationUI:'hide'})).catch(()=>{}); });
  document.addEventListener('fullscreenchange',()=>{ maj(); setTimeout(ajusterBarre,50); });
  maj();
}
export function initBarre(){
  menuBarre('ouvertures','ouvertures-menu'); menuBarre('lumiere','lumiere-menu',true); menuBarre('realiste','realiste-menu');
  addEventListener('keydown',fenetreEchap);
  pleinEcran();
  bar=document.querySelector('header.bar'); if(!bar) return;
  ligne=document.createElement('div'); ligne.className='bar-ligne';
  ligne.append(...bar.childNodes); bar.append(ligne);
  ajusterBarre();
  addEventListener('resize',ajusterBarre);
  // un bouton montré ou caché, un nom qui change (prénom, variante) : on remesure tout de suite (avant l'affichage)
  const hors=n=>{ const e=n.nodeType===1?n:n.parentElement; return !!e?.closest('.menu'); };   // menus : en dessous, sans effet sur la largeur
  new MutationObserver(l=>{ if(l.some(m=>!hors(m.target))) ajusterBarre(); }).observe(ligne,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','data-nom','data-icone']});
  document.fonts?.ready?.then(plusTard);
  addEventListener('load',plusTard);
  addEventListener('visibilitychange',plusTard);
}
