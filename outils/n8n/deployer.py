# Assemble et publie le workflow n8n « Maison3D API » (étape 3).
# Usage : N8N_BASE_URL=… N8N_API_KEY=… python3 deployer.py [<id credential Airtable> <nom>]
# Par défaut : la clé « Airtable Maison3D » (créée par Mauro dans n8n, id YLhykJLQo38AL1L5).
# Le secret qui signe les jetons de connexion n'est jamais dans le dépôt : il est lu dans le workflow déjà publié
# (nœud « Analyser ») ; s'il n'existe pas encore, un nouveau est tiré au hasard (tous les appareils devront se reconnecter).
import json, os, sys, urllib.request, uuid
D=os.path.dirname(os.path.abspath(__file__)); C=D
lire=lambda n: open(os.path.join(C,n),encoding='utf8').read()
lib=lire('chiffre.js')+'\n'+lire('commun.js')+'\n'
cred={'airtableTokenApi':{'id':sys.argv[1] if len(sys.argv)>2 else 'YLhykJLQo38AL1L5','name':sys.argv[2] if len(sys.argv)>2 else 'Airtable Maison3D'}}
ORIGINES='https://maison3d.vercel.app,http://localhost:8000'
def code(nom,js,x): return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-'+nom)),'name':nom,'type':'n8n-nodes-base.code','typeVersion':2,'position':[x,0],'parameters':{'jsCode':js}}
def si(nom,x): return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-'+nom)),'name':nom,'type':'n8n-nodes-base.if','typeVersion':2.2,'position':[x,0],'parameters':{
  'conditions':{'options':{'caseSensitive':True,'leftValue':'','typeValidation':'loose','version':2},
    'conditions':[{'id':'c1','leftValue':'={{ $json.req != null }}','rightValue':'','operator':{'type':'boolean','operation':'true','singleValue':True}}],'combinator':'and'},
  'looseTypeValidation':True,'options':{}}}
def http(nom,x,corps):
  p={'method':'={{ $json.req.method }}','url':'={{ $json.req.url }}','authentication':'predefinedCredentialType','nodeCredentialType':'airtableTokenApi',
     'options':{'response':{'response':{'fullResponse':True,'neverError':True}},'batching':{'batch':{'batchSize':4,'batchInterval':1000}}}}
  if corps: p.update({'sendBody':True,'contentType':'json','specifyBody':'json','jsonBody':'={{ JSON.stringify($json.req.body) }}'})
  return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-'+nom)),'name':nom,'type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[x,0],'parameters':p,'credentials':cred}
nodes=[
 {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-webhook')),'name':'Site Maison3D','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[0,0],'webhookId':'4a2f5d0e-6c1b-4c8e-9f3a-maison3d0001',
  'parameters':{'httpMethod':'POST','path':'maison3d','responseMode':'responseNode','options':{'allowedOrigins':ORIGINES}}},
 code('Analyser',lib+lire('analyser.js'),220), si('Lecture ?',440), http('Lire Airtable',660,False),
 code('Décider',lib+lire('decider.js'),880), si('Écriture ?',1100), http('Écrire Airtable',1320,True),
 code('Répondre',lire('repondre.js'),1540),
 {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3d-reponse')),'name':'Réponse','type':'n8n-nodes-base.respondToWebhook','typeVersion':1.1,'position':[1760,0],
  'parameters':{'respondWith':'json','responseBody':'={{ JSON.stringify($json.reponse) }}','options':{}}}]
m=lambda n,i=0:{'node':n,'type':'main','index':i}
conn={'Site Maison3D':{'main':[[m('Analyser')]]},'Analyser':{'main':[[m('Lecture ?')]]},'Lecture ?':{'main':[[m('Lire Airtable')],[m('Décider')]]},
 'Lire Airtable':{'main':[[m('Décider')]]},'Décider':{'main':[[m('Écriture ?')]]},'Écriture ?':{'main':[[m('Écrire Airtable')],[m('Répondre')]]},
 'Écrire Airtable':{'main':[[m('Répondre')]]},'Répondre':{'main':[[m('Réponse')]]}}
wf={'name':'Maison3D API','nodes':nodes,'connections':conn,'settings':{'executionOrder':'v1','saveDataSuccessExecution':'none','saveDataErrorExecution':'all'}}
B=os.environ['N8N_BASE_URL']+'/api/v1/workflows'; H={'X-N8N-API-KEY':os.environ['N8N_API_KEY'],'Content-Type':'application/json'}
def req(meth,u,data=None):
  r=urllib.request.Request(u,data=json.dumps(data).encode() if data is not None else None,headers=H,method=meth)
  try: return json.load(urllib.request.urlopen(r))
  except urllib.error.HTTPError as e: print('ERREUR',e.code,e.read().decode()[:500]); sys.exit(1)
