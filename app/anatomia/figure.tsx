'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const RED = '#e0323c'
const BONE = '#d9d6cf'

// One promise per model file, shared by every view and every item.
const cache = new Map<string, Promise<THREE.Group>>()
function loadModel(model: string): Promise<THREE.Group> {
  let p = cache.get(model)
  if (!p) {
    p = new GLTFLoader().loadAsync(`/anatomia/${model}.glb`).then((gltf) => {
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.computeVertexNormals()
      })
      return gltf.scene
    })
    p.catch(() => cache.delete(model))
    cache.set(model, p)
  }
  return p
}

/** Which part of the target a node is, or -1. "parietal" lights both
 *  parietal__L and parietal__R; "frontal+parietal" lights both bones. */
const partOf = (name: string, mesh: string) =>
  mesh.split('+').findIndex((m) => name === m || name.startsWith(`${m}__`))
// Neighbouring parts of one target alternate two reds so the line between
// them (a suture, a joint) stays visible.
const RED_ALT = '#a9232c'

function Model({ source, mesh, spin, tilt }: { source: THREE.Group; mesh: string; spin: number; tilt: number }) {
  const group = useRef<THREE.Group>(null)
  // Each canvas gets its own copy and its own materials; geometry is shared.
  const scene = useMemo(() => {
    const copy = source.clone(true)
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide })
    })
    return copy
  }, [source])

  useEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const part = partOf(o.name, mesh)
      const hit = part >= 0
      const m = o.material as THREE.MeshStandardMaterial
      m.color.set(!hit ? BONE : part % 2 ? RED_ALT : RED)
      m.emissive.set(hit ? '#5a0d12' : '#000000')
      // Both go in three's transparent pass so renderOrder applies: the ghosted
      // context first without writing depth, then the target on top of it.
      m.transparent = true
      m.opacity = hit ? 1 : 0.22
      m.depthWrite = hit
      m.needsUpdate = true
      o.renderOrder = hit ? 2 : 1
    })
  }, [scene, mesh])

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.35
  })

  return (
    <group rotation={[tilt, 0, 0]}>
      <group ref={group} rotation={[0, spin, 0]}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

function View({ source, mesh, spin, tilt, className, paused }: {
  source: THREE.Group | null; mesh: string; spin: number; tilt: number; className: string; paused: boolean
}) {
  return (
    <div className={className}>
      {source && (
        <Canvas camera={{ position: [0, 0, 4.1], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}
          frameloop={paused ? 'never' : 'always'}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 4, 5]} intensity={1.6} />
          <directionalLight position={[-4, -1, -3]} intensity={0.5} />
          <Model source={source} mesh={mesh} spin={spin} tilt={tilt} />
        </Canvas>
      )}
    </div>
  )
}

/** The lit model: one large slow-turning view flanked by two smaller ones from other angles. */
export default function Figure({ model, mesh, paused = false }: { model: string; mesh: string; paused?: boolean }) {
  const [loaded, setLoaded] = useState<{ model: string; scene: THREE.Group } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    setFailed(false)
    loadModel(model).then((scene) => live && setLoaded({ model, scene }), () => live && setFailed(true))
    return () => { live = false }
  }, [model])

  const source = loaded?.model === model ? loaded.scene : null
  if (failed) return <p className="an-figure-note">The 3D model could not be loaded.</p>
  return (
    <div className="an-skull">
      <View className="an-skull-side" source={source} mesh={mesh} spin={Math.PI * 0.75} tilt={0.5} paused={paused} />
      <View className="an-skull-main" source={source} mesh={mesh} spin={-0.6} tilt={0.08} paused={paused} />
      <View className="an-skull-side" source={source} mesh={mesh} spin={-Math.PI * 0.9} tilt={-0.55} paused={paused} />
      {!source && <p className="an-figure-note">Loading model…</p>}
    </div>
  )
}
