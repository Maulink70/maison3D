// Barre d'icônes (demande de Mauro du 9 octobre 2026, style A « trait fin » choisi sur la page de propositions) : chaque
// bouton de la barre porte une icône au trait (attribut data-icone) ; son nom est dans aria-label, montré en infobulle :
// au survol de la souris (après 0,35 s, aussitôt d'un bouton à l'autre), au clavier, et sur tablette en gardant le doigt
// appuyé 0,45 s (le nom s'affiche et le bouton n'agit pas au relâcher). Dessins Lucide 0.460.0 (licence ISC), recopiés
// ici : aucun fichier à télécharger. Niveaux Tout / Rez / Étage : maison à deux étages, le niveau affiché rempli.
const LUCIDE={
  'circle-user-round':'<path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/>',
  'files':'<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
  'git-compare':'<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
  'armchair':'<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  'bookmark':'<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  'box':'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  'door-closed':'<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/>',
  'door-open':'<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
  'download':'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'drafting-compass':'<path d="m12.99 6.74 1.93 3.44"/><path d="M19.136 12a10 10 0 0 1-14.271 0"/><path d="m21 21-2.16-3.84"/><path d="m3 21 8.02-14.26"/><circle cx="12" cy="5" r="2"/>',
  'eye':'<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  'footprints':'<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
  'maximize':'<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  'minimize':'<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  'save':'<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  'gamepad-2':'<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  'shopping-bag':'<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  'table':'<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  'camera':'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  'images':'<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>',
  'image':'<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  'layers':'<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  'map':'<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  'navigation':'<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  'pencil':'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  'printer':'<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  'radar':'<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>',
  'ruler':'<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  'plus':'<path d="M5 12h14"/><path d="M12 5v14"/>',
  'rotate-cw':'<path d="M20 12.5a8 8 0 1 1-5.26-7.52" stroke-width="2.4"/><path d="M18.1 6.2 13.4 8.3l1.9-5.6z" fill="currentColor" stroke-width="1.2"/>',
  'blinds':'<path d="M3 3h18"/><path d="M20 7H8"/><path d="M20 11H8"/><path d="M10 19h10"/><path d="M8 15h12"/><path d="M4 3v14"/><circle cx="4" cy="19" r="2"/>',
  'lightbulb':'<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  'lightbulb-off':'<path d="M16.8 11.2c.8-.9 1.2-2 1.2-3.2a6 6 0 0 0-9.8-4.6"/><path d="M6.3 6.3a4.67 4.67 0 0 0 1.2 5.2c.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/><path d="m2 2 20 20"/>',
  'monitor':'<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  'library':'<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
  'folder':'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  'shapes':'<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  'link':'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'message-square':'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'sun-dim':'<circle cx="12" cy="12" r="4"/><path d="M12 4h.01"/><path d="M20 12h.01"/><path d="M12 20h.01"/><path d="M4 12h.01"/><path d="M17.657 6.343h.01"/><path d="M17.657 17.657h.01"/><path d="M6.343 17.657h.01"/><path d="M6.343 6.343h.01"/>',
  'sunrise':'<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  'sunset':'<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  'moon':'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  'sparkles':'<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  'wind':'<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
};
// maison à deux étages : toit, étage (haut), rez (bas) ; « Tout » remplit les deux
const niveau=k=>`<path d="M2 10.5 12 2.5l10 8"/><rect x="4" y="10" width="16" height="5.5" rx="1"${k!=='rez'?' class="plein"':''}/>`+
  `<rect x="4" y="15.5" width="16" height="6" rx="1"${k!=='etage'?' class="plein"':''}/>`;
// points de vue des photos : repère de lieu (Lucide map-pin) avec un petit appareil photo dedans
const pinPhoto='<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>'+
  '<rect x="8.3" y="8.2" width="7.4" height="5.2" rx="1"/><circle cx="12" cy="10.8" r="1.3"/><path d="M10.6 8.2l.6-1.1h1.6l.6 1.1"/>';
// stores remontés (ouverts) : le store « blinds » de Lucide replié sous son caisson
const storeOuvert='<path d="M3 3h18"/><path d="M20 6H8"/><path d="M20 9H8"/><path d="M4 3v14"/><circle cx="4" cy="19" r="2"/>';
const DESSINS={...LUCIDE,'niv-tout':niveau('tout'),'niv-rez':niveau('rez'),'niv-etage':niveau('etage'),'pin-photo':pinPhoto,'store-ouvert':storeOuvert};
export const svg=nom=>nom==='assistant'?'<img class="ico ico-avatar" src="icones/assistant-tete.webp" alt="" aria-hidden="true">':`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${DESSINS[nom]||''}</svg>`;

