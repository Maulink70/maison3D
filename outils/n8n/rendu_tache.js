// Maison3D Rendu : les images sont chez kie.ai (dans l'ordre) ; créer la tâche du modèle choisi (MODELES_RENDU), avec le rappel de
// Familia (clé externe de la galerie, gardée ici dans n8n, jamais dans le site ni dans le dépôt)
const a=$('Analyser').all().map(i=>i.json), r=$input.all().map(i=>i.json), urls=[];
for(let k=0;k<r.length;k++){ const b=r[k].body||{}, u=b&&b.code===200&&b.data&&b.data.downloadUrl;
  if(!u) return [{json:{reponse:{ok:false,erreur:'kie.ai a refusé l’image '+(k+1)+' ('+(b.msg||r[k].statusCode||'?')+')',code:502},req:null}}];
  urls.push(u); }
const {consigne,ratio,titre,modele}=a[0], nombre=a[0].nombre||1, FAMILIA='__FAMILIA__';
// une tâche par rendu demandé (1 à 4), mêmes images ; chacune arrive dans Familia avec son numéro
return Array.from({length:nombre},(_,i)=>{ const corps=(modeleRendu(modele)||MODELES_RENDU[0]).corps(consigne,urls,ratio), t=nombre>1?titre+' ('+(i+1)+'/'+nombre+')':titre;
  if(/^[0-9a-f]{32}$/.test(FAMILIA)) corps.callBackUrl='https://familia-azure.vercel.app/api/callback?x='+FAMILIA+'&src=maison3d&t='+encodeURIComponent(t);
  return {json:{req:{method:'POST',url:'https://api.kie.ai/api/v1/jobs/createTask',body:corps}}}; });
