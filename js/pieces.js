// Pièces de l'appartement (validées par Mauro le 8 octobre 2026) : emprises intérieures mesurées dans le modèle
// (rectangles x0, z0 → x1, z1 en mètres, coupe à 1 m) et point d'arrivée de « Aller à » en 1re personne
// (devant ou juste après la porte, regard vers le point vers, incliné de incl radians vers le bas dans les petites
// pièces). Les points du plan validé qui tombaient dans le débattement d'une porte (salle de bain, WC, chambre,
// dressing, chambre et douche de l'étage) sont décalés d'environ 50 cm vers l'intérieur : la porte qui s'ouvre à
// l'approche passait à travers la caméra.
export const PIECES=[
  {id:'salon',      nom:'Salon',            niveau:'rez',   rects:[[12.87,-21.11,19.44,-14.34]],                              arrivee:[16.6,-20.4],  vers:[16.6,-14.4]},
  {id:'cuisine',    nom:'Cuisine',          niveau:'rez',   rects:[[15.00,-24.93,19.44,-21.11],[13.82,-22.58,15.00,-21.11]], arrivee:[16.0,-21.45], vers:[17.3,-23.2]},
  {id:'entree',     nom:'Entrée',           niveau:'rez',   rects:[[11.45,-22.58,13.82,-21.11]],                              arrivee:[11.75,-21.4], vers:[13.8,-21.4]},
  {id:'degagement', nom:'Dégagement',       niveau:'rez',   rects:[[13.08,-24.93,14.87,-22.58]],                              arrivee:[13.6,-22.9],  vers:[13.9,-24.9]},
  {id:'chambre',    nom:'Chambre',          niveau:'rez',   rects:[[14.88,-27.80,19.44,-25.01],[13.08,-26.03,14.88,-25.01]], arrivee:[14.5,-25.5],  vers:[19.4,-25.9]},
  {id:'sdb',        nom:'Salle de bain',    niveau:'rez',   rects:[[11.31,-27.80,14.75,-26.11],[11.31,-26.11,13.00,-25.01]], arrivee:[12.3,-26.3],  vers:[13.6,-27.4], incl:-0.2},
  {id:'wc',         nom:'WC / buanderie',   niveau:'rez',   rects:[[11.31,-24.20,13.00,-22.66],[11.31,-24.93,12.11,-24.20]], arrivee:[12.55,-23.45],vers:[11.3,-23.6], incl:-0.5},
  {id:'mezzanine',  nom:'Mezzanine',        niveau:'etage', rects:[[14.10,-26.53,16.70,-21.11],[11.45,-22.75,14.10,-21.11]], arrivee:[13.3,-21.6],  vers:[15.4,-23.8]},
  {id:'dressing',   nom:'Dressing',         niveau:'etage', rects:[[11.31,-26.53,13.97,-22.83]],                              arrivee:[13.2,-23.9],  vers:[12.3,-25.6]},
  {id:'chambre_etage',nom:'Chambre de l’étage',niveau:'etage',rects:[[16.78,-26.53,19.44,-22.83]],                           arrivee:[17.5,-23.9],  vers:[18.6,-25.6], incl:-0.15},
  {id:'douche',     nom:'Douche + WC',      niveau:'etage', rects:[[16.78,-22.75,19.44,-21.19]],                              arrivee:[17.75,-22.25],vers:[19.4,-22.0], incl:-0.2},
];

// Surface au sol (m²) et boîte englobante d'une pièce
export const surface=p=>p.rects.reduce((s,[x0,z0,x1,z1])=>s+(x1-x0)*(z1-z0),0);
export function bornes(p){
  const xs=p.rects.flatMap(r=>[r[0],r[2]]), zs=p.rects.flatMap(r=>[r[1],r[3]]);
  return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};
}
// Pièce qui contient un point (x, z) d'un niveau donné, ou null
export function pieceEn(x,z,niveau){
  return PIECES.find(p=>p.niveau===niveau&&p.rects.some(([x0,z0,x1,z1])=>x>=x0&&x<=x1&&z>=z0&&z<=z1))||null;
}
