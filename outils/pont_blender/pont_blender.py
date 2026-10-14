#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pont Blender de Maison3D (14 octobre 2026).

Petit programme qui tourne sur le PC de Mauro, à côté de Blender (ouvert, avec l'extension Blender MCP) et de
Claude Code. Il demande toutes les 10 secondes au workflow n8n « Maison3D Blender » s'il y a une demande venue de
l'application (créer un objet d'après une description, une ou plusieurs images, un produit, ou modifier un objet),
ouvre Blender s'il est fermé, lance Claude Code sans fenêtre (`claude -p`) avec la consigne `consigne_blender.md`, envoie
l'avancement à l'application, puis le modèle fini (.glb) et son aperçu dans la table Fichiers ; il copie aussi le .glb
dans le Drive, dans le dossier de sa pièce (« Objets 3D/Rez/Salon »…). L'application ouvre ensuite la fenêtre
« Fichier 3D » pour l'ajouter.

Utilisation (dans une invite de commandes, dans ce dossier) :
  python pont_blender.py --connexion     une fois : nom et mot de passe Maison3D (seul le jeton est gardé)
  python pont_blender.py --verifier      contrôle : connexion, Claude Code, Blender MCP
  python pont_blender.py                 le pont : attend les demandes (Ctrl+C pour l'arrêter)
  python pont_blender.py --une-fois      traite une seule demande puis s'arrête
Réglages : pont_blender.json (créé au premier lancement, à côté de ce fichier, jamais dans le dépôt).
Aucune bibliothèque à installer : Python 3.9 ou plus récent suffit.
"""
import argparse, base64, getpass, glob, json, math, os, re, shutil, socket, struct, subprocess, sys, threading, time, unicodedata, urllib.request, urllib.error
from pathlib import Path

VERSION = '1.5'
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
    'ouvrir_blender': True,                  # Blender fermé quand une demande arrive : le pont l'ouvre
    'blender_exe': '',                       # chemin de blender.exe ; vide = cherché tout seul
    'fichier_blender': '',                   # fichier .blend à ouvrir avec Blender (vide = scène de départ de Blender)
    'port_blender': 9876,                    # port de l'extension Blender MCP (« MCP for Blender ») du Blender de Mauro
    'blender_a_part': True,                  # le pont a son propre Blender (fenêtre à part) : un plantage n'emporte pas celui de Mauro
    'port_pont': 9877,                       # port de Blender MCP dans le Blender du pont
    'fermer_apres_min': 10,                  # le Blender du pont se ferme seul après tant de minutes sans demande (0 = jamais)
    'dossier_drive': '',                     # dossier « Objets 3D » du Drive sur ce PC ; vide = cherché tout seul ; « non » = pas de copie
    'dossiers_pieces': {},                   # sous-dossiers des pièces s'ils changent de nom, ex. {"salon": "Rez/Salon"}
    'dossier_miroir': '',                    # copie de plus, sur le PC, au même rangement (vide = aucune)
    'ajouter_aux_plans': True,               # chaque objet fini est aussi ajouté au plan Blender de son niveau
    'plans': {},                             # {"rez": chemin, "etage": chemin} ; vide = meubles_rez.blend / meubles_etage.blend du dossier_blender
    'plans_intervalle': 60,                  # toutes les combien de secondes regarder si un plan en attente est fermé
    'repere_plans': {},                      # {"rez": [ox, oz, sol], …} : site (x, y, z) → plan X = x − ox, Y = −(z − oz), Z = y − sol
                                             # (y = sol du niveau : 0 au rez, 2,74 à l'étage) ; vide = pas de repère connu
}
# centre de chaque pièce (x, z du site, mètres) : place d'un objet dans le plan quand on ne connaît pas mieux
CENTRES = {
    'salon': (16.16, -17.73), 'cuisine': (17.22, -23.02), 'entree': (12.64, -21.85), 'degagement': (13.98, -23.76),
    'chambre': (17.16, -26.41), 'sdb': (13.03, -26.96), 'wc': (12.16, -23.28), 'portes_rez': (15.40, -21.00),
    'mezzanine': (15.40, -23.82), 'dressing': (12.64, -24.68), 'chambre_etage': (18.11, -24.68), 'douche': (18.11, -21.97),
    'portes_etage': (15.40, -21.00),
}
ETAGE = {'mezzanine', 'dressing', 'chambre_etage', 'douche', 'portes_etage'}
# sous-dossiers du Drive (« Maison 3D/Objets 3D/… ») où ranger le modèle d'après la pièce choisie dans l'application
DOSSIERS = {
    'salon': 'Rez/Salon', 'cuisine': 'Rez/Cuisine', 'entree': 'Rez/Entrée et réduit', 'degagement': 'Rez/Dégagement',
    'wc': 'Rez/WC-buanderie', 'chambre': 'Rez/Chambre', 'sdb': 'Rez/Salle de bain', 'portes_rez': 'Rez/Portes-fenêtres-stores',
    'mezzanine': 'Étage/Mezzanine et coin bureau', 'dressing': 'Étage/Dressing', 'chambre_etage': 'Étage/Chambre',
    'douche': 'Étage/Douche-WC', 'portes_etage': 'Étage/Portes-fenêtres',
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
            return r
        try:
            if any(k not in json.loads(REGLAGES.read_text(encoding='utf-8')) for k in DEFAUT):
                ecrire_reglages(r)           # nouveaux réglages ajoutés au fichier (les valeurs de Mauro sont gardées)
        except Exception:
            pass
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
    # Blender MCP (« uvx mcp-for-blender », lancé par Claude Code) lit son port dans BLENDER_PORT
    p = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         env=dict(os.environ, BLENDER_PORT=str(port_actif(r))), creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
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


# ---------------------------------------------------------------- Blender : ouvert tout seul s'il est fermé
def port_actif(r):
    """Port de Blender MCP utilisé par le pont : celui de son propre Blender, ou celui du Blender de Mauro."""
    return int(r.get('port_pont') or 9877) if r.get('blender_a_part', True) else int(r.get('port_blender') or 9876)


PROCESSUS = {}                               # le Blender ouvert par le pont (Popen), s'il y en a un


def blender_repond(r, attente=1.0):
    """Vrai si l'extension Blender MCP écoute (Blender ouvert, serveur démarré)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(attente)
    try:
        s.connect(('127.0.0.1', port_actif(r)))
        return True
    except Exception:
        return False
    finally:
        s.close()


def blender_lance():
    """Vrai si un processus Blender tourne déjà."""
    try:
        if os.name == 'nt':
            o = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq blender.exe', '/NH'], capture_output=True, timeout=20,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)).stdout.decode('utf-8', 'replace').lower()
            return 'blender.exe' in o
        return subprocess.run(['pgrep', '-x', 'blender'], capture_output=True, timeout=20).returncode == 0
    except Exception:
        return False


def trouver_blender(r):
    c = r.get('blender_exe') or ''
    if c and Path(c).exists():
        return c
    w = shutil.which('blender')
    if w:
        return w
    if os.name == 'nt':
        cands = []
        for base in (os.environ.get('ProgramFiles', r'C:\Program Files'), os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'),
                     os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs')):
            cands += glob.glob(os.path.join(base, 'Blender Foundation', 'Blender*', 'blender.exe'))
        cands += glob.glob(os.path.join(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'), 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe'))

        def version(p):
            m = re.search(r'Blender\s*(\d+)\.(\d+)', p)
            return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
        cands.sort(key=version, reverse=True)
        if cands:
            return cands[0]
    return None


def avancer(srv, d, texte):
    if srv and d:
        srv.file('avancer', id=d['id'], p=2, texte=texte)


def assurer_blender(srv, r, d):
    """Avant une demande : Blender et Blender MCP doivent répondre ; sinon le pont ouvre Blender et attend.
    Blender à part (réglage par défaut) : le pont ouvre son propre Blender, à côté de celui de Mauro, sur un autre port."""
    if r.get('simuler') or blender_repond(r):
        return
    if r.get('blender_a_part', True):
        p = PROCESSUS.get('blender')
        if p and p.poll() is None:
            # notre Blender tourne (il démarre encore, ou son serveur s'est arrêté) : on attend un peu, sinon on le relance
            avancer(srv, d, 'Le PC attend que son Blender réponde…')
            for _ in range(30):
                time.sleep(2)
                if blender_repond(r):
                    return
            dire('Le Blender du pont ne répond plus : fermé et rouvert.')
            try:
                p.kill()
            except Exception:
                pass
        ouvrir_blender(srv, r, d)
        return
    if blender_lance():
        # Blender ouvert (peut-être en train de démarrer) mais Blender MCP ne répond pas encore
        srv.file('avancer', id=d['id'], p=2, texte='Le PC attend que Blender MCP réponde…')
        for _ in range(45):
            time.sleep(2)
            if blender_repond(r):
                return
        raise RuntimeError('Blender est ouvert mais Blender MCP ne répond pas : dans Blender, touche N, onglet « MCP for Blender », '
                           '« Start MCP Server », puis « Relancer » la demande')
    if not r.get('ouvrir_blender', True):
        raise RuntimeError('Blender est fermé sur le PC : ouvrez-le, puis « Relancer » la demande')
    ouvrir_blender(srv, r, d)


def fermer_si_inactif(r):
    """Le Blender ouvert par le pont (à part) se ferme après « fermer_apres_min » minutes sans demande."""
    p, m = PROCESSUS.get('blender'), float(r.get('fermer_apres_min') or 0)
    if not p or p.poll() is not None or not m or not r.get('blender_a_part', True):
        return
    if time.time() - PROCESSUS.get('fin', time.time()) > 60 * m:
        dire('Aucune demande depuis', int(m), 'min : le Blender du pont est fermé (il se rouvrira à la prochaine).')
        try:
            p.terminate()
        except Exception:
            pass
        PROCESSUS.pop('blender', None)


def ouvrir_blender(srv, r, d):
    exe = trouver_blender(r)
    fichier = r.get('fichier_blender') or ''
    if not exe and not (fichier and os.name == 'nt' and Path(fichier).exists()):
        raise RuntimeError('Blender est fermé et blender.exe est introuvable (réglage « blender_exe » de pont_blender.json)')
    a_part = r.get('blender_a_part', True)
    dire('Ouverture du Blender du pont (port ' + str(port_actif(r)) + ')…' if a_part else 'Blender est fermé : ouverture…')
    avancer(srv, d, 'Le PC ouvre son Blender…' if a_part else 'Le PC ouvre Blender…')
    env = dict(os.environ, M3D_PORT=str(port_actif(r)))
    if exe:
        # Blender à part : sans fichier (le réglage « fichier_blender » ne sert qu'au Blender partagé)
        cmd = [exe] + ([fichier] if fichier and not a_part and Path(fichier).exists() else []) + ['--python', str(ICI / 'demarrer_blender_mcp.py')]
        drapeaux = getattr(subprocess, 'DETACHED_PROCESS', 0) | getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
        PROCESSUS['fin'] = time.time()
        PROCESSUS['blender'] = subprocess.Popen(cmd, cwd=str(Path(exe).parent), env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                                stderr=subprocess.DEVNULL, close_fds=True, creationflags=drapeaux)
    elif a_part:
        raise RuntimeError('blender.exe introuvable : le pont ne peut pas ouvrir son Blender (réglage « blender_exe » de pont_blender.json)')
    else:
        os.startfile(fichier)                # .blend ouvert par Windows avec Blender (l'extension démarre son serveur seule)
    for _ in range(90):
        time.sleep(2)
        if blender_repond(r):
            time.sleep(4)                    # le temps que Blender finisse de s'ouvrir
            dire('Blender est ouvert, Blender MCP répond.')
            return
    raise RuntimeError('Blender a été ouvert mais Blender MCP ne répond pas (3 min) : vérifiez l’extension « MCP for Blender » '
                       '(touche N, onglet « MCP for Blender », « Start MCP Server »), puis « Relancer » la demande')


# ---------------------------------------------------------------- Drive : copie du modèle dans le dossier de sa pièce
def simple(t):
    """Nom sans accents, minuscules, lettres et chiffres seulement (pour comparer des noms de dossiers)."""
    t = unicodedata.normalize('NFKD', str(t)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '', t)


def sous_dossier(parent, nom, creer=False):
    """Sous-dossier de parent au nom proche (accents, majuscules, tirets et espaces ignorés) ; créé si besoin."""
    p = Path(parent) / nom
    if p.is_dir():
        return p
    try:
        for x in Path(parent).iterdir():
            if x.is_dir() and simple(x.name) == simple(nom):
                return x
    except Exception:
        return None
    if creer:
        p.mkdir(parents=True, exist_ok=True)
        return p
    return None


def trouver_drive(r):
    c = (r.get('dossier_drive') or '').strip()
    if c.lower() == 'non':
        return None
    if c:
        return Path(c) if Path(c).is_dir() else None
    racines = []
    if os.name == 'nt':
        for l in 'GHIJKLMNOPQRSTUVWXYZDEF':
            for md in ('Mon Drive', 'My Drive'):
                racines.append(Path(l + ':\\') / md)
    for md in ('Mon Drive', 'My Drive', 'Google Drive', 'Google Drive/Mon Drive', 'Google Drive/My Drive'):
        racines.append(Path.home() / md)
    for base in racines:
        if not base.is_dir():
            continue
        m = sous_dossier(base, 'Maison 3D')
        o = m and sous_dossier(m, 'Objets 3D')
        if o:
            return o
    return None


def nom_fichier(nom):
    t = unicodedata.normalize('NFKD', str(nom or 'objet')).encode('ascii', 'ignore').decode().lower()
    return (re.sub(r'[^a-z0-9]+', '_', t).strip('_') or 'objet')[:60]


def ranger(racine, rel, nom, glb):
    """Copie glb dans racine/rel (sous-dossiers créés au besoin) sous un nom libre (« tabouret_chene_2.glb »)."""
    dossier = Path(racine)
    for part in rel.replace('\\', '/').split('/'):
        dossier = sous_dossier(dossier, part, creer=True)
    base = nom_fichier(nom)
    cible = dossier / (base + '.glb')
    k = 2
    while cible.exists():
        cible = dossier / (base + '_' + str(k) + '.glb')
        k += 1
    shutil.copyfile(glb, cible)
    return str(cible.relative_to(racine)).replace('\\', '/')


def copier_drive(r, d, glb):
    """Copie le .glb dans « Objets 3D/<niveau>/<pièce> » du Drive ; renvoie (chemin relatif, None) ou (None, raison).
    Drive pour ordinateur arrêté (pas de lecteur G:) : pas de copie, une ligne au journal, la demande n'échoue pas."""
    rel = dict(DOSSIERS, **(r.get('dossiers_pieces') or {})).get(d.get('piece') or '')
    if rel and r.get('dossier_miroir') and Path(r['dossier_miroir']).is_dir():
        try:
            dire('Copie sur le PC :', ranger(r['dossier_miroir'], rel, d.get('nom'), glb))
        except Exception as e:
            dire('Copie sur le PC impossible :', e)
    if (r.get('dossier_drive') or '').strip().lower() == 'non':
        return None, None
    if not rel:
        return None, 'pièce non choisie : pas de copie dans le Drive'
    racine = trouver_drive(r)
    if not racine:
        return None, 'Drive introuvable sur le PC (Google Drive pour ordinateur arrêté ?) : pas de copie dans « Objets 3D »'
    return ranger(racine, rel, d.get('nom'), glb), None


# ---------------------------------------------------------------- plans Blender : objets ajoutés à meubles_rez / meubles_etage
def chemin_plan(r, niv):
    c = (r.get('plans') or {}).get(niv) or ''
    if c:
        return Path(c)
    base = r.get('dossier_blender') or ''
    return Path(base) / ('meubles_etage.blend' if niv == 'etage' else 'meubles_rez.blend') if base else None


def file_plans(r):
    return Path(r.get('dossier_travail') or (ICI / 'travail')) / 'plans_en_attente.json'


def lire_file_plans(r):
    try:
        return json.loads(file_plans(r).read_text(encoding='utf-8'))
    except Exception:
        return []


def ecrire_file_plans(r, l):
    f = file_plans(r)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(l, ensure_ascii=False, indent=1), encoding='utf-8')


def plan_ouvert(plan):
    """Vrai si le plan est ouvert dans une fenêtre de Blender (titre « meubles_rez [chemin] - Blender »)."""
    nom = plan.stem.lower()
    try:
        if os.name == 'nt':
            o = subprocess.run(['tasklist', '/v', '/fo', 'csv', '/fi', 'IMAGENAME eq blender.exe'], capture_output=True, timeout=20,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)).stdout.decode('utf-8', 'replace').lower()
            return any(nom in ligne.split('","')[-1] for ligne in o.splitlines()[1:])
        o = subprocess.run(['ps', '-eo', 'args'], capture_output=True, timeout=20).stdout.decode('utf-8', 'replace')
        return any(str(plan) in l and 'blender' in l and ' -b ' not in l for l in o.splitlines())
    except Exception:
        return False


