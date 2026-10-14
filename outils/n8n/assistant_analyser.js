// Maison3D Assistant (étape 6, 12 octobre 2026) : comprendre une demande libre (« mets ce canapé à la place du canapé
// d'angle ») avec un modèle de texte de kie.ai (≈ 0,05 crédit par message) ; le site reçoit les réponses déjà trouvées
// (branche du parcours, objet visé, pièce, source, dimensions, couleur…) et ne pose que les questions qui manquent.
// Jeton de connexion exigé ; 300 messages par jour au plus (sécurité).
const it=$input.first().json; let c=it.body;
if(typeof c==='string'){ try{ c=JSON.parse(c); }catch(e){ c=null; } }
const refus=(erreur,code)=>[{json:{reponse:{ok:false,erreur,code:code||400},req:null}}];
if(!c||typeof c!=='object') return refus('Demande illisible');
const moi=lireJeton(c.jeton); if(!moi) return refus('Connexion nécessaire',401);
const demande=String(c.texte||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,800);
if(demande.length<2) return refus('Demande vide');
const s=$getWorkflowStaticData('global'), jour=new Date().toISOString().slice(0,10);
if(s.jour!==jour){ s.jour=jour; s.n=0; }
if((s.n||0)>=300) return refus('Limite de 300 messages par jour atteinte : réessayez demain.',429);
s.n=(s.n||0)+1;
// « ✨ Améliorer » de « Créer avec l'IA » (comme dans Familia) : la description réécrite en une description riche, en anglais,
// du sujet seul (fond, lumière et cadrage sont fixés par la consigne de creer_modeles.js)
if(c.action==='ameliorer'){
  const dims=String(c.dims||'').replace(/[^0-9a-z ,.]/gi,'').slice(0,60), modele=String(c.modele||'').replace(/[\u0000-\u001f"]/g,' ').slice(0,60);
  const sys='You write prompts for the AI image model '+(modele||'of the user')+' which draws exactly one subject (a piece of furniture, a lamp, a plant, an animal, a bicycle or any other object) alone on a plain white background, like a studio product photo; the picture is then cut out and placed in a 3D model of an apartment or on a photo of a room. '
    +'Rewrite the user\'s description (often in French) into one rich, precise description in English of that subject only: what it is, shape, proportions, materials, colors, finish, style and notable details.'
    +(dims?' Its real size: '+dims+'; keep it.':'')
    +' Keep every detail and constraint the user gave and invent nothing that contradicts it. Do not describe a background, a room, the lighting or the camera (they are fixed). No lists, no quotes, no preamble: answer with the description only, at most 90 words.';
  return [{json:{mode:'ameliorer',req:{method:'POST',url:'https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions',
    body:{messages:[{role:'system',content:sys},{role:'user',content:demande}],stream:false}}}}];
}
const propre=v=>String(v||'').replace(/[\u0000-\u001f]/g,' ').slice(0,80);
const pieces=(Array.isArray(c.pieces)?c.pieces:[]).slice(0,30).map(p=>propre(p.id)+'='+propre(p.nom)).join(', ');
const meubles=(Array.isArray(c.meubles)?c.meubles:[]).slice(0,160).map(m=>propre(m.id)+'='+propre(m.nom)+' ('+propre(m.piece)+')').join(' ; ');
const pj=c.pieceJointe==='image'?' L’utilisateur a joint une image (photo d’un objet).':c.pieceJointe==='lien'?' L’utilisateur a joint le lien d’un produit.':'';
const systeme="Tu es le cerveau de l'assistant de Maison3D, une maquette 3D de l'appartement de Mauro. Tu lis la demande de l'utilisateur et tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec ces clés :\n"
+"branche : une lettre. A = visiter, aller voir une pièce ; B = ajouter un objet ; C = remplacer un objet de la maquette par un autre ; D = modifier un objet existant (déplacer, décaler, tourner, taille, couleur, matière) ; E = enlever, masquer ou supprimer un objet ; F = changer le sol ou les murs d'une pièce ; G = voir le résultat en vrai sur une photo de la pièce (« montre-moi le salon avec… », « à quoi ressemblerait… », décoration imaginée) ; H = mesurer, vérifier si un meuble rentre, distance, surface ; I = imprimer ou partager ; J = projets (variantes, copie, comparer, liste des meubles) ; L = créer un objet nouveau dessiné par l'IA d'après une description ; X = autre chose ou pas compris.\n"
+"objet : id de l'objet de la maquette visé (pris dans la liste des meubles), ou null. piece : id de la pièce concernée, ou null.\n"
+"source : d'où vient le nouvel objet, SEULEMENT si l'utilisateur le dit : photo (image jointe), lien (lien joint), produits (« un de mes produits »), catalogue, forme (forme simple, boîte), ia (« dessine », « invente », « une image »), blender (« Blender », « modélise », « sur le PC »), mes (« déjà fait », « reprends », « celui de mon autre projet »), fichier ; sinon null.\n"
+"description : le nouvel objet ou la demande en quelques mots, en français, ou null. couleur : #rrggbb ou null. matiere : cuir, velours, lin, tissu, chêne, noyer, bois clair, bois foncé, marbre, béton, métal, laiton, verre, rotin… ou null.\n"
+"L, P, H : largeur, profondeur, hauteur en cm (nombres) ou null. action (pour D) : deplacer, decaler, tourner, taille, aspect ou null. angle : degrés (90 = quart de tour à droite, -90 à gauche) ou null. dx : décalage vers la droite en cm (négatif = gauche) ou null ; dz : vers l'avant en cm (négatif = arrière) ou null.\n"
+"mode (pour A) : 1re, maquette ou plan, ou null. reponse : une phrase courte et simple en français qui dit ce que tu as compris (tutoiement).\n"
+"Pièces : "+pieces+"\nMeubles : "+meubles;
return [{json:{req:{method:'POST',url:'https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions',
  body:{messages:[{role:'system',content:systeme},{role:'user',content:demande+pj}],stream:false}}}}];
