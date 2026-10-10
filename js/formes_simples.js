// Formes simples paramétrables (étape 4, livraison 1) : boîte, table, table ronde, étagère, armoire, lit, canapé, chaise,
// tapis, cylindre. Chaque forme est construite à ses dimensions (L largeur, P profondeur, H hauteur, en mètres ; repère
// propre : origine au centre du dessous, avant vers +z), en parties nommées (plateau, pieds…) dont la matière se choisit
// dans la bibliothèque. Une partie = un matériau nommé par sa clé : une seule géométrie par partie (fusionner).
import * as THREE from 'three';
import {boite, cylindre, fusionner} from './formes.js';
import {materiau} from './bibliotheque.js';
import {poserCoordonnees} from './matieres.js';

// options : [clé, libellé, type ('n' nombre entier, 'oui' case), min, max]
export const FORMES={
  boite:{nom:'Boîte',L:0.8,P:0.5,H:0.8,parties:{corps:['Boîte','mat-blanc']}},
  table:{nom:'Table',L:1.6,P:0.9,H:0.75,parties:{plateau:['Plateau','chene'],pieds:['Pieds','metal-noir']}},
  table_ronde:{nom:'Table ronde',L:1.1,P:1.1,H:0.75,rond:true,parties:{plateau:['Plateau','chene-clair'],pied:['Pied','metal-noir']}},
  etagere:{nom:'Étagère',L:0.8,P:0.3,H:1.8,options:[['n','Nombre de tablettes','n',2,12,5],['dos','Fond','oui',0,1,1]],parties:{caisson:['Caisson','chene-clair']}},
  armoire:{nom:'Armoire',L:1.2,P:0.6,H:2.0,options:[['portes','Nombre de portes','n',1,6,2]],parties:{caisson:['Caisson','mat-blanc'],portes:['Portes','laque-blanc'],poignees:['Poignées','inox']}},
  lit:{nom:'Lit',L:1.6,P:2.1,H:1.0,parties:{cadre:['Cadre','chene'],tete:['Tête de lit','lin'],matelas:['Matelas','toile'],linge:['Couette et oreillers','lin']}},
  canape:{nom:'Canapé',L:2.2,P:0.9,H:0.8,options:[['accoudoirs','Accoudoirs','oui',0,1,1]],parties:{structure:['Structure','toile'],coussins:['Coussins','toile'],pieds:['Pieds','chene']}},
  chaise:{nom:'Chaise',L:0.45,P:0.5,H:0.85,parties:{assise:['Assise et dossier','chene'],pieds:['Pieds','chene']}},
  tapis:{nom:'Tapis',L:2.0,P:1.4,H:0.015,parties:{tapis:['Tapis','bouclette']}},
  cylindre:{nom:'Cylindre (pot, pouf, lampe)',L:0.4,P:0.4,H:0.6,rond:true,parties:{corps:['Corps','ceramique']}}
};
// couleurs de départ qui changent de celles de la matière (coussins un ton plus clair, linge bleu clair…)
const TEINTE={canape:{structure:'#8c8f93',coussins:'#a9acb0'},lit:{tete:'#b9b2a5',matelas:'#f4f2ee',linge:'#c9d6e4'}};

// paramètres complets d'une forme (valeurs par défaut pour ce qui manque)
export function parametres(f,p={}){ const d=FORMES[f], r={L:+p.L||d.L,P:+p.P||d.P,H:+p.H||d.H};
  for(const [k,,type,min,max,def] of d.options||[]) r[k]=type==='oui'?(p[k]===undefined?def:+!!p[k]):Math.round(Math.min(max,Math.max(min,+p[k]||def)));
  if(d.rond) r.P=r.L; return r; }

