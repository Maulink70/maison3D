// Maison3D IA : l'image est chez kie.ai ; préparer la tâche Nano Banana Pro (consigne fixe, ici et non dans la page)
const {quoi,ratio}=$('Analyser').first().json, r=$input.first().json, b=r.body||{};
const url=b&&b.code===200&&b.data&&b.data.downloadUrl;
if(!url) return [{json:{reponse:{ok:false,erreur:'kie.ai a refusé l’image ('+(b.msg||r.statusCode||'?')+')',code:502},req:null}}];
const objet=quoi?' The object is: '+quoi+'.':'';
const prompt='Edit this product photo of a piece of furniture or a decor object.'+objet+' Keep only that main object, complete and whole: '+
  'remove any people, animals, other furniture, decorations, text and logos; if parts of the object are hidden, reconstruct them plausibly. '+
  'Do not change its shape, proportions, colors, materials or the camera viewpoint. Place it on a plain pure white background (#FFFFFF), '+
  'evenly lit, with no shadow and no floor on the background.';
return [{json:{req:{method:'POST',url:'https://api.kie.ai/api/v1/jobs/createTask',body:{model:'nano-banana-pro',input:{prompt,image_input:[url],aspect_ratio:ratio,resolution:'1K',output_format:'png'}}}}}];
