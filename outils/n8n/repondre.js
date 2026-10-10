// Étape 3 : vérifier les écritures et renvoyer la réponse au site
const {reponse}=$('Décider').first().json, r=Object.assign({},reponse);
const ecrits=$input.all().map(i=>i.json).filter(j=>j.statusCode!==undefined);
const mauvais=ecrits.find(j=>j.statusCode<200||j.statusCode>=300);
if(mauvais) return [{json:{reponse:{ok:false,erreur:'Airtable a refusé l’enregistrement ('+mauvais.statusCode+') : '+JSON.stringify(mauvais.body&&mauvais.body.error||'').slice(0,200),code:502}}}];
if(r.creee==='fichier'){ const rec=ecrits[0]&&ecrits[0].body&&ecrits[0].body.records&&ecrits[0].body.records[0]; delete r.creee; if(rec) r.id=rec.id; else return [{json:{reponse:{ok:false,erreur:'Fichier non créé',code:502}}}]; }
if(r.creee){ const rec=ecrits[0]&&ecrits[0].body&&ecrits[0].body.records&&ecrits[0].body.records[0]; delete r.creee;
  if(rec) r.variante={id:rec.id,nom:rec.fields['Nom'],version:rec.fields['Version']||1,ordre:rec.fields['Ordre']||0,creeePar:rec.fields['Créée par']||'',modifieePar:rec.fields['Modifiée par']||'',modifieeLe:rec.fields['Modifiée le']||null}; }
return [{json:{reponse:r}}];
