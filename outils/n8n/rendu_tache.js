// Maison3D Rendu : les images sont chez kie.ai (dans l'ordre) ; créer la tâche du modèle choisi (MODELES_RENDU), avec le rappel de
// Familia (clé externe de la galerie, gardée ici dans n8n, jamais dans le site ni dans le dépôt)
const a=$('Analyser').all().map(i=>i.json), r=$input.all().map(i=>i.json), urls=[];
for(let k=0;k<r.length;k++){ const b=r[k].body||{}, u=b&&b.code===200&&b.data&&b.data.downloadUrl;
  if(!u) return [{json:{reponse:{ok:false,erreur:'kie.ai a refusé l’image '+(k+1)+' ('+(b.msg||r[k].statusCode||'?')+')',code:502},req:null}}];
  urls.push(u); }
const {consigne,ratio,titre,modele}=a[0], FAMILIA='__FAMILIA__';
const corps=(modeleRendu(modele)||MODELES_RENDU[0]).corps(consigne,urls,ratio);
if(/^[0-9a-f]{32}$/.test(FAMILIA)) corps.callBackUrl='https://familia-azure.vercel.app/api/callback?x='+FAMILIA+'&src=maison3d&t='+encodeURIComponent(titre);
return [{json:{req:{method:'POST',url:'https://api.kie.ai/api/v1/jobs/createTask',body:corps}}}];
