// Lumière du jour (étape 2) : Normale, Matin, Midi, Soir, Nuit (menu « Calques », groupe Affichage, choix mémorisé avec les
// calques) : direction, couleur et force du soleil, lumière d'ambiance (ciel et sol), teinte du ciel et des montagnes en
// 1re personne. Sans ombres portées (trop lourdes pour la tablette) : la lumière change la teinte et l'éclairage des faces.
// Nord = −z (haut du plan) : soleil à l'est (+x) le matin, au sud (+z) et haut à midi, à l'ouest (−x) et bas le soir.
import * as THREE from 'three';
import {app} from './app.js';
import {etat} from './calques.js';

export const LUMIERES=[['normale','Normale'],['matin','Matin'],['midi','Midi'],['soir','Soir'],['nuit','Nuit']];
const R={
  normale:{ciel:[0xffffff,0xd9d3c9,2.1],soleil:[0xffffff,1.3,[30,40,10]],appoint:0.5,teinte:0xffffff},
  matin:{ciel:[0xdfe8ff,0xd8c6ad,1.75],soleil:[0xffd2a0,1.5,[40,15,-6]],appoint:0.35,teinte:0xfff0e2},
  midi:{ciel:[0xffffff,0xe2ddd2,2.25],soleil:[0xfffaf0,1.6,[6,50,22]],appoint:0.4,teinte:0xffffff},
  soir:{ciel:[0xffd9bc,0xb39a88,1.45],soleil:[0xff9d55,1.45,[-40,11,6]],appoint:0.28,teinte:0xffc9a0},
  nuit:{ciel:[0x5a6c94,0x231f1c,0.55],soleil:[0x9db2e0,0.18,[-10,40,-20]],appoint:0.06,teinte:0x2a3352}};   // lune, lampes allumées (lampes.js)
let posee=null, cielTeinte=null;
export function majLumiere(){
  const nom=R[etat.lumiere]?etat.lumiere:'normale';
  if(nom!==posee){ posee=nom; const r=R[nom], {hemi,sun,fill}=app.lumieres;
    hemi.color.set(r.ciel[0]); hemi.groundColor.set(r.ciel[1]); hemi.intensity=r.ciel[2];
    sun.color.set(r.soleil[0]); sun.intensity=r.soleil[1]; sun.position.set(...r.soleil[2]); fill.intensity=r.appoint; cielTeinte=null; }
  // ciel et montagnes (peints, sans éclairage) : teintés une fois qu'ils existent
  if(app.ciel&&cielTeinte!==posee){ cielTeinte=posee;
    app.ciel.traverse(o=>{ if(o.isMesh&&o.material?.isMeshBasicMaterial&&o.material.map){ o.material.color.set(R[posee].teinte); } }); }
}
