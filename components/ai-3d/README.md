# AI 3D Interaction Component

This component provides AI-powered 3D model generation from text or images.

## Features

- **Text to 3D**: Generate 3D models from text descriptions
- **Image to 3D**: Generate 3D models from single or multiple images
- **Model Selection**: Choose between standard texture or white model
- **Provider Selection**: Support for Tripo3D and Tencent Hunyuan
- **Credit System**: Integrated with the project's credit deduction system
- **Pro Features**: Smart Low Poly and Private Visibility for Pro users

## 3D Viewer Integration

The current `Model3DViewer` component is a placeholder. To implement a full 3D viewer with auto-rotation (like 3davatarforge.com), you need to:

### Option 1: Use @react-three/fiber (Recommended)

1. Install dependencies:
```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

2. Update `Model3DViewer.tsx` to use React Three Fiber:
```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';

function Model({ url, autoRotate }: { url: string; autoRotate: boolean }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!autoRotate || !groupRef.current) return;
    
    const interval = setInterval(() => {
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.01;
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [autoRotate]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

export default function Model3DViewer({ modelUrl, autoRotate = true, ...props }) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 5] }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          {modelUrl && <Model url={modelUrl} autoRotate={autoRotate} />}
          <OrbitControls enableZoom={true} enablePan={true} />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

### Option 2: Use vanilla Three.js

If you prefer vanilla Three.js, you can create a similar implementation using the Three.js core library.

## Default Model for Initial Display

To show a default rotating model when no model is generated:

1. Add a default GLB file to `public/models/default-model.glb`
2. Update `Model3DViewer` to load this default model when `modelUrl` is not provided

## API Integration

### Tripo3D API

The API route `/api/ai-3d/generate` needs to be implemented with actual Tripo3D API calls. Reference: https://platform.tripo3d.ai/docs/introduction

### Tencent Hunyuan API

Similarly, implement Tencent Hunyuan API integration. Reference: https://cloud.tencent.com/document/product/1804/120838

## Credit Calculation

The credit calculation follows this table:

| Mode | Type | Tripo | Tencent |
|------|------|-------|---------|
| Text to 3D | White | 10 | 15 |
| Text to 3D | Standard | 20 | 20 |
| Image to 3D | White | 20 | 15 |
| Image to 3D | Standard | 30 | 20 |
| Multi-image to 3D | White | 20 | 25 |
| Multi-image to 3D | Standard | 30 | 30 |
| Smart Low Poly | - | +10 | +25 |
| High-res PBR | - | +10 | +10 |

## File Requirements

For the 3D showcase component (similar to fast3d.io), you'll need:
- GLB files for the 3D models
- Preview images (thumbnails) for each model (optional but recommended)
- Model metadata (title, description, tags, etc.)

The showcase component can be implemented as a separate component that displays a grid of 3D model cards with hover effects and click-to-view functionality.