def sauvegarder_plan(plan):
    """Copie du plan avant d'y toucher (les 5 dernières gardées dans « sauvegardes_pont »)."""
    d = plan.parent / 'sauvegardes_pont'
    d.mkdir(exist_ok=True)
    shutil.copy2(plan, d / (plan.stem + '_' + time.strftime('%Y%m%d_%H%M%S') + '.blend'))
    for vieux in sorted(d.glob(plan.stem + '_*.blend'))[:-5]:
        try:
            vieux.unlink()
        except Exception:
            pass


def mettre_en_attente_plan(r, d, dossier, glb):
    """Après une demande finie : l'objet attend d'être ajouté au plan de son niveau."""
    if not r.get('ajouter_aux_plans', True) or r.get('simuler'):
        return
    piece = d.get('piece') or ''
    place = d.get('place') or {}
    niv = 'etage' if (piece in ETAGE or (not piece and place.get('niv') == 'etage')) else 'rez'
    if chemin_plan(r, niv) is None:
        return                               # aucun plan connu sur ce PC (dossier_blender vide)
    blend = dossier / 'objet.blend'
    l = [x for x in lire_file_plans(r) if x.get('id') != d['id']]
    l.append({'id': d['id'], 'nom': d.get('nom') or 'Objet', 'piece': piece, 'niv': niv, 'place': place or None,
              'blend': str(blend) if blend.exists() else '', 'glb': str(glb), 'quand': time.strftime('%Y-%m-%d %H:%M'), 'fait': False, 'essais': 0})
    ecrire_file_plans(r, l)


