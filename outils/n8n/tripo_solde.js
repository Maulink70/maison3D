// Maison3D Tripo : crédits restants (affichés dans la confirmation avant chaque modèle), ou liste des tâches récentes
const r=$input.first().json, b=r.body||{};
if($('Analyser').first().json.quoi==='recents'){
  const d=b.data, l=Array.isArray(d)?d:(d&&(d.items||d.list||d.records||d.tasks))||null;
  if(b.code!==0||!Array.isArray(l)) return [{json:{reponse:erreurTripo(r,'liste')}}];
  return [{json:{reponse:{ok:true,taches:l.slice(0,40).map(i=>({id:String(i.task_id||i.id||''),quand:i.created_at||i.create_time||null,
    type:String(i.type||'').slice(0,40),credits:+(i.credits_consumed||i.credits||0)||0})).filter(t=>/^[A-Za-z0-9_-]{6,100}$/.test(t.id))}}}];
}
if(b.code===0&&b.data) return [{json:{reponse:{ok:true,solde:+b.data.balance||0,gele:+b.data.frozen||0}}}];
return [{json:{reponse:erreurTripo(r,'solde')}}];