let bulle=null, cible=null, attente=null, minuterie=0, avaler=null, finAvaler=0, vueA=0;
// change l'icône d'un bouton (porte ouverte / fermée…)
export function poserIcone(b,nom){ if(b.dataset.icone===nom&&b.firstElementChild) return; b.dataset.icone=nom; const s=b.querySelector('svg.ico'); if(s) s.outerHTML=svg(nom); else b.insertAdjacentHTML('afterbegin',svg(nom)); }
// change le nom d'un bouton (infobulle et lecteurs d'écran), aussi pendant que l'infobulle est affichée
export function nommer(b,nom){ b.setAttribute('aria-label',nom); if(cible===b&&bulle&&!bulle.hidden) bulle.textContent=nom; }

function montrer(b){
  if(b.hasAttribute('aria-haspopup')&&b.getAttribute('aria-expanded')==='true') return;   // son menu est ouvert : l'infobulle le couvrirait
  cible=b; bulle.textContent=b.getAttribute('aria-label')||''; bulle.hidden=false;
  const r=b.getBoundingClientRect(), w=bulle.offsetWidth;
  bulle.style.left=Math.round(Math.max(8,Math.min(innerWidth-8-w,r.left+r.width/2-w/2)))+'px';
  bulle.style.top=Math.round(r.bottom+8)+'px';
}
function cacher(){ clearTimeout(minuterie); attente=null; if(bulle&&!bulle.hidden){ bulle.hidden=true; vueA=performance.now(); } cible=null; }
const bouton=e=>{ const b=e.target instanceof Element?e.target.closest('button.ib[aria-label]'):null; return b&&!b.closest('.menu-choix')?b:null; };   // menus « Ouvrir » et « Lumière » : le nom est déjà écrit

export function initIcones(){
  for(const b of document.querySelectorAll('button[data-icone]')) b.insertAdjacentHTML('afterbegin',svg(b.dataset.icone));
  // barre du haut : le nom sous l'icône, montré sur PC seulement (Mauro, 12 octobre 2026 ; css : .ib-nom) : le nom court
  // choisi par Mauro (data-nom), sinon aria-label ; l'infobulle garde le nom complet (aria-label) ; data-sans-nom : l'image seule
  // (assistant : son visage suffit, Mauro, 12 octobre 2026)
  const nomCourt=b=>b.dataset.nom||b.getAttribute('aria-label')||'';
  const suivre=new MutationObserver(l=>{ for(const m of l){ const n=m.target.querySelector(':scope > .ib-nom'); if(n) n.textContent=nomCourt(m.target); } });
  for(const b of document.querySelectorAll('header.bar button.ib[data-icone]:not([data-sans-nom])')){
    const n=document.createElement('span'); n.className='ib-nom'; n.textContent=nomCourt(b); b.append(n);
    suivre.observe(b,{attributes:true,attributeFilter:['aria-label','data-nom']}); }
  bulle=document.createElement('div'); bulle.id='infobulle'; bulle.setAttribute('role','tooltip'); bulle.hidden=true; document.body.append(bulle);
  // souris : survol
  addEventListener('pointerover',e=>{ if(e.pointerType!=='mouse') return; const b=bouton(e); if(!b||b===cible||b===attente) return;
    const deja=!bulle.hidden||performance.now()-vueA<400; cacher(); if(deja) montrer(b); else { attente=b; minuterie=setTimeout(()=>{ attente=null; montrer(b); },350); } });
  addEventListener('pointerout',e=>{ if(e.pointerType!=='mouse') return; const b=bouton(e); if(b&&!b.contains(e.relatedTarget)) cacher(); });
  // doigt : appui long = nom affiché, sans agir
  addEventListener('pointerdown',e=>{ cacher(); if(e.pointerType==='mouse') return; const b=bouton(e); if(!b) return;
    minuterie=setTimeout(()=>{ montrer(b); avaler=b; },450); },true);
  const relacher=()=>{ clearTimeout(minuterie); if(avaler){ finAvaler=performance.now()+800; setTimeout(cacher,1500); } };
  addEventListener('pointerup',relacher,true); addEventListener('pointercancel',relacher,true);
  addEventListener('click',e=>{ if(!avaler) return; const b=avaler; avaler=null;
    if(performance.now()<finAvaler&&b.contains(e.target)){ e.preventDefault(); e.stopPropagation(); } },true);
  addEventListener('contextmenu',e=>{ if(bouton(e)) e.preventDefault(); },true);
  // clavier
  addEventListener('focusin',e=>{ const b=bouton(e); if(b&&b.matches(':focus-visible')) montrer(b); });
  addEventListener('focusout',e=>{ if(bouton(e)) cacher(); });
  addEventListener('resize',cacher); addEventListener('keydown',e=>{ if(e.key==='Escape') cacher(); });
}
