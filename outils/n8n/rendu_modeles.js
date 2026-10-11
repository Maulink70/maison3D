// Modèles kie.ai proposés pour les rendus (montages), choisis par Mauro le 11 octobre 2026. La liste n'existe qu'ici :
// le site la reçoit avec le solde (action « solde ») et affiche le menu « Modèle » d'après elle.
// Mettre à jour (nouveau modèle, nouvelle version, prix) : vérifier sur kie.ai (GET /api/v1/models : modèles existants ;
// /api/v1/models/<modèle>/schema : paramètres ; /api/v1/models/<modèle>/price : prix), modifier cette liste, puis
// python3 outils/n8n/deployer.py ; le site n'a pas besoin d'être republié. Le premier modèle est le choix par défaut.
// cout : crédits d'un rendu 2K ; coutImage : crédits par image de référence en plus de la première ; max : images acceptées.
const procheRatio=(r,liste)=>{ if(liste.includes(r)) return r; if(liste.includes('auto')) return 'auto';
  const v=x=>{ const [a,b]=x.split(':').map(Number); return a/b; };
  return liste.filter(x=>x!=='auto').reduce((m,x)=>Math.abs(Math.log(v(x)/v(r)))<Math.abs(Math.log(v(m)/v(r)))?x:m); };
const MODELES_RENDU=[
  {id:'nano-banana-pro', nom:'Nano Banana Pro', cout:18, max:8, note:'Google : le plus fidèle à la pièce',
    corps:(prompt,urls,r)=>({model:'nano-banana-pro',input:{prompt,image_input:urls,aspect_ratio:procheRatio(r,['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9']),resolution:'2K',output_format:'jpg'}})},
  {id:'nano-banana-2', nom:'Nano Banana 2', cout:12, max:14, note:'Google : plus récent, moins cher',
    corps:(prompt,urls,r)=>({model:'nano-banana-2',input:{prompt,image_input:urls,aspect_ratio:procheRatio(r,['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9','auto']),resolution:'2K',output_format:'jpg'}})},
  {id:'gpt-image-2.5', nom:'GPT Image 2.5', cout:10, max:16, note:'OpenAI : suit bien une consigne écrite',
    corps:(prompt,urls,r)=>({model:'gpt-image-2-5-sunburst-image-to-image',input:{prompt,input_urls:urls,aspect_ratio:procheRatio(r,['1:1','3:2','2:3','4:3','3:4','16:9','9:16','21:9','auto']),resolution:'2K',background:'opaque'}})},
  {id:'seedream-5.0-pro', nom:'Seedream 5.0 Pro', cout:14, coutImage:0.5, max:10, note:'ByteDance : rendus très photographiques',
    corps:(prompt,urls,r)=>({model:'seedream/5-pro-image-to-image',input:{prompt,image_urls:urls,aspect_ratio:procheRatio(r,['1:1','4:3','3:4','16:9','9:16','2:3','3:2','21:9']),quality:'high',output_format:'jpeg'}})},
  {id:'flux-2-pro', nom:'Flux 2 Pro', cout:7, max:8, note:'Black Forest Labs : bon marché',
    corps:(prompt,urls,r)=>({model:'flux-2/pro-image-to-image',input:{prompt,input_urls:urls,aspect_ratio:procheRatio(r,['1:1','4:3','3:4','16:9','9:16','3:2','2:3','auto']),resolution:'2K'}})},
  {id:'grok-imagine-image-2.0', nom:'Grok Imagine Image 2.0', cout:4, max:5, note:'xAI : le moins cher',
    corps:(prompt,urls,r)=>({model:'grok-imagine-image-2-0/image-edit',input:{prompt,image_urls:urls,aspect_ratio:procheRatio(r,['1:1','2:3','3:2','16:9','9:16','auto'])}})}];
const modeleRendu=id=>MODELES_RENDU.find(m=>m.id===id)||null;
const modelesPublics=()=>MODELES_RENDU.map(({id,nom,cout,coutImage,max,note})=>({id,nom,cout,coutImage:coutImage||0,max,note}));
