// Étape 4 : découpe le modèle complet en deux fichiers pour le chargement progressif.
//   structure.glb : murs, sols, escalier, cloison (affichés en premier, ~0,5 Mo)
//   mobilier.glb  : meubles, portes et fenêtres (chargés ensuite)
// Usage : node decouper_glb.mjs <appartement.glb> <dossier de sortie>
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import fs from 'fs';
import path from 'path';

const [,, src, outDir] = process.argv;
if (!src || !outDir) { console.error('Usage : node decouper_glb.mjs <appartement.glb> <dossier>'); process.exit(1); }

// Doit correspondre aux éléments « fixe » de META dans js/config.js
const STRUCTURE = new Set(['structure_rez', 'structure_etage', 'rez__escalier', 'rez__cloison']);

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder});

async function partie(nom, garder) {
  const doc = await io.read(src);
  const scene = doc.getRoot().getDefaultScene();
  for (const n of scene.listChildren()) if (!garder(n.getName())) n.traverse(c => c.dispose());
  await doc.transform(prune());
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const out = path.join(outDir, nom);
  await io.write(out, doc);
  const noms = scene.listChildren().map(n => n.getName());
  console.log(nom, (fs.statSync(out).size / 1e6).toFixed(2), 'Mo,', noms.length, 'éléments');
  return noms;
}

fs.mkdirSync(outDir, {recursive: true});
const a = await partie('structure.glb', n => STRUCTURE.has(n));
const b = await partie('mobilier.glb', n => !STRUCTURE.has(n));
const total = (await io.read(src)).getRoot().getDefaultScene().listChildren().length;
if (a.length + b.length !== total) { console.error('Éléments perdus :', total, '≠', a.length + b.length); process.exit(1); }
