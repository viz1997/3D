export interface GeometryStats {
  faces: number;
  vertices: number;
}

export function extractGeometryStats(buffer: Buffer, fileExtension: string): GeometryStats | null {
  try {
    const normalizedExt = fileExtension.toLowerCase();
    if (normalizedExt === "glb" || normalizedExt === "gltf") {
      return extractGlTFStats(buffer);
    }
    if (normalizedExt === "obj") {
      return extractObjStats(buffer);
    }
  } catch (error) {
    console.warn("[GeometryStats] Failed to extract geometry stats:", error);
  }
  return null;
}

function extractGlTFStats(buffer: Buffer): GeometryStats | null {
  let gltfJson: any;
  const magic = buffer.slice(0, 4).toString("utf8");
  try {
    if (magic === "glTF") {
      const jsonChunkLength = buffer.readUInt32LE(12);
      const jsonChunkType = buffer.readUInt32LE(16);
      const JSON_TYPE = 0x4e4f534a; // 'JSON'
      if (jsonChunkType !== JSON_TYPE) {
        throw new Error("Invalid GLB JSON chunk");
      }
      const jsonChunkData = buffer.slice(20, 20 + jsonChunkLength);
      gltfJson = JSON.parse(jsonChunkData.toString("utf8"));
    } else {
      gltfJson = JSON.parse(buffer.toString("utf8"));
    }
  } catch (error) {
    console.warn("[GeometryStats] Failed to parse glTF JSON:", error);
    return null;
  }

  const accessors = gltfJson.accessors || [];
  const meshes = gltfJson.meshes || [];
  let totalVertices = 0;
  let totalFaces = 0;

  for (const mesh of meshes) {
    const primitives = mesh.primitives || [];
    for (const primitive of primitives) {
      const attributes = primitive.attributes || {};
      const positionAccessorIndex = attributes.POSITION;
      const positionAccessor = typeof positionAccessorIndex === "number" ? accessors[positionAccessorIndex] : null;
      if (positionAccessor?.count) {
        totalVertices += positionAccessor.count;
      }

      const indicesAccessorIndex = primitive.indices;
      const indicesAccessor = typeof indicesAccessorIndex === "number" ? accessors[indicesAccessorIndex] : null;
      const primitiveMode = typeof primitive.mode === "number" ? primitive.mode : 4; // TRIANGLES default

      if (indicesAccessor?.count && primitiveMode === 4) {
        totalFaces += Math.floor(indicesAccessor.count / 3);
      } else if (positionAccessor?.count && primitiveMode === 4) {
        totalFaces += Math.floor(positionAccessor.count / 3);
      }
    }
  }

  if (totalVertices === 0 && totalFaces === 0) {
    return null;
  }

  return { faces: totalFaces, vertices: totalVertices };
}

function extractObjStats(buffer: Buffer): GeometryStats | null {
  const content = buffer.toString("utf8");
  let vertices = 0;
  let faces = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("v ")) {
      vertices += 1;
    } else if (trimmed.startsWith("f ")) {
      const parts = trimmed.slice(2).trim().split(/\s+/);
      if (parts.length >= 3) {
        faces += Math.max(parts.length - 2, 1);
      }
    }
  }

  if (vertices === 0 && faces === 0) {
    return null;
  }

  return { faces, vertices };
}