// Construit la forme dans un groupe (repère propre). Renvoie le groupe et les noms des parties.
export function construireForme(f,p){
  const d=FORMES[f], q=parametres(f,p), g=new THREE.Group(), mats={};
  for(const [k,[,mat]] of Object.entries(d.parties)){ const m=materiau({i:mat,c:TEINTE[f]?.[k]||null}); m.name=k; mats[k]=m; }
  const {L,P,H}=q, x0=-L/2, x1=L/2, z0=-P/2, z1=P/2, M=mats;
  const pieds4=(e,h,ins,mat,rond)=>{ for(const [x,z] of [[x0+ins,z0+ins],[x1-ins,z0+ins],[x0+ins,z1-ins],[x1-ins,z1-ins]])
    rond?cylindre(g,x,0,h,z,e/2,mat,e/2,12):boite(g,x-e/2,x+e/2,0,h,z-e/2,z+e/2,mat); };
  switch(f){
    case 'boite': boite(g,x0,x1,0,H,z0,z1,M.corps); break;
    case 'table': boite(g,x0,x1,H-0.03,H,z0,z1,M.plateau); pieds4(0.05,H-0.03,0.07,M.pieds); break;
    case 'table_ronde': cylindre(g,0,H-0.03,H,0,L/2,M.plateau,L/2,48); cylindre(g,0,0.02,H-0.03,0,0.04,M.pied,0.04,16);
      cylindre(g,0,0,0.02,0,Math.min(0.28,L/3),M.pied,Math.min(0.28,L/3),32); break;
    case 'etagere': { const e=0.02;
      boite(g,x0,x0+e,0,H,z0,z1,M.caisson); boite(g,x1-e,x1,0,H,z0,z1,M.caisson);
      for(let k=0;k<q.n;k++){ const y=k===0?0.04:k===q.n-1?H-e:0.04+(H-e-0.04)*k/(q.n-1); boite(g,x0+e,x1-e,y,y+e,z0,z1,M.caisson); }
      boite(g,x0+e,x1-e,0,0.04,z1-0.03,z1-0.01,M.caisson);
      if(q.dos) boite(g,x0+e,x1-e,0.04,H-e,z0,z0+0.008,M.caisson); break; }
    case 'armoire': { const socle=0.08, ep=0.02, n=q.portes, jeu=0.003, lp=(L-jeu*(n+1))/n;
      boite(g,x0,x1,socle,H,z0,z1-ep,M.caisson); boite(g,x0+0.03,x1-0.03,0,socle,z0+0.03,z1-ep-0.03,M.caisson);
      for(let k=0;k<n;k++){ const a=x0+jeu+k*(lp+jeu), b=a+lp; boite(g,a,b,socle+0.005,H-0.005,z1-ep,z1,M.portes,true);
        const cote=n===1?1:k%2?-1:1, xp=cote>0?b-0.05:a+0.05, hp=Math.min(0.35,H*0.18), yp=Math.min(1.1,H*0.55);
        boite(g,xp-0.006,xp+0.006,yp-hp/2,yp+hp/2,z1,z1+0.025,M.poignees); } break; }
    case 'lit': { const hc=0.3, hm=0.5;
      boite(g,x0,x1,0.06,hc,z0+0.08,z1,M.cadre); pieds4(0.05,0.06,0.06,M.cadre,true);
      boite(g,x0,x1,0.06,Math.max(H,hm+0.15),z0,z0+0.08,M.tete);
      boite(g,x0+0.03,x1-0.03,hc,hm,z0+0.1,z1-0.02,M.matelas);
      boite(g,x0+0.01,x1-0.01,hm,hm+0.06,z0+0.62,z1-0.01,M.linge);
      const no=L>=1.2?2:1, lo=Math.min(0.62,(L-0.16)/no-0.04);
      for(let k=0;k<no;k++){ const c=x0+L*(k+0.5)/no; boite(g,c-lo/2,c+lo/2,hm,hm+0.12,z0+0.13,z0+0.5,M.linge); } break; }
    case 'canape': { const acc=q.accoudoirs?0.18:0, hp=0.1, hb=0.4, hs=0.52, dd=0.2;
      pieds4(0.04,hp,0.06,M.pieds,true);
      boite(g,x0,x1,hp,hb,z0,z1,M.structure); boite(g,x0,x1,hb,H,z0,z0+dd,M.structure);
      if(acc){ boite(g,x0,x0+acc,hb,0.62,z0+dd,z1,M.structure); boite(g,x1-acc,x1,hb,0.62,z0+dd,z1,M.structure); }
      const li=L-2*acc, nc=li>1.6?3:li>0.9?2:1;
      for(let k=0;k<nc;k++){ const a=x0+acc+li*k/nc+0.005, b=x0+acc+li*(k+1)/nc-0.005; boite(g,a,b,hb,hs,z0+dd,z1-0.02,M.coussins,true);
        boite(g,a,b,hs,Math.min(H-0.03,hs+0.4),z0+dd,z0+dd+0.16,M.coussins,true); } break; }
    case 'chaise': { const hs=Math.min(0.46,H*0.55), e=0.03;
      boite(g,x0,x1,hs-0.03,hs,z0,z1,M.assise); boite(g,x0+0.01,x1-0.01,hs,H,z0,z0+0.025,M.assise);
      pieds4(e,hs-0.03,0.025,M.pieds); break; }
    case 'tapis': boite(g,x0,x1,0,H,z0,z1,M.tapis); break;
    case 'cylindre': cylindre(g,0,0,H,0,L/2,M.corps,L/2,32); break;
  }
  fusionner(g); poserCoordonnees(g);   // une géométrie par partie ; coordonnées de texture en mètres
  const noms={}; for(const [k,[n]] of Object.entries(d.parties)) noms[k]=n;
  return {g,noms,taille:new THREE.Vector3(L,f==='lit'?Math.max(H,0.65):H,P)};
}