# workflow existant (par son nom) et secret des jetons
import re, secrets
existant=[w for w in req('GET',B+'?limit=200')['data'] if w['name']=='Maison3D API']
sec=None
if existant:
  w0=req('GET',B+'/'+existant[0]['id'])
  for n in w0['nodes']:
    m=re.search(r"SECRET=utf8\('([0-9a-f]{64})'\)",n.get('parameters',{}).get('jsCode','') or '')
    if m: sec=m.group(1)
sec=sec or secrets.token_hex(32)
for n in wf['nodes']:
  if n['type']=='n8n-nodes-base.code': n['parameters']['jsCode']=n['parameters']['jsCode'].replace('__SECRET__',sec)
if existant:
  i=existant[0]['id']; req('POST',B+'/'+i+'/deactivate'); req('PUT',B+'/'+i,wf)
else:
  i=req('POST',B,wf)['id']
r=req('POST',B+'/'+i+'/activate'); print('workflow',i,'actif',r.get('active'))

# ---------- workflow « Maison3D Fichiers » (étape 4) : contenu d'un fichier de la table Fichiers, servi au site ----------
# GET /webhook/maison3d-fichier?id=rec…&p=<morceau>&j=<jeton> ; les adresses des pièces jointes Airtable expirent et ne
# sont pas lisibles depuis le site : n8n les relit et renvoie le contenu (CORS des origines du site, cache d'un an)
def siExpr(nom,x,expr): n=si(nom,x); n['parameters']['conditions']['conditions'][0]['leftValue']=expr; return n
def repondre(nom,x,binaire=False):
  p={'respondWith':'binary','options':{'responseHeaders':{'entries':[{'name':'Cache-Control','value':'private, max-age=31536000, immutable'}]}}} if binaire else \
    {'respondWith':'json','responseBody':'={{ JSON.stringify($json.reponse) }}','options':{}}
  return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3df-'+nom)),'name':nom,'type':'n8n-nodes-base.respondToWebhook','typeVersion':1.1,'position':[x,0],'parameters':p}
dl={'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3df-telecharger')),'name':'Télécharger','type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[1100,-100],
  'parameters':{'url':'={{ $json.url }}','options':{'response':{'response':{'responseFormat':'file'}}}}}
ligne=http('Lire la ligne',660,False); ligne['id']=str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3df-lire'))
nodesF=[
 {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3df-webhook')),'name':'Fichier demandé','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[0,0],'webhookId':'4a2f5d0e-6c1b-4c8e-9f3a-maison3d0002',
  'parameters':{'httpMethod':'GET','path':'maison3d-fichier','responseMode':'responseNode','options':{'allowedOrigins':ORIGINES}}},
 code('Vérifier',lib+lire('fichier_verifier.js'),220),
 siExpr('Autorisé ?',440,'={{ $json.req != null }}'), ligne,
 code('Adresse',lire('fichier_adresse.js'),880),
 siExpr('Trouvé ?',990,'={{ $json.url != null }}'), dl, repondre('Contenu',1320,True), repondre('Refus',660), repondre('Introuvable',1100)]
for n in nodesF:
  if n['name'] in ('Vérifier','Adresse'): n['id']=str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3df-'+n['name']))
  if n['name'] in ('Autorisé ?','Trouvé ?'): n['id']=str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3df-'+n['name']))
  if n['type']=='n8n-nodes-base.code': n['parameters']['jsCode']=n['parameters']['jsCode'].replace('__SECRET__',sec)
mm=lambda n,i=0:{'node':n,'type':'main','index':i}   # (m est repris plus haut par la recherche du secret)
connF={'Fichier demandé':{'main':[[mm('Vérifier')]]},'Vérifier':{'main':[[mm('Autorisé ?')]]},'Autorisé ?':{'main':[[mm('Lire la ligne')],[mm('Refus')]]},
 'Lire la ligne':{'main':[[mm('Adresse')]]},'Adresse':{'main':[[mm('Trouvé ?')]]},'Trouvé ?':{'main':[[mm('Télécharger')],[mm('Introuvable')]]},'Télécharger':{'main':[[mm('Contenu')]]}}
