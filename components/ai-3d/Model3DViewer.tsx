"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import {
  AlertCircle,
  Box,
  Grid3x3,
  Info,
  Lightbulb,
  Moon,
  Palette,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Sun,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import type { DetailedHTMLProps, HTMLAttributes } from "react";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

interface Model3DViewerProps {
  modelUrl?: string;
  className?: string;
  autoRotate?: boolean;
  showInfo?: boolean;
  modelInfo?: {
    faces?: number;
    vertices?: number;
    topology?: string;
  };
  showControls?: boolean;
  onTextureToggle?: (showTexture: boolean) => void;
  defaultModelUrl?: string;
  generationParams?: {
    mode?: string;
    provider?: string;
    modelType?: string;
    smartLowPoly?: boolean;
  };
  generationStatus?: "idle" | "processing" | "completed" | "failed";
  transparentBackground?: boolean;
  enableZoom?: boolean;
  modelScaleFactor?: number;
  suppressDefaultModel?: boolean;
  renderEngine?: "internal" | "model-viewer";
}

type RenderEngine = "internal" | "model-viewer";

const MODEL_VIEWER_SCRIPT_URL =
  "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
const MODEL_VIEWER_DEFAULT_THETA = "0deg";
const MODEL_VIEWER_DEFAULT_PHI = "75deg";
const MODEL_VIEWER_BASE_RADIUS = 2.5;
const MIN_VIEWER_ZOOM = 0.5;
const MAX_VIEWER_ZOOM = 3;

type LightingPreset = "studio" | "warm" | "cool";
type BackgroundMode = "gradient" | "solid" | "transparent";
type MaterialState = {
  color: THREE.Color;
  map: THREE.Texture | null;
  emissive: THREE.Color;
  emissiveIntensity: number;
};
const ORIGINAL_MATERIAL_STATE_KEY = "__originalMaterialState";

const LIGHTING_PRESETS: Record<LightingPreset, {
  ambientIntensity: number;
  ambientColor: string;
  keyLight: { position: [number, number, number]; intensity: number; color: string };
  fillLight: { position: [number, number, number]; intensity: number; color: string };
  rimLight: { position: [number, number, number]; intensity: number; color: string };
  environmentImage: string;
  shadowIntensity: number;
  exposure: number;
}> = {
  studio: {
    ambientIntensity: 0.85,
    ambientColor: "#ffffff",
    keyLight: { position: [10, 12, 6], intensity: 1.4, color: "#ffffff" },
    fillLight: { position: [-8, 4, -4], intensity: 0.9, color: "#8ec5ff" },
    rimLight: { position: [0, 5, -10], intensity: 0.6, color: "#6dd5fa" },
    environmentImage: "neutral",
    shadowIntensity: 1,
    exposure: 1,
  },
  warm: {
    ambientIntensity: 0.75,
    ambientColor: "#ffd7ba",
    keyLight: { position: [8, 10, 4], intensity: 1.6, color: "#ffcf99" },
    fillLight: { position: [-6, 3, -5], intensity: 0.8, color: "#ff9966" },
    rimLight: { position: [0, 4, -8], intensity: 0.5, color: "#ff7849" },
    environmentImage: "city",
    shadowIntensity: 1.1,
    exposure: 0.95,
  },
  cool: {
    ambientIntensity: 0.9,
    ambientColor: "#c6d4ff",
    keyLight: { position: [11, 13, 7], intensity: 1.3, color: "#b5d9ff" },
    fillLight: { position: [-9, 5, -6], intensity: 0.85, color: "#4a7bdc" },
    rimLight: { position: [0, 6, -9], intensity: 0.55, color: "#6bd3ff" },
    environmentImage: "spruit",
    shadowIntensity: 0.9,
    exposure: 1.05,
  },
};

type ModelViewerElement = HTMLElement & {
  autoRotate?: boolean;
  cameraOrbit?: string;
  getCameraOrbit?: () => {
    theta: { value: number; unit: string };
    phi: { value: number; unit: string };
    radius: { value: number; unit: string };
  };
  setCameraOrbit?: (theta: string, phi: string, radius: string) => void;
  resetTurntableRotation?: () => void;
  jumpCameraToGoal?: () => void;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, any>;
    }
  }
}

type ModelBoundsCallback = (center: THREE.Vector3, radius: number) => void;

