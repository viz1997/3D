import { serverUploadFile } from "@/lib/cloudflare/r2";
import { generateR2Key } from "@/lib/cloudflare/r2-utils";
import { extractGeometryStats } from "@/lib/geometry/stats";

const TRIPO_API_BASE = "https://api.tripo3d.ai";

interface SubmitTripoTaskParams {
  apiKey: string;
  payload: Record<string, any>;
}

interface TripoTaskResponse {
  taskId: string;
}

interface TripoStatusResult {
  status: string;
  modelUrl?: string;
  modelFormat?: string;
  previewUrl?: string;
  error?: string;
  raw?: Record<string, any>;
}

interface UploadTripoImageParams {
  apiKey: string;
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface TripoUploadedImage {
  token: string;
  fileType: string;
}

async function tripoFetch(path: string, apiKey: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${TRIPO_API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tripo API error ${response.status}: ${text}`);
  }

  return response;
}

export async function uploadTripoImage({ apiKey, fileBuffer, filename, mimeType }: UploadTripoImageParams): Promise<TripoUploadedImage> {
  const formData = new FormData();
  const uint8Array = Uint8Array.from(fileBuffer);
  const blob = new Blob([uint8Array], { type: mimeType || "application/octet-stream" });
  formData.append("file", blob, filename);

  const response = await tripoFetch("/v2/openapi/upload/sts", apiKey, {
    method: "POST",
    body: formData,
  });

  const json = await response.json();
  const token = json.data?.image_token || json.data?.file_token;
  if (json.code !== 0 || !token) {
    throw new Error(`Failed to upload image to Tripo: ${JSON.stringify(json)}`);
  }

  const fileType = mimeType?.split("/").pop()?.toLowerCase() || "png";

  return {
    token: token as string,
    fileType,
  };
}

export async function submitTripoTask({ apiKey, payload }: SubmitTripoTaskParams): Promise<TripoTaskResponse> {
  const response = await tripoFetch("/v2/openapi/task", apiKey, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await response.json();

  if (json.code !== 0 || !json.data?.task_id) {
    throw new Error(`Failed to create Tripo task: ${JSON.stringify(json)}`);
  }

  return { taskId: json.data.task_id };
}

export async function queryTripoTaskStatus(apiKey: string, taskId: string): Promise<TripoStatusResult> {
  const response = await tripoFetch(`/v2/openapi/task/${taskId}`, apiKey, {
    method: "GET",
  });
  const json = await response.json();

  if (json.code !== 0) {
    throw new Error(`Failed to query Tripo task: ${JSON.stringify(json)}`);
  }

  const data = json.data || {};
  const status = data.status || data.task_status || "unknown";
  const modelUrl = extractModelUrl(data);
  const previewUrl = extractPreviewUrl(data);

  return {
    status,
    modelUrl,
    modelFormat: data.model_format,
    previewUrl,
    error: data.error_msg || data.error || data.message,
    raw: data,
  };
}

function extractModelUrl(data: Record<string, any>): string | undefined {
  const candidatePaths = [
    "model_url",
    "modelUrl",
    "model_file_url",
    "model_file.url",
    "model.url",
    "result.model_url",
    "result.modelUrl",
    "result.model_file_url",
    "result.model_file.url",
    "result.file_url",
    "result.file.url",
    "task_result.model_url",
    "task_result.modelUrl",
    "task_result.data.model_url",
    "task_result.data.result_url",
    "output.model_url",
    "output.file_url",
    "output.url",
    "data.model_url",
    "data.modelUrl",
    "data.data.model_url",
    "data.data.result_url",
    "result_url",
    "resultUrl",
    "file_url",
    "file.url",
    "url",
  ];

  for (const path of candidatePaths) {
    const value = getPathValue(data, path);
    if (isLikelyModelUrl(value)) {
      return value;
    }
  }

  // Fallback: scan nested structures for a likely model file URL
  return deepSearchForUrl(data, isLikelyModelUrl);
}

function extractPreviewUrl(data: Record<string, any>): string | undefined {
  const previewPaths = [
    "preview_url",
    "previewUrl",
    "result.preview_url",
    "result.previewUrl",
    "output.preview_url",
    "output.previewUrl",
    "data.preview_url",
    "data.previewUrl",
  ];

  for (const path of previewPaths) {
    const value = getPathValue(data, path);
    if (typeof value === "string" && value.startsWith("http")) {
      return value;
    }
  }

  return deepSearchForUrl(data, (url, key) => isHttpUrl(url) && (key ?? "").toLowerCase().includes("preview"));
}

function getPathValue(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((acc: any, key) => {
    if (acc && typeof acc === "object") {
      return acc[key];
    }
    return undefined;
  }, obj);
}

function isHttpUrl(value: any): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function isLikelyModelUrl(value: any, keyHint?: string): value is string {
  if (!isHttpUrl(value)) return false;
  const lower = value.toLowerCase();
  if (/\.(glb|gltf|obj|fbx|stl|ply|usdz|zip)(\?|$)/.test(lower)) {
    return true;
  }
  if (keyHint && keyHint.toLowerCase().includes("model")) {
    return true;
  }
  return false;
}

function deepSearchForUrl(
  obj: Record<string, any>,
  predicate: (url: string, keyHint?: string) => boolean
): string | undefined {
  const stack: Array<[any, string | undefined]> = [[obj, undefined]];

  while (stack.length) {
    const [current, keyHint] = stack.pop()!;
    if (!current) continue;

    if (typeof current === "string") {
      if (predicate(current, keyHint)) {
        return current;
      }
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push([item, keyHint]);
      }
      continue;
    }

    if (typeof current === "object") {
      for (const [childKey, childValue] of Object.entries(current)) {
        if (typeof childValue === "string") {
          if (predicate(childValue, childKey)) {
            return childValue;
          }
        } else {
          stack.push([childValue, childKey]);
        }
      }
    }
  }

  return undefined;
}

export async function processTripoModel(modelUrl: string, contentTypeHint?: string) {
  if (!modelUrl) {
    throw new Error("Tripo model URL is empty");
  }

  const downloadResponse = await fetch(modelUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download Tripo model: ${downloadResponse.status}`);
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const inferredContentType = contentTypeHint || downloadResponse.headers.get("content-type") || "application/octet-stream";
  const extension = guessFileExtension(modelUrl, inferredContentType);

  const key = generateR2Key({
    path: "ai-3d/models",
    prefix: "tripo",
    fileName: `model.${extension}`,
  });

  const geometryStats = extractGeometryStats(buffer, extension);

  const uploadResult = await serverUploadFile({
    data: buffer,
    contentType: mapContentType(extension, inferredContentType),
    key,
  });

  return {
    modelUrl: uploadResult.url,
    modelInfo: {
      topology: "TRIPO",
      faces: geometryStats?.faces ?? 0,
      vertices: geometryStats?.vertices ?? 0,
    },
  };
}

function guessFileExtension(url: string, contentType: string) {
  const lower = url.toLowerCase();
  if (lower.includes(".glb") || contentType.includes("gltf-binary")) return "glb";
  if (lower.includes(".gltf") || contentType.includes("gltf")) return "gltf";
  if (lower.includes(".obj") || contentType.includes("obj")) return "obj";
  if (lower.includes(".fbx")) return "fbx";
  if (lower.includes(".stl")) return "stl";
  if (lower.includes(".usdz")) return "usdz";
  return "glb";
}

function mapContentType(extension: string, fallback: string) {
  switch (extension) {
    case "glb":
      return "model/gltf-binary";
    case "gltf":
      return "model/gltf+json";
    case "obj":
      return "model/obj";
    case "fbx":
      return "application/octet-stream";
    case "stl":
      return "model/stl";
    case "usdz":
      return "model/vnd.usdz+zip";
    default:
      return fallback || "application/octet-stream";
  }
}
