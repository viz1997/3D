"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import {
  AlertCircle,
  Box,
  Palette,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

// Preload the default demo GLB and showcase models to reduce first-load issues
useGLTF.preload("https://assets.ai3dmodel.app/pgc/ai3d-demo.glb");
useGLTF.preload("https://assets.ai3dmodel.app/pgc/ai3d-1.glb");
useGLTF.preload("https://assets.ai3dmodel.app/pgc/ai3d-2.glb");

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
}

type ModelBoundsCallback = (center: THREE.Vector3, radius: number) => void;

// Loading progress component - must be inside Canvas
// Simple loading indicator without useProgress to avoid SSR issues
function LoadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <Html center>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1419]/90 backdrop-blur-sm">
        <div className="bg-[#1a1f2e] rounded-lg p-6 border border-[#2d3548] text-center min-w-[300px]">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
          <div className="text-white text-lg font-medium mb-2">正在加载模型...</div>
          <div className="w-full bg-[#2d3548] rounded-full h-2 mb-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 90)}%` }}
            />
          </div>
          <div className="text-gray-400 text-sm">{Math.round(Math.min(progress, 90))}%</div>
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
}: {
  autoRotate: boolean;
  defaultModelUrl: string;
  onBoundsComputed?: ModelBoundsCallback;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Add cache-busting to default model URL (no caching)
  const defaultModelUrlWithCacheBust = useCacheBustUrl(defaultModelUrl);

  // Debug: log URL before loading
  useEffect(() => {
    console.log("[DefaultModelWithFile] Attempting to load:", defaultModelUrlWithCacheBust, "from original:", defaultModelUrl);
  }, [defaultModelUrlWithCacheBust, defaultModelUrl]);

  // Use useGLTF hook (must be called at top level)
  // Errors will be caught by ErrorBoundary
  const gltf = useGLTF(defaultModelUrlWithCacheBust);
  const { scene } = gltf;

  // Debug: log when scene is loaded
  useEffect(() => {
    if (scene) {
      console.log("[DefaultModelWithFile] Scene loaded successfully:", defaultModelUrl, scene);
      console.log("[DefaultModelWithFile] Scene children count:", scene.children.length);
      // Log bounding box info
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      console.log("[DefaultModelWithFile] Model size:", size);
    } else {
      console.warn("[DefaultModelWithFile] Scene is null/undefined for:", defaultModelUrl);
    }
  }, [scene, defaultModelUrl]);

  useEffect(() => {
    if (!autoRotate || !groupRef.current) return;

    let animationId: number;
    const animate = () => {
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.005;
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [autoRotate]);

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

    const scale = 3.5 / maxDim; // Increased from 2 to 3 for larger display

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
}: {
  autoRotate: boolean;
  defaultModelUrl?: string;
  onBoundsComputed?: ModelBoundsCallback;
}) {
  if (defaultModelUrl) {
    return (
      <ModelErrorBoundary
        fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ff6b6b" />
          </mesh>
        }
      >
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#4ecdc4" />
            </mesh>
          }
        >
          <DefaultModelWithFile
            autoRotate={autoRotate}
            defaultModelUrl={defaultModelUrl}
            onBoundsComputed={onBoundsComputed}
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
  // Generate a new timestamp on each component mount to force reload
  const cacheBust = useMemo(() => Date.now(), [url]); // Regenerate when URL changes
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_t=${cacheBust}`;
}

// Helper component to load OBJ with MTL
function OBJWithMTLInternal({
  url,
  baseUrl,
  autoRotate,
  showTexture,
  onBoundsComputed,
}: {
  url: string;
  baseUrl: string;
  autoRotate: boolean;
  showTexture: boolean;
  onBoundsComputed?: ModelBoundsCallback;
}) {
  // Add cache-busting to URLs to force reload (no caching)
  const mtlUrl = useCacheBustUrl(baseUrl + "material.mtl");
  const objUrl = useCacheBustUrl(url);

  // Load MTL file first (useLoader will throw if it fails, caught by error boundary)
  const materials = useLoader(MTLLoader, mtlUrl);

  // Load OBJ file with materials
  const scene = useLoader(OBJLoader, objUrl, (loader) => {
    (loader as OBJLoader).setMaterials(materials);
  }) as THREE.Group;

  // Debug: log when OBJ is loaded
  useEffect(() => {
    console.log("[OBJWithMTLInternal] OBJ loaded successfully:", url, scene);
  }, [scene, url]);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!autoRotate || !groupRef.current) return;

    let animationId: number;
    const animate = () => {
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.005;
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [autoRotate]);

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

    const scale = 3.5 / maxDim;

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

  // Toggle texture/white model
  useEffect(() => {
    if (!scene) return;

    scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial) {
                if (!showTexture) {
                  // White model mode
                  mat.color.set(0xffffff);
                  mat.map = null;
                } else {
                  // Restore original material if available
                  // Note: We can't fully restore, but we can re-enable texture
                  if (materials) {
                    // Materials are already applied, just ensure texture is visible
                    mat.needsUpdate = true;
                  }
                }
              }
            });
          } else if (child.material instanceof THREE.MeshStandardMaterial) {
            if (!showTexture) {
              child.material.color.set(0xffffff);
              child.material.map = null;
            } else {
              child.material.needsUpdate = true;
            }
          }
        }
      }
    });
  }, [showTexture, scene, materials]);

  return <primitive ref={groupRef} object={scene} />;
}

// Helper component to load OBJ without MTL (fallback)
function OBJWithoutMTL({
  url,
  autoRotate,
  showTexture,
  onBoundsComputed,
}: {
  url: string;
  autoRotate: boolean;
  showTexture: boolean;
  onBoundsComputed?: ModelBoundsCallback;
}) {
  // Add cache-busting to URL to force reload (no caching)
  const objUrl = useCacheBustUrl(url);

  // Load OBJ file without materials
  const scene = useLoader(OBJLoader, objUrl) as THREE.Group;

  // Debug: log when OBJ is loaded
  useEffect(() => {
    console.log("[OBJWithoutMTL] OBJ loaded successfully:", url, scene);
  }, [scene, url]);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!autoRotate || !groupRef.current) return;

    let animationId: number;
    const animate = () => {
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.005;
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [autoRotate]);

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

    const scale = 3.5 / maxDim;

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

  // Toggle texture/white model
  useEffect(() => {
    if (!scene) return;

    scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial) {
                if (!showTexture) {
                  mat.color.set(0xffffff);
                  mat.map = null;
                } else {
                  mat.needsUpdate = true;
                }
              }
            });
          } else if (child.material instanceof THREE.MeshStandardMaterial) {
            if (!showTexture) {
              child.material.color.set(0xffffff);
              child.material.map = null;
            } else {
              child.material.needsUpdate = true;
            }
          }
        }
      }
    });
  }, [showTexture, scene]);

  return <primitive ref={groupRef} object={scene} />;
}

// Helper component for GLTF/GLB models
function GLTFModel({
  url,
  autoRotate,
  showTexture,
  onBoundsComputed,
}: {
  url: string;
  autoRotate: boolean;
  showTexture: boolean;
  onBoundsComputed?: ModelBoundsCallback;
}) {
  // Add cache-busting to URL to force reload (no caching)
  const gltfUrl = useCacheBustUrl(url);

  // Debug: log URL before loading
  useEffect(() => {
    console.log("[GLTFModel] Attempting to load:", gltfUrl, "from original:", url);
    console.log("[GLTFModel] URL type check - isGLB:", url.toLowerCase().endsWith(".glb"), "isGLTF:", url.toLowerCase().endsWith(".gltf"));
  }, [gltfUrl, url]);

  // Use useGLTF for GLTF/GLB files (must be called at top level)
  // If loading fails, useGLTF will throw an error which will be caught by ErrorBoundary
  const gltf = useGLTF(gltfUrl);
  const scene = gltf.scene;

  // Debug: log when scene is loaded
  useEffect(() => {
    if (scene) {
      console.log("[GLTFModel] Scene loaded successfully:", url, scene);
      console.log("[GLTFModel] Scene children count:", scene.children.length);
      console.log("[GLTFModel] Scene type:", scene.type);
      console.log("[GLTFModel] Scene visible:", scene.visible);

      // Log bounding box info
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      console.log("[GLTFModel] Model size:", size);
      console.log("[GLTFModel] Model center:", center);
      console.log("[GLTFModel] Model is empty:", size.x === 0 && size.y === 0 && size.z === 0);

      let meshCount = 0;
      scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          meshCount++;
          console.log("[GLTFModel] Found mesh:", child.name || "unnamed",
            "vertices:", child.geometry.attributes.position?.count || 0,
            "visible:", child.visible,
            "material:", child.material?.constructor.name);
        }
      });
      console.log("[GLTFModel] Total mesh count:", meshCount);
    } else {
      console.warn("[GLTFModel] Scene is null/undefined for:", url);
    }
  }, [scene, url]);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!autoRotate || !scene) return;

    let animationId: number;
    const animate = () => {
      if (scene) {
        scene.rotation.y += 0.005;
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [autoRotate, scene]);

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

        console.log("[GLTFModel] Centering/Scaling - size:", size, "maxDim:", maxDim, "center:", center);

        // Skip if model has no size
        if (maxDim === 0) {
          console.warn("[GLTFModel] Model has no size, skipping scale/center");
          return;
        }

        const scale = 3.5 / maxDim;
        console.log("[GLTFModel] Applying scale:", scale);

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

        console.log("[GLTFModel] Model centered and scaled. Final position:", scene.position, "Final scale:", scene.scale);
      } catch (error) {
        console.error("[GLTFModel] Error in center/scale:", error);
      }
    }, 100); // Small delay to ensure scene is ready

    return () => clearTimeout(timer);
  }, [scene, showTexture, onBoundsComputed]);

  // Toggle texture/white model
  useEffect(() => {
    if (!scene) return;

    scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial) {
                if (!showTexture) {
                  // White model mode
                  mat.color.set(0xffffff);
                  mat.map = null;
                  mat.emissive.set(0x333333);
                  mat.emissiveIntensity = 0.2;
                } else {
                  // Restore original material
                  mat.emissive.set(0x000000);
                  mat.emissiveIntensity = 0;
                }
              }
            });
          } else if (child.material instanceof THREE.MeshStandardMaterial) {
            if (!showTexture) {
              // White model mode
              child.material.color.set(0xffffff);
              child.material.map = null;
              child.material.emissive.set(0x333333);
              child.material.emissiveIntensity = 0.2;
            } else {
              // Restore original material
              child.material.emissive.set(0x000000);
              child.material.emissiveIntensity = 0;
            }
          }
        }
      }
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

// 3D Model component with texture toggle support
function Model({
  url,
  autoRotate,
  showTexture,
  onBoundsComputed,
}: {
  url: string;
  autoRotate: boolean;
  showTexture: boolean;
  onBoundsComputed?: ModelBoundsCallback;
}) {
  // Determine file type from URL
  const isOBJ = url.toLowerCase().endsWith(".obj");
  const isGLTF = url.toLowerCase().endsWith(".gltf") || url.toLowerCase().endsWith(".glb");

  // Route to appropriate component based on file type
  if (isOBJ) {
    // For OBJ files, try to load with MTL first, fallback to without MTL
    const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
    return (
      <ModelErrorBoundary
        fallback={
          <Suspense fallback={null}>
            <OBJWithoutMTL
              url={url}
              autoRotate={autoRotate}
              showTexture={showTexture}
              onBoundsComputed={onBoundsComputed}
            />
          </Suspense>
        }
      >
        <Suspense fallback={null}>
          <OBJWithMTLInternal
            url={url}
            baseUrl={baseUrl}
            autoRotate={autoRotate}
            showTexture={showTexture}
            onBoundsComputed={onBoundsComputed}
          />
        </Suspense>
      </ModelErrorBoundary>
    );
  } else {
    // For GLTF/GLB files or default
    return (
      <ModelErrorBoundary
        fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ff6b6b" />
          </mesh>
        }
      >
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#4ecdc4" />
            </mesh>
          }
        >
          <GLTFModel
            url={url}
            autoRotate={autoRotate}
            showTexture={showTexture}
            onBoundsComputed={onBoundsComputed}
          />
        </Suspense>
      </ModelErrorBoundary>
    );
  }
}

export default function Model3DViewer({
  modelUrl,
  className,
  autoRotate = true,
  showInfo = false,
  modelInfo,
  showControls = true,
  onTextureToggle,
  defaultModelUrl = "/models/ai3d-demo.glb",
  generationParams,
  generationStatus = "idle",
}: Model3DViewerProps) {
  const [isAutoRotating, setIsAutoRotating] = useState(autoRotate);
  const [showTexture, setShowTexture] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isWebGLLost, setIsWebGLLost] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Ensure component only renders on client side to avoid SSR issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleModelBoundsComputed = useCallback(
    (center: THREE.Vector3, radius: number) => {
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

  // Don't show default model when processing
  const isDefaultModel = !modelUrl && generationStatus !== "processing";

  // Debug: log modelUrl changes
  useEffect(() => {
    console.log("[Model3DViewer] modelUrl changed:", modelUrl, "isDefaultModel:", isDefaultModel, "generationStatus:", generationStatus);
  }, [modelUrl, isDefaultModel, generationStatus]);

  useEffect(() => {
    setIsAutoRotating(autoRotate);
  }, [autoRotate]);

  const handleZoomIn = () => {
    setZoom((prev) => {
      const newZoom = Math.min(prev + 0.2, 3);
      // Zoom by adjusting camera position
      if (cameraRef.current) {
        const currentDistance = cameraRef.current.position.length();
        const newDistance = currentDistance / 1.2;
        cameraRef.current.position.normalize().multiplyScalar(newDistance);
      }
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.2, 0.5);
      // Zoom by adjusting camera position
      if (cameraRef.current) {
        const currentDistance = cameraRef.current.position.length();
        const newDistance = currentDistance * 1.2;
        cameraRef.current.position.normalize().multiplyScalar(newDistance);
      }
      return newZoom;
    });
  };

  const handleReset = () => {
    setZoom(1);
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

  const handleTextureToggle = () => {
    const newValue = !showTexture;
    setShowTexture(newValue);
    onTextureToggle?.(newValue);
  };

  return (
    <div
      className={cn(
        "relative w-full h-full bg-gradient-to-br from-[#1a1f2e] via-[#0f1419] to-[#1a1f2e] overflow-hidden",
        className
      )}
    >
      {/* Model Info Overlay - Top Left */}
      {showInfo && modelInfo && (
        <div className="absolute top-4 left-4 z-10 bg-[#1a1f2e]/90 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300 space-y-1.5 min-w-[200px]">
          <div className="text-white text-sm font-medium mb-2">3D模型预览</div>
          {modelInfo.topology && (
            <div>
              <span className="text-gray-500">拓扑: </span>
              <span className="text-white">{modelInfo.topology}</span>
            </div>
          )}
          {modelInfo.faces !== undefined && (
            <div>
              <span className="text-gray-500">面数: </span>
              <span className="text-white">{modelInfo.faces.toLocaleString()}</span>
            </div>
          )}
          {modelInfo.vertices !== undefined && (
            <div>
              <span className="text-gray-500">顶点数: </span>
              <span className="text-white">{modelInfo.vertices.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Generation Status Overlay - Center */}
      {generationStatus === "processing" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0f1419]/80 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] rounded-lg p-6 border border-[#2d3548] text-center min-w-[300px]">
            <div className="flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
            <div className="text-white text-lg font-medium mb-2">正在生成3D模型...</div>
            <div className="text-gray-400 text-sm">这可能需要几分钟时间，请耐心等待</div>
          </div>
        </div>
      )}

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

      {/* Generation Parameters - Top Right */}
      {showInfo && generationParams && (
        <div className="absolute top-4 right-4 z-10 bg-[#1a1f2e]/90 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300 space-y-1.5 min-w-[180px]">
          <div className="text-gray-500 mb-2 text-sm">生成参数</div>
          {generationParams.mode && (
            <div>
              <span className="text-gray-500">模式: </span>
              <span className="text-white">
                {generationParams.mode === "text-to-3d"
                  ? "文生3D"
                  : generationParams.mode === "image-to-3d"
                    ? "图生3D"
                    : "多图生3D"}
              </span>
            </div>
          )}
          {generationParams.provider && (
            <div>
              <span className="text-gray-500">提供商: </span>
              <span className="text-white">
                {generationParams.provider === "tripo" ? "Tripo 3D-V3.0" : "腾讯混元"}
              </span>
            </div>
          )}
          {generationParams.modelType && (
            <div>
              <span className="text-gray-500">类型: </span>
              <span className="text-white">
                {generationParams.modelType === "standard" ? "标准纹理" : "白模"}
              </span>
            </div>
          )}
          {generationParams.smartLowPoly !== undefined && (
            <div>
              <span className="text-gray-500">智能低模: </span>
              <span className="text-white">
                {generationParams.smartLowPoly ? "是" : "否"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3D Viewer Container */}
      <div className="w-full h-full">
        {!isClient ? (
          <div className="w-full h-full flex items-center justify-center bg-[#0f1419]">
            <div className="text-gray-400 text-sm">加载中...</div>
          </div>
        ) : (
          <Canvas
            key={retryKey}
            camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 1000 }}
            dpr={[1, 1.5]}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: "high-performance",
              failIfMajorPerformanceCaveat: false,
            }}
            style={{ background: 'linear-gradient(to bottom, #1a1f2e 0%, #0f1419 50%, #1a1f2e 100%)' }}
            onCreated={({ camera, gl }) => {
              cameraRef.current = camera as THREE.PerspectiveCamera;
              // Listen for WebGL context loss/restoration
              const canvas = gl.domElement;
              const handleLost = (e: Event) => {
                e.preventDefault();
                console.warn("WebGL context lost");
                setIsWebGLLost(true);
              };
              const handleRestored = () => {
                console.info("WebGL context restored");
                setIsWebGLLost(false);
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
            <LoadingProgress />
            <Suspense
              fallback={null}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[10, 10, 5]} intensity={1.5} />
              <directionalLight position={[-10, 5, -5]} intensity={0.8} />
              <pointLight position={[0, 10, 0]} intensity={0.5} />
              <pointLight position={[-10, -10, -10]} intensity={0.4} />

              {isDefaultModel ? (
                <DefaultModel
                  autoRotate={isAutoRotating}
                  defaultModelUrl={defaultModelUrl}
                  onBoundsComputed={handleModelBoundsComputed}
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
                    if (error.message?.includes("timeout") || error.message?.includes("Failed to fetch")) {
                      setModelLoadError("模型文件过大或网络连接超时，请稍后重试");
                    } else if (error.message?.includes("CORS")) {
                      setModelLoadError("跨域访问被阻止，请联系管理员");
                    } else {
                      setModelLoadError("模型加载失败，请检查文件格式或重试");
                    }
                  }}
                >
                  <Model
                    url={modelUrl}
                    autoRotate={isAutoRotating}
                    showTexture={showTexture}
                    onBoundsComputed={handleModelBoundsComputed}
                  />
                </ModelErrorBoundary>
              ) : null}

              <OrbitControls
                ref={controlsRef}
                enableZoom={true}
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
        )}
        {/* WebGL lost overlay */}
        {isWebGLLost && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
            <div className="bg-[#1a1f2e] rounded-lg p-4 border border-[#2d3548] text-center">
              <div className="text-white text-sm font-medium mb-1">WebGL 上下文已丢失</div>
              <div className="text-gray-400 text-xs">请刷新页面或在浏览器设置中开启硬件加速</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls - Bottom */}
      {showControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#1a1f2e]/90 backdrop-blur-sm rounded-lg p-2">
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
          <div className="flex items-center gap-1 px-2 border-l border-r border-[#2d3548]">
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

          {/* Right: Texture Toggle */}
          {!isDefaultModel && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  !showTexture
                    ? "text-white bg-purple-500/20 hover:bg-purple-500/30"
                    : "text-gray-400 hover:text-white"
                )}
                onClick={() => {
                  setShowTexture(false);
                  handleTextureToggle();
                }}
                title="白模"
              >
                <Box className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  showTexture
                    ? "text-white bg-purple-500/20 hover:bg-purple-500/30"
                    : "text-gray-400 hover:text-white"
                )}
                onClick={() => {
                  setShowTexture(true);
                  handleTextureToggle();
                }}
                title="纹理"
              >
                <Palette className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
