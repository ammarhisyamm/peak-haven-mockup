import { Component, Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import PackagingModel, { getModelLayout, type PackagingModelProps } from './PackagingModel';

export interface SceneViewportHandle {
  /** Renders the current view at high resolution and returns a transparent PNG data URL. */
  capturePNG: (longEdgePx?: number) => string | null;
  /** Re-frames the camera around the active model. */
  resetView: () => void;
}

/** The subset of drei's OrbitControls the camera rig drives. */
interface OrbitControlsLike {
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
}

const FOV = 35;
const VIEW_DIRECTION = new THREE.Vector3(0.75, 0.5, 1.6).normalize();
const DEFAULT_EXPORT_LONG_EDGE = 3840;

interface Framing {
  target: THREE.Vector3;
  position: THREE.Vector3;
  radius: number;
}

function computeFraming(size: [number, number, number], aspect: number): Framing {
  const [w, h, d] = size;
  const radius = 0.5 * Math.sqrt(w * w + h * h + d * d);
  const vFov = THREE.MathUtils.degToRad(FOV);
  // Use the narrower of the vertical/horizontal FOV so the model fits either way.
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const fov = Math.min(vFov, hFov);
  const distance = (radius / Math.sin(fov / 2)) * 1.35;
  const target = new THREE.Vector3(0, h / 2, 0);
  return { target, position: target.clone().addScaledVector(VIEW_DIRECTION, distance), radius };
}

/**
 * Eases the camera + orbit target to a new framing whenever `framingKey` changes
 * (preset switch or reset), then hands control back to the user.
 */
function CameraRig({
  size,
  framingKey,
}: {
  size: [number, number, number];
  framingKey: string;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null;
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  const goal = useRef<Framing | null>(null);
  const progress = useRef(1);

  useEffect(() => {
    goal.current = computeFraming(size, aspect);
    progress.current = 0;
    if (controls) {
      controls.minDistance = goal.current.radius * 1.2;
      controls.maxDistance = goal.current.radius * 8;
    }
    // Aspect changes alone should not yank the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framingKey, controls]);

  useFrame((_, delta) => {
    if (!goal.current || progress.current >= 1 || !controls) return;
    progress.current = Math.min(progress.current + delta / 0.6, 1);
    const t = 1 - Math.pow(1 - progress.current, 3);
    camera.position.lerp(goal.current.position, t);
    controls.target.lerp(goal.current.target, t);
    controls.update();
  });

  return null;
}

/** Swallows render errors from optional scene pieces (e.g. a failed HDR download). */
class SilentBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Environment map unavailable, falling back to direct lighting.', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Exposes renderer, scene and camera to the imperative handle. */
function StateBridge({ stateRef }: { stateRef: React.MutableRefObject<RootState | null> }) {
  const state = useThree();
  stateRef.current = state;
  return null;
}

export type SceneViewportProps = PackagingModelProps;

const SceneViewport = forwardRef<SceneViewportHandle, SceneViewportProps>(function SceneViewport(
  { preset, artwork, finish, baseColor },
  ref,
) {
  const stateRef = useRef<RootState | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const layout = useMemo(() => getModelLayout(preset), [preset]);
  const [w, h, d] = layout.size;
  const footprint = Math.max(w, d);
  const radius = 0.5 * Math.sqrt(w * w + h * h + d * d);
  const initial = useMemo(() => computeFraming(layout.size, 16 / 10), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Changes on preset switch or when resetView bumps the counter.
  const framingKey = `${preset.id}:${resetCount}`;

  useImperativeHandle(
    ref,
    () => ({
      capturePNG: (longEdgePx = DEFAULT_EXPORT_LONG_EDGE) => {
        const state = stateRef.current;
        if (!state) return null;
        const { gl, scene, camera } = state;
        const size = gl.getSize(new THREE.Vector2());
        const previousRatio = gl.getPixelRatio();
        const maxEdge = Math.min(gl.capabilities.maxTextureSize, 8192);
        const targetEdge = Math.min(longEdgePx, maxEdge);
        const ratio = Math.max(previousRatio, targetEdge / Math.max(size.x, size.y, 1));
        try {
          gl.setPixelRatio(ratio);
          gl.render(scene, camera);
          return gl.domElement.toDataURL('image/png');
        } finally {
          gl.setPixelRatio(previousRatio);
          gl.render(scene, camera);
        }
      },
      resetView: () => setResetCount((n) => n + 1),
    }),
    [],
  );

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.01, far: 200, position: initial.position.toArray() }}
      gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      className="h-full w-full touch-none"
    >
      <StateBridge stateRef={stateRef} />

      {/* Studio lighting rig */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} />
      <directionalLight position={[-4, 2.5, -2]} intensity={0.45} />

      {/* The HDR is fetched from a CDN; if that fails the scene keeps its direct lights instead of crashing. */}
      <SilentBoundary>
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>
      </SilentBoundary>

      <PackagingModel preset={preset} artwork={artwork} finish={finish} baseColor={baseColor} />

      <ContactShadows
        key={preset.id}
        // Sits just below the floor: a base face exactly on the shadow camera's near plane would be clipped.
        position={[0, -0.002, 0]}
        scale={Math.max(footprint * 3, radius * 3, 3)}
        far={Math.max(h, 1)}
        blur={2.4}
        opacity={0.5}
        resolution={1024}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2 - 0.04}
        target={initial.target.toArray()}
      />
      <CameraRig size={layout.size} framingKey={framingKey} />
    </Canvas>
  );
});

export default SceneViewport;
