# Lancé par le pont Blender quand il ouvre Blender lui-même (blender.exe --python demarrer_blender_mcp.py).
# L'extension « MCP for Blender » démarre normalement son serveur toute seule à l'ouverture ; si, 15 secondes plus
# tard, rien n'écoute encore sur son port, on le démarre (bouton « Connect to Claude » / « Start MCP Server »).
# Ne touche à aucun fichier ni à aucune scène.
import os
import socket

import bpy

PORT = int(os.environ.get('M3D_PORT') or 9876)


def _ecoute():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        s.connect(('127.0.0.1', PORT))
        return True
    except Exception:
        return False
    finally:
        s.close()


def _demarrer():
    if _ecoute():
        return None
    for nom in ('start_server', 'start'):
        try:
            op = getattr(bpy.ops.blendermcp, nom)
            op()
            print('Pont Blender : serveur Blender MCP démarré.')
            return None
        except Exception:
            pass
    print('Pont Blender : impossible de démarrer Blender MCP (extension « MCP for Blender » absente ou désactivée ?).')
    return None


bpy.app.timers.register(_demarrer, first_interval=15.0)
