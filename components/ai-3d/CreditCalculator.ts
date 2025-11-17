/**
 * Calculate credits required based on generation parameters
 */

export type ModelProvider = "tripo" | "tencentPro" | "tencentRapid";
export type ModelType = "white" | "standard";
export type GenerationMode = "text-to-3d" | "image-to-3d" | "multi-image-to-3d";

export interface GenerationParams {
  provider: ModelProvider;
  mode: GenerationMode;
  modelType: ModelType;
  smartLowPoly?: boolean;
}

/**
 * Credit cost table based on the requirements
 * 
 * Tripo 3D-V3.0 | Tencent Hunyuan (Pro)
 * 
 * Text to 3D:
 * - White: 10 | 15
 * - Standard: 20 | 20
 * 
 * Image to 3D:
 * - White: 20 | 15
 * - Standard: 30 | 20
 * 
 * Multi-image to 3D:
 * - White: 20 | 25
 * - Standard: 30 | 30
 * 
 * Additional options:
 * - Low Poly with Texture: 10 | 25
 * - High-res PBR: 10 | 10
 */
const TENCENT_BASE_COSTS: Record<GenerationMode, Record<ModelType, number>> = {
  "text-to-3d": {
    white: 15,
    standard: 20,
  },
  "image-to-3d": {
    white: 15,
    standard: 20,
  },
  "multi-image-to-3d": {
    white: 25,
    standard: 30,
  },
};

const CREDIT_COSTS: Record<
  ModelProvider,
  Record<GenerationMode, Record<ModelType, number>>
> = {
  tripo: {
    "text-to-3d": {
      white: 10,
      standard: 20,
    },
    "image-to-3d": {
      white: 20,
      standard: 30,
    },
    "multi-image-to-3d": {
      white: 20,
      standard: 30,
    },
  },
  tencentPro: TENCENT_BASE_COSTS,
  tencentRapid: TENCENT_BASE_COSTS,
};

const LOW_POLY_COSTS: Record<ModelProvider, number> = {
  tripo: 10,
  tencentPro: 25,
  tencentRapid: 25,
};

const PBR_COSTS: Record<ModelProvider, number> = {
  tripo: 10,
  tencentPro: 10,
  tencentRapid: 10,
};

export function calculateCredits(params: GenerationParams): number {
  const baseCost =
    CREDIT_COSTS[params.provider][params.mode][params.modelType];

  let additionalCost = 0;

  if (params.smartLowPoly) {
    additionalCost += LOW_POLY_COSTS[params.provider];
  }

  // Note: PBR cost would be added if that option is selected separately
  // For now, we assume it's part of the model type selection

  return baseCost + additionalCost;
}

export function getCreditDescription(
  params: GenerationParams
): string {
  const credits = calculateCredits(params);
  const modeText = {
    "text-to-3d": "Text to 3D",
    "image-to-3d": "Image to 3D",
    "multi-image-to-3d": "Multi-image to 3D",
  }[params.mode];
  const typeText =
    params.modelType === "white" ? "White Model" : "Standard Texture";
  const providerText =
    params.provider === "tripo"
      ? "Tripo"
      : params.provider === "tencentPro"
        ? "Tencent Pro"
        : "Tencent Rapid";

  return `${modeText} - ${typeText} (${providerText}): ${credits} credits`;
}

