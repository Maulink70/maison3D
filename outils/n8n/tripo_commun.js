// Maison3D Tripo : message d'erreur lisible pour une réponse refusée par Tripo (format {code, message} de l'API v3)
function erreurTripo(r,quoi){
  const b=(r&&r.body)||{}, c=b.code, h=r&&r.statusCode;
  const msg=h===401||c===1000||c===1001?'Tripo refuse la clé (identifiant « Tripo Maison3D » à vérifier dans n8n)'
    :c===2010||(h===403&&/credit/i.test(b.message||''))?'Crédits Tripo insuffisants : rechargez sur platform.tripo3d.ai'
    :c===2008?'Tripo refuse cette image (règles de contenu)'
    :c===2003||c===2004?'Tripo ne peut pas lire cette image'
    :h===429||c===2000?'Tripo est surchargé : réessayez dans une minute'
    :'Tripo'+(quoi?' ('+quoi+')':'')+' : '+String(b.message||h||'?').slice(0,160);
  return {ok:false,erreur:msg,code:502};
}
