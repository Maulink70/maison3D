#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pont Blender de Maison3D (14 octobre 2026).

Petit programme qui tourne sur le PC de Mauro, à côté de Blender (ouvert, avec l'extension Blender MCP) et de
Claude Code. Il demande toutes les 10 secondes au workflow n8n « Maison3D Blender » s'il y a une demande venue de
l'application (créer un objet d'après une description, une ou plusieurs images, un produit, ou modifier un objet),
lance Claude Code sans fenêtre (`claude -p`) avec la consigne `consigne_blender.md`, envoie l'avancement à l'application,
puis le modèle fini (.glb) et son aperçu dans la table Fichiers. L'application ouvre ensuite la fenêtre « Fichier 3D »
pour l'ajouter.

Utilisation (dans une invite de commandes, dans ce dossier) :
  python pont_blender.py --connexion     une fois : nom et mot de passe Maison3D (seul le jeton est gardé)
  python pont_blender.py --verifier      contrôle : connexion, Claude Code, Blender MCP
  python pont_blender.py                 le pont : attend les demandes (Ctrl+C pour l'arrêter)
  python pont_blender.py --une-fois      traite une seule demande puis s'arrête
Réglages : pont_blender.json (créé au premier lancement, à côté de ce fichier, jamais dans le dépôt).
Aucune bibliothèque à installer : Python 3.9 ou plus récent suffit.
"""
import argparse, base64, getpass, json, math, os, shutil, struct, subprocess, sys, threading, time, urllib.request, urllib.error
from pathlib import Path

VERSION = '1.0'
ICI = Path(__file__).resolve().parent
REGLAGES = ICI / 'pont_blender.json'
JOURNAL = ICI / 'pont_blender.log'
DEFAUT = {
    'n8n': 'https://n8n.srv1123557.hstgr.cloud',
    'jeton': '',
    'agent': 'PC de Mauro',
    'claude': 'claude',                      # chemin de Claude Code s'il n'est pas trouvé tout seul
    'dossier_blender': '',                   # dossier de travail de Claude Code (là où Blender MCP est configuré) ; vide = ce dossier
    'dossier_travail': '',                   # où ranger les demandes (images, .glb, aperçu) ; vide = ./travail
    'outils': 'mcp__blender,Read,Write,Edit,Glob,Grep',
    'modele': '',                            # modèle de Claude (vide = celui de Claude Code)
    'minutes_max': 45,
    'pause': 10,
    'simuler': False,                        # essai sans Blender : une simple boîte aux dimensions demandées
}
MORCEAU = int(4.5 * 1024 * 1024)


# ---------------------------------------------------------------- réglages, journal
def lire_reglages():
    r = dict(DEFAUT)
    if REGLAGES.exists():
        try:
            r.update(json.loads(REGLAGES.read_text(encoding='utf-8')))
        except Exception as e:
            dire('Réglages illisibles (' + str(e) + ') : valeurs par défaut.')
    else:
        ecrire_reglages(r)
    return r


def ecrire_reglages(r):
    REGLAGES.write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding='utf-8')


def dire(*t):
    ligne = time.strftime('%H:%M:%S') + ' ' + ' '.join(str(x) for x in t)
    try:
        print(ligne, flush=True)
    except UnicodeEncodeError:
        print(ligne.encode('ascii', 'replace').decode(), flush=True)
    try:
        with open(JOURNAL, 'a', encoding='utf-8') as f:
            f.write(time.strftime('%Y-%m-%d ') + ligne + '\n')
    except Exception:
        pass


# ---------------------------------------------------------------- appels à n8n
class Serveur:
    def __init__(self, r):
        self.r = r
        self.base = r['n8n'].rstrip('/') + '/webhook/'

    def poster(self, chemin, corps, essais=3):
        corps = dict(corps, jeton=self.r['jeton'])
        donnees = json.dumps(corps).encode('utf-8')
        derniere = None
        for k in range(essais):
            try:
                q = urllib.request.Request(self.base + chemin, data=donnees, method='POST',
                                           headers={'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': 'pont-blender/' + VERSION})
                with urllib.request.urlopen(q, timeout=60) as rep:
                    return json.loads(rep.read().decode('utf-8') or '{}')
            except urllib.error.HTTPError as e:
                derniere = 'HTTP ' + str(e.code)
                if 400 <= e.code < 500 and e.code not in (404, 429):
                    break
            except Exception as e:
                derniere = str(e)
            time.sleep(2 * (k + 1))
        return {'ok': False, 'erreur': 'serveur injoignable (' + str(derniere) + ')', 'reseau': True}

    def file(self, action, **c):
        return self.poster('maison3d-blender', dict(c, action=action, agent=self.r['agent'], version=VERSION))

    def api(self, action, **c):
        return self.poster('maison3d', dict(c, action=action))

    def lire_fichier(self, f):
        """Contenu d'un fichier de la table Fichiers ({id, n}) par le workflow « Maison3D Fichiers »."""
        morceaux = []
        for k in range(max(1, int(f.get('n') or 1))):
            url = self.base + 'maison3d-fichier?id=' + f['id'] + '&p=' + str(k) + '&j=' + urllib.request.quote(self.r['jeton'], safe='')
            b = None
            for essai in range(3):
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'pont-blender/' + VERSION}), timeout=60) as rep:
                        if 'json' in (rep.headers.get('Content-Type') or ''):
                            return None                      # refus de n8n (jeton, fichier inconnu)
                        b = rep.read()
                        break
                except Exception:
                    time.sleep(2 * (essai + 1))
            if b is None:
                return None
            morceaux.append(b)
        return b''.join(morceaux)

    def envoyer_fichier(self, octets, nom, genre, type_mime):
        """Envoie un fichier dans la table Fichiers (morceaux de 4,5 Mo) ; renvoie {id, n, type} ou None."""
        n = max(1, math.ceil(len(octets) / MORCEAU))
        if n > 8:
            raise RuntimeError('fichier trop lourd (' + str(len(octets) // 1048576) + ' Mo, 36 Mo au plus)')
        c = self.api('fichier', op='creer', nom=nom, type=genre, taille=len(octets))
        if not c.get('ok') or not c.get('id'):
            raise RuntimeError('envoi refusé : ' + str(c.get('erreur')))
        for k in range(n):
            part = octets[k * MORCEAU:(k + 1) * MORCEAU]
            r = self.api('fichier', op='contenu', id=c['id'], part=k, type=type_mime, nom=nom, donnees=base64.b64encode(part).decode('ascii'))
            if not r.get('ok'):
                raise RuntimeError('envoi du morceau ' + str(k + 1) + ' refusé : ' + str(r.get('erreur')))
        return {'id': c['id'], 'n': n, 'type': type_mime}


# ---------------------------------------------------------------- Claude Code
def commande_claude(r):
    c = r.get('claude') or 'claude'
    chemin = shutil.which(c) or (c if Path(c).exists() else None)
    if not chemin:
        return None
    if chemin.lower().endswith(('.cmd', '.bat')):
        return ['cmd', '/c', chemin]
    return [chemin]


def lancer_claude(r, consigne, dossier, etat, arret):
    """Lance Claude Code sans fenêtre ; met à jour etat (actions, dernier texte) ; renvoie (code, texte final)."""
    cmd = commande_claude(r)
    if not cmd:
        raise RuntimeError('Claude Code introuvable (réglage « claude » de pont_blender.json)')
    cmd = cmd + ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
                 '--allowedTools', r['outils'], '--max-turns', '150']
    if r.get('modele'):
        cmd += ['--model', r['modele']]
    cwd = r.get('dossier_blender') or str(dossier)
    p = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    p.stdin.write(consigne.encode('utf-8'))
    p.stdin.close()
    fin = {'texte': '', 'erreur': False}

    def lire():
        for brut in p.stdout:
            try:
                m = json.loads(brut.decode('utf-8', 'replace'))
            except Exception:
                continue
            if m.get('type') == 'assistant':
                for b in (m.get('message') or {}).get('content') or []:
                    if b.get('type') == 'tool_use':
                        etat['actions'] += 1
                        etat['outil'] = b.get('name', '')
                    elif b.get('type') == 'text' and b.get('text', '').strip():
                        etat['texte'] = ' '.join(b['text'].split())[:240]
            elif m.get('type') == 'result':
                fin['texte'] = str(m.get('result') or '')
                fin['erreur'] = bool(m.get('is_error'))
    t = threading.Thread(target=lire, daemon=True)
    t.start()
    erreurs = []
    threading.Thread(target=lambda: erreurs.append(p.stderr.read().decode('utf-8', 'replace')), daemon=True).start()
    limite = time.time() + 60 * float(r.get('minutes_max') or 45)
    while p.poll() is None:
        if arret.is_set() or time.time() > limite:
            p.kill()
            p.wait()
            raise RuntimeError('annulée' if arret.is_set() else 'trop longue (plus de ' + str(r.get('minutes_max')) + ' min)')
        time.sleep(1)
    t.join(5)
    if p.returncode != 0 and not fin['texte']:
        fin['texte'] = (erreurs[0] if erreurs else '')[-400:]
        fin['erreur'] = True
    return p.returncode, fin


# ---------------------------------------------------------------- essai sans Blender : une boîte en .glb
def boite_glb(nom, L, P, H, couleur=(0.75, 0.6, 0.45)):
    x, y, z = L / 2, H, P / 2
    faces = [((1, 0, 0), [(x, 0, -z), (x, y, -z), (x, y, z), (x, 0, z)]), ((-1, 0, 0), [(-x, 0, z), (-x, y, z), (-x, y, -z), (-x, 0, -z)]),
             ((0, 1, 0), [(-x, y, -z), (-x, y, z), (x, y, z), (x, y, -z)]), ((0, -1, 0), [(-x, 0, z), (-x, 0, -z), (x, 0, -z), (x, 0, z)]),
             ((0, 0, 1), [(-x, 0, z), (x, 0, z), (x, y, z), (-x, y, z)]), ((0, 0, -1), [(x, 0, -z), (-x, 0, -z), (-x, y, -z), (x, y, -z)])]
    pos, nor, idx = [], [], []
    for n, q in faces:
        b = len(pos)
        pos += q
        nor += [n] * 4
        idx += [b, b + 1, b + 2, b, b + 2, b + 3]
    binp = b''.join(struct.pack('<3f', *v) for v in pos)
    binn = b''.join(struct.pack('<3f', *v) for v in nor)
    bini = b''.join(struct.pack('<H', i) for i in idx)
    binaire = binp + binn + bini
    binaire += b'\0' * ((4 - len(binaire) % 4) % 4)
    g = {'asset': {'version': '2.0', 'generator': 'pont-blender (essai)'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
         'nodes': [{'name': nom, 'mesh': 0}],
         'meshes': [{'name': nom, 'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1}, 'indices': 2, 'material': 0}]}],
         'materials': [{'name': 'bois', 'pbrMetallicRoughness': {'baseColorFactor': list(couleur) + [1], 'metallicFactor': 0, 'roughnessFactor': 0.7}}],
         'buffers': [{'byteLength': len(binaire)}],
         'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(binp), 'target': 34962},
                         {'buffer': 0, 'byteOffset': len(binp), 'byteLength': len(binn), 'target': 34962},
                         {'buffer': 0, 'byteOffset': len(binp) + len(binn), 'byteLength': len(bini), 'target': 34963}],
         'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 24, 'type': 'VEC3', 'min': [-x, 0, -z], 'max': [x, y, z]},
                       {'bufferView': 1, 'componentType': 5126, 'count': 24, 'type': 'VEC3'},
                       {'bufferView': 2, 'componentType': 5123, 'count': 36, 'type': 'SCALAR'}]}
    js = json.dumps(g).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binaire)
    return struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binaire), 0x004E4942) + binaire


