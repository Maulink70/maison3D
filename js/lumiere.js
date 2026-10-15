// Lumière du jour (étape 2) : Normale, Matin, Midi, Soir, Nuit (menu « Calques », groupe Affichage, choix mémorisé avec les
// calques) : direction, couleur et force du soleil, lumière d'ambiance (ciel et sol), teinte du ciel et des montagnes en
// 1re personne. Sans ombres portées (trop lourdes pour la tablette) : la lumière change la teinte et l'éclairage des faces.
// Nord = −z (haut du plan) : soleil à l'est (+x) le matin, au sud (+z) et haut à midi, à l'ouest (−x) et bas le soir.
import * as THREE from 'three';
import {app} from './app.js';
import {etat, choisirLumiere} from './calques.js';
import {poserIcone, nommer} from './icones.js';
import {renduReel, BAISSE} from './realiste.js';
import {poserCiel} from './ciel.js';

export const LUMIERES=[['normale','Normale'],['matin','Matin'],['midi','Midi'],['soir','Soir'],['nuit','Nuit']];
const R={
  normale:{ciel:[0xffffff,0xd9d3c9,2.1],soleil:[0xffffff,1.3,[30,40,10]],appoint:0.5,teinte:0xffffff},
  matin:{ciel:[0xdfe8ff,0xd8c6ad,1.75],soleil:[0xffd2a0,1.5,[40,15,-6]],appoint:0.35,teinte:0xfff0e2},
  midi:{ciel:[0xffffff,0xe2ddd2,2.25],soleil:[0xfffaf0,1.6,[6,50,22]],appoint:0.4,teinte:0xffffff},
  soir:{ciel:[0xffd9bc,0xb39a88,1.45],soleil:[0xff9d55,1.45,[-40,11,6]],appoint:0.28,teinte:0xffc9a0},
  nuit:{ciel:[0x5a6c94,0x231f1c,0.55],soleil:[0x9db2e0,0.18,[-10,40,-20]],appoint:0.06,teinte:0x2a3352}};   // lune, lampes allumées (lampes.js)
let posee=null, cielTeinte=null, reelPose=null, bouton=null;
// bouton « Lumière » de la barre (Mauro, 14 octobre 2026 : « une icône à part ») : son icône dit la lumière choisie, son menu les 5 choix
const ICONE={normale:'sun-dim',matin:'sunrise',midi:'sun',soir:'sunset',nuit:'moon'};
// 4 choix (Mauro, 14 octobre 2026) : retoucher le choix allumé rend la lumière normale (elle reste dans le menu « Affichage »)
for(const b of document.querySelectorAll('#lumiere-menu [data-lumiere]')) b.addEventListener('click',()=>choisirLumiere(etat.lumiere===b.dataset.lumiere?'normale':b.dataset.lumiere));
function majBouton(nom){
  const b=document.getElementById('lumiere'); bouton=nom; if(!b) return;
  poserIcone(b,ICONE[nom]); nommer(b,'Lumière : '+LUMIERES.find(l=>l[0]===nom)[1].toLowerCase()); b.setAttribute('aria-pressed',String(nom!=='normale'));
  for(const x of document.querySelectorAll('#lumiere-menu [data-lumiere]')) x.setAttribute('aria-pressed',String(x.dataset.lumiere===nom));
}
export function majLumiere(){
  const nom=R[etat.lumiere]?etat.lumiere:'normale', reel=renduReel();
  if(nom!==bouton) majBouton(nom);
  // rendu réaliste (realiste.js) : l'éclairage d'ambiance éclaire déjà, les lumières sont baissées d'autant
  if(nom!==posee||reel!==reelPose){ posee=nom; reelPose=reel; const r=R[nom], {hemi,sun,fill}=app.lumieres, k=reel?BAISSE:{ciel:1,soleil:1,appoint:1};
    hemi.color.set(r.ciel[0]); hemi.groundColor.set(r.ciel[1]); hemi.intensity=r.ciel[2]*k.ciel;
    sun.color.set(r.soleil[0]); sun.intensity=r.soleil[1]*k.soleil; sun.position.set(...r.soleil[2]); fill.intensity=r.appoint*k.appoint; cielTeinte=null; }
  // ciel et montagnes (peints, sans éclairage) : teintés une fois qu'ils existent
  if(app.ciel&&cielTeinte!==posee){ cielTeinte=posee;
    app.ciel.traverse(o=>{ if(o.isMesh&&o.material?.isMeshBasicMaterial&&o.material.map&&!o.userData.photo){ o.material.color.set(R[posee].teinte); } });
    poserCiel(posee,R[posee].soleil[2]); }   // vraie photo de ciel (ciel.js, 15 octobre 2026), soleil dans la direction du soleil
}
