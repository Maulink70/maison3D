// Maison3D IA : la tâche est créée (ou refusée)
const r=$input.first().json, b=r.body||{};
if(b.code===200&&b.data&&b.data.taskId) return [{json:{reponse:{ok:true,tache:b.data.taskId}}}];
return [{json:{reponse:{ok:false,erreur:'kie.ai a refusé la tâche ('+(b.msg||r.statusCode||'?')+')',code:502}}}];
