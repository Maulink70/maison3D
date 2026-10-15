// Curseurs de réglage (15 octobre 2026, demande de Mauro : « un curseur dans le menu afin que je puisse choisir moi la
// quantité de filtre… ça me permettrait de ne pas te demander à chaque fois ») : « Filtre » du menu « Lumière » (un réglage
// par lumière du jour, lumiere.js), et, dans le menu « Réaliste », « Effet » sous « Ombres de contact » (realiste.js), sous
// « Ombres du soleil » (ombres.js) et sous « Lumière précalculée » (cuisson.js). Chaque curseur va de −100 à +100 par pas
// de 5 ; 0 = le réglage d'origine ; à droite l'effet s'accentue, à gauche il s'atténue ; double-clic = retour à 0.
// Valeurs gardées sur l'appareil (clé maison3d-curseurs) ; évènement « curseur » {nom, valeur} à chaque changement.
const CLE='maison3d-curseurs';
let v={};
try{ v=JSON.parse(localStorage.getItem(CLE)||'{}')||{}; }catch{ v={}; }
const borne=x=>Math.max(-100,Math.min(100,Math.round((+x||0)/5)*5));
export const curseur=nom=>borne(v[nom]);
// facteur multiplicatif : 2^(valeur / p) ; p = 100 → ±100 = ×2 / ÷2 ; p = 50 → ×4 / ÷4
export const facteur=(nom,p=100)=>Math.pow(2,curseur(nom)/p);
// filtre de la lumière du jour (menu « Lumière ») : à droite plus sombre (÷4 au bout), à gauche plus clair (×4)
export const filtreLumiere=lumiere=>Math.pow(2,-curseur('filtre_'+(lumiere||'normale'))/50);
export const texteCurseur=val=>val>0?'+'+val:val<0?'−'+(-val):'0';
export function poserCurseur(nom,val){
  v[nom]=borne(val); try{ localStorage.setItem(CLE,JSON.stringify(v)); }catch{}
  majCurseurs(); dispatchEvent(new CustomEvent('curseur',{detail:{nom,valeur:v[nom]}}));
}
// lie un <input type="range"> (et le <output> à côté) à un réglage ; nomDe() donne le nom, qui peut changer (filtre par lumière)
const lies=[];
export function lierCurseur(input,nomDe){
  if(!input) return; const out=input.parentElement?.querySelector('output'); lies.push({input,nomDe,out});
  input.min='-100'; input.max='100'; input.step='5';
  input.addEventListener('input',()=>poserCurseur(nomDe(),+input.value));
  input.addEventListener('dblclick',()=>poserCurseur(nomDe(),0));
  majCurseurs();
}
export function majCurseurs(){ for(const l of lies){ const val=curseur(l.nomDe()); l.input.value=String(val); if(l.out) l.out.textContent=texteCurseur(val); } }
export function initCurseurs(){ for(const i of document.querySelectorAll('input[type=range][data-curseur]')) lierCurseur(i,()=>i.dataset.curseur); }
