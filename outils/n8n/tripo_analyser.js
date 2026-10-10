// Maison3D Tripo (étape 4, demande de Mauro du 10 octobre 2026) : un vrai modèle 3D d'après la photo d'un meuble, par
// Tripo (API v3, openapi.tripo3d.ai ; clé Tripo dans n8n, jamais dans la page). solde : crédits restants ; demarrer :
// envoyer la photo (/v3/files) puis créer la tâche image-to-model ; suivre : état et progression, et le modèle GLB
// quand il est prêt (téléchargé aussitôt : son adresse expire en 5 min). Le site demande confirmation avant (crédits).
// Jeton de connexion exigé ; 20 modèles par jour au plus (sécurité).
const it=$input.first().json; let c=it.body;
if(typeof c==='string'){ try{ c=JSON.parse(c); }catch(e){ c=null; } }
const refus=(erreur,code)=>[{json:{reponse:{ok:false,erreur,code:code||400},req:null}}];
if(!c||typeof c!=='object') return refus('Demande illisible');
const moi=lireJeton(c.jeton); if(!moi) return refus('Connexion nécessaire',401);
const API='https://openapi.tripo3d.ai/v3';
if(c.action==='solde') return [{json:{op:'solde',req:{method:'GET',url:API+'/account/balance'}}}];
if(c.action==='demarrer'){
  const m=typeof c.image==='string'&&c.image.length<=14000000&&c.image.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if(!m) return refus('Image refusée (png ou jpeg, 10 Mo au plus)');
  const s=$getWorkflowStaticData('global'), jour=new Date().toISOString().slice(0,10);
  if(s.jour!==jour){ s.jour=jour; s.n=0; }
  if((s.n||0)>=20) return refus('Limite de 20 modèles 3D par jour atteinte : réessayez demain.',429);
  s.n=(s.n||0)+1;
  const ext=m[1]==='png'?'png':'jpg', mime='image/'+m[1], nom='photo-'+Date.now()+'.'+ext;
  let bin; try{ bin=await this.helpers.prepareBinaryData(Buffer.from(m[2],'base64'),nom,mime); }
  catch(e){ bin={data:m[2],mimeType:mime,fileName:nom,fileExtension:ext}; }
  return [{json:{op:'demarrer',qui:moi.n,req:{method:'POST',url:API+'/files'}},binary:{data:bin}}];
}
if(c.action==='suivre'){
  if(typeof c.tache!=='string'||!/^[A-Za-z0-9_-]{6,100}$/.test(c.tache)) return refus('Tâche inconnue');
  return [{json:{op:'suivre',req:{method:'GET',url:API+'/tasks/'+encodeURIComponent(c.tache)}}}];
}
return refus('Action inconnue');