def position_plan(r, item):
    """Place et rotation dans le repère du plan : place connue (remplacement, photo calée), sinon centre de la pièce.
    Hauteur : le sol du niveau (0 au rez, 2,74 à l'étage), les plans gardant les hauteurs du site (session BLENDER)."""
    rep_ = (r.get('repere_plans') or {}).get(item['niv'])
    if not rep_:
        return [0, 0, 0], 0, 'origine'
    ox, oz, sol = (list(rep_) + [0, 0, 0])[:3]
    p = item.get('place') or {}
    x, z = (p.get('x'), p.get('z')) if p.get('x') is not None else CENTRES.get(item.get('piece'), CENTRES['salon'])
    y = 2.74 if item.get('niv') == 'etage' else 0.0
    return [round(x - ox, 4), round(-(z - oz), 4), round(y - sol, 4)], float(p.get('r') or 0), ('exacte' if p.get('x') is not None else 'piece')


def ajouter_aux_plans(srv, r):
    """Ajoute aux plans les objets en attente dont le plan n'est pas ouvert dans Blender."""
    l = lire_file_plans(r)
    if not any(not x.get('fait') for x in l):
        return
    exe = trouver_blender(r)
    change = False
    for item in l:
        if item.get('fait'):
            continue
        plan = chemin_plan(r, item['niv'])
        nomp = plan.name if plan else 'plan'
        if not plan or not plan.exists():
            item.update(fait=True, erreur='plan introuvable : ' + str(plan))
            srv.file('plan', id=item['id'], etat='echec', texte='Plan Blender introuvable (' + nomp + ') : objet non ajouté.')
            change = True
            continue
        if not exe:
            return
        if plan_ouvert(plan):
            if not item.get('annonce'):
                item['annonce'] = True
                change = True
                srv.file('plan', id=item['id'], etat='attente',
                         texte=f'En attente : {nomp} est ouvert dans Blender. Il y sera ajouté dès qu’il sera fermé.')
            continue
        dossier = Path(item['glb']).parent
        pos, rot, mode = position_plan(r, item)
        args = {'id': item['id'], 'nom': item['nom'], 'blend': item.get('blend') or '', 'glb': item['glb'],
                'collection': NOMS_PIECES.get(item.get('piece'), 'Divers'), 'parent': 'Créés depuis l’application',
                'position': pos, 'rotation': rot, 'sortie': str(dossier / 'plan_resultat.json')}
        (dossier / 'plan_demande.json').write_text(json.dumps(args, ensure_ascii=False), encoding='utf-8')
        (dossier / 'plan_resultat.json').unlink(missing_ok=True)
        try:
            sauvegarder_plan(plan)
            subprocess.run([exe, '-b', '--factory-startup', str(plan), '--python', str(ICI / 'ajouter_au_plan.py'), '--',
                            str(dossier / 'plan_demande.json')], cwd=str(Path(exe).parent), capture_output=True, timeout=300,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            res = json.loads((dossier / 'plan_resultat.json').read_text(encoding='utf-8'))
        except Exception as e:
            res = {'ok': False, 'erreur': str(e)[:300]}
        change = True
        if res.get('ok'):
            item.update(fait=True, ajoute=time.strftime('%Y-%m-%d %H:%M'))
            ou = res.get('collection') or ''
            txt = (f'Déjà dans {nomp}.' if res.get('deja') else f'Ajouté à {nomp} (collection {ou})'
                   + {'exacte': ', à sa place', 'piece': ', au milieu de la pièce : à placer', 'origine': ', au centre du plan : à placer'}[mode] + '.')
            dire('Plan :', item['nom'], '→', nomp, ou)
            srv.file('plan', id=item['id'], etat='ajoute', texte=txt)
        else:
            item['essais'] = item.get('essais', 0) + 1
            dire('Plan : échec pour', item['nom'], ':', res.get('erreur'))
            if item['essais'] >= 3:
                item.update(fait=True, erreur=res.get('erreur'))
                srv.file('plan', id=item['id'], etat='echec', texte='Ajout à ' + nomp + ' impossible : ' + str(res.get('erreur'))[:200])
    if change:
        ecrire_file_plans(r, l)


NOMS_PIECES = {'salon': 'Salon', 'cuisine': 'Cuisine', 'entree': 'Entrée et réduit', 'degagement': 'Dégagement', 'wc': 'WC-buanderie',
               'chambre': 'Chambre', 'sdb': 'Salle de bain', 'portes_rez': 'Portes-fenêtres-stores', 'mezzanine': 'Mezzanine et coin bureau',
               'dressing': 'Dressing', 'chambre_etage': 'Chambre', 'douche': 'Douche-WC', 'portes_etage': 'Portes-fenêtres'}


# ---------------------------------------------------------------- une demande
EXT = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'model/gltf-binary': '.glb'}
DETAILS = {'simple': 'simple (formes principales, rapide)', 'normal': 'normal (comme les meubles de la base « Réalisme »)', 'detaille': 'très détaillé (poignées, chanfreins, coutures, matières fines)'}


