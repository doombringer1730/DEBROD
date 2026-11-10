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

type Control = { spin: number; tilt: number; dragging: boolean; moved: number }

function Model({ source, mesh, spin, tilt, ctl, onPick, onHover }: {
  source: THREE.Group; mesh: string; spin: number; tilt: number
  ctl?: React.MutableRefObject<Control>
  onPick?: (name: string) => void
  onHover?: (name: string | null) => void
}) {
  const group = useRef<THREE.Group>(null)
  const outer = useRef<THREE.Group>(null)
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
    if (!group.current) return
    if (!ctl) { group.current.rotation.y += dt * 0.35; return }
    // Explore: the pointer turns the model; it drifts slowly when left alone.
    if (!ctl.current.dragging) ctl.current.spin += dt * 0.12
    group.current.rotation.y = ctl.current.spin
    if (outer.current) outer.current.rotation.x = ctl.current.tilt
  })

  const pickable = onPick ? {
    onPointerMove: (e: { stopPropagation: () => void; object: THREE.Object3D }) => { e.stopPropagation(); onHover?.(e.object.name) },
    onPointerOut: () => onHover?.(null),
    onClick: (e: { stopPropagation: () => void; object: THREE.Object3D }) => {
      e.stopPropagation()
      if ((ctl?.current.moved ?? 0) < 6) onPick(e.object.name)
    },
  } : {}

  return (
    <group ref={outer} rotation={[tilt, 0, 0]}>
      <group ref={group} rotation={[0, spin, 0]}>
        <primitive object={scene} {...pickable} />
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

/** Explore: one large view you can turn by dragging; hovering names a
 *  structure and clicking picks it. */
export function ExploreFigure({ model, mesh, onPick, nameOf, label }: {
  model: string; mesh: string; onPick: (name: string) => void; nameOf: (name: string) => string | null; label: string
}) {
  const [loaded, setLoaded] = useState<{ model: string; scene: THREE.Group } | null>(null)
  const [failed, setFailed] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const ctl = useRef<Control>({ spin: -0.6, tilt: 0.08, dragging: false, moved: 0 })
  const last = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let live = true
    setFailed(false)
    loadModel(model).then((scene) => live && setLoaded({ model, scene }), () => live && setFailed(true))
    return () => { live = false }
  }, [model])

  const source = loaded?.model === model ? loaded.scene : null
  if (failed) return <p className="an-figure-note">The 3D model could not be loaded.</p>
  const hoverName = hover ? nameOf(hover) : null
  return (
    <div className="an-explore-3d" role="img" aria-label={label}
      onPointerDown={(e) => { last.current = { x: e.clientX, y: e.clientY }; ctl.current.dragging = true; ctl.current.moved = 0 }}
      onPointerMove={(e) => {
        if (!last.current) return
        const dx = e.clientX - last.current.x, dy = e.clientY - last.current.y
        last.current = { x: e.clientX, y: e.clientY }
        ctl.current.moved += Math.abs(dx) + Math.abs(dy)
        ctl.current.spin += dx * 0.01
        ctl.current.tilt = Math.max(-1.2, Math.min(1.2, ctl.current.tilt + dy * 0.008))
      }}
      onPointerUp={() => { last.current = null; ctl.current.dragging = false }}
      onPointerCancel={() => { last.current = null; ctl.current.dragging = false }}
      onPointerLeave={() => { last.current = null; ctl.current.dragging = false }}>
      {source && (
        <Canvas camera={{ position: [0, 0, 4.1], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 4, 5]} intensity={1.6} />
          <directionalLight position={[-4, -1, -3]} intensity={0.5} />
          <Model source={source} mesh={mesh} spin={-0.6} tilt={0.08} ctl={ctl} onPick={onPick} onHover={setHover} />
        </Canvas>
      )}
      {!source && <p className="an-figure-note">Loading model…</p>}
      <p className="an-explore-hover" aria-hidden="true">{hoverName ?? '\u00a0'}</p>
    </div>
  )
}
