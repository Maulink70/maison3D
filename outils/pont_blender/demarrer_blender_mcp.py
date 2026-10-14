# Lancé par le pont Blender quand il ouvre Blender lui-même (blender.exe --python demarrer_blender_mcp.py).
# Le port voulu est dans M3D_PORT : 9877 pour le Blender à part du pont (réglage « port_pont »), 9876 sinon.
# L'extension « MCP for Blender » démarre son serveur toute seule, une fois l'interface prête, sur le port de la scène
# (propriété blendermcp_port) : on règle ce port tout de suite, avant elle. Si, 15 secondes plus tard, rien n'écoute
# encore sur ce port (ou si le serveur a démarré sur un autre), on le (re)démarre : bouton « Connect to Claude ».
# Ne touche à aucun fichier.
import os
import socket

import bpy

PORT = int(os.environ.get('M3D_PORT') or 9876)
essais = [0]


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


def _regler_port():
    for sc in bpy.data.scenes:
        try:
            sc.blendermcp_port = PORT
        except Exception:
            pass


def _demarrer():
    _regler_port()
    if _ecoute():
        return None
    essais[0] += 1
    serveur = getattr(bpy.types, 'blendermcp_server', None)
    if serveur is not None and getattr(serveur, 'port', PORT) != PORT:
        try:
            bpy.ops.blendermcp.stop_server()       # démarré sur un autre port avant notre réglage
        except Exception:
            pass
    try:
        bpy.ops.blendermcp.start_server()
    except Exception as e:
        print('Pont Blender : démarrage de Blender MCP impossible (' + str(e) + ').')
    if _ecoute():
        print('Pont Blender : Blender MCP écoute sur le port', PORT)
        return None
    return 5.0 if essais[0] < 6 else None


_regler_port()
bpy.app.timers.register(_demarrer, first_interval=15.0)
