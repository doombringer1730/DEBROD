// Instances that change how a part looks: decals, meshes and lights, plus
// part classes that imported places use (unions and mesh parts render as boxes).
import { Instance, P } from './instance.js'
import { BasePart } from './parts.js'
import { enumName } from './enum.js'

class PartDecoration extends Instance {
  static className = 'PartDecoration'
  static notCreatable = true
  _contextChanged() { this._refresh() }
  _onProp() { this._refresh() }
  _onDestroy() { this._refresh() }
  _refresh() {
    const part = this._lastPart
    const now = this._parent instanceof BasePart && this._ws ? this._parent : null
    this._lastPart = now
    for (const p of new Set([part, now])) if (p && p._ws && p._engine) p._engine.partChanged(p, 'Decoration')
  }
}
Instance.register(PartDecoration)

const faceEnum = { coerce: enumName, default: 'Front' }

export class Decal extends PartDecoration {
  static className = 'Decal'
  static props = { Texture: P.str(''), Face: faceEnum, Transparency: P.num(0), Color3: P.color(255, 255, 255) }
}
Instance.register(Decal)

export class Texture extends Decal {
  static className = 'Texture'
  static props = { StudsPerTileU: P.num(2), StudsPerTileV: P.num(2) }
}
Instance.register(Texture)

export class DataModelMesh extends PartDecoration {
  static className = 'DataModelMesh'
  static notCreatable = true
  static props = { Scale: P.vec(1, 1, 1), Offset: P.vec(0, 0, 0) }
}
Instance.register(DataModelMesh)

// MeshType: Brick, Sphere, Cylinder, Head, Wedge, Torso, FileMesh
export class SpecialMesh extends DataModelMesh {
  static className = 'SpecialMesh'
  static props = { MeshType: { default: 'Head', coerce: enumName }, MeshId: P.str(''), TextureId: P.str('') }
}
Instance.register(SpecialMesh)
export class BlockMesh extends DataModelMesh { static className = 'BlockMesh' }
Instance.register(BlockMesh)
export class CylinderMesh extends DataModelMesh { static className = 'CylinderMesh' }
Instance.register(CylinderMesh)

export class Light extends PartDecoration {
  static className = 'Light'
  static notCreatable = true
  static props = { Brightness: P.num(1), Color: P.color(255, 255, 255), Enabled: P.bool(true), Range: P.num(8), Shadows: P.bool(false) }
}
Instance.register(Light)
export class PointLight extends Light { static className = 'PointLight' }
Instance.register(PointLight)
export class SpotLight extends Light {
  static className = 'SpotLight'
  static props = { Angle: P.num(90), Face: faceEnum }
}
Instance.register(SpotLight)
export class SurfaceLight extends SpotLight { static className = 'SurfaceLight' }
Instance.register(SurfaceLight)

export class UnionOperation extends BasePart { static className = 'UnionOperation' }
Instance.register(UnionOperation)
export class MeshPart extends BasePart {
  static className = 'MeshPart'
  static props = { MeshId: P.str(''), TextureID: P.str('') }
}
Instance.register(MeshPart)
export class TrussPart extends BasePart { static className = 'TrussPart' }
Instance.register(TrussPart)
export class Seat extends BasePart { static className = 'Seat' }
Instance.register(Seat)