wfF={'name':'Maison3D Fichiers','nodes':nodesF,'connections':connF,'settings':{'executionOrder':'v1','saveDataSuccessExecution':'none','saveDataErrorExecution':'all'}}
exF=[w for w in req('GET',B+'?limit=200')['data'] if w['name']=='Maison3D Fichiers']
if exF:
  iF=exF[0]['id']; req('POST',B+'/'+iF+'/deactivate'); req('PUT',B+'/'+iF,wfF)
else:
  iF=req('POST',B,wfF)['id']
r=req('POST',B+'/'+iF+'/activate'); print('workflow',iF,'(fichiers) actif',r.get('active'))

# ---------- workflow « Maison3D IA » (étape 4, livraison 2) : nettoyage d'une photo par kie.ai (Nano Banana Pro) ----------
# POST /webhook/maison3d-ia (texte JSON) : demarrer {image, quoi, ratio} → {tache} ; suivre {tache} → {etat, image}.
# Clé kie.ai : identifiant « kie.ai Maison3D (Bearer) » créé par Mauro dans n8n (type « Bearer Auth » : la clé seule,
# id SeeB77SMCgNVZLgQ ; l'ancien « kie.ai Maison3D » en Header Auth était refusé par kie.ai). Autre clé :
# KIE_TYPE=httpHeaderAuth|httpBearerAuth KIE_CRED=<id> KIE_NOM=<nom> python3 outils/n8n/deployer.py
KIE_TYPE=os.environ.get('KIE_TYPE','httpBearerAuth')
KIE={KIE_TYPE:{'id':os.environ.get('KIE_CRED','SeeB77SMCgNVZLgQ'),'name':os.environ.get('KIE_NOM','kie.ai Maison3D (Bearer)')}}
def kie(nom,x,y,corps):
  p={'method':'={{ $json.req.method }}','url':'={{ $json.req.url }}','authentication':'genericCredentialType','genericAuthType':KIE_TYPE,
     'options':{'response':{'response':{'fullResponse':True,'neverError':True}},'timeout':60000}}
  if corps: p.update({'sendBody':True,'contentType':'json','specifyBody':'json','jsonBody':'={{ JSON.stringify($json.req.body) }}'})
  return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3dia-'+nom)),'name':nom,'type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[x,y],'parameters':p,'credentials':KIE}
def codeIA(nom,f,x,y,avecLib=False):
  js=(lib if avecLib else '')+lire(f); js=js.replace('__SECRET__',sec)
  return {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3dia-'+nom)),'name':nom,'type':'n8n-nodes-base.code','typeVersion':2,'position':[x,y],'parameters':{'jsCode':js}}
def siIA(nom,x,y,expr): n=si(nom,x); n['id']=str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3dia-'+nom)); n['position']=[x,y]; n['parameters']['conditions']['conditions'][0]['leftValue']=expr; return n
def repIA(nom,x,y): n=repondre(nom,x); n['id']=str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3dia-'+nom)); n['position']=[x,y]; return n
dlIA={'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3dia-telecharger')),'name':'Télécharger le résultat','type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[1540,200],
  'parameters':{'url':'={{ $json.url }}','sendHeaders':True,'headerParameters':{'parameters':[{'name':'User-Agent','value':'Mozilla/5.0'},{'name':'Referer','value':'https://kie.ai/'}]},
    'options':{'response':{'response':{'responseFormat':'file'}},'timeout':120000}}}
nodesIA=[
 {'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3dia-webhook')),'name':'Demande du site','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[0,0],'webhookId':'4a2f5d0e-6c1b-4c8e-9f3a-maison3d0003',
  'parameters':{'httpMethod':'POST','path':'maison3d-ia','responseMode':'responseNode','options':{'allowedOrigins':ORIGINES}}},
 codeIA('Analyser','ia_analyser.js',220,0,True), siIA('Valide ?',440,0,'={{ $json.req != null }}'), repIA('Refus',660,200),
 siIA('Démarrer ?',660,0,'={{ $json.op === "demarrer" }}'),
 kie('Envoyer l’image',880,-200,True), codeIA('Préparer la tâche','ia_tache.js',1100,-200), siIA('Image reçue ?',1320,-200,'={{ $json.req != null }}'),
 kie('Créer la tâche',1540,-300,True), codeIA('Tâche créée','ia_reponse_tache.js',1760,-300), repIA('Réponse tâche',1980,-300), repIA('Refus kie',1540,-100),
 kie('Lire la tâche',880,200,False), codeIA('État','ia_etat.js',1100,200), siIA('Prête ?',1320,200,'={{ $json.url != null }}'),
 dlIA, codeIA('Image','ia_image.js',1760,200), repIA('Réponse image',1980,200), repIA('Réponse état',1540,400)]
