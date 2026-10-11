// Maison3D Rendu : les tâches sont créées (une par rendu demandé, de 1 à 4, mêmes images) ; celles que kie.ai refuse sont comptées
const r=$input.all().map(i=>i.json), taches=[]; let refus='';
for(const x of r){ const b=x.body||{}; if(b.code===200&&b.data&&b.data.taskId) taches.push(b.data.taskId); else refus=refus||(b.msg||x.statusCode||'?'); }
if(taches.length) return [{json:{reponse:{ok:true,tache:taches[0],taches,refusees:r.length-taches.length}}}];
return [{json:{reponse:{ok:false,erreur:'kie.ai a refusé la tâche ('+refus+')',code:502}}}];