def consigne_pour(d, dossier, images, source_glb, source_image, reprise=''):
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
        '{{REPRISE}}': reprise,
        '{{SCRIPT}}': str(dossier / 'modele.py'),
        '{{SCENE}}': 'M3D_' + d['id'],
        '{{SORTIE_GLB}}': str(dossier / 'resultat.glb'),
        '{{SORTIE_APERCU}}': str(dossier / 'apercu.png'),
        '{{SORTIE_INFOS}}': str(dossier / 'infos.json'),
        '{{SORTIE_BLEND}}': str(dossier / 'objet.blend'),
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
    for f in ('resultat.glb', 'apercu.png', 'infos.json', 'objet.blend'):
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
                reprise = ''
                for tentative in (1, 2):
                    assurer_blender(srv, r, d)
                    consigne = consigne_pour(d, dossier, images, source_glb, source_image, reprise)
                    (dossier / ('consigne.md' if tentative == 1 else 'consigne_reprise.md')).write_text(consigne, encoding='utf-8')
                    resultat['code'], resultat['fin'] = lancer_claude(r, consigne, dossier, etat, arret)
                    glb = dossier / 'resultat.glb'
                    if arret.is_set() or (glb.exists() and glb.stat().st_size >= 200) or tentative == 2:
                        break
                    # Blender s'est fermé (plantage) pendant la demande : on le rouvre et on reprend une fois
                    if blender_repond(r, 3):
                        break
                    raison = ''
                    try:
                        raison = json.loads((dossier / 'infos.json').read_text(encoding='utf-8')).get('erreur') or ''
                    except Exception:
                        pass
                    dire('Blender s’est fermé pendant la demande : reprise (Blender rouvert).')
                    srv.file('avancer', id=d['id'], p=estimer(d, time.time() - debut), texte='Blender s’est fermé : le PC le rouvre et reprend la demande…')
                    (dossier / 'infos.json').unlink(missing_ok=True)
                    script = dossier / 'modele.py'
                    reprise = ('## Reprise après un plantage de Blender\n'
                               '- À la tentative précédente, Blender s’est fermé brutalement' + (f' ({raison})' if raison else '') + '. Il vient d’être rouvert.\n'
                               + (f'- Le script de modélisation de la tentative précédente est dans `{script}` : ne remodélise pas ; vérifie-le, '
                                  'exécute-le dans une scène neuve, regarde l’aperçu, puis exporte.\n' if script.exists() else '')
                               + '- Garde ta scène affichée dans la fenêtre (`bpy.context.window_manager.windows[0].scene = scene`) et fais `bpy.context.view_layer.update()` avant l’export ; désélectionne tout, '
                                 'sélectionne seulement les objets de l’objet, puis exporte. Si Blender se ferme encore, écris l’erreur dans infos.json.\n')
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
    try:
        drive, drive_erreur = copier_drive(r, d, glb)
    except Exception as e:
        drive, drive_erreur = None, 'copie dans le Drive impossible (' + str(e)[:200] + ')'
    if drive:
        dire('Copié dans le Drive :', drive)
    elif drive_erreur:
        dire('Drive :', drive_erreur)
    dims = {k: infos.get(k) for k in ('L', 'P', 'H') if isinstance(infos.get(k), (int, float))}
    corps = dict(id=d['id'], fichier=f, apercu=apercu, taille=len(octets), triangles=int(infos.get('triangles') or 0), dims=dims or None,
                 notes=str(infos.get('notes') or '')[:1400], duree=int(time.time() - debut), texte='Fini', drive=drive, driveErreur=drive_erreur)
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
    try:
        mettre_en_attente_plan(r, d, dossier, glb)
    except Exception as e:
        dire('Plan : mise en attente impossible :', e)


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
    exe = trouver_blender(r)
    print('Blender :', exe or 'blender.exe INTROUVABLE (réglage « blender_exe ») : il ne pourra pas être ouvert tout seul',
          '· ouvert tout seul s’il est fermé' if exe and r.get('ouvrir_blender', True) else '')
    if r.get('blender_a_part', True) and exe and not r.get('simuler') and not blender_repond(r):
        print('Blender du pont : ouverture pour l’essai (port', str(port_actif(r)) + ')…')
        try:
            ouvrir_blender(None, r, None)
        except Exception as e:
            print('Ouverture impossible :', e)
    print(('Blender du pont' if r.get('blender_a_part', True) else 'Blender MCP') + ' (port', str(port_actif(r)) + ') :',
          'répond' if blender_repond(r) else 'ne répond pas')
    dd = trouver_drive(r)
    if (r.get('dossier_drive') or '').strip().lower() == 'non':
        print('Drive : copie désactivée (réglage « dossier_drive » = « non »)')
    else:
        print('Drive :', str(dd) + ' (les modèles y sont copiés, dans le dossier de leur pièce)' if dd else
              'dossier « Maison 3D/Objets 3D » INTROUVABLE (réglage « dossier_drive ») : les modèles ne seront pas copiés')
    if cmd and not r.get('simuler') and not blender_repond(r):
        print('Blender MCP ne répond pas : ' + ('son Blender n’a pas démarré Blender MCP.' if r.get('blender_a_part', True) else 'ouvrez Blender pour l’essai (le pont, lui, l’ouvrira tout seul).'))
        ok = False
    elif cmd and not r.get('simuler'):
        cwd = r.get('dossier_blender') or str(ICI)
        print('Essai de Blender MCP (dossier', cwd, ')…')
        try:
            p = subprocess.run(cmd + ['-p', '--allowedTools', 'mcp__blender', '--max-turns', '4'], env=dict(os.environ, BLENDER_PORT=str(port_actif(r))), input=(
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
                PROCESSUS['fin'] = time.time()
                try:
                    ajouter_aux_plans(srv, r)
                except Exception as e:
                    dire('Plans :', e)
                if une_fois:
                    return 0
                continue
            fermer_si_inactif(r)
            if time.time() - PROCESSUS.get('plans', 0) > float(r.get('plans_intervalle') or 60):
                PROCESSUS['plans'] = time.time()
                try:
                    ajouter_aux_plans(srv, r)
                except Exception as e:
                    dire('Plans :', e)
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
