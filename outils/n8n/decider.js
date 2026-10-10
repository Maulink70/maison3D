// Étape 2 : avec ce qu'Airtable a renvoyé, vérifier, calculer, préparer les écritures et la réponse
const {ctx}=$('Analyser').first().json, c=ctx.corps, moi=ctx.moi, maintenant=new Date().toISOString();
const entrees=$input.all().map(i=>i.json), lus=entrees.filter(j=>j.statusCode!==undefined);
const sortie=(reponse,ecritures)=>(ecritures&&ecritures.length?ecritures:[null]).map(req=>({json:{reponse,req}}));
const echec=(erreur,code)=>sortie({ok:false,erreur,code:code||400});
if(ctx.reponse) return sortie(ctx.reponse);
const mauvais=lus.find(j=>j.statusCode<200||j.statusCode>=300);
if(mauvais) return echec('Airtable a refusé la lecture ('+mauvais.statusCode+') : '+JSON.stringify(mauvais.body&&mauvais.body.error||'').slice(0,200),502);
const lignes=k=>(lus[k]&&lus[k].body&&lus[k].body.records)||[];
const lot=(t,methode,recs,suite)=>{ const r=[]; for(let i=0;i<recs.length;i+=10) r.push({method:methode,url:url(t,suite||''),body:{records:recs.slice(i,i+10),typecast:true}}); return r; };
const effacer=(t,ids)=>{ const r=[]; for(let i=0;i<ids.length;i+=10) r.push({method:'DELETE',url:url(t,'?'+ids.slice(i,i+10).map(id=>'records%5B%5D='+id).join('&')),body:{}}); return r; };
const json=(s,d)=>{ try{ const v=JSON.parse(s); return v==null?d:v; }catch(e){ return d; } };
const variante=r=>({id:r.id,nom:r.fields['Nom']||'',disposition:json(r.fields['Disposition'],{}),version:r.fields['Version']||0,ordre:r.fields['Ordre']||0,
  creeePar:r.fields['Créée par']||'',modifieePar:r.fields['Modifiée par']||'',modifieeLe:r.fields['Modifiée le']||null});
