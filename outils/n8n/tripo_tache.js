// Maison3D Tripo : la photo est chez Tripo (file_token) ; créer la tâche image-to-model : modèle v3.1, 60 000 faces au plus,
// taille réelle estimée (en mètres), géométrie compressée ; textures au choix du site (nœud « Analyser ») : standard (PBR,
// ~30 crédits), hd (PBR, texture_quality detailed, ~40 crédits) ou aucune (forme seule, ~20 crédits)
const r=$input.first().json, b=r.body||{}, tok=b.code===0&&b.data&&b.data.file_token;
if(!tok) return [{json:{reponse:erreurTripo(r,'envoi de la photo'),req:null}}];
let tx='standard'; try{ tx=$('Analyser').first().json.texture||'standard'; }catch(e){}
const avec=tx!=='aucune';
const body={input:tok,model:'v3.1-20260211',texture:avec,pbr:avec,face_limit:60000,auto_size:true,compress:'geometry'};
if(avec) body.texture_quality=tx==='hd'?'detailed':'standard';
return [{json:{req:{method:'POST',url:'https://openapi.tripo3d.ai/v3/generation/image-to-model',body}}}];
