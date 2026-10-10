// Fichiers des objets ajoutés (étape 4, livraison 2) : photos (panneau photo) et modèles 3D (.glb), rangés dans la table
// « Fichiers » de la base Airtable Maison3D, par n8n : une ligne (action fichier/creer), puis le contenu par morceaux de
// 4,5 Mo au plus (fichier/contenu ; Airtable n'accepte pas plus de 5 Mo par envoi). Relecture : workflow n8n « Maison3D
// Fichiers » (les adresses des pièces jointes Airtable expirent et ne sont pas lisibles depuis la page), gardée ensuite
// dans le cache du navigateur (Cache Storage « maison3d-fichiers ») : chaque fichier n'est téléchargé qu'une fois.
import {appel, connecte} from './api.js';

const LIRE='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-fichier', CACHE='maison3d-fichiers', MORCEAU=4.5*1024*1024;
const cle=(id,k)=>new Request(location.origin+'/__fichiers/'+id+'/'+k);
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };
const base64=b=>new Promise((ok,ko)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(',')[1]||''); r.onerror=ko; r.readAsDataURL(b); });
async function garder(id,k,b){ try{ const c=await caches.open(CACHE); await c.put(cle(id,k),new Response(b,{headers:{'Content-Type':b.type||'application/octet-stream'}})); }catch{} }

// envoie un fichier ; renvoie {id, n (morceaux)} ou {erreur}
export async function envoyerFichier(blob,{nom,type}){
  if(!connecte()) return {erreur:'Connectez-vous pour ajouter un objet.'};
  const n=Math.max(1,Math.ceil(blob.size/MORCEAU));
  if(n>8) return {erreur:'Fichier trop lourd (plus de 36 Mo, même allégé).'};
  const c=await appel('fichier',{op:'creer',nom,type,taille:blob.size});
  if(!c.ok) return {erreur:c.horsLigne?'Hors connexion : l’objet pourra être ajouté au retour du réseau.':(c.erreur||'Envoi impossible')};
  for(let k=0;k<n;k++){
    const part=blob.slice(k*MORCEAU,(k+1)*MORCEAU,blob.type);
    const r=await appel('fichier',{op:'contenu',id:c.id,part:k,type:blob.type||'application/octet-stream',nom,donnees:await base64(part)});
    if(!r.ok) return {erreur:r.horsLigne?'Hors connexion pendant l’envoi : réessayez.':(r.erreur||'Envoi impossible')};
    await garder(c.id,k,part);
  }
  return {id:c.id,n};
}
// relit un fichier (cache du navigateur, sinon n8n) ; renvoie un Blob ou null
const enCours=new Map();
export function lireFichier(id,n=1,type=''){
  const k0=id+':'+n; if(enCours.has(k0)) return enCours.get(k0);
  const p=(async()=>{
    const parts=[]; let c=null; try{ c=await caches.open(CACHE); }catch{}
    for(let k=0;k<n;k++){
      let b=null; try{ const r=await c?.match(cle(id,k)); if(r) b=await r.blob(); }catch{}
      if(!b){ try{ const r=await fetch(LIRE+'?id='+encodeURIComponent(id)+'&p='+k+'&j='+encodeURIComponent(jeton()),{cache:'no-store'});
          if(!r.ok||/json/.test(r.headers.get('Content-Type')||'')) return null; b=await r.blob(); await garder(id,k,b); }catch{ return null; } }
      parts.push(b);
    }
    return new Blob(parts,{type:type||parts[0]?.type||''});
  })();
  enCours.set(k0,p); p.then(b=>{ if(!b) enCours.delete(k0); }); return p;
}