const vueDe=r=>({rid:r.id,id:r.fields['Id'],nom:r.fields['Nom']||'',reglage:json(r.fields['Réglage'],null),ordre:r.fields['Ordre']||0,creeePar:r.fields['Créée par']||''});
const point=s=>String(s||'').split(';').map(Number);
const mesureDe=r=>({rid:r.id,id:r.fields['Id'],a:point(r.fields['A']),b:point(r.fields['B']),creeePar:r.fields['Créée par']||''});
const resume=s=>String(s||'').slice(0,250);
switch(ctx.action){
  case 'connexion': {
    const p=lignes(0)[0];
    if(!p||!p.fields['Actif']) return echec('Nom ou mot de passe incorrect',401);
    const emp=hex(pbkdf2(utf8(c.motDePasse),utf8(p.fields['Sel']||''),TOURS));
    if(!egal(emp,p.fields['Empreinte']||'')) return echec('Nom ou mot de passe incorrect',401);
    const nom=p.fields['Nom'], jeton=signer({p:p.id,n:nom,e:Date.now()+DUREE});
    return sortie({ok:true,jeton,nom},[{method:'PATCH',url:url('personnes'),body:{records:[{id:p.id,fields:{'Dernière connexion':maintenant}}]}}]);
  }
  case 'charger': {
    return sortie({ok:true,moi:{nom:moi.n},variantes:lignes(0).map(variante),vues:lignes(1).map(vueDe),mesures:lignes(2).map(mesureDe)});
  }
  case 'etat':
    return sortie({ok:true,variantes:lignes(0).map(r=>({id:r.id,nom:r.fields['Nom']||'',version:r.fields['Version']||0,modifieePar:r.fields['Modifiée par']||'',modifieeLe:r.fields['Modifiée le']||null}))});
  case 'enregistrer': {
    // un élément : position, rotation, masqué, couleur ; taille s, matières m, objet ajouté a (étape 4) ; seuls les champs présents
    const propre=e=>{ const r={};
      for(const k of ['x','z','r']) if(k in e) r[k]=+e[k]||0;
      if('h' in e) r.h=!!e.h; if('c' in e) r.c=typeof e.c==='string'?e.c.slice(0,9):null;
      if(Array.isArray(e.s)&&e.s.length===3) r.s=e.s.map(v=>Math.min(50,Math.max(0.01,+v||1)));
      if('dy' in e) r.dy=Math.max(-10,Math.min(10,+e.dy||0));   // hauteur de pose d'un meuble du modèle
      if(e.m&&typeof e.m==='object'){ const m={}; for(const [k,v] of Object.entries(e.m).slice(0,40)) if(v&&typeof v==='object')
        m[String(k).slice(0,60)]={i:v.i==null?null:String(v.i).slice(0,40),c:typeof v.c==='string'?v.c.slice(0,9):null,...(v.n?{n:String(v.n).slice(0,60)}:{})}; r.m=m; }
      if(e.a&&typeof e.a==='object'&&JSON.stringify(e.a).length<6000) r.a=e.a;
      if(Array.isArray(e.g)){ const g=e.g.slice(0,300); if(JSON.stringify(g).length<40000) r.g=g; }   // alertes ignorées
      return r; };
    const r=lus[0]&&lus[0].body; if(!r||!r.fields) return echec('Variante introuvable',404);
    if(r.fields['Supprimée']) return echec('Cette variante a été supprimée',409);
    const d=json(r.fields['Disposition'],{}), ch=c.changements&&typeof c.changements==='object'?c.changements:{};
    for(const [n,e] of Object.entries(ch)){ if(e===null) delete d[n]; else if(e&&typeof e==='object') d[String(n).slice(0,80)]=propre(e); }
    const version=(r.fields['Version']||0)+1;
    const ecr=[{method:'PATCH',url:url('variantes'),body:{records:[{id:r.id,fields:{'Disposition':JSON.stringify(d),'Version':version,'Modifiée par':moi.n,'Modifiée le':maintenant}}]}}];
    const h=(Array.isArray(c.historique)?c.historique:[]).slice(0,50).map(l=>({fields:{'Résumé':resume(l.texte),'Quand':new Date(+l.t||Date.now()).toISOString(),'Personne':moi.n,'Variante':r.fields['Nom']||'','Variante id':r.id,'Détail':JSON.stringify(l.ch||[]).slice(0,90000)}}));
    return sortie({ok:true,version,modifieeLe:maintenant,modifieePar:moi.n},ecr.concat(lot('historique','POST',h)));
  }
  case 'variante': {
    if(c.op==='creer'){
      const nom=String(c.nom||'').trim().slice(0,80)||'Projet';
      const disp=c.disposition&&typeof c.disposition==='object'?c.disposition:{};
      return sortie({ok:true,creee:true},[{method:'POST',url:url('variantes'),body:{records:[{fields:{'Nom':nom,'Disposition':JSON.stringify(disp),'Ordre':+c.ordre||0,'Version':1,
        'Créée par':moi.n,'Créée le':maintenant,'Modifiée par':moi.n,'Modifiée le':maintenant}}],typecast:true}}]);
    }
    if(c.op==='renommer'){ if(!estId(c.id)) return echec('Variante inconnue');
      return sortie({ok:true},[{method:'PATCH',url:url('variantes'),body:{records:[{id:c.id,fields:{'Nom':String(c.nom||'').trim().slice(0,80)||'Projet','Modifiée par':moi.n,'Modifiée le':maintenant}}]}}]); }
    if(c.op==='supprimer'){ if(!estId(c.id)) return echec('Variante inconnue');
      return sortie({ok:true},[{method:'PATCH',url:url('variantes'),body:{records:[{id:c.id,fields:{'Supprimée':true,'Modifiée par':moi.n,'Modifiée le':maintenant}}]}}]); }
    if(c.op==='ordre'){ const ids=(Array.isArray(c.ids)?c.ids:[]).filter(estId);
      return sortie({ok:true},lot('variantes','PATCH',ids.map((id,k)=>({id,fields:{'Ordre':k}})))); }
    return echec('Opération inconnue');
  }
  case 'vue': {
    if(c.op==='enregistrer'){ const v=c.vue||{}; if(!v.id) return echec('Vue sans identifiant');
      return sortie({ok:true},[{method:'PATCH',url:url('vues'),body:{performUpsert:{fieldsToMergeOn:['Id']},typecast:true,records:[{fields:{'Id':String(v.id),'Nom':String(v.nom||'Vue').slice(0,120),
        'Réglage':JSON.stringify(v.reglage||{}),'Ordre':+v.ordre||0,'Créée par':v.creeePar||moi.n,'Créée le':v.creeeLe?new Date(+v.creeeLe).toISOString():maintenant}}]}}]); }
    const ids=lignes(0).map(r=>r.id); return sortie({ok:true},effacer('vues',ids));
  }
  case 'mesure': {
    if(c.op==='ajouter'){ const m=c.mesure||{}; if(!m.id||!Array.isArray(m.a)||!Array.isArray(m.b)) return echec('Mesure incomplète');
      const L=Math.hypot(m.b[0]-m.a[0],m.b[1]-m.a[1],m.b[2]-m.a[2]);
      return sortie({ok:true},[{method:'PATCH',url:url('mesures'),body:{performUpsert:{fieldsToMergeOn:['Id']},typecast:true,records:[{fields:{'Id':String(m.id),'Libellé':L.toFixed(2).replace('.',',')+' m',
        'A':m.a.map(v=>(+v).toFixed(3)).join(';'),'B':m.b.map(v=>(+v).toFixed(3)).join(';'),'Longueur':+L.toFixed(2),'Créée par':moi.n,'Créée le':maintenant}}]}}]); }
    const ids=lignes(0).map(r=>r.id); return sortie({ok:true,effacees:ids.length},effacer('mesures',ids));
  }
  case 'historique':
    return sortie({ok:true,lignes:lignes(0).map(r=>({id:r.id,texte:r.fields['Résumé']||'',t:Date.parse(r.fields['Quand']||'')||0,qui:r.fields['Personne']||'',ch:json(r.fields['Détail'],[])}))});
  case 'fichier': {
    if(c.op==='creer') return sortie({ok:true,creee:'fichier'},[{method:'POST',url:url('fichiers'),body:{records:[{fields:{'Nom':String(c.nom||'fichier').slice(0,120),
      'Type':c.type==='glb'?'glb':'photo','Taille':Math.max(0,+c.taille||0),'Créé par':moi.n,'Créé le':maintenant}}],typecast:true}}]);
    const k=Math.max(0,Math.min(20,c.part|0));
    return sortie({ok:true},[{method:'POST',url:CONTENU(c.id),body:{contentType:c.type,file:c.donnees,filename:String(c.nom||'fichier').replace(/[^\w.-]+/g,'_').slice(0,80)+'.part'+k}}]);
  }
  case 'motdepasse': {
    const p=lus[0]&&lus[0].body; if(!p||!p.fields) return echec('Compte introuvable',404);
    if(!egal(hex(pbkdf2(utf8(c.ancien),utf8(p.fields['Sel']||''),TOURS)),p.fields['Empreinte']||'')) return echec('Mot de passe actuel incorrect',401);
    const sel=hex(hmac(SECRET,utf8(p.id+':'+Date.now()+':'+Math.random()+':'+Math.random()))).slice(0,32);
    return sortie({ok:true},[{method:'PATCH',url:url('personnes'),body:{records:[{id:p.id,fields:{'Sel':sel,'Empreinte':hex(pbkdf2(utf8(c.nouveau),utf8(sel),TOURS))}}]}}]);
  }
}
return echec('Action inconnue');