conIA={'Demande du site':{'main':[[mm('Analyser')]]},'Analyser':{'main':[[mm('Valide ?')]]},'Valide ?':{'main':[[mm('Démarrer ?')],[mm('Refus')]]},
 'Démarrer ?':{'main':[[mm('Envoyer l’image')],[mm('Lire la tâche')]]},
 'Envoyer l’image':{'main':[[mm('Préparer la tâche')]]},'Préparer la tâche':{'main':[[mm('Image reçue ?')]]},'Image reçue ?':{'main':[[mm('Créer la tâche')],[mm('Refus kie')]]},
 'Créer la tâche':{'main':[[mm('Tâche créée')]]},'Tâche créée':{'main':[[mm('Réponse tâche')]]},
 'Lire la tâche':{'main':[[mm('État')]]},'État':{'main':[[mm('Prête ?')]]},'Prête ?':{'main':[[mm('Télécharger le résultat')],[mm('Réponse état')]]},
 'Télécharger le résultat':{'main':[[mm('Image')]]},'Image':{'main':[[mm('Réponse image')]]}}
wfIA={'name':'Maison3D IA','nodes':nodesIA,'connections':conIA,'settings':{'executionOrder':'v1','saveDataSuccessExecution':'none','saveDataErrorExecution':'all'}}
exIA=[w for w in req('GET',B+'?limit=200')['data'] if w['name']=='Maison3D IA']
if exIA:
  iIA=exIA[0]['id']; req('POST',B+'/'+iIA+'/deactivate'); req('PUT',B+'/'+iIA,wfIA)
else:
  iIA=req('POST',B,wfIA)['id']
r=req('POST',B+'/'+iIA+'/activate'); print('workflow',iIA,'(IA) actif',r.get('active'))

