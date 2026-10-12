// Maison3D Rendu (étape 5, livraison 2) : rendu réaliste d'une photo de pièce par kie.ai (modèle au choix, MODELES_RENDU, 2K), lancé
// par le site après confirmation (crédits). solde : crédits kie.ai ; demarrer : les images (vraie photo, photo avec les
// changements dessinés, photos des meubles ; 8 au plus) sont envoyées chez kie.ai une par une, puis la tâche est créée
// avec l'adresse de rappel de Familia (la galerie de Mauro y range le rendu, sans rien changer à Familia) ; suivre : état
// de la tâche, et l'image quand elle est prête. Jeton de connexion exigé ; 30 rendus par jour au plus (sécurité).
const it=$input.first().json; let c=it.body;
if(typeof c==='string'){ try{ c=JSON.parse(c); }catch(e){ c=null; } }
const refus=(erreur,code)=>[{json:{op:'refus',reponse:{ok:false,erreur,code:code||400},req:null}}];
if(!c||typeof c!=='object') return refus('Demande illisible');
const moi=lireJeton(c.jeton); if(!moi) return refus('Connexion nécessaire',401);
const RATIOS=['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'];
if(c.action==='solde') return [{json:{op:'solde',req:{method:'GET',url:'https://api.kie.ai/api/v1/chat/credit'}}}];
if(c.action==='demarrer'){
  const im=Array.isArray(c.images)?c.images:[], m=modeleRendu(c.modele||MODELES_RENDU[0].id);
  if(!m) return refus('Modèle inconnu : '+String(c.modele).slice(0,60));
  if(!im.length||im.length>m.max) return refus('Il faut de 1 à '+m.max+' images pour '+m.nom);
  if(im.some(s=>typeof s!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(s)||s.length>12000000)) return refus('Image refusée (png, jpeg ou webp, 9 Mo au plus)');
  if(typeof c.consigne!=='string'||c.consigne.length<10||c.consigne.length>8000) return refus('Consigne manquante ou trop longue');
  const s=$getWorkflowStaticData('global'), jour=new Date().toISOString().slice(0,10);
  if(s.jour!==jour){ s.jour=jour; s.n=0; }
  const nombre=Math.min(4,Math.max(1,Math.round(+c.nombre||1)));   // 1 à 4 rendus des mêmes images (Mauro, 11 octobre 2026)
  if((s.n||0)+nombre>30) return refus((s.n||0)>=30?'Limite de 30 rendus par jour atteinte : réessayez demain.':'Limite de 30 rendus par jour : il en reste '+(30-(s.n||0))+' aujourd’hui.',429);
  s.n=(s.n||0)+nombre;
  const t=Date.now(), ratio=RATIOS.includes(c.ratio)?c.ratio:'4:3', titre=String(c.titre||'Maison3D').replace(/[\u0000-\u001f]/g,' ').slice(0,100);
  return im.map((d,k)=>({json:{op:'demarrer',k,consigne:c.consigne,ratio,titre,qui:moi.n,modele:m.id,nombre,
    req:{method:'POST',url:'https://kieai.redpandaai.co/api/file-base64-upload',body:{base64Data:d,uploadPath:'maison3d-rendus',fileName:'rendu-'+t+'-'+k+'.'+(d.slice(11,15).replace(/[^a-z]/g,'')||'jpg')}}}}));
}
// Créer avec l'IA (12 octobre 2026) : 1 à 4 images d'un objet décrit par le texte, sans image de départ (MODELES_CREER) ;
// 40 créations par jour au plus, compteur à part de celui des rendus ; pas d'envoi dans Familia (ce ne sont pas des rendus)
if(c.action==='creer'){
  const m=modeleCreer(c.modele||MODELES_CREER[0].id); if(!m) return refus('Modèle inconnu : '+String(c.modele).slice(0,60));
  const desc=String(c.description||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,600);
  if(desc.length<3) return refus('Décrivez l’objet à créer');
  const d=c.dims||{}, cm=v=>Number.isFinite(+v)&&+v>0&&+v<2000?Math.round(+v):null, L=cm(d.L), P=cm(d.P), H=cm(d.H);
  const dims=L&&P&&H?L+' × '+P+' × '+H+' cm':'';
  const s=$getWorkflowStaticData('global'), jour=new Date().toISOString().slice(0,10);
  if(s.jourC!==jour){ s.jourC=jour; s.nc=0; }
  const nombre=Math.min(4,Math.max(1,Math.round(+c.nombre||1)));
  if((s.nc||0)+nombre>40) return refus((s.nc||0)>=40?'Limite de 40 créations par jour atteinte : réessayez demain.':'Limite de 40 créations par jour : il en reste '+(40-(s.nc||0))+' aujourd’hui.',429);
  s.nc=(s.nc||0)+nombre;
  const corps=m.corps(consigneCreer(desc,dims));
  return Array.from({length:nombre},()=>({json:{op:'creer',req:{method:'POST',url:'https://api.kie.ai/api/v1/jobs/createTask',body:corps}}}));
}
if(c.action==='suivre'){
  if(typeof c.tache!=='string'||!/^[A-Za-z0-9_-]{6,100}$/.test(c.tache)) return refus('Tâche inconnue');
  return [{json:{op:'suivre',req:{method:'GET',url:'https://api.kie.ai/api/v1/jobs/recordInfo?taskId='+encodeURIComponent(c.tache)}}}];
}
return refus('Action inconnue');