# ---------------------------------------------------------------- une demande
EXT = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'model/gltf-binary': '.glb'}
DETAILS = {'simple': 'simple (formes principales, rapide)', 'normal': 'normal (comme les meubles de la base « Réalisme »)', 'detaille': 'très détaillé (poignées, chanfreins, coutures, matières fines)'}


def consigne_pour(d, dossier, images, source_glb, source_image):
    modele = (ICI / 'consigne_blender.md').read_text(encoding='utf-8')
    dims = [('largeur', d.get('L')), ('profondeur', d.get('P')), ('hauteur', d.get('H'))]
    dims_txt = ', '.join(f'{k} {v:g} cm' for k, v in dims if v) or 'non données : choisis des dimensions réalistes pour cet objet'
    if d.get('type') == 'modifier' and not any(v for _, v in dims):
        dims_txt = 'celles de l’objet actuel (voir ci-dessous), sauf si la demande dit autre chose'
    if d.get('type') == 'modifier':
        sd = (d.get('source') or {}).get('dims') or {}
        sdims = ', '.join(f'{k} {sd.get(c):g} cm' for k, c in (('largeur', 'L'), ('profondeur', 'P'), ('hauteur', 'H')) if sd.get(c))
        if source_glb:
            source = (f"## Objet à modifier : « {(d.get('source') or {}).get('nom') or d.get('nom')} »\n"
                      f"- Son fichier actuel : `{source_glb}`. Importe-le dans la scène neuve (`bpy.ops.import_scene.gltf`), applique **seulement** "
                      "les changements demandés et garde tout le reste (formes, matières, textures, noms des parties, dimensions sauf demande contraire).\n"
                      + (f"- Taille affichée dans l'application : {sdims} (garde-la, sauf demande contraire).\n" if sdims else ''))
        else:
            source = (f"## Élément de la maquette à refaire : « {(d.get('source') or {}).get('nom') or d.get('nom')} »\n"
                      + (f"- Image de l'élément actuel (vue de la maquette, formes simplifiées) : `{source_image}`.\n" if source_image else '')
                      + (f"- Ses dimensions dans la maquette : {sdims}.\n" if sdims else '')
                      + "- Refais-le en vrai modèle détaillé, avec les changements demandés.\n")
    else:
        source = ''
    remplacer = {
        '{{TYPE}}': 'modifier un objet existant' if d.get('type') == 'modifier' else 'créer un nouvel objet',
        '{{NOM}}': d.get('nom') or 'Objet',
        '{{DESCRIPTION}}': d.get('description') or '(aucune : d’après les images)',
        '{{DIMENSIONS}}': dims_txt,
        '{{DETAIL}}': DETAILS.get(d.get('detail') or 'normal', DETAILS['normal']),
        '{{TEXTURES}}': 'oui : vraies matières (bois veiné, tissu, métal brossé…), textures répétables dessinées en numpy, 1024 px' if d.get('textures', True)
                        else 'non : couleurs unies (matériaux PBR sans image), pour un fichier très léger',
        '{{IMAGES}}': '\n'.join(f'  - `{p}`' for p in images) if images else '  (aucune)',
        '{{LIEN}}': d.get('lien') or '(aucun)',
        '{{SOURCE}}': source,
        '{{SCENE}}': 'M3D_' + d['id'],
        '{{SORTIE_GLB}}': str(dossier / 'resultat.glb'),
        '{{SORTIE_APERCU}}': str(dossier / 'apercu.png'),
        '{{SORTIE_INFOS}}': str(dossier / 'infos.json'),
        '{{DOSSIER}}': str(dossier),
    }
    for k, v in remplacer.items():
        modele = modele.replace(k, str(v))
    return modele


