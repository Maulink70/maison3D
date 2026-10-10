// Maison3D Tripo : la tâche est créée (ou refusée)
const r=$input.first().json, b=r.body||{};
if(b.code===0&&b.data&&b.data.task_id) return [{json:{reponse:{ok:true,tache:b.data.task_id}}}];
return [{json:{reponse:erreurTripo(r,'création du modèle')}}];
