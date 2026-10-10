// Maison3D IA (étape 4, livraison 2) : nettoyage d'une photo de meuble par kie.ai (Nano Banana Pro), sur demande du site
// seulement (le site demande confirmation avant : crédits). demarrer : envoyer l'image chez kie.ai puis créer la tâche ;
// suivre : lire l'état de la tâche, et l'image nettoyée quand elle est prête. Jeton de connexion exigé ; 40 nettoyages
// par jour au plus (sécurité).
const it=$input.first().json; let c=it.body;
if(typeof c==='string'){ try{ c=JSON.parse(c); }catch(e){ c=null; } }
const refus=(erreur,code)=>[{json:{reponse:{ok:false,erreur,code:code||400},req:null}}];
if(!c||typeof c!=='object') return refus('Demande illisible');
const moi=lireJeton(c.jeton); if(!moi) return refus('Connexion nécessaire',401);
const RATIOS=['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'];
if(c.action==='demarrer'){
  if(typeof c.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(c.image)||c.image.length>9000000) return refus('Image refusée (png, jpeg ou webp, 6 Mo au plus)');
  const s=$getWorkflowStaticData('global'), jour=new Date().toISOString().slice(0,10);
  if(s.jour!==jour){ s.jour=jour; s.n=0; }
  if((s.n||0)>=40) return refus('Limite de 40 nettoyages par jour atteinte : réessayez demain.',429);
  s.n=(s.n||0)+1;
  const ext=c.image.slice(11,15).replace(/[^a-z]/g,'')||'png';
  return [{json:{op:'demarrer',quoi:String(c.quoi||'').replace(/[^\p{L}\p{N} '’,.-]/gu,'').slice(0,60),ratio:RATIOS.includes(c.ratio)?c.ratio:'1:1',qui:moi.n,
    req:{method:'POST',url:'https://kieai.redpandaai.co/api/file-base64-upload',body:{base64Data:c.image,uploadPath:'maison3d',fileName:'photo-'+Date.now()+'.'+ext}}}}];
}
if(c.action==='suivre'){
  if(typeof c.tache!=='string'||!/^[A-Za-z0-9_-]{6,100}$/.test(c.tache)) return refus('Tâche inconnue');
  return [{json:{op:'suivre',req:{method:'GET',url:'https://api.kie.ai/api/v1/jobs/recordInfo?taskId='+encodeURIComponent(c.tache)}}}];
}
return refus('Action inconnue');