def estimer(d, ecoule):
    t = {'simple': 240, 'normal': 480, 'detaille': 900}.get(d.get('detail') or 'normal', 480)
    return int(min(95, 5 + 90 * (1 - math.exp(-ecoule / t))))


def traiter(srv, r, d):
    debut = time.time()
    racine = Path(r.get('dossier_travail') or (ICI / 'travail'))
    dossier = racine / d['id']
    dossier.mkdir(parents=True, exist_ok=True)
    dire('Demande', d['id'], '«', d.get('nom'), '» de', d.get('qui'), '(' + d.get('type', 'creer') + ')')
    srv.file('avancer', id=d['id'], p=2, texte='Le PC prépare la demande (images)…')
    images = []
    for k, f in enumerate(d.get('images') or []):
        b = srv.lire_fichier(f)
        if b:
            p = dossier / ('image' + str(k + 1) + EXT.get(f.get('type') or '', '.png'))
            p.write_bytes(b)
            images.append(p)
    source_glb = source_image = None
    s = d.get('source') or {}
    if s.get('fic'):
        b = srv.lire_fichier(s['fic'])
        if not b:
            raise RuntimeError('le fichier de l’objet à modifier n’a pas pu être lu')
        source_glb = dossier / 'objet_actuel.glb'
        source_glb.write_bytes(b)
    if s.get('image'):
        b = srv.lire_fichier(s['image'])
        if b:
            source_image = dossier / ('element_actuel' + EXT.get(s['image'].get('type') or '', '.png'))
            source_image.write_bytes(b)
    for f in ('resultat.glb', 'apercu.png', 'infos.json'):
        (dossier / f).unlink(missing_ok=True)

    etat = {'actions': 0, 'texte': '', 'outil': ''}
    arret = threading.Event()
    resultat = {}

    def travailler():
        try:
            if r.get('simuler'):
                time.sleep(3)
                L, P, H = (float(d.get(k) or v) / 100 for k, v in (('L', 80), ('P', 50), ('H', 80)))
                (dossier / 'resultat.glb').write_bytes(boite_glb(d.get('nom') or 'Objet', L, P, H))
                (dossier / 'infos.json').write_text(json.dumps({'L': L * 100, 'P': P * 100, 'H': H * 100, 'triangles': 12, 'notes': 'Essai sans Blender : une boîte aux dimensions demandées.'}), encoding='utf-8')
                resultat['code'], resultat['fin'] = 0, {'texte': 'essai', 'erreur': False}
            else:
                consigne = consigne_pour(d, dossier, images, source_glb, source_image)
                (dossier / 'consigne.md').write_text(consigne, encoding='utf-8')
                resultat['code'], resultat['fin'] = lancer_claude(r, consigne, dossier, etat, arret)
        except Exception as e:
            resultat['erreur'] = str(e)
    t = threading.Thread(target=travailler, daemon=True)
    t.start()
    dernier = 0
    while t.is_alive():
        t.join(1)
        if time.time() - dernier >= 15:
            dernier = time.time()
            ec = time.time() - debut
            texte = ('Claude Code travaille dans Blender'
                     + (f' · {etat["actions"]} actions' if etat['actions'] else '')
                     + (' · « ' + etat['texte'][:140] + ' »' if etat['texte'] else ''))
            a = srv.file('avancer', id=d['id'], p=estimer(d, ec), texte=texte)
            if a.get('annule') or a.get('etat') in ('annule', 'fini', 'echec'):
                dire('Demande annulée depuis l’application : arrêt.')
                arret.set()
    if arret.is_set():
        return
    if resultat.get('erreur'):
        raise RuntimeError(resultat['erreur'])
    infos = {}
    if (dossier / 'infos.json').exists():
        try:
            infos = json.loads((dossier / 'infos.json').read_text(encoding='utf-8'))
        except Exception:
            infos = {}
    glb = dossier / 'resultat.glb'
    if infos.get('erreur') or not glb.exists() or glb.stat().st_size < 200:
        raison = infos.get('erreur') or (resultat.get('fin') or {}).get('texte') or 'aucun fichier .glb produit'
        raise RuntimeError(' '.join(str(raison).split())[:500])
    srv.file('avancer', id=d['id'], p=97, texte='Envoi du modèle à l’application…')
    octets = glb.read_bytes()
    f = srv.envoyer_fichier(octets, 'blender ' + (d.get('nom') or 'objet'), 'glb', 'model/gltf-binary')
    apercu = None
    if (dossier / 'apercu.png').exists() and (dossier / 'apercu.png').stat().st_size < 4 * 1048576:
        try:
            apercu = srv.envoyer_fichier((dossier / 'apercu.png').read_bytes(), 'apercu blender ' + (d.get('nom') or 'objet'), 'photo', 'image/png')
        except Exception as e:
            dire('Aperçu non envoyé :', e)
    dims = {k: infos.get(k) for k in ('L', 'P', 'H') if isinstance(infos.get(k), (int, float))}
    corps = dict(id=d['id'], fichier=f, apercu=apercu, taille=len(octets), triangles=int(infos.get('triangles') or 0), dims=dims or None,
                 notes=str(infos.get('notes') or '')[:1400], duree=int(time.time() - debut), texte='Fini')
    for essai in range(4):
        rep = srv.file('finir', **corps)
        if rep.get('etat') == 'fini' or rep.get('annule'):
            break
        time.sleep(3)
        # vérifier que « fini » a bien été gardé (deux écritures en même temps peuvent s'écraser)
        e = srv.file('etat')
        if any(x.get('id') == d['id'] and x.get('etat') == 'fini' for x in e.get('demandes') or []):
            break
    dire('Fini en', int(time.time() - debut), 's :', len(octets) // 1024, 'Ko')


# ---------------------------------------------------------------- commandes
def connexion(r):
    srv = Serveur(r)
    ident = input('Nom (identifiant Maison3D) : ').strip()
    mdp = getpass.getpass('Mot de passe (ne s’affiche pas) : ')
    c = srv.poster('maison3d', {'action': 'connexion', 'identifiant': ident, 'motDePasse': mdp})
    if not c.get('ok'):
        print('Refusé :', c.get('erreur'))
        return 1
    r['jeton'] = c['jeton']
    ecrire_reglages(r)
    print('Connecté :', c.get('nom'), '— jeton gardé dans', REGLAGES.name, '(valable un an).')
    return 0


def verifier(r):
    ok = True
    srv = Serveur(r)
    e = srv.file('etat')
    print('Connexion à n8n :', 'oui' if e.get('ok') else 'NON (' + str(e.get('erreur')) + ')')
    ok &= bool(e.get('ok'))
    cmd = commande_claude(r)
    print('Claude Code :', ' '.join(cmd) if cmd else 'INTROUVABLE')
    ok &= bool(cmd)
    if cmd and not r.get('simuler'):
        cwd = r.get('dossier_blender') or str(ICI)
        print('Essai de Blender MCP (dossier', cwd, ')…')
        try:
            p = subprocess.run(cmd + ['-p', '--allowedTools', 'mcp__blender', '--max-turns', '4'], input=(
                'Appelle l’outil mcp__blender__get_scene_info, puis réponds en une ligne : « BLENDER OK : <nom de la scène>, <nombre d’objets> objets ». '
                'Si l’outil est absent ou ne répond pas, réponds « BLENDER ABSENT : <raison> ».').encode('utf-8'),
                cwd=cwd, capture_output=True, timeout=240, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            sortie = p.stdout.decode('utf-8', 'replace').strip()
            print('Réponse :', sortie[-300:])
            ok &= 'BLENDER OK' in sortie
        except Exception as ex:
            print('Essai impossible :', ex)
            ok = False
    print('Tout est prêt.' if ok else 'Quelque chose manque (voir ci-dessus).')
    return 0 if ok else 1


def boucle(r, une_fois=False):
    if not r.get('jeton'):
        print('Pas encore connecté : lancez d’abord  python pont_blender.py --connexion')
        return 1
    srv = Serveur(r)
    dire('Pont Blender', VERSION, 'démarré (' + r['agent'] + ')' + (' — ESSAI SANS BLENDER' if r.get('simuler') else '') + '. Ctrl+C pour arrêter.')
    depart, silence = True, 0
    while True:
        try:
            rep = srv.file('prendre', depart=depart)
            depart = False
            if not rep.get('ok'):
                if rep.get('code') == 401:
                    dire('Jeton refusé : relancez  python pont_blender.py --connexion')
                    return 1
                silence += 1
                if silence in (1, 10) or silence % 60 == 0:
                    dire('n8n ne répond pas :', rep.get('erreur'))
                time.sleep(r['pause'])
                continue
            silence = 0
            d = rep.get('demande')
            if d:
                try:
                    traiter(srv, r, d)
                except Exception as e:
                    dire('Échec :', e)
                    srv.file('echouer', id=d['id'], erreur=str(e)[:500])
                if une_fois:
                    return 0
                continue
            time.sleep(r['pause'])
        except KeyboardInterrupt:
            dire('Arrêt demandé.')
            return 0


def main():
    a = argparse.ArgumentParser(description='Pont Blender de Maison3D')
    a.add_argument('--connexion', action='store_true')
    a.add_argument('--verifier', action='store_true')
    a.add_argument('--une-fois', action='store_true')
    a.add_argument('--simuler', action='store_true', help='essai sans Blender (boîte)')
    o = a.parse_args()
    r = lire_reglages()
    if o.simuler:
        r['simuler'] = True
    if o.connexion:
        return connexion(r)
    if o.verifier:
        return verifier(r)
    return boucle(r, o.une_fois)


if __name__ == '__main__':
    sys.exit(main())
