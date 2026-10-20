import {
  Component,
  Suspense,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import PackagingModel, { getModelLayout, useSceneTextures } from './PackagingModel';
import { getLayout, placeInstances, type LayoutId } from '../constants/layouts';
import type { ArtworkMap, FinishId, PackagingPreset } from '../constants/presets';
import type { ViewSettings } from '../state/settings';

export type ViewName = 'front' | 'angle' | 'side' | 'top';
export type VideoMode = 'turntable' | 'open-close';

export interface VideoOptions {
  mode: VideoMode;
  durationMs: number;
  /** Solid background for the video (videos can't be transparent). */
  background: string;
}

export interface SceneViewportHandle {
  /** Renders the current view at high resolution and returns a transparent PNG data URL. */
  capturePNG: (longEdgePx: number) => string | null;
  /** Records a turntable or open/close animation of the canvas. */
  recordVideo: (options: VideoOptions) => Promise<{ blob: Blob; extension: string }>;
  resetView: () => void;
  setView: (view: ViewName) => void;
  /** Multiplies the camera distance (<1 zooms in). */
  zoom: (factor: number) => void;
}

/** The subset of drei's OrbitControls the camera code drives. */
interface OrbitControlsLike {
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
}

const FOV = 35;
type Vec3 = [number, number, number];
const VIEW_DIRECTIONS: Record<ViewName, Vec3> = {
  angle: [0.75, 0.5, 1.6],
  front: [0, 0.18, 1],
  side: [1, 0.18, 0.02],
  top: [0.001, 1, 0.02],
};

interface Framing {
  target: THREE.Vector3;
  position: THREE.Vector3;
  radius: number;
}

function computeFraming(bounds: THREE.Box3, aspect: number, direction: Vec3): Framing {
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const vFov = THREE.MathUtils.degToRad(FOV);
  // Use the narrower of the vertical/horizontal FOV so the scene fits either way.
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const fov = Math.min(vFov, hFov);
  const distance = (sphere.radius / Math.sin(fov / 2)) * 1.3;
  const dir = new THREE.Vector3(...direction).normalize();
  return {
    target: sphere.center.clone(),
    position: sphere.center.clone().addScaledVector(dir, distance),
    radius: sphere.radius,
  };
}

/**
 * Eases the camera + orbit target to a new framing whenever `framingKey` changes
 * (preset, size or layout switch, a view button, or reset), then hands control back to the user.
 */
function CameraRig({ bounds, direction, framingKey }: { bounds: THREE.Box3; direction: Vec3; framingKey: string }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null;
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  const goal = useRef<Framing | null>(null);
  const progress = useRef(1);

  useEffect(() => {
    goal.current = computeFraming(bounds, aspect, direction);
    progress.current = 0;
    if (controls) {
      controls.minDistance = goal.current.radius * 0.6;
      controls.maxDistance = goal.current.radius * 12;
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

/** Shifts the rendered image right so the model centers in the area not covered by side panels. */
function ViewOffset({ offsetPx }: { offsetPx: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (offsetPx) camera.setViewOffset(size.width, size.height, -offsetPx, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, offsetPx]);
  return null;
}

/** Swallows render errors from optional scene pieces (e.g. a failed HDR download). */
class SilentBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Environment map unavailable, falling back to direct lighting.', error);
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

interface Animation {
  mode: VideoMode;
  start: number;
  duration: number;
  resolve: () => void;
}

interface SceneContentProps {
  preset: PackagingPreset;
  artwork: ArtworkMap;
  finish: FinishId;
  baseColor: string;
  layoutId: LayoutId;
  openRef: MutableRefObject<number>;
  animationRef: MutableRefObject<Animation | null>;
  settings: ViewSettings;
}

/** Packaging instances for the active layout, plus the turntable / open-close animation driver. */
function SceneContent({ preset, artwork, finish, baseColor, layoutId, openRef, animationRef, settings }: SceneContentProps) {
  // Loaded once and shared by every instance in the layout.
  const textures = useSceneTextures(artwork, preset);
  const layout = useMemo(() => getModelLayout(preset), [preset]);
  const placed = useMemo(() => placeInstances(getLayout(layoutId), layout.size), [layoutId, layout.size]);
  const rootRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const anim = animationRef.current;
    const root = rootRef.current;
    if (!root) return;
    if (!anim) {
      root.rotation.y = 0;
      return;
    }
    const p = Math.min((performance.now() - anim.start) / anim.duration, 1);
    if (anim.mode === 'turntable') root.rotation.y = p * Math.PI * 2;
    else openRef.current = Math.sin(p * Math.PI);
    if (p >= 1) {
      animationRef.current = null;
      root.rotation.y = 0;
      anim.resolve();
    }
  });

  const { bounds } = placed;
  const footprint = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
  const height = bounds.max.y - bounds.min.y;

  return (
    <>
      <group ref={rootRef}>
        {placed.instances.map((inst, i) => (
          <group key={i} position={inst.position} rotation={new THREE.Euler(...inst.rotation, 'YXZ')}>
            <PackagingModel preset={preset} textures={textures} finish={finish} baseColor={baseColor} openRef={openRef} />
          </group>
        ))}
      </group>
      {settings.shadows && (
        <ContactShadows
          key={`${preset.id}:${layoutId}`}
          // Sits just below the floor: a base face exactly on the shadow camera's near plane would be clipped.
          position={[0, -0.002, 0]}
          scale={Math.max(footprint * 1.8, 3)}
          far={Math.max(height, 1)}
          blur={2.4}
          opacity={settings.shadowOpacity}
          resolution={1024}
        />
      )}
    </>
  );
}

/** Exposes renderer, scene and camera to the imperative handle. */
function StateBridge({ stateRef }: { stateRef: MutableRefObject<RootState | null> }) {
  const state = useThree();
  stateRef.current = state;
  return null;
}

function pickVideoMime(): { mime: string; extension: string } {
  const candidates = [
    { mime: 'video/mp4;codecs=avc1', extension: 'mp4' },
    { mime: 'video/webm;codecs=vp9', extension: 'webm' },
    { mime: 'video/webm', extension: 'webm' },
  ];
  return (
    candidates.find((c) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) ?? {
      mime: '',
      extension: 'webm',
    }
  );
}

export interface SceneViewportProps {
  preset: PackagingPreset;
  artwork: ArtworkMap;
  finish: FinishId;
  baseColor: string;
  layoutId: LayoutId;
  open: number;
  settings: ViewSettings;
  panMode: boolean;
  /** Horizontal shift (px) of the image so the model centers beside floating panels. */
  viewOffsetPx: number;
}

const SceneViewport = forwardRef<SceneViewportHandle, SceneViewportProps>(function SceneViewport(
  { preset, artwork, finish, baseColor, layoutId, open, settings, panMode, viewOffsetPx },
  ref,
) {
  const stateRef = useRef<RootState | null>(null);
  const openRef = useRef(open);
  const animationRef = useRef<Animation | null>(null);
  const [view, setViewState] = useState<{ dir: Vec3 | null; nonce: number }>({ dir: null, nonce: 0 });

  // The lid follows the editor value unless an open/close video is playing.
  useEffect(() => {
    if (!animationRef.current) openRef.current = open;
  }, [open]);

  const layout = useMemo(() => getModelLayout(preset), [preset]);
  const layoutDef = getLayout(layoutId);
  const bounds = useMemo(() => placeInstances(layoutDef, layout.size).bounds, [layoutDef, layout.size]);
  const sizeKey = layout.size.map((n) => n.toFixed(3)).join('x');

  // A preset, size or layout change returns to the layout's default view.
  useEffect(() => {
    setViewState((v) => ({ dir: null, nonce: v.nonce }));
  }, [preset.id, layoutId, sizeKey]);

  const direction = view.dir ?? layoutDef.view ?? VIEW_DIRECTIONS.angle;
  const framingKey = `${preset.id}:${layoutId}:${sizeKey}:${view.nonce}`;
  const initial = useMemo(() => computeFraming(bounds, 16 / 10, direction), []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(
    ref,
    () => {
      /** Removes the panel offset for a capture so the image is centered; returns a restore function. */
      const suspendOffset = (camera: THREE.PerspectiveCamera) => {
        const saved = camera.view ? { ...camera.view } : null;
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
        return () => {
          if (saved?.enabled) {
            camera.setViewOffset(saved.fullWidth, saved.fullHeight, saved.offsetX, saved.offsetY, saved.width, saved.height);
            camera.updateProjectionMatrix();
          }
        };
      };

      return {
        capturePNG: (longEdgePx) => {
          const state = stateRef.current;
          if (!state) return null;
          const { gl, scene } = state;
          const camera = state.camera as THREE.PerspectiveCamera;
          const size = gl.getSize(new THREE.Vector2());
          const previousRatio = gl.getPixelRatio();
          const maxEdge = Math.min(gl.capabilities.maxTextureSize, 8192);
          const ratio = Math.min(longEdgePx, maxEdge) / Math.max(size.x, size.y, 1);
          const restore = suspendOffset(camera);
          try {
            gl.setPixelRatio(ratio);
            gl.render(scene, camera);
            return gl.domElement.toDataURL('image/png');
          } finally {
            gl.setPixelRatio(previousRatio);
            restore();
            gl.render(scene, camera);
          }
        },

        recordVideo: async ({ mode, durationMs, background }) => {
          const state = stateRef.current;
          if (!state) throw new Error('The 3D viewport is not ready yet.');
          if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot record video.');
          const { gl, scene } = state;
          const camera = state.camera as THREE.PerspectiveCamera;
          const { mime, extension } = pickVideoMime();
          const stream = gl.domElement.captureStream(30);
          const recorder = new MediaRecorder(stream, {
            ...(mime ? { mimeType: mime } : {}),
            videoBitsPerSecond: 12_000_000,
          });
          const chunks: Blob[] = [];
          recorder.ondataavailable = (e) => {
            if (e.data.size) chunks.push(e.data);
          };
          const stopped = new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
          });

          const previousBackground = scene.background;
          scene.background = new THREE.Color(background);
          const restore = suspendOffset(camera);
          recorder.start();
          try {
            await new Promise<void>((resolve) => {
              animationRef.current = { mode, start: performance.now(), duration: durationMs, resolve };
            });
            // Let the last frame reach the stream.
            await new Promise((r) => setTimeout(r, 150));
          } finally {
            recorder.stop();
            stream.getTracks().forEach((t) => t.stop());
            scene.background = previousBackground;
            openRef.current = open;
            restore();
          }
          await stopped;
          return { blob: new Blob(chunks, { type: mime.split(';')[0] || 'video/webm' }), extension };
        },

        resetView: () => setViewState((v) => ({ dir: null, nonce: v.nonce + 1 })),
        setView: (name) => setViewState((v) => ({ dir: VIEW_DIRECTIONS[name], nonce: v.nonce + 1 })),
        zoom: (factor) => {
          const state = stateRef.current;
          const controls = state?.controls as unknown as OrbitControlsLike | null;
          if (!state || !controls) return;
          const offset = state.camera.position.clone().sub(controls.target);
          const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
          state.camera.position.copy(controls.target).addScaledVector(offset.normalize(), distance);
          controls.update();
        },
      };
    },
    [open],
  );

  const intensity = settings.lightIntensity;

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.01, far: 300, position: initial.position.toArray() }}
      gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      className="h-full w-full touch-none"
    >
      <StateBridge stateRef={stateRef} />
      <ViewOffset offsetPx={viewOffsetPx} />

      {/* Studio lighting rig */}
      <ambientLight intensity={0.35 * intensity} />
      <directionalLight position={[4, 6, 3]} intensity={1.6 * intensity} />
      <directionalLight position={[-4, 2.5, -2]} intensity={0.45 * intensity} />

      {/* The HDR is fetched from a CDN; if that fails the scene keeps its direct lights instead of crashing. */}
      <SilentBoundary
        key={settings.environment}
        fallback={<hemisphereLight args={['#ffffff', '#cbd5e1', 1.1 * intensity]} />}
      >
        <Suspense fallback={null}>
          <Environment preset={settings.environment} environmentIntensity={intensity} />
        </Suspense>
      </SilentBoundary>

      <SceneContent
        preset={preset}
        artwork={artwork}
        finish={finish}
        baseColor={baseColor}
        layoutId={layoutId}
        openRef={openRef}
        animationRef={animationRef}
        settings={settings}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.02}
        maxPolarAngle={Math.PI / 2 - 0.04}
        autoRotate={settings.autoRotate}
        autoRotateSpeed={1.2}
        mouseButtons={{
          LEFT: panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{ ONE: panMode ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        target={initial.target.toArray()}
      />
      <CameraRig bounds={bounds} direction={direction} framingKey={framingKey} />
    </Canvas>
  );
});

export default SceneViewport;
