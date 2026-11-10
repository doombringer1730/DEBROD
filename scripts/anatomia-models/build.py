"""Add the structures in mapping.py to the Anatomía models in public/anatomia/.

Existing meshes are kept byte for byte; new ones are read from BodyParts3D
(isa_BP3D_4.0_obj_99.zip and isa/partof_element_parts.txt from
https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/), placed with the
same transform the model was built with (transforms.json), simplified, and
appended. Running it twice is safe: meshes already in a model are skipped.

  pip install numpy fast-simplification
  python3 scripts/anatomia-models/build.py <bp3d dir with the txt files and the unzipped obj folder>

BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan.
"""
import json, os, re, struct, sys
import numpy as np
import fast_simplification

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from mapping import M, NEW_MODELS  # noqa: E402

BP3D = sys.argv[1]
OBJ_DIR = next(os.path.join(r, d) for r, ds, _ in os.walk(BP3D) for d in ds if d.startswith('isa_BP3D'))
OUT = os.path.join(HERE, '..', '..', 'public', 'anatomia')
VIEW = 1.3          # keep parts whose centre is inside the view cube
MAX_FACES = 3000    # per new mesh, after simplification

concepts: dict[str, set[str]] = {}
for fn in ('isa_element_parts.txt', 'partof_element_parts.txt'):
    for line in open(os.path.join(BP3D, fn)).read().splitlines()[1:]:
        _, name, fj = line.split('\t')
        concepts.setdefault(name.lower(), set()).add(fj)


def elements(sources: list[str]) -> list[str]:
    out: set[str] = set()
    for s in sources:
        if s.startswith('~'):
            rx = re.compile(s[1:])
            hits = [n for n in concepts if rx.search(n)]
        else:
            hits = [s] if s in concepts else []
        if not hits:
            raise SystemExit(f'no BodyParts3D concept for {s!r}')
        for h in hits:
            out |= concepts[h]
    return sorted(out)


_obj_cache: dict[str, tuple[np.ndarray, np.ndarray]] = {}
def read_obj(fj: str):
    if fj not in _obj_cache:
        vs, fs = [], []
        for line in open(os.path.join(OBJ_DIR, fj + '.obj')):
            if line.startswith('v '):
                vs.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('f '):
                idx = [int(p.split('/')[0]) - 1 for p in line.split()[1:]]
                for k in range(1, len(idx) - 1):
                    fs.append([idx[0], idx[k], idx[k + 1]])
        _obj_cache[fj] = (np.array(vs, np.float64), np.array(fs, np.int64))
    return _obj_cache[fj]


def to_model(v: np.ndarray, t: dict) -> np.ndarray:
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    a = np.stack([-x if t['mirror'] else x, z, -y], 1)
    return (a - np.array(t['c'])) * t['s']


def geometry(fjs: list[str], t: dict):
    vs, fs, n = [], [], 0
    total = sum(len(read_obj(fj)[1]) for fj in fjs)
    for fj in fjs:
        v, f = read_obj(fj)
        v = to_model(v, t)
        centre = (v.min(0) + v.max(0)) / 2
        if np.abs(centre).max() > VIEW:
            continue  # the other side, or far outside the view
        share = max(200, int(MAX_FACES * len(f) / total))
        if len(f) > share:
            v, f = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=1 - share / len(f))
        vs.append(v); fs.append(f + n); n += len(v)
    if not vs:
        return None
    v, f = np.concatenate(vs).astype(np.float32), np.concatenate(fs).astype(np.int32)
    # Simplify each part on its own: big unions of many small parts (all the
    # intercostals) barely shrink when simplified together.
    for _ in range(4):
        if len(f) <= MAX_FACES:
            break
        v, f = fast_simplification.simplify(v, f, target_reduction=min(0.97, 1 - MAX_FACES / len(f)))
    return v.astype(np.float32), f.astype(np.uint32)


# --- minimal GLB read/write ---
def read_glb(path):
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', b[off:off + 4])[0]
    return j, bytearray(b[off + 8:off + 8 + bl])


def write_glb(path, j, binary: bytearray):
    while len(binary) % 4:
        binary += b'\0'
    j['buffers'] = [{'byteLength': len(binary)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(binary), 0x004E4942)); f.write(binary)


def add_mesh(j, binary: bytearray, name: str, v: np.ndarray, f: np.ndarray):
    def view(data: bytes, target: int):
        while len(binary) % 4:
            binary.append(0)
        j['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data), 'target': target})
        binary.extend(data)
        return len(j['bufferViews']) - 1
    iv = view(f.astype('<u4').tobytes(), 34963)
    j['accessors'].append({'bufferView': iv, 'componentType': 5125, 'count': int(f.size), 'type': 'SCALAR',
                           'max': [int(f.max())], 'min': [int(f.min())]})
    ia = len(j['accessors']) - 1
    pv = view(v.astype('<f4').tobytes(), 34962)
    j['accessors'].append({'bufferView': pv, 'componentType': 5126, 'count': int(len(v)), 'type': 'VEC3',
                           'max': v.max(0).tolist(), 'min': v.min(0).tolist()})
    pa = len(j['accessors']) - 1
    j['meshes'].append({'name': name, 'primitives': [{'attributes': {'POSITION': pa}, 'indices': ia, 'mode': 4}]})
    j['nodes'].append({'name': name, 'mesh': len(j['meshes']) - 1})
    j['scenes'][0]['nodes'].append(len(j['nodes']) - 1)


def main():
    transforms = json.load(open(os.path.join(HERE, 'transforms.json')))
    wanted: dict[str, dict[str, list[str]]] = {}
    for model, mesh, sources, _ in M.values():
        if sources:
            wanted.setdefault(model, {})[mesh] = sources

    for model, ctx in NEW_MODELS.items():
        if model in transforms:
            continue
        fjs = elements(ctx + [s for ss in wanted.get(model, {}).values() for s in ss])
        pts = np.concatenate([to_model(read_obj(fj)[0], {'mirror': False, 'c': [0, 0, 0], 's': 1}) for fj in fjs])
        lo, hi = pts.min(0), pts.max(0)
        transforms[model] = {'mirror': False, 's': float(2 / (hi - lo).max()), 'c': ((lo + hi) / 2).tolist()}
        json.dump(transforms, open(os.path.join(HERE, 'transforms.json'), 'w'), indent=1)

    for model in sorted(set(wanted) | set(NEW_MODELS)):
        path = os.path.join(OUT, f'{model}.glb')
        t = transforms[model]
        if os.path.exists(path):
            j, binary = read_glb(path)
        else:
            j, binary = {'asset': {'version': '2.0', 'generator': 'anatomia build.py'}, 'scene': 0,
                         'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': []}, bytearray()
        have = {n['name'] for n in j['nodes']}
        jobs = [(f'ctx_{i}', [c]) for i, c in enumerate(NEW_MODELS.get(model, []))] + list(wanted.get(model, {}).items())
        added = []
        for mesh, sources in jobs:
            if mesh in have or any(h.startswith(mesh + '__') for h in have):
                continue
            g = geometry(elements(sources), t)
            if g is None:
                raise SystemExit(f'{model}/{mesh}: nothing inside the view')
            add_mesh(j, binary, mesh, *g)
            added.append(f'{mesh}({len(g[1])})')
        if added:
            write_glb(path, j, binary)
        print(f'{model:10s} {os.path.getsize(path) / 1e6:5.2f} MB  +{len(added)} {" ".join(added)}')


main()