# ---------- workflow « Maison3D Tripo » (étape 4) : vrai modèle 3D d'après une photo, par Tripo (API v3) ----------
# POST /webhook/maison3d-tripo (texte JSON) : solde → {solde} ; demarrer {image} → {tache} ; suivre {tache} → {etat,
# progres} ou, prêt, le fichier GLB lui-même (en-tête X-Tripo-Credits = crédits consommés).
# Clé Tripo : identifiant « Tripo Maison3D » (type « Bearer Auth », la clé secrète seule) créé par Mauro dans n8n,
# id OI1DeZBZpvIQKGwE ; une autre clé : TRIPO_CRED=<id> python3 outils/n8n/deployer.py (TRIPO_CRED= vide : non publié).
TRIPO_CRED=os.environ.get('TRIPO_CRED','OI1DeZBZpvIQKGwE')
if TRIPO_CRED:
  TRIPO={'httpBearerAuth':{'id':TRIPO_CRED,'name':os.environ.get('TRIPO_NOM','Tripo Maison3D')}}
  ident=lambda nom:str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3dtripo-'+nom))
  libT=lib+lire('tripo_commun.js')+'\n'
  def tripo(nom,x,y,corps=None):
    p={'method':'={{ $json.req.method }}','url':'={{ $json.req.url }}','authentication':'genericCredentialType','genericAuthType':'httpBearerAuth',
       'options':{'response':{'response':{'fullResponse':True,'neverError':True}},'timeout':60000}}
    if corps=='json': p.update({'sendBody':True,'contentType':'json','specifyBody':'json','jsonBody':'={{ JSON.stringify($json.req.body) }}'})
    if corps=='fichier': p.update({'sendBody':True,'contentType':'multipart-form-data','bodyParameters':{'parameters':[{'parameterType':'formBinaryData','name':'file','inputDataFieldName':'data'}]}})
    return {'id':ident(nom),'name':nom,'type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[x,y],'parameters':p,'credentials':TRIPO}
  def codeT(nom,f,x,y): return {'id':ident(nom),'name':nom,'type':'n8n-nodes-base.code','typeVersion':2,'position':[x,y],'parameters':{'jsCode':(libT+lire(f)).replace('__SECRET__',sec)}}
  def siT(nom,x,y,expr): n=si(nom,x); n['id']=ident(nom); n['position']=[x,y]; n['parameters']['conditions']['conditions'][0]['leftValue']=expr; return n
  def repT(nom,x,y,binaire=False):
    n=repondre(nom,x); n['id']=ident(nom); n['position']=[x,y]
    if binaire: n['parameters']={'respondWith':'binary','options':{'responseHeaders':{'entries':[{'name':'Content-Type','value':'model/gltf-binary'},
      {'name':'X-Tripo-Credits','value':"={{ $('État').first().json.credits }}"},{'name':'Access-Control-Expose-Headers','value':'X-Tripo-Credits'},{'name':'Cache-Control','value':'no-store'}]}}}
    return n
  dlT={'id':ident('telecharger'),'name':'Télécharger le modèle','type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[1540,300],
    'parameters':{'url':'={{ $json.url }}','options':{'response':{'response':{'responseFormat':'file'}},'timeout':180000}}}
  nodesT=[
   {'id':ident('webhook'),'name':'Demande du site','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[0,0],'webhookId':'4a2f5d0e-6c1b-4c8e-9f3a-maison3d0004',
    'parameters':{'httpMethod':'POST','path':'maison3d-tripo','responseMode':'responseNode','options':{'allowedOrigins':ORIGINES}}},
   codeT('Analyser','tripo_analyser.js',220,0), siT('Valide ?',440,0,'={{ $json.req != null }}'), repT('Refus',660,400),
   siT('Solde ?',660,0,'={{ $json.op === "solde" }}'), tripo('Lire le solde',880,-300), codeT('Solde','tripo_solde.js',1100,-300), repT('Réponse solde',1320,-300),
   siT('Démarrer ?',880,0,'={{ $json.op === "demarrer" }}'),
   tripo('Envoyer la photo',1100,-100,'fichier'), codeT('Préparer la tâche','tripo_tache.js',1320,-100), siT('Photo reçue ?',1540,-100,'={{ $json.req != null }}'),
   tripo('Créer la tâche',1760,-200,'json'), codeT('Tâche créée','tripo_reponse_tache.js',1980,-200), repT('Réponse tâche',2200,-200), repT('Refus Tripo',1760,0),
   tripo('Lire la tâche',1100,200), codeT('État','tripo_etat.js',1320,200), siT('Prêt ?',1540,200,'={{ $json.url != null }}'),
   dlT, repT('Modèle',1760,300,True), repT('Réponse état',1760,100)]
  conT={'Demande du site':{'main':[[mm('Analyser')]]},'Analyser':{'main':[[mm('Valide ?')]]},'Valide ?':{'main':[[mm('Solde ?')],[mm('Refus')]]},
   'Solde ?':{'main':[[mm('Lire le solde')],[mm('Démarrer ?')]]},'Lire le solde':{'main':[[mm('Solde')]]},'Solde':{'main':[[mm('Réponse solde')]]},
   'Démarrer ?':{'main':[[mm('Envoyer la photo')],[mm('Lire la tâche')]]},
   'Envoyer la photo':{'main':[[mm('Préparer la tâche')]]},'Préparer la tâche':{'main':[[mm('Photo reçue ?')]]},'Photo reçue ?':{'main':[[mm('Créer la tâche')],[mm('Refus Tripo')]]},
   'Créer la tâche':{'main':[[mm('Tâche créée')]]},'Tâche créée':{'main':[[mm('Réponse tâche')]]},
   'Lire la tâche':{'main':[[mm('État')]]},'État':{'main':[[mm('Prêt ?')]]},'Prêt ?':{'main':[[mm('Télécharger le modèle')],[mm('Réponse état')]]},
   'Télécharger le modèle':{'main':[[mm('Modèle')]]}}
  wfT={'name':'Maison3D Tripo','nodes':nodesT,'connections':conT,'settings':{'executionOrder':'v1','saveDataSuccessExecution':'none','saveDataErrorExecution':'all'}}
  exT=[w for w in req('GET',B+'?limit=200')['data'] if w['name']=='Maison3D Tripo']
  if exT:
    iT=exT[0]['id']; req('POST',B+'/'+iT+'/deactivate'); req('PUT',B+'/'+iT,wfT)
  else:
    iT=req('POST',B,wfT)['id']
  r=req('POST',B+'/'+iT+'/activate'); print('workflow',iT,'(Tripo) actif',r.get('active'))
else:
  print('workflow Tripo non publié : TRIPO_CRED (id de la clé « Tripo Maison3D » dans n8n) manquant')

# ---------- workflow « Maison3D Catalogue » (étape 4, livraison 3) : téléchargements Sketchfab ----------
# POST /webhook/maison3d-catalogue (texte JSON) : verifier → {nom} ; telecharger {id} → {url, taille} (adresse temporaire du
# .glb) ; fichier {url} → le .glb lui-même. Clé Sketchfab : identifiant « Sketchfab Maison3D » (type « Header Auth » :
# Name = Authorization, Value = Token <clé API Sketchfab>) créé par Mauro dans n8n : SKETCHFAB_CRED=<id> (sans lui : non publié).
SKETCHFAB_CRED=os.environ.get('SKETCHFAB_CRED','mBhIxdQpUfrxwStl')
if SKETCHFAB_CRED:
  SKF={'httpHeaderAuth':{'id':SKETCHFAB_CRED,'name':os.environ.get('SKETCHFAB_NOM','Sketchfab Maison3D (Token)')}}
  idc=lambda nom:str(uuid.uuid5(uuid.NAMESPACE_DNS,'m3dcat-'+nom))
  def codeC(nom,f,x,y,avecLib=False): return {'id':idc(nom),'name':nom,'type':'n8n-nodes-base.code','typeVersion':2,'position':[x,y],'parameters':{'jsCode':((lib if avecLib else '')+lire(f)).replace('__SECRET__',sec)}}
  def siC(nom,x,y,expr): n=si(nom,x); n['id']=idc(nom); n['position']=[x,y]; n['parameters']['conditions']['conditions'][0]['leftValue']=expr; return n
  def repC(nom,x,y,binaire=False):
    n=repondre(nom,x); n['id']=idc(nom); n['position']=[x,y]
    if binaire: n['parameters']={'respondWith':'binary','options':{'responseHeaders':{'entries':[{'name':'Content-Type','value':'model/gltf-binary'},{'name':'Cache-Control','value':'no-store'}]}}}
    return n
  sfC={'id':idc('sketchfab'),'name':'Sketchfab','type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[880,-100],'credentials':SKF,
    'parameters':{'method':'={{ $json.req.method }}','url':'={{ $json.req.url }}','authentication':'genericCredentialType','genericAuthType':'httpHeaderAuth',
      'options':{'response':{'response':{'fullResponse':True,'neverError':True}},'timeout':60000}}}
  dlC={'id':idc('fichier'),'name':'Télécharger le fichier','type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[880,200],
    'parameters':{'url':'={{ $json.url }}','options':{'response':{'response':{'responseFormat':'file'}},'timeout':300000}}}
  nodesC=[
   {'id':idc('webhook'),'name':'Demande du site','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[0,0],'webhookId':'4a2f5d0e-6c1b-4c8e-9f3a-maison3d0005',
    'parameters':{'httpMethod':'POST','path':'maison3d-catalogue','responseMode':'responseNode','options':{'allowedOrigins':ORIGINES}}},
   codeC('Analyser','catalogue_analyser.js',220,0,True), siC('Valide ?',440,0,'={{ $json.req != null }}'), repC('Refus',660,300),
   siC('Fichier ?',660,0,'={{ $json.op === "fichier" }}'), dlC, repC('Fichier',1100,200,True),
   sfC, codeC('Réponse','catalogue_reponse.js',1100,-100), repC('Réponse au site',1320,-100)]
  conC={'Demande du site':{'main':[[mm('Analyser')]]},'Analyser':{'main':[[mm('Valide ?')]]},'Valide ?':{'main':[[mm('Fichier ?')],[mm('Refus')]]},
   'Fichier ?':{'main':[[mm('Télécharger le fichier')],[mm('Sketchfab')]]},'Télécharger le fichier':{'main':[[mm('Fichier')]]},
   'Sketchfab':{'main':[[mm('Réponse')]]},'Réponse':{'main':[[mm('Réponse au site')]]}}
  wfC={'name':'Maison3D Catalogue','nodes':nodesC,'connections':conC,'settings':{'executionOrder':'v1','saveDataSuccessExecution':'none','saveDataErrorExecution':'all'}}
  exC=[w for w in req('GET',B+'?limit=200')['data'] if w['name']=='Maison3D Catalogue']
  if exC:
    iC=exC[0]['id']; req('POST',B+'/'+iC+'/deactivate'); req('PUT',B+'/'+iC,wfC)
  else:
    iC=req('POST',B,wfC)['id']
  r=req('POST',B+'/'+iC+'/activate'); print('workflow',iC,'(catalogue) actif',r.get('active'))
else:
  print('workflow Catalogue non publié : SKETCHFAB_CRED (id de la clé « Sketchfab Maison3D » dans n8n) manquant')
