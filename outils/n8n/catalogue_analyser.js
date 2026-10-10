// Maison3D Catalogue (étape 4, livraison 3) : téléchargements Sketchfab avec la clé de Mauro (dans n8n, jamais dans la
// page ; la recherche, publique, est faite par le site). verifier : la clé est-elle acceptée (gratuit) ; telecharger {id} :
// adresse temporaire du .glb du modèle ; fichier {url} : ce .glb relu par n8n quand le navigateur ne peut pas le lire
// directement. Jeton de connexion exigé ; 60 téléchargements par jour au plus (sécurité).
const it=$input.first().json; let c=it.body;
if(typeof c==='string'){ try{ c=JSON.parse(c); }catch(e){ c=null; } }
const refus=(erreur,code)=>[{json:{reponse:{ok:false,erreur,code:code||400},req:null}}];
if(!c||typeof c!=='object') return refus('Demande illisible');
const moi=lireJeton(c.jeton); if(!moi) return refus('Connexion nécessaire',401);
const SF='https://api.sketchfab.com/v3';
if(c.action==='verifier') return [{json:{op:'verifier',req:{method:'GET',url:SF+'/me'}}}];
if(c.action==='telecharger'){
  if(typeof c.id!=='string'||!/^[0-9a-f]{32}$/.test(c.id)) return refus('Modèle inconnu');
  const s=$getWorkflowStaticData('global'), jour=new Date().toISOString().slice(0,10);
  if(s.jour!==jour){ s.jour=jour; s.n=0; }
  if((s.n||0)>=60) return refus('Limite de 60 téléchargements par jour atteinte : réessayez demain.',429);
  s.n=(s.n||0)+1;
  return [{json:{op:'telecharger',req:{method:'GET',url:SF+'/models/'+c.id+'/download'}}}];
}
if(c.action==='fichier'){
  if(typeof c.url!=='string'||!/^https:\/\/[a-z0-9.-]*sketchfab[a-z0-9.-]*\//i.test(c.url)||c.url.length>4000) return refus('Adresse refusée');
  return [{json:{op:'fichier',url:c.url,req:{}}}];
}
return refus('Action inconnue');