// Non-blocking idle trigger: schedules heavy work when the browser is idle
function useIdleTrigger(delayMs = 500): boolean {
  const [isIdle, setIsIdle] = useState(false);
  useEffect(() => {
    let timeoutId: any;
    let idleId: any;
    const onIdle = () => setIsIdle(true);
    if (typeof (window as any).requestIdleCallback === "function") {
      idleId = (window as any).requestIdleCallback(onIdle, { timeout: Math.max(1000, delayMs * 2) });
    } else {
      timeoutId = setTimeout(onIdle, delayMs);
    }
    return () => {
      if (idleId && typeof (window as any).cancelIdleCallback === "function") {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [delayMs]);
  return isIdle;
}

// Loading indicator - centered circular loader with preview text
function LoadingProgress({ transparentBackground = false }: { transparentBackground?: boolean }) {
  return (
    <Html center>
      <div
        className={cn(
          "flex flex-col items-center gap-3 px-6 py-4 rounded-2xl min-w-[240px] max-w-[300px] text-center",
          transparentBackground ? "bg-transparent" : "bg-[#0f1419]/80 border border-[#1f2937]"
        )}
      >
        <div className="relative h-10 w-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[#252b3a]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#6366f1] border-r-[#6366f1] border-b-transparent border-l-transparent animate-spin" />
        </div>
        <div className="text-xs md:text-sm font-medium text-gray-200">3D Preview</div>
        <div className="text-[11px] md:text-xs text-gray-500">
          Preview will appear here after generation
        </div>
      </div>
    </Html>
  );
}

// Default model component - tries to load user's model, falls back to geometric shape
function DefaultModelWithFile({
  autoRotate,
  defaultModelUrl,
  onBoundsComputed,
  modelScaleFactor = 3.5,
}: {
  autoRotate: boolean;
  defaultModelUrl: string;
  onBoundsComputed?: ModelBoundsCallback;
  modelScaleFactor?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Use useGLTF hook (must be called at top level)
  // Errors will be caught by ErrorBoundary
  // 第二个参数开启 drei 内置 Draco 支持，第三个参数开启 Meshopt 支持
  const gltf = useGLTF(defaultModelUrl, true, true);
  const { scene } = gltf;

  // Auto-rotation is handled by OrbitControls, no manual rotation needed

  // Center and scale the model
  useEffect(() => {
    if (!scene) return;

    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Skip if model has no size
    if (maxDim === 0) return;

    const scale = modelScaleFactor / maxDim; // Increased base factor for larger display

    // Reset scale and position first
    scene.scale.set(1, 1, 1);
    scene.position.set(0, 0, 0);

    // Apply scale
    scene.scale.multiplyScalar(scale);

    // Recalculate bounding box after scale
    const boxAfterScale = new THREE.Box3().setFromObject(scene);
    const centerAfterScale = boxAfterScale.getCenter(new THREE.Vector3());

    // Center the model by moving it to origin
    scene.position.x = -centerAfterScale.x;
    scene.position.y = -centerAfterScale.y;
    scene.position.z = -centerAfterScale.z;

    const finalBox = new THREE.Box3().setFromObject(scene);
    const finalSphere = finalBox.getBoundingSphere(new THREE.Sphere());
    if (finalSphere && onBoundsComputed) {
      onBoundsComputed(finalSphere.center.clone(), finalSphere.radius);
    }
  }, [scene, onBoundsComputed]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}


// Error Boundary for model loading
class ModelErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ModelErrorBoundary] Model loading error:", error);
    console.error("[ModelErrorBoundary] Error message:", error.message);
    console.error("[ModelErrorBoundary] Error stack:", error.stack);
    console.error("[ModelErrorBoundary] Error info:", errorInfo);

    // Check for CORS errors
    if (error.message?.includes("CORS") || error.message?.includes("cross-origin")) {
      console.error("[ModelErrorBoundary] CORS error detected! The model server may not allow cross-origin requests.");
    }

    // Check for network errors
    if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
      console.error("[ModelErrorBoundary] Network error detected! Check if the model URL is accessible.");
    }

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Default model wrapper with error handling
function DefaultModel({
  autoRotate,
  defaultModelUrl,
  onBoundsComputed,
  modelScaleFactor,
}: {
  autoRotate: boolean;
  defaultModelUrl?: string;
  onBoundsComputed?: ModelBoundsCallback;
  modelScaleFactor?: number;
}) {
  if (defaultModelUrl) {
    return (
      <ModelErrorBoundary
        fallback={
          null
        }
      >
        <Suspense
          fallback={
            null
          }
        >
          <DefaultModelWithFile
            autoRotate={autoRotate}
            defaultModelUrl={defaultModelUrl}
            onBoundsComputed={onBoundsComputed}
            modelScaleFactor={modelScaleFactor}
          />
        </Suspense>
      </ModelErrorBoundary>
    );
  }

  return null;
}

// Helper hook to add cache-busting parameter to URL
// Forces reload on every component mount (no caching)
function useCacheBustUrl(url: string): string {
  return useMemo(() => {
    if (process.env.NODE_ENV === "production") {
      return url;
    }

    const cacheBust = Date.now();
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}_t=${cacheBust}`;
  }, [url]);
}

// Helper component for GLTF/GLB models
function GLTFModel({
  url,
  autoRotate,
  showTexture,
  onBoundsComputed,
  modelScaleFactor = 3.5,
}: {
  url: string;
  autoRotate: boolean;
  showTexture: boolean;
  onBoundsComputed?: ModelBoundsCallback;
  modelScaleFactor?: number;
}) {
  // Use useGLTF for GLTF/GLB files (must be called at top level)
  // If loading fails, useGLTF will throw an error which will be caught by ErrorBoundary
  // 第二个参数开启 drei 内置 Draco 支持，第三个参数开启 Meshopt 支持
  const gltf = useGLTF(url, true, true);
  const scene = gltf.scene;

  const groupRef = useRef<THREE.Group>(null);

  // Auto-rotation is handled by OrbitControls, no manual rotation needed

  // Center and scale the model
  useEffect(() => {
    if (!scene) {
      console.warn("[GLTFModel] Cannot center/scale: scene is null");
      return;
    }

    // Wait a bit for scene to be fully loaded
    const timer = setTimeout(() => {
      try {
        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Skip if model has no size
        if (maxDim === 0) {
          return;
        }

        const scale = modelScaleFactor / maxDim;

        // Reset scale and position first
        scene.scale.set(1, 1, 1);
        scene.position.set(0, 0, 0);

        // Apply scale
        scene.scale.multiplyScalar(scale);

        // Recalculate bounding box after scale
        const boxAfterScale = new THREE.Box3().setFromObject(scene);
        const centerAfterScale = boxAfterScale.getCenter(new THREE.Vector3());

        // Center the model by moving it to origin
        scene.position.x = -centerAfterScale.x;
        scene.position.y = -centerAfterScale.y;
        scene.position.z = -centerAfterScale.z;

        const finalBox = new THREE.Box3().setFromObject(scene);
        const finalSphere = finalBox.getBoundingSphere(new THREE.Sphere());
        if (finalSphere && onBoundsComputed) {
          onBoundsComputed(finalSphere.center.clone(), finalSphere.radius);
        }
      } catch (error) {
        console.error("[GLTFModel] Error in center/scale:", error);
      }
    }, 100); // Small delay to ensure scene is ready

    return () => clearTimeout(timer);
  }, [scene, onBoundsComputed]);

  // Toggle texture/white model
  useEffect(() => {
    if (!scene) return;

    scene.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh) || !child.material) {
        return;
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material];

      materials.forEach((mat) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) {
          return;
        }

        const storedState: MaterialState = (mat.userData as Record<string, MaterialState>)[ORIGINAL_MATERIAL_STATE_KEY] ?? {
          color: mat.color.clone(),
          map: mat.map ?? null,
          emissive: mat.emissive.clone(),
          emissiveIntensity: mat.emissiveIntensity ?? 0,
        };

        if (!(ORIGINAL_MATERIAL_STATE_KEY in mat.userData)) {
          (mat.userData as Record<string, MaterialState>)[ORIGINAL_MATERIAL_STATE_KEY] = storedState;
        }

        if (!showTexture) {
          // White model mode
          mat.color.set(0xffffff);
          mat.map = null;
          mat.emissive.set(0x333333);
          mat.emissiveIntensity = 0.2;
        } else {
          // Restore original material
          mat.color.copy(storedState.color);
          mat.map = storedState.map;
          mat.emissive.copy(storedState.emissive);
          mat.emissiveIntensity = storedState.emissiveIntensity;
        }

        mat.needsUpdate = true;
      });
    });
  }, [scene, showTexture]);

  // Return the scene wrapped in a group for better control
  // Make sure scene is visible
  useEffect(() => {
    if (scene) {
      scene.visible = true;
      scene.traverse((child: THREE.Object3D) => {
        child.visible = true;
      });
    }
  }, [scene]);

  // Return the scene directly - transformations are applied to scene itself
  return <primitive object={scene} />;
}

// Helper component for OBJ models
function OBJModel({
  url,
  autoRotate,
  showTexture,
  onBoundsComputed,
  modelScaleFactor = 3.5,
}: {
  url: string;
  autoRotate: boolean;
  showTexture: boolean;
  onBoundsComputed?: ModelBoundsCallback;
  modelScaleFactor?: number;
}) {
  // Derive MTL URL from OBJ URL (same directory, fixed filename material.mtl)
  const baseDir = useMemo(() => {
    const lastSlash = url.lastIndexOf("/");
    return lastSlash !== -1 ? url.slice(0, lastSlash) : "";
  }, [url]);

  const mtlUrl = useMemo(() => {
    return baseDir ? `${baseDir}/material.mtl` : "material.mtl";
  }, [baseDir]);

  // Try to load MTL first, then bind it to OBJ loader
  const materials = useLoader(MTLLoader, mtlUrl);
  const object = useLoader(
    OBJLoader,
    url,
    (loader: OBJLoader) => {
      if (materials) {
        materials.preload();
        loader.setMaterials(materials);
      }
    }
  );
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!object) {
      console.warn("[OBJModel] Cannot center/scale: object is null");
      return;
    }

    const group = groupRef.current;
    if (!group) return;

    // Reset transform
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.scale.set(1, 1, 1);

    // Compute bounds on the group with object attached
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim === 0) return;

    const scale = modelScaleFactor / maxDim;

    group.scale.setScalar(scale);
    group.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const finalBox = new THREE.Box3().setFromObject(group);
    const finalSphere = finalBox.getBoundingSphere(new THREE.Sphere());
    if (finalSphere && onBoundsComputed) {
      onBoundsComputed(finalSphere.center.clone(), finalSphere.radius);
    }
  }, [object, modelScaleFactor, onBoundsComputed]);

  // Toggle texture / white model for OBJ by traversing materials, similar to GLTFModel
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        const applyTexture = (m: THREE.Material) => {
          if (m instanceof THREE.MeshStandardMaterial) {
            if (!showTexture) {
              m.color.set(0xffffff);
              m.map = null;
              m.emissive.set(0x333333);
              m.emissiveIntensity = 0.2;
            } else {
              m.emissive.set(0x000000);
              m.emissiveIntensity = 0;
            }
          }
        };
        if (Array.isArray(mat)) {
          mat.forEach(applyTexture);
        } else if (mat) {
          applyTexture(mat);
        }
      }
    });
  }, [showTexture]);

  return (
    <group ref={groupRef}>
      <primitive object={object} />
    </group>
  );
}

// 3D Model component - supports GLB/GLTF and OBJ formats
function Model({
  url,
  autoRotate,
  showTexture,
  onBoundsComputed,
  modelScaleFactor,
}: {
  url: string;
  autoRotate: boolean;
  showTexture: boolean;
  onBoundsComputed?: ModelBoundsCallback;
  modelScaleFactor?: number;
}) {
  const isObj = url.toLowerCase().endsWith(".obj");
  return (
    <ModelErrorBoundary
      fallback={
        null
      }
    >
      <Suspense
        fallback={null}
      >
        {isObj ? (
          <OBJModel
            url={url}
            autoRotate={autoRotate}
            showTexture={showTexture}
            onBoundsComputed={onBoundsComputed}
            modelScaleFactor={modelScaleFactor}
          />
        ) : (
          <GLTFModel
            url={url}
            autoRotate={autoRotate}
            showTexture={showTexture}
            onBoundsComputed={onBoundsComputed}
            modelScaleFactor={modelScaleFactor}
          />
        )}
      </Suspense>
    </ModelErrorBoundary>
  );
}

export default function Model3DViewer({
  modelUrl,
  className,
  autoRotate = true,
  showInfo = false,
  modelInfo,
  showControls = true,
  onTextureToggle,
  defaultModelUrl,
  generationParams,
  generationStatus = "idle",
  transparentBackground = false,
  enableZoom = true,
  modelScaleFactor = 3.5,
  suppressDefaultModel = false,
  renderEngine = "internal",
}: Model3DViewerProps) {
  const [isAutoRotating, setIsAutoRotating] = useState(autoRotate);
  const [showTexture, setShowTexture] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isWebGLLost, setIsWebGLLost] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);
  const [optimizationHint, setOptimizationHint] = useState<string | null>(null);
  const [isOptimizationHintVisible, setIsOptimizationHintVisible] = useState(false);
  const [detectedModelSizeMB, setDetectedModelSizeMB] = useState<number | null>(null);
  const [isModelViewerScriptLoaded, setIsModelViewerScriptLoaded] = useState(false);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>("studio");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(transparentBackground ? "transparent" : "gradient");
  const [viewMode, setViewMode] = useState<"textured" | "white">("textured");

  const hasFacesInfo = typeof modelInfo?.faces === "number" && Number.isFinite(modelInfo.faces);
  const hasVerticesInfo = typeof modelInfo?.vertices === "number" && Number.isFinite(modelInfo.vertices);
  const facesText = hasFacesInfo ? modelInfo!.faces!.toLocaleString() : "--";
  const verticesText = hasVerticesInfo ? modelInfo!.vertices!.toLocaleString() : "--";
  const estimatedQualityLabel = useMemo(() => {
    if (!hasFacesInfo) {
      return "未知";
    }
    if (modelInfo!.faces! >= 400000) {
      return "超高精度";
    }
    if (modelInfo!.faces! >= 150000) {
      return "视觉高保";
    }
    if (modelInfo!.faces! >= 50000) {
      return "实时通用";
    }
    return "移动端";
  }, [hasFacesInfo, modelInfo?.faces]);
  const estimatedTextureState = generationParams?.modelType === "white" || showTexture === false
    ? "白模"
    : "已贴图";

  const generationModeLabel = generationParams?.mode
    ? generationParams.mode === "text-to-3d"
      ? "文生3D"
      : generationParams.mode === "image-to-3d"
        ? "图生3D"
        : "多图生3D"
    : "未设置";
  const generationProviderLabel = generationParams?.provider
    ? generationParams.provider === "tripo"
      ? "Tripo 3D-V3.0"
      : "腾讯混元"
    : "未设置";
  const generationModelTypeLabel = generationParams?.modelType
    ? generationParams.modelType === "standard"
      ? "标准纹理"
      : "白模"
    : "未设置";
  const generationSmartLowPolyLabel = generationParams?.smartLowPoly === undefined
    ? "未设置"
    : generationParams.smartLowPoly
      ? "是"
      : "否";

  const resolvedRenderEngine: RenderEngine = renderEngine ?? "internal";
  const isModelViewerEngine = resolvedRenderEngine === "model-viewer";
  const currentLightingPreset = useMemo(() => LIGHTING_PRESETS[lightingPreset], [lightingPreset]);
  const clampZoomValue = useCallback((value: number) => Math.min(Math.max(value, MIN_VIEWER_ZOOM), MAX_VIEWER_ZOOM), []);

  const MAX_MODEL_SIZE_MB = 60;
  const SHOWCASE_HINT_ENABLED = false;

  // Don't show default model when processing
  const isDefaultModel = !modelUrl && generationStatus !== "processing" && !suppressDefaultModel;
  const effectiveModelSrc = modelUrl ?? (isDefaultModel ? defaultModelUrl : undefined);
  // Always allow mounting to prevent freezing (removed idle trigger optimization)
  const allowHeavyMount = true;
  const shouldRenderTransparent = backgroundMode === "transparent" || transparentBackground;
  const viewerBackgroundStyle = shouldRenderTransparent
    ? { background: "transparent" }
    : backgroundMode === "solid"
      ? { background: "#0b111b" }
      : { background: "linear-gradient(to bottom, #1a1f2e 0%, #0f1419 50%, #1a1f2e 100%)" };
  const initialModelViewerOrbit = `${MODEL_VIEWER_DEFAULT_THETA} ${MODEL_VIEWER_DEFAULT_PHI} ${MODEL_VIEWER_BASE_RADIUS}m`;
  const setModelViewerRef = useCallback((node: ModelViewerElement | null) => {
    modelViewerRef.current = node;
  }, []);

  const handleModelLoadFailure = useCallback((message: string) => {
    setModelLoadError(message);
    setIsSceneReady(true);
    setIsAutoRotating(false);
  }, []);

  const updateModelViewerOrbit = useCallback(
    (targetZoom: number, keepAngles = true) => {
      if (!isModelViewerEngine) {
        return;
      }
      const element = modelViewerRef.current;
      if (!element) {
        return;
      }

      const radiusValue = (MODEL_VIEWER_BASE_RADIUS / targetZoom).toFixed(3);
      let theta = MODEL_VIEWER_DEFAULT_THETA;
      let phi = MODEL_VIEWER_DEFAULT_PHI;

      if (keepAngles && typeof element.getCameraOrbit === "function") {
        const orbit = element.getCameraOrbit();
        if (orbit) {
          theta = `${orbit.theta.value}${orbit.theta.unit}`;
          phi = `${orbit.phi.value}${orbit.phi.unit}`;
        }
      }

      const radiusString = `${radiusValue}m`;
      if (typeof element.setCameraOrbit === "function") {
        element.setCameraOrbit(theta, phi, radiusString);
      } else {
        element.setAttribute("camera-orbit", `${theta} ${phi} ${radiusString}`);
      }

      element.jumpCameraToGoal?.();
    },
    [isModelViewerEngine]
  );

  // Ensure component only renders on client side to avoid SSR issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Lazy-load @google/model-viewer script when needed
  useEffect(() => {
    if (!isClient || !isModelViewerEngine) {
      return;
    }

    const win = window as typeof window & { customElements?: CustomElementRegistry };
    if (win?.customElements?.get("model-viewer")) {
      setIsModelViewerScriptLoaded(true);
      return;
    }

    let script = document.querySelector(`script[data-model-viewer-script="true"]`) as HTMLScriptElement | null;

    const handleLoad = () => {
      setIsModelViewerScriptLoaded(true);
      setModelLoadError(null);
    };

    const handleError = () => {
      setIsModelViewerScriptLoaded(false);
      handleModelLoadFailure("无法加载 model-viewer 库，请检查网络后重试");
    };

    if (!script) {
      script = document.createElement("script");
      script.src = MODEL_VIEWER_SCRIPT_URL;
      script.type = "module";
      script.async = true;
      script.dataset.modelViewerScript = "true";
      document.head.appendChild(script);
    }

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, [handleModelLoadFailure, isClient, isModelViewerEngine]);

  // Reset scene ready when starting a new load
  useEffect(() => {
    setIsSceneReady(false);
    // Clear any previous errors when modelUrl changes
    if (modelUrl) {
      setModelLoadError(null);
    }
  }, [modelUrl, retryKey, isDefaultModel]);

  useEffect(() => {
    if (!modelUrl || modelUrl.startsWith("blob:") || modelUrl.startsWith("data:")) {
      setDetectedModelSizeMB(null);
      return;
    }

    const controller = new AbortController();

    const checkModelSize = async () => {
      try {
        const response = await fetch(modelUrl, { method: "HEAD", signal: controller.signal });
        const contentLength = response.headers.get("content-length");
        if (!contentLength) return;

        const sizeBytes = Number(contentLength);
        if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return;

        const sizeMB = sizeBytes / (1024 * 1024);
        setDetectedModelSizeMB(sizeMB);

        if (sizeMB > MAX_MODEL_SIZE_MB) {
          const sizeMessage = `检测到模型体积约 ${sizeMB.toFixed(1)} MB，超过推荐的 ${MAX_MODEL_SIZE_MB} MB。强烈建议先在本地进行 Draco 压缩、贴图降分辨率或简化多边形后再预览。`;
          setOptimizationHint(sizeMessage);
          setIsOptimizationHintVisible(SHOWCASE_HINT_ENABLED);
          setTimeout(() => {
            handleModelLoadFailure("模型文件过大导致加载缓慢或失败，请压缩后重新上传。");
          }, 0);
        }
      } catch (error) {
        const isAbortError =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error as any)?.name === "AbortError";
        if (isAbortError) {
          return;
        }
        console.warn("[Model3DViewer] Failed to fetch model headers for size check:", error);
      }
    };

    checkModelSize();

    return () => {
      controller.abort();
    };
  }, [modelUrl, handleModelLoadFailure]);

  useEffect(() => {
    if (modelLoadError || isWebGLLost) {
      setIsSceneReady(true);
      setIsAutoRotating(false);
    }
  }, [modelLoadError, isWebGLLost]);

  const handleModelBoundsComputed = useCallback(
    (center: THREE.Vector3, radius: number) => {
      setIsSceneReady(true);
      const controls = controlsRef.current;
      const camera = cameraRef.current;

      if (!camera) {
        return;
      }

      const currentTarget = controls ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
      const direction = camera.position.clone().sub(currentTarget);
      if (direction.lengthSq() === 0) {
        direction.set(0, 0, 1);
      } else {
        direction.normalize();
      }

      const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;
      const distance = Math.max(safeRadius * 2.4, 3);
      const newPosition = center.clone().add(direction.multiplyScalar(distance));

      camera.position.copy(newPosition);
      camera.near = Math.max(distance / 100, 0.1);
      camera.far = Math.max(distance * 20, 50);
      camera.updateProjectionMatrix();
      camera.lookAt(center);

      if (controls) {
        controls.target.copy(center);
        controls.update();
        if (typeof controls.saveState === "function") {
          controls.saveState();
        }
      }

      setZoom(1);
    },
    []
  );

  useEffect(() => {
    setIsAutoRotating(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    if (!isModelViewerEngine || !isModelViewerScriptLoaded || !modelViewerRef.current) {
      return;
    }

    if (isAutoRotating) {
      modelViewerRef.current.setAttribute("auto-rotate", "");
    } else {
      modelViewerRef.current.removeAttribute("auto-rotate");
    }
  }, [isAutoRotating, isModelViewerEngine, isModelViewerScriptLoaded]);

  useEffect(() => {
    if (!isModelViewerEngine || !isModelViewerScriptLoaded) {
      return;
    }

    const element = modelViewerRef.current;
    if (!element) {
      return;
    }

    const handleLoaded = () => {
      setIsSceneReady(true);
      setModelLoadError(null);
      updateModelViewerOrbit(zoom, false);
    };

    const handleError = () => {
      handleModelLoadFailure("模型加载失败，请检查文件格式或跨域设置");
    };

    element.addEventListener("load", handleLoaded);
    element.addEventListener("error", handleError as EventListener);

    return () => {
      element.removeEventListener("load", handleLoaded);
      element.removeEventListener("error", handleError as EventListener);
    };
  }, [handleModelLoadFailure, isModelViewerEngine, isModelViewerScriptLoaded, updateModelViewerOrbit, zoom, effectiveModelSrc]);

  useEffect(() => {
    if (!isModelViewerEngine || !isModelViewerScriptLoaded || !modelViewerRef.current) {
      return;
    }

    const element = modelViewerRef.current;
    element.setAttribute("environment-image", currentLightingPreset.environmentImage);
    element.setAttribute("shadow-intensity", currentLightingPreset.shadowIntensity.toString());
    element.setAttribute("exposure", currentLightingPreset.exposure.toString());
  }, [currentLightingPreset, isModelViewerEngine, isModelViewerScriptLoaded]);

  const handleZoom = (direction: "in" | "out") => {
    if (isModelViewerEngine && (!isModelViewerScriptLoaded || !modelViewerRef.current)) {
      return;
    }
    setZoom((prev) => {
      const delta = direction === "in" ? 0.2 : -0.2;
      const newZoom = clampZoomValue(prev + delta);
      if (resolvedRenderEngine === "internal" && cameraRef.current) {
        const currentDistance = cameraRef.current.position.length();
        const newDistance = direction === "in" ? currentDistance / 1.2 : currentDistance * 1.2;
        cameraRef.current.position.normalize().multiplyScalar(newDistance);
      } else if (resolvedRenderEngine === "model-viewer") {
        updateModelViewerOrbit(newZoom);
      }
      return newZoom;
    });
  };

  const handleZoomIn = () => handleZoom("in");
  const handleZoomOut = () => handleZoom("out");

  const handleReset = () => {
    setZoom(1);
    if (resolvedRenderEngine === "model-viewer") {
      if (modelViewerRef.current) {
        modelViewerRef.current.resetTurntableRotation?.();
        updateModelViewerOrbit(1, false);
      }
      return;
    }

    if (controlsRef.current) {
      // Try to reset controls - @react-three/drei OrbitControls may have different API
      try {
        if (controlsRef.current.reset) {
          controlsRef.current.reset();
        } else if (controlsRef.current.object && controlsRef.current.object.reset) {
          controlsRef.current.object.reset();
        }
      } catch (error) {
        // If reset is not available, just log and continue
        console.warn("Could not reset OrbitControls:", error);
      }
    }
  };

  const handleTextureToggle = useCallback(
    (value: boolean) => {
      setShowTexture(value);
      onTextureToggle?.(value);
    },
    [onTextureToggle]
  );

  const handleViewModeChange = (mode: "textured" | "white") => {
    setViewMode(mode);
    handleTextureToggle(mode === "textured");
  };

  const handleBackgroundChange = (mode: BackgroundMode) => {
    setBackgroundMode(mode);
  };

  const handleLightingPresetChange = (preset: LightingPreset) => {
    setLightingPreset(preset);
  };

  const handleViewerWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!event.ctrlKey) {
      event.preventDefault();
    }
  }, []);

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden",
        !transparentBackground && "bg-gradient-to-br from-[#1a1f2e] via-[#0f1419] to-[#1a1f2e]",
        transparentBackground && "bg-transparent",
        className
      )}
      style={transparentBackground ? { background: 'transparent' } : undefined}
    >
      {/* Model Info Overlay - Top Left */}
      {showInfo && modelInfo && (
        <div className="absolute top-4 left-4 z-10 bg-[#1a1f2e]/90 backdrop-blur-sm rounded-xl p-4 text-xs text-gray-300 space-y-3 min-w-[260px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-sm font-semibold">模型数据</div>
              {modelInfo.topology && <div className="text-[11px] text-gray-500">拓扑：{modelInfo.topology}</div>}
            </div>
            {detectedModelSizeMB && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-purple-200 border border-white/10">
                {detectedModelSizeMB.toFixed(1)} MB
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-gray-500">三角面数</div>
              <div className="text-white text-base font-semibold">{facesText}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">顶点数</div>
              <div className="text-white text-base font-semibold">{verticesText}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">{estimatedQualityLabel}</span>
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-200">{estimatedTextureState}</span>
            {generationParams?.smartLowPoly && (
              <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[11px] text-yellow-200">智能低模</span>
            )}
          </div>
        </div>
      )}

      {/* Generation Status Overlay handled by status panel; no separate overlay */}

      {/* Model Load Error Overlay */}
      {modelLoadError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0f1419]/80 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] rounded-lg p-6 border border-[#2d3548] text-center min-w-[300px]">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <div className="text-white text-lg font-medium mb-2">模型加载失败</div>
            <div className="text-gray-400 text-sm mb-4">{modelLoadError}</div>
            <Button
              onClick={() => {
                setModelLoadError(null);
                setRetryKey(prev => prev + 1);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重试加载
            </Button>
          </div>
        </div>
      )}

      {isOptimizationHintVisible && optimizationHint && (
        <div className="absolute bottom-4 right-4 z-30 max-w-sm">
          <div className="bg-[#1a1f2e]/95 backdrop-blur-sm border border-[#2d3548] rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-purple-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-xs text-gray-200 space-y-2">
                <p>{optimizationHint}</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>优先导出为带 Draco 压缩的 GLB/GLTF。</li>
                  <li>在 Blender 中使用 Decimate 减少多边形。</li>
                  <li>将贴图压缩到 2K 或更低分辨率。</li>
                </ul>
                {detectedModelSizeMB !== null && (
                  <p className="text-purple-300">
                    检测到模型体积：约 {detectedModelSizeMB.toFixed(1)} MB
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-white"
                onClick={() => setIsOptimizationHintVisible(false)}
                title="关闭提示"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generation Parameters - Top Right */}
      {showInfo && (
        <div className="absolute top-4 right-4 z-10 bg-[#1a1f2e]/90 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300 space-y-1.5 min-w-[180px]">
          <div className="text-gray-500 mb-2 text-sm">生成参数</div>
          <div>
            <span className="text-gray-500">模式: </span>
            <span className="text-white">{generationModeLabel}</span>
          </div>
          <div>
            <span className="text-gray-500">提供商: </span>
            <span className="text-white">{generationProviderLabel}</span>
          </div>
          <div>
            <span className="text-gray-500">类型: </span>
            <span className="text-white">{generationModelTypeLabel}</span>
          </div>
          <div>
            <span className="text-gray-500">智能低模: </span>
            <span className="text-white">{generationSmartLowPolyLabel}</span>
          </div>
        </div>
      )}

      {/* 3D Viewer Container */}
      <div className="w-full h-full" onWheel={handleViewerWheel}>
        {!isClient ? (
          <div className={cn("w-full h-full flex items-center justify-center", !transparentBackground && "bg-[#0f1419]")}>
            <div className="text-gray-400 text-sm">加载中...</div>
          </div>
        ) : (
          isModelViewerEngine ? (
            isModelViewerScriptLoaded ? (
              effectiveModelSrc ? (
                <model-viewer
                  key={`${retryKey}-${effectiveModelSrc}`}
                  ref={setModelViewerRef as any}
                  src={effectiveModelSrc}
                  style={{ width: "100%", height: "100%", ...viewerBackgroundStyle }}
                  ar
                  ar-modes="scene-viewer webxr quick-look"
                  shadow-intensity="1"
                  exposure="0.9"
                  touch-action="pan-y"
                  camera-controls
                  interaction-prompt="auto"
                  interaction-policy="always-allow"
                  autoplay
                  auto-rotate={isAutoRotating ? true : undefined}
                  camera-orbit={initialModelViewerOrbit}
                  environment-image="legacy"
                  loading="lazy"
                  reveal={generationStatus === "completed" ? "auto" : "interaction"}
                  tone-mapping="aces"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400" style={viewerBackgroundStyle}>
                  暂无可预览模型
                </div>
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400" style={viewerBackgroundStyle}>
                正在加载 3D 预览引擎...
              </div>
            )
          ) : (
            <Canvas
              key={retryKey}
              camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 1000 }}
              dpr={1}
              frameloop="always"
              gl={{
                antialias: false,
                alpha: transparentBackground,
                powerPreference: "high-performance",
                failIfMajorPerformanceCaveat: false,
              }}
              style={viewerBackgroundStyle}
              onCreated={({ camera, gl }) => {
                cameraRef.current = camera as THREE.PerspectiveCamera;

                // Get canvas element
                const canvas = gl.domElement;

                // Set transparent background if needed
                if (transparentBackground) {
                  gl.setClearColor(0x000000, 0); // Transparent black
                  // Force canvas background to be transparent
                  canvas.style.backgroundColor = "transparent";
                  canvas.style.background = "transparent";
                  gl.clear();
                } else {
                  gl.setClearColor(0x0f1419, 1); // Default dark background
                }

                // Listen for WebGL context loss/restoration
                const handleLost = (e: Event) => {
                  e.preventDefault();
                  const webglEvent = e as WebGLContextEvent;
                  console.warn("WebGL context lost", webglEvent);

                  // Check if it's a memory error by checking the WebGL context
                  const webglContext = gl.getContext() as WebGLRenderingContext | null;
                  if (webglContext) {
                    const glError = webglContext.getError();
                    // OUT_OF_MEMORY = 0x0505 = 1285, but error code 5 is also common
                    if (glError === 0x0505 || glError === 5 || (webglEvent as any).statusMessage?.includes("memory")) {
                      console.error("WebGL OUT_OF_MEMORY error detected");
                      handleModelLoadFailure("模型文件过大导致 GPU 内存不足，请尝试使用更小的模型或刷新页面");
                      return;
                    }
                  }
                  setIsWebGLLost(true);
                };
                const handleRestored = () => {
                  console.info("WebGL context restored");
                  setIsWebGLLost(false);
                  setModelLoadError(null);
                };
                canvas.addEventListener("webglcontextlost", handleLost as EventListener, false);
                canvas.addEventListener("webglcontextrestored", handleRestored as EventListener, false);

                // Ensure reasonable color pipeline
                // three r181 supports SRGBColorSpace on WebGLRenderer
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                gl.outputColorSpace = THREE.SRGBColorSpace;
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.0;
              }}
            >
              {!isSceneReady && !modelLoadError && !isWebGLLost && <LoadingProgress transparentBackground={transparentBackground} />}
              <Suspense fallback={null}>
                <ambientLight intensity={currentLightingPreset.ambientIntensity} color={currentLightingPreset.ambientColor} />
                <directionalLight
                  position={currentLightingPreset.keyLight.position}
                  intensity={currentLightingPreset.keyLight.intensity}
                  color={currentLightingPreset.keyLight.color}
                />
                <directionalLight
                  position={currentLightingPreset.fillLight.position}
                  intensity={currentLightingPreset.fillLight.intensity}
                  color={currentLightingPreset.fillLight.color}
                />
                <directionalLight
                  position={currentLightingPreset.rimLight.position}
                  intensity={currentLightingPreset.rimLight.intensity}
                  color={currentLightingPreset.rimLight.color}
                />
                <pointLight position={[0, 10, 0]} intensity={0.35} />

                {isDefaultModel ? (
                  <DefaultModel
                    autoRotate={isAutoRotating}
                    defaultModelUrl={defaultModelUrl}
                    onBoundsComputed={handleModelBoundsComputed}
                    modelScaleFactor={modelScaleFactor * 1.35}
                  />
                ) : modelUrl ? (
                  <ModelErrorBoundary
                    fallback={
                      <mesh>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color="#ff0000" />
                      </mesh>
                    }
                    onError={(error) => {
                      console.error("[Model3DViewer] Model loading error:", error);
                      const errorMsg = error.message || error.toString();

                      if (errorMsg?.includes("timeout") || errorMsg?.includes("Failed to fetch")) {
                        handleModelLoadFailure("模型文件过大或网络连接超时，请稍后重试");
                      } else if (errorMsg?.includes("CORS") || errorMsg?.includes("cross-origin")) {
                        handleModelLoadFailure("跨域访问被阻止，请联系管理员");
                      } else if (
                        errorMsg?.includes("memory") ||
                        errorMsg?.includes("Memory") ||
                        errorMsg?.includes("OUT_OF_MEMORY") ||
                        errorMsg?.includes("错误代码：5") ||
                        (error as any).code === 5
                      ) {
                        handleModelLoadFailure("模型文件过大导致内存不足，请尝试使用更小的模型或刷新页面");
                      } else if (errorMsg?.includes("WebGL") || errorMsg?.includes("webgl")) {
                        handleModelLoadFailure("WebGL 渲染错误，请检查浏览器是否支持 WebGL 或刷新页面");
                      } else {
                        handleModelLoadFailure("模型加载失败，请检查文件格式或重试。如果问题持续，可能是模型文件过大");
                      }
                    }}
                  >
                    <Model
                      url={modelUrl}
                      autoRotate={isAutoRotating}
                      showTexture={showTexture}
                      onBoundsComputed={handleModelBoundsComputed}
                      modelScaleFactor={modelScaleFactor}
                    />
                  </ModelErrorBoundary>
                ) : null}

                <OrbitControls
                  ref={controlsRef}
                  enableZoom={enableZoom}
                  enablePan={true}
                  enableRotate={true}
                  autoRotate={isAutoRotating}
                  autoRotateSpeed={1}
                  minDistance={1.5}
                  maxDistance={15}
                  target={[0, 0, 0]}
                />
              </Suspense>
            </Canvas>
          )
        )}
      </div>

      {/* Controls - Bottom */}
      {showControls && (
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-1.5rem)] max-w-[940px] flex justify-center">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-xl bg-[#1a1f2e]/95 px-4 py-3 text-xs text-gray-200 backdrop-blur-sm">
            {/* Left: Zoom Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white"
                onClick={handleZoomOut}
                title="缩小"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-400 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white"
                onClick={handleZoomIn}
                title="放大"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Middle: Reset & Auto Rotate */}
            <div className="flex items-center gap-1 px-3 border-l border-r border-[#2d3548]">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white"
                onClick={handleReset}
                title="重置到初始角度"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  isAutoRotating
                    ? "text-purple-400 hover:text-purple-300"
                    : "text-gray-400 hover:text-white"
                )}
                onClick={() => setIsAutoRotating(!isAutoRotating)}
                title={isAutoRotating ? "停止自动旋转" : "开始自动旋转"}
              >
                {isAutoRotating ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* View Mode */}
            {!isDefaultModel && (
              <div className="flex items-center gap-1 px-3 border-r border-[#2d3548]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    viewMode === "white"
                      ? "text-white bg-purple-500/20 hover:bg-purple-500/30"
                      : "text-gray-400 hover:text-white"
                  )}
                  onClick={() => handleViewModeChange("white")}
                  title="白模"
                >
                  <Box className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    viewMode === "textured"
                      ? "text-white bg-purple-500/20 hover:bg-purple-500/30"
                      : "text-gray-400 hover:text-white"
                  )}
                  onClick={() => handleViewModeChange("textured")}
                  title="纹理"
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Lighting Presets */}
            <div className="flex items-center gap-1 px-3 border-r border-[#2d3548]">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  lightingPreset === "studio" ? "text-amber-300 bg-white/10" : "text-gray-400 hover:text-white"
                )}
                onClick={() => handleLightingPresetChange("studio")}
                title="影棚光"
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  lightingPreset === "warm" ? "text-orange-300 bg-white/10" : "text-gray-400 hover:text-white"
                )}
                onClick={() => handleLightingPresetChange("warm")}
                title="暖色光"
              >
                <Sun className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  lightingPreset === "cool" ? "text-blue-300 bg-white/10" : "text-gray-400 hover:text-white"
                )}
                onClick={() => handleLightingPresetChange("cool")}
                title="冷色光"
              >
                <Moon className="h-4 w-4" />
              </Button>
            </div>

            {/* Background Modes */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  backgroundMode === "solid" ? "text-white bg-white/10" : "text-gray-400 hover:text-white"
                )}
                onClick={() => handleBackgroundChange("solid")}
                title="纯色背景"
              >
                <Square className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  backgroundMode === "gradient" ? "text-white bg-white/10" : "text-gray-400 hover:text-white"
                )}
                onClick={() => handleBackgroundChange("gradient")}
                title="渐变背景"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  backgroundMode === "transparent" ? "text-white bg-white/10" : "text-gray-400 hover:text-white"
                )}
                onClick={() => handleBackgroundChange("transparent")}
                title="透明背景"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
