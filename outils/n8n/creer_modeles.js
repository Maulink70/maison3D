// Modèles kie.ai proposés pour « Créer avec l'IA » (12 octobre 2026, demande de Mauro) : une image d'un meuble ou d'un objet
// d'après sa description, sur fond blanc, en 1K (assez pour la mettre en 3D, à plat ou sur une photo). Comme pour
// rendu_modeles.js, la liste n'existe qu'ici et le site la reçoit avec le solde ; le premier est le choix par défaut.
// Vérifié sur kie.ai le 12 octobre 2026 (GET /api/v1/models/<modèle>/schema et /price). cout : crédits d'une image.
const MODELES_CREER=[
  {id:'nano-banana-pro', nom:'Nano Banana Pro', cout:18, note:'Google : le plus soigné',
    corps:prompt=>({model:'nano-banana-pro',input:{prompt,aspect_ratio:'1:1',resolution:'1K',output_format:'png'}})},
  {id:'nano-banana-2', nom:'Nano Banana 2', cout:8, note:'Google : plus récent, moins cher',
    corps:prompt=>({model:'nano-banana-2',input:{prompt,aspect_ratio:'1:1',resolution:'1K',output_format:'png'}})},
  {id:'gpt-image-2.5', nom:'GPT Image 2.5', cout:6, note:'OpenAI : suit bien une description précise',
    corps:prompt=>({model:'gpt-image-2-5-sunburst-text-to-image',input:{prompt,aspect_ratio:'1:1',resolution:'1K',background:'opaque'}})},
  {id:'seedream-5.0-pro', nom:'Seedream 5.0 Pro', cout:7, note:'ByteDance : très photographique',
    corps:prompt=>({model:'seedream/5-pro-text-to-image',input:{prompt,aspect_ratio:'1:1',quality:'basic',output_format:'png'}})},
  {id:'flux-2-pro', nom:'Flux 2 Pro', cout:5, note:'Black Forest Labs : bon marché',
    corps:prompt=>({model:'flux-2/pro-text-to-image',input:{prompt,aspect_ratio:'1:1',resolution:'1K'}})},
  {id:'grok-imagine-image-2.0', nom:'Grok Imagine Image 2.0', cout:4, note:'xAI : le moins cher',
    corps:prompt=>({model:'grok-imagine-image-2-0/text-to-image',input:{prompt,aspect_ratio:'1:1'}})}];
const modeleCreer=id=>MODELES_CREER.find(m=>m.id===id)||null;
const modelesCreerPublics=()=>MODELES_CREER.map(({id,nom,cout,note})=>({id,nom,cout,note}));
// consigne fixe : le sujet seul (meuble, lampe, plante, animal, vélo… : tout ce que dit la description, Mauro 12 octobre 2026),
// entier, de trois quarts face, sur fond blanc uni (utilisable tel quel par Tripo, à plat et sur une photo) ; la description peut
// être en français ou déjà améliorée en anglais (« ✨ Améliorer », workflow « Maison3D Assistant », action ameliorer)
const consigneCreer=(desc,dims)=>'Studio photograph of exactly one subject (it can be a piece of furniture, a lamp, a plant, an animal, a bicycle or any other object), described here: "'+desc+'".'
  +(dims?' Its real size is about '+dims+' (width × depth × height); keep these proportions.':'')
  +' Show the whole subject, fully visible and centered, three-quarter front view, at eye level slightly above, on a plain pure white background,'
  +' soft even studio lighting, realistic materials and colors. Nothing else: no room, no floor line, no other objects or people, no shadows on the edges, no text, no watermark.';
