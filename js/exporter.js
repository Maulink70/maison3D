// Sauvegarde des données Airtable sur l'appareil (Mauro, 11 octobre 2026 : « au cas où un jour je n'ai plus accès ») :
// un seul .zip avec tout ce qui est dans la base Airtable « Maison3D » : variantes (dispositions, objets ajoutés, sols et
// murs), vues, mesures, historique complet, photos des pièces (calages, vignettes), rendus, et les fichiers (photos,
// images des rendus, modèles 3D et images des objets ajoutés). PAS la maquette elle-même (site et modèle 3D : GitHub), ni
// les comptes (mots de passe). donnees.json est lisible par Claude Code pour tout remettre en place ailleurs.
import {appel, moi} from './api.js';
import {lireFichier} from './fichiers.js';

const EXT={'image/jpeg':'jpg','image/webp':'webp','image/png':'png','model/gltf-binary':'glb'};
const propre=t=>String(t||'sans nom').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80)||'sans nom';
const deux=n=>String(n).padStart(2,'0');

// lit toutes les pages d'une liste (photos, rendus, historique)
async function toutLire(action,donnees,cle){
  const l=[]; let offset=null;
  do{ const r=await appel(action,{...donnees,...(offset?{offset}:{})});
    if(!r.ok) throw new Error(r.horsLigne?'Pas de connexion au serveur.':(r.erreur||'Lecture impossible ('+action+')'));
    l.push(...(r[cle]||[])); offset=r.offset||null;
  }while(offset);
  return l;
}

// dire(texte) : où en est la sauvegarde ; renvoie {nom, octets, manquants}
export async function sauvegarderDonnees(dire=()=>{}){
  dire('Lecture des variantes, vues et mesures…');
  const c=await appel('charger');
  if(!c.ok) throw new Error(c.horsLigne?'Pas de connexion au serveur : la sauvegarde est impossible hors connexion.':(c.erreur||'Lecture impossible'));
  const variantes=c.variantes||[];
  const historique={};
  for(const [k,v] of variantes.entries()){ dire(`Historique : variante ${k+1} / ${variantes.length}…`);
    historique[v.id]=await toutLire('historique',{variante:v.id,tout:true},'lignes'); }
  dire('Lecture des photos et des rendus…');
  const photos=await toutLire('photo',{op:'liste'},'photos'), rendus=await toutLire('rendu',{op:'liste'},'rendus');

  // fichiers à joindre (une seule fois chacun) : photos, rendus, objets ajoutés des variantes
  const fichiers=new Map(), noms=new Set();
  const noter=(f,dossier,nom)=>{ if(!f?.id||fichiers.has(f.id)) return;
    let n=propre(nom), k=2; const ext=EXT[f.type]||(dossier==='objets'&&!f.type?'glb':'bin');
    while(noms.has(dossier+'/'+n+'.'+ext)) n=propre(nom)+' ('+(k++)+')';
    noms.add(dossier+'/'+n+'.'+ext); fichiers.set(f.id,{id:f.id,n:f.n||1,type:f.type||(ext==='glb'?'model/gltf-binary':''),chemin:`fichiers/${dossier}/${n}.${ext}`}); };
  for(const p of photos) noter(p.image,'photos',p.nom);
  for(const r of rendus){ noter(r.image,'rendus',r.titre||'rendu'); noter(r.avant,'photos','photo de départ de '+(r.titre||'rendu')); }
  for(const v of variantes) for(const [nom,e] of Object.entries(v.disposition||{})){ const a=e?.a; if(!a) continue;
    if(a.fic) noter({...a.fic,type:'model/gltf-binary'},'objets',a.n||nom);
    if(a.img) noter(a.img,'objets',(a.n||nom)+' (image)'); }

  const zip={}, manquants=[], liste=[...fichiers.values()]; let lus=0, octets=0;
  const lire=async f=>{ const b=await lireFichier(f.id,f.n,f.type);
    if(b&&b.size){ zip[f.chemin]=[new Uint8Array(await b.arrayBuffer()),{level:0}]; f.taille=b.size; octets+=b.size; }
    else { f.manque=true; manquants.push(f.chemin); }
    dire(`Fichiers : ${++lus} / ${liste.length} (${(octets/1048576).toFixed(0)} Mo)…`); };
  for(let i=0;i<liste.length;i+=3) await Promise.all(liste.slice(i,i+3).map(lire));   // trois à la fois

  const d=new Date(), quand=`${deux(d.getDate())}/${deux(d.getMonth()+1)}/${d.getFullYear()} à ${deux(d.getHours())}:${deux(d.getMinutes())}`;
  const donnees={application:'Maison3D',contenu:'Données de la base Airtable « Maison3D » (sans la maquette ni les mots de passe)',version:1,date:d.toISOString(),par:moi(),
    variantes,vues:c.vues||[],mesures:c.mesures||[],historique,photos,rendus,
    fichiers:Object.fromEntries(liste.map(f=>[f.id,{chemin:f.chemin,type:f.type,morceaux:f.n,taille:f.taille||0,...(f.manque?{manque:true}:{})}]))};
  const lisez=['Sauvegarde des données Maison3D (base Airtable « Maison3D »)',`Faite le ${quand} par ${moi()}.`,'',
    'Ce fichier contient SEULEMENT les données enregistrées dans Airtable :',
    `- ${variantes.length} variante(s) : disposition des meubles, objets ajoutés, sols et murs ;`,
    `- ${(c.vues||[]).length} vue(s) enregistrée(s), ${(c.mesures||[]).length} mesure(s), l'historique de chaque variante ;`,
    `- ${photos.length} photo(s) des pièces et leurs calages, ${rendus.length} rendu(s), les fichiers des objets ajoutés (modèles 3D, images).`,'',
    'Il ne contient PAS la maquette elle-même (le site et le modèle 3D de l\'appartement) : elle est sur GitHub,',
    'https://github.com/Maulink70/maison3D → bouton vert « Code » → « Download ZIP ».','',
    'Les mots de passe des comptes et les clés d\'accès (Airtable, kie.ai, Tripo, Sketchfab) ne sont pas dans la sauvegarde.','',
    'Contenu :','- donnees.json : toutes les données (Claude Code peut s\'en servir pour tout remettre en place) ;',
    '- fichiers/photos, fichiers/rendus, fichiers/objets : les fichiers.',
    ...(manquants.length?['',`Fichiers introuvables au moment de la sauvegarde (${manquants.length}) :`,...manquants.map(m=>'- '+m)]:[])].join('\r\n');
  dire('Création du fichier .zip…');
  const {zipSync,strToU8}=await import('three/addons/libs/fflate.module.js');
  zip['LISEZMOI.txt']=[strToU8(lisez),{level:6}]; zip['donnees.json']=[strToU8(JSON.stringify(donnees,null,1)),{level:6}];
  const blob=new Blob([zipSync(zip)],{type:'application/zip'});
  const nom=`Maison3D-donnees-Airtable-${d.getFullYear()}-${deux(d.getMonth()+1)}-${deux(d.getDate())}.zip`;
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nom; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);
  return {nom,octets:blob.size,manquants,variantes:variantes.length,photos:photos.length,rendus:rendus.length,fichiers:liste.length};
}
