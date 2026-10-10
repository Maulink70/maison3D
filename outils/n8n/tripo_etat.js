// Maison3D Tripo : état de la tâche ; prête : adresse du modèle (pbr_model, puis model, base_model ; .glb de préférence)
const r=$input.first().json, b=r.body||{}, d=b.data||{};
if(b.code!==0) return [{json:{reponse:erreurTripo(r,'suivi'),url:null}}];
if(d.status==='success'){
  const urls=[], voir=(v,k)=>{ if(typeof v==='string'&&/^https?:\/\//.test(v)) urls.push({k,u:v}); else if(v&&typeof v==='object') for(const [kk,vv] of Object.entries(v)) voir(vv,k?k+'.'+kk:kk); };
  voir(d.output||{},'');
  const rang=x=>(/pbr_model/.test(x.k)?0:/^model/.test(x.k)?1:/base_model/.test(x.k)?2:3)+(/\.glb(\?|$)/i.test(x.u)?0:0.5);
  const m=urls.filter(x=>/model/.test(x.k)&&!/image|preview|render/.test(x.k)).sort((a,c)=>rang(a)-rang(c))[0];
  return m?[{json:{url:m.u,credits:+d.credits_consumed||0}}]:[{json:{reponse:{ok:true,etat:'echec',raison:'pas de modèle dans le résultat'},url:null}}];
}
const FIN={failed:'échec chez Tripo',banned:'image refusée par Tripo (règles de contenu)',expired:'tâche expirée',cancelled:'tâche annulée'};
if(FIN[d.status]) return [{json:{reponse:{ok:true,etat:'echec',raison:FIN[d.status]},url:null}}];
return [{json:{reponse:{ok:true,etat:'attente',progres:Math.max(0,Math.min(100,Math.round(+d.progress||0))),statut:String(d.status||'')},url:null}}];
