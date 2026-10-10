// Maison3D Catalogue : réponse de Sketchfab → réponse au site
const r=$input.first().json, b=r.body||{}, h=r.statusCode, op=$('Analyser').first().json.op;
const non=(erreur,code)=>[{json:{reponse:{ok:false,erreur,code:code||502}}}];
if(h===401) return non('Sketchfab refuse la clé (identifiant « Sketchfab Maison3D » à vérifier dans n8n)');
if(op==='verifier') return h===200?[{json:{reponse:{ok:true,nom:String(b.displayName||b.username||'')}}}]:non('Sketchfab : '+String(b.detail||h));
if(h===429) return non('Sketchfab limite les téléchargements : réessayez plus tard.');
if(h===403||h===404) return non('Ce modèle n’est pas téléchargeable.');
if(h!==200) return non('Sketchfab : '+String(b.detail||h).slice(0,160));
const g=b.glb;
if(!g||!g.url) return non('Pas de version .glb pour ce modèle : choisissez-en un autre.');
if((+g.size||0)>60e6) return non('Modèle trop lourd ('+Math.round(g.size/1e6)+' Mo) : choisissez-en un plus léger.');
return [{json:{reponse:{ok:true,url:g.url,taille:+g.size||0}}}];
