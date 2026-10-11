// Mode jeu (PC, 11 octobre 2026, demande de Mauro : « que ça se comporte comme un jeu FPS ») : en 1re personne, double-clic
// dans la vue ou bouton manette (près du pavé) : la souris est capturée (Pointer Lock), le curseur disparaît et un viseur
// marque le centre ; bouger la souris tourne le regard, W A S D (Z Q S D) avancent là où l'on regarde, Maj = courir (× 2).
// Un clic agit sur ce qui est sous le viseur : Visite = ouvrir ou fermer une porte ou une fenêtre, allumer une lampe le
// soir, faire un pas ; Éditer = choisir le meuble (Échap pour se servir du panneau) ; règle = poser un point ; clic gardé
// = téléportation. Échap rend la souris. Sensibilité : curseur « Souris » sous « Vitesse » (vues.js, mémorisée).
// Tablette et téléphone : rien ne change (ni bouton ni curseur).
import {app, $} from './app.js';
import {regarder, arreter} from './visite.js';
import {calageActif} from './calage.js';
import {comparaisonActive} from './comparer.js';
import {nommer} from './icones.js';

export const jeuPossible=()=>'requestPointerLock' in app.canvas&&matchMedia('(hover:hover) and (pointer:fine)').matches;
// centre de la vue (le viseur) : le clic y vise, la règle y pose ses points
export function centreVue(){ const r=app.canvas.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]; }

let aide=0;
function dire(t){ const a=$('jeu-aide'); a.textContent=t; a.hidden=!t; clearTimeout(aide); if(t) aide=setTimeout(()=>{ a.hidden=true; },6000); }
export function entrerJeu(){
  if(app.modeJeu||app.mode!=='walk'||!jeuPossible()||calageActif()||comparaisonActive()) return;
  document.activeElement?.blur?.();   // un curseur ou un champ touché avant garderait les touches
  try{ const p=app.canvas.requestPointerLock(); p?.catch?.(()=>dire('La souris n’a pas pu être capturée : cliquez de nouveau dans la vue (double-clic).')); }
  catch{ dire('Mode jeu indisponible dans ce navigateur.'); }
}
export function quitterJeu(){ if(document.pointerLockElement) document.exitPointerLock(); }
// double-clic dans la vue (souris, 1re personne) : le premier clic a déjà fait un pas, il est annulé
let dernier=null;
export function doubleClic(e){
  if(e.pointerType!=='mouse'||app.modeJeu||app.mode!=='walk'||app.mesure||calageActif()||!jeuPossible()){ dernier=null; return false; }
  const t=performance.now(), oui=!!dernier&&t-dernier.t<400&&Math.hypot(e.clientX-dernier.x,e.clientY-dernier.y)<12;
  dernier=oui?null:{t,x:e.clientX,y:e.clientY};
  if(oui){ arreter(); entrerJeu(); }
  return oui;
}
// à chaque image : on rend la souris si l'on quitte la 1re personne (maquette, plan), le calage ou la comparaison
export function majJeu(){ if(app.modeJeu&&(app.mode!=='walk'||calageActif()||comparaisonActive())) quitterJeu(); }

let depuis=0;
function placerViseur(){ const v=$('viseur'), [x,y]=centreVue(); v.style.left=x+'px'; v.style.top=y+'px'; }
export function initJeu(){
  app.modeJeu=false;
  const b=$('jeu'); if(!('requestPointerLock' in app.canvas)) b.remove();
  else b.onclick=()=>entrerJeu();
  document.addEventListener('pointerlockchange',()=>{
    app.modeJeu=document.pointerLockElement===app.canvas; depuis=performance.now();
    document.body.classList.toggle('jeu',app.modeJeu); $('viseur').hidden=!app.modeJeu;
    if(b.isConnected){ b.setAttribute('aria-pressed',String(app.modeJeu)); nommer(b,app.modeJeu?'Mode jeu : Échap pour rendre la souris':'Mode jeu (souris capturée, comme un jeu vidéo) : aussi par double-clic dans la vue'); }
    if(app.modeJeu){ placerViseur(); dire('Mode jeu : la souris tourne le regard · W A S D (Z Q S D) pour marcher · Maj pour courir · clic = ouvrir, choisir, faire un pas · Échap pour rendre la souris'); }
    else dire('');
  });
  document.addEventListener('pointerlockerror',()=>dire('La souris n’a pas pu être capturée : cliquez de nouveau dans la vue (double-clic).'));
  addEventListener('resize',()=>{ if(app.modeJeu) placerViseur(); });
  // souris capturée : les mouvements tournent le regard ; les sauts (plus de 300 px d'un coup, ou dans les 80 ms qui
  // suivent la capture) sont ignorés : certains navigateurs en envoient un au moment de la capture
  document.addEventListener('mousemove',e=>{
    if(!app.modeJeu||performance.now()-depuis<80) return; const x=e.movementX||0, y=e.movementY||0;
    if(Math.abs(x)>300||Math.abs(y)>300) return; const k=0.5*(app.souris||1); regarder(x*k,y*k);
  });
}
