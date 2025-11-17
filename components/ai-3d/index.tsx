"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUserBenefits } from "@/hooks/useUserBenefits";
import { cn } from "@/lib/utils";
import { Crown, HelpCircle, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { calculateCredits, type GenerationParams } from "./CreditCalculator";
import Model3DViewer from "./Model3DViewer";
import { UploadArea } from "./UploadArea";

export default function AI3DInteraction() {
  const t = useTranslations("AI3D");
  const { benefits, isLoading: isLoadingBenefits, isError: benefitsError } = useUserBenefits();
  const isPro =
    benefits?.subscriptionStatus === "active" ||
    benefits?.subscriptionStatus === "trialing";

  const [mainTab, setMainTab] = useState<"text-to-3d" | "image-to-3d">(
    "text-to-3d"
  );
  const [imageTab, setImageTab] = useState<"single" | "multiple">("single");
  const [selectedModel, setSelectedModel] = useState("3D-V3.0");
  const [provider, setProvider] = useState<"tripo" | "tencentPro" | "tencentRapid">("tripo");
  const [modelType, setModelType] = useState<"standard" | "white">("standard");
  const [smartLowPoly, setSmartLowPoly] = useState(false);
  const [publicVisibility, setPublicVisibility] = useState(true);
  const [outputFormat, setOutputFormat] = useState("GLB");
  const [textPrompt, setTextPrompt] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedPreviews, setUploadedPreviews] = useState<(string | null)[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [currentJobId, setCurrentJobId] = useState<string>();
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string>();
  const [generatedModelInfo, setGeneratedModelInfo] = useState<{
    faces?: number;
    vertices?: number;
    topology?: string;
  }>();
  const [currentGenerationParams, setCurrentGenerationParams] = useState<{
    mode?: string;
    provider?: string;
    modelType?: string;
    smartLowPoly?: boolean;
  }>();
  const [hasRestoredModel, setHasRestoredModel] = useState(false);

  useEffect(() => {
    setUploadedFiles([]);
    setUploadedPreviews([]);
  }, [imageTab]);

  const shouldShowViewerInfo = Boolean(
    generatedModelUrl ||
    generationStatus === "processing" ||
    (currentGenerationParams && Object.keys(currentGenerationParams).length > 0)
  );

  const isTencentProProvider = provider === "tencentPro";
  const isTencentRapidProvider = provider === "tencentRapid";
  const isOutputFormatLocked = isTencentProProvider;
  const formatOptions = isTencentProProvider ? ["OBJ"] : ["GLB", "OBJ", "STL", "FBX"];

  useEffect(() => {
    if (isTencentProProvider) {
      setOutputFormat("OBJ");
    }
  }, [isTencentProProvider]);

  // LocalStorage key + TTL for saving task state
  const TASK_STORAGE_KEY = "ai3d_current_task";
  const TASK_STATE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
  const LAST_SUCCESS_STORAGE_KEY = "ai3d_last_success";

  const isStateExpired = (timestamp?: number) => {
    if (!timestamp) return true;
    return Date.now() - timestamp > TASK_STATE_TTL_MS;
  };

  // Save task state to localStorage
  const saveTaskState = (
    jobId?: string,
    status?: "idle" | "processing" | "completed" | "failed",
    modelUrl?: string,
    modelInfo?: { faces?: number; vertices?: number; topology?: string },
    generationParamsOverride?: typeof currentGenerationParams
  ) => {
    try {
      const taskState = {
        jobId: jobId || currentJobId,
        status: status || generationStatus,
        modelUrl: modelUrl || generatedModelUrl,
        modelInfo: modelInfo || generatedModelInfo,
        generationParams: generationParamsOverride || currentGenerationParams,
        timestamp: Date.now(),
      };
      console.log("[AI3D] Saving task state:", taskState);
      localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskState));
    } catch (error) {
      console.error("[AI3D] Failed to save task to localStorage:", error);
    }
  };

  const saveLastSuccessState = (
    payload: {
      modelUrl: string;
      modelInfo?: { faces?: number; vertices?: number; topology?: string };
      generationParams?: typeof currentGenerationParams;
    }
  ) => {
    try {
      const data = { ...payload, timestamp: Date.now() };
      localStorage.setItem(LAST_SUCCESS_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("[AI3D] Failed to save last success state:", error);
    }
  };

  // Clear task state from localStorage
  const clearTaskState = () => {
    try {
      localStorage.removeItem(TASK_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear task from localStorage:", error);
    }
  };

  const pollJobStatus = async (
    jobId: string,
    generationParamsSnapshot?: typeof currentGenerationParams
  ) => {
    const maxAttempts = 120; // 10 minutes (5 seconds * 120)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch("/api/ai-3d/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });

        if (!response.ok) {
          throw new Error("Failed to query job status");
        }

        const data = await response.json();

        if (data.status === "SUCCESS" && data.modelUrl) {
          // Job completed successfully
          setGeneratedModelUrl(data.modelUrl);
          setGeneratedModelInfo(data.modelInfo);
          setGenerationStatus("completed");
          setIsGenerating(false);

          // Save completed task state to localStorage (use explicit values)
          const taskState = {
            jobId: jobId,
            status: "completed" as const,
            modelUrl: data.modelUrl,
            modelInfo: data.modelInfo,
            generationParams: generationParamsSnapshot || currentGenerationParams,
            timestamp: Date.now(),
          };
          console.log("[AI3D] Saving completed task state:", taskState);
          localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskState));

          saveLastSuccessState({
            modelUrl: data.modelUrl,
            modelInfo: data.modelInfo,
            generationParams: generationParamsSnapshot || currentGenerationParams,
          });

          toast.success(t("generationSuccess"));
        } else if (data.status === "FAILED") {
          // Job failed
          setGenerationStatus("failed");
          setIsGenerating(false);

          // Save failed task state to localStorage
          saveTaskState(jobId, "failed", undefined, undefined, generationParamsSnapshot);

          toast.error(data.error || t("generationError"));
        } else {
          // Job still processing
          attempts++;

          // Update task state in localStorage (still processing)
          saveTaskState(jobId, "processing", undefined, undefined, generationParamsSnapshot);

          if (attempts >= maxAttempts) {
            setGenerationStatus("failed");
            setIsGenerating(false);

            // Save failed task state to localStorage
            saveTaskState(jobId, "failed", undefined, undefined, generationParamsSnapshot);

            toast.error("Generation timeout. Please try again.");
          } else {
            // Continue polling after 5 seconds
            setTimeout(poll, 5000);
          }
        }
      } catch (error) {
        attempts++;

        // Update task state in localStorage (still processing, but with error)
        saveTaskState(jobId, "processing", undefined, undefined, generationParamsSnapshot);

        if (attempts >= maxAttempts) {
          setGenerationStatus("failed");
          setIsGenerating(false);

          // Save failed task state to localStorage
          saveTaskState(jobId, "failed", undefined, undefined, generationParamsSnapshot);

          toast.error("Failed to check generation status");
        } else {
          // Retry after 5 seconds
          setTimeout(poll, 5000);
        }
      }
    };

    // Start polling
    poll();
  };

  // Attempt to restore previous task state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TASK_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as {
        jobId?: string;
        status?: "idle" | "processing" | "completed" | "failed";
        modelUrl?: string;
        modelInfo?: { faces?: number; vertices?: number; topology?: string };
        generationParams?: typeof currentGenerationParams;
        timestamp?: number;
      };

      if (!parsed.timestamp || Date.now() - parsed.timestamp > TASK_STATE_TTL_MS) {
        localStorage.removeItem(TASK_STORAGE_KEY);
        return;
      }

      console.log("[AI3D] Restoring task state from localStorage", parsed);

      if (parsed.jobId) {
        setCurrentJobId(parsed.jobId);
      }
      if (parsed.generationParams) {
        setCurrentGenerationParams(parsed.generationParams);
      }
      if (parsed.modelUrl) {
        setGeneratedModelUrl(parsed.modelUrl);
        setGeneratedModelInfo(parsed.modelInfo);
        setHasRestoredModel(true);
      }

      const restoredStatus = parsed.status ?? "idle";
      const shouldResumePolling = Boolean(parsed.jobId && restoredStatus !== "completed");

      setGenerationStatus(shouldResumePolling ? "processing" : restoredStatus);
      setIsGenerating(shouldResumePolling ? true : restoredStatus === "processing");

      if (shouldResumePolling && parsed.jobId) {
        pollJobStatus(parsed.jobId, parsed.generationParams);
      }
    } catch (error) {
      console.error("[AI3D] Failed to restore task from localStorage:", error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_SUCCESS_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as {
        modelUrl: string;
        modelInfo?: { faces?: number; vertices?: number; topology?: string };
        generationParams?: typeof currentGenerationParams;
        timestamp?: number;
      };

      if (isStateExpired(parsed.timestamp)) {
        localStorage.removeItem(LAST_SUCCESS_STORAGE_KEY);
        return;
      }

      if (!generatedModelUrl) {
        setGeneratedModelUrl(parsed.modelUrl);
        setGeneratedModelInfo(parsed.modelInfo);
        if (parsed.generationParams) {
          setCurrentGenerationParams(parsed.generationParams);
        }
      }
    } catch (error) {
      console.error("[AI3D] Failed to restore last success state:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createImagePreview = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFileUpload = (file: File, index?: number) => {
    if (index !== undefined) {
      setUploadedFiles((prev) => {
        const next = [...prev];
        next[index] = file;
        return next;
      });
    } else {
      setUploadedFiles([file]);
    }

    createImagePreview(file)
      .then((preview) => {
        if (index !== undefined) {
          setUploadedPreviews((prev) => {
            const next = [...prev];
            next[index] = preview;
            return next;
          });
        } else {
          setUploadedPreviews([preview]);
        }
      })
      .catch((error) => {
        console.error("[AI3D] Failed to create image preview:", error);
      });
  };

  const handleSmartLowPolyChange = (checked: boolean) => {
    if (checked && !isPro) {
      toast.error(t("upgradeProRequired"));
      return;
    }
    setSmartLowPoly(checked);
  };

  const handlePublicVisibilityChange = (checked: boolean) => {
    if (!checked && !isPro) {
      toast.error(t("upgradeProRequired"));
      setPublicVisibility(true);
      return;
    }
    setPublicVisibility(checked);
  };

  const getGenerationMode = (): GenerationParams["mode"] => {
    if (mainTab === "text-to-3d") return "text-to-3d";
    if (imageTab === "single") return "image-to-3d";
    return "multi-image-to-3d";
  };

  const generationParams: GenerationParams = {
    provider,
    mode: getGenerationMode(),
    modelType,
    smartLowPoly,
  };

  const requiredCredits = calculateCredits(generationParams);

  const canGenerate = () => {
    if (mainTab === "text-to-3d") {
      return textPrompt.trim().length > 0;
    }
    if (imageTab === "single") {
      return uploadedFiles.length > 0;
    }
    return uploadedFiles[0] !== undefined; // Front view required
  };

  const handleCreate = async () => {
    if (!canGenerate()) {
      toast.error(t("fillRequiredFields"));
      return;
    }

    // Check if benefits are still loading (only if user is logged in)
    if (isLoadingBenefits) {
      toast.error("Loading user benefits, please wait...");
      return;
    }

    // Check if benefits failed to load
    if (benefitsError) {
      toast.error("Failed to load user benefits. Please refresh the page.");
      return;
    }

    // Check if benefits are loaded (only if user is logged in)
    // If user is not logged in, benefits will be undefined, skip credit check
    if (benefits) {
      const availableCredits = benefits.totalAvailableCredits ?? 0;
      if (availableCredits < requiredCredits) {
        toast.error(
          `${t("insufficientCredits")}. ${t("requiredCredits")}: ${requiredCredits}, ${t("availableCredits")}: ${availableCredits}`
        );
        return;
      }
    }

    setIsGenerating(true);
    const pendingParams = {
      mode: getGenerationMode(),
      provider,
      modelType,
      smartLowPoly,
    };
    setGenerationStatus("processing");
    setCurrentGenerationParams(pendingParams);
    setGeneratedModelUrl(undefined);
    setHasRestoredModel(false);
    let submittingToastId: string | number | undefined;
    try {
      // TODO: Call API to generate 3D model
      // Convert files to base64 for API
      const imageData =
        mainTab === "image-to-3d"
          ? await Promise.all(
            uploadedFiles.map((file) => {
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () =>
                  resolve(reader.result as string);
                reader.readAsDataURL(file);
              });
            })
          )
          : undefined;

      submittingToastId = toast.loading(t("generationSubmitting"));

      const response = await fetch("/api/ai-3d/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: getGenerationMode(),
          provider,
          modelType,
          smartLowPoly,
          publicVisibility,
          outputFormat,
          modelVersion: selectedModel,
          textPrompt: mainTab === "text-to-3d" ? textPrompt : undefined,
          images: imageData,
        }),
      });

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = t("generationError");
        try {
          const errorData = await response.json();
          if (errorData.error) {
            // Check if it's an insufficient credits error
            if (
              errorData.error.toLowerCase().includes("insufficient") ||
              errorData.error.toLowerCase().includes("credits")
            ) {
              errorMessage = `${t("insufficientCredits")}. ${t("requiredCredits")}: ${requiredCredits}`;
            } else {
              errorMessage = errorData.error;
            }
          }
        } catch {
          // If parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Check if response contains jobId (async task)
      if (data.jobId) {
        setCurrentJobId(data.jobId);
        if (submittingToastId !== undefined) {
          toast.dismiss(submittingToastId);
          submittingToastId = undefined;
        }
        toast.success(t("generationStarted"));
        // Keep isGenerating true to show "generating" button state
        // setIsGenerating will be set to false in pollJobStatus when done
        // Save task state to localStorage
        saveTaskState(data.jobId, "processing", undefined, undefined, pendingParams);

        // Start polling for job status
        pollJobStatus(data.jobId, pendingParams);
      } else if (data.modelUrl) {
        // Synchronous response - model is ready immediately
        setGeneratedModelUrl(data.modelUrl);
        setGeneratedModelInfo(data.modelInfo);
        setGenerationStatus("completed");

        if (submittingToastId !== undefined) {
          toast.dismiss(submittingToastId);
          submittingToastId = undefined;
        }

        // Save completed task state to localStorage (use explicit values)
        const taskState = {
          jobId: undefined,
          status: "completed" as const,
          modelUrl: data.modelUrl,
          modelInfo: data.modelInfo,
          generationParams: pendingParams,
          timestamp: Date.now(),
        };
        console.log("[AI3D] Saving completed task state (sync):", taskState);
        localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskState));

        saveLastSuccessState({ modelUrl: data.modelUrl, modelInfo: data.modelInfo, generationParams: pendingParams });

        toast.success(t("generationSuccess"));
        setIsGenerating(false);
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (error) {
      if (submittingToastId !== undefined) {
        toast.dismiss(submittingToastId);
        submittingToastId = undefined;
      }
      const errorMessage =
        error instanceof Error ? error.message : t("generationError");
      toast.error(errorMessage);
      setGenerationStatus("failed");
      setIsGenerating(false);

      // Save failed task state to localStorage
      saveTaskState(undefined, "failed", undefined, undefined, pendingParams);
    } finally {
      if (submittingToastId !== undefined) {
        toast.dismiss(submittingToastId);
      }
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-[#0f1419] text-white flex flex-col lg:flex-row min-h-0 overflow-x-hidden overflow-y-auto lg:overflow-y-hidden">
      {/* Left Panel - Interaction Area (1/3) */}
      <div className="basis-full lg:basis-1/3 shrink-0 border-r border-[#1f2937] flex flex-col min-h-[320px] lg:min-h-0 lg:max-h-full">
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Main Tabs */}
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-5 bg-[#1a1f2e] p-1 rounded-lg">
              <TabsTrigger
                value="text-to-3d"
                className="data-[state=active]:bg-[#2d3548] rounded-md text-gray-400 data-[state=active]:text-white"
              >
                {t("textTo3D")}
              </TabsTrigger>
              <TabsTrigger
                value="image-to-3d"
                className="data-[state=active]:bg-[#2d3548] rounded-md text-gray-400 data-[state=active]:text-white"
              >
                {t("imageTo3D")}
              </TabsTrigger>
            </TabsList>

            {/* Text to 3D Tab */}
            <TabsContent value="text-to-3d" className="space-y-4">
              <div>
                <Textarea
                  id="text-prompt"
                  placeholder={t("promptPlaceholder")}
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  className="min-h-[120px] bg-[#1a1f2e] border-[#2d3548] text-white placeholder:text-gray-500 resize-none focus:border-[#4a5568]"
                />
              </div>
            </TabsContent>

            {/* Image to 3D Tab */}
            <TabsContent value="image-to-3d" className="space-y-4">
              {/* Image Sub-tabs */}
              <div className="flex items-center gap-6 mb-4 border-b border-[#2d3548]">
                <button
                  onClick={() => setImageTab("single")}
                  className={cn(
                    "pb-2 border-b-2 transition-colors text-sm",
                    imageTab === "single"
                      ? "border-white text-white"
                      : "border-transparent text-gray-400 hover:text-gray-300"
                  )}
                >
                  {t("singleImage")}
                </button>
                <button
                  onClick={() => setImageTab("multiple")}
                  className={cn(
                    "pb-2 border-b-2 transition-colors flex items-center gap-1.5 text-sm",
                    imageTab === "multiple"
                      ? "border-white text-white"
                      : "border-transparent text-gray-400 hover:text-gray-300"
                  )}
                >
                  {t("multipleImages")}
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Single Image Upload */}
              {imageTab === "single" && (
                <div>
                  <UploadArea
                    label={t("uploadImage")}
                    size="medium"
                    previewUrl={uploadedPreviews[0] ?? null}
                    onUpload={(file) => handleFileUpload(file)}
                  />
                  <p className="text-gray-500 text-xs text-center mt-3">
                    {t("imageFormatHint")}
                  </p>
                </div>
              )}

              {/* Multiple Images Upload */}
              {imageTab === "multiple" && (
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    {imageSlots.map((slot, slotIndex) => (
                      <UploadArea
                        key={slotIndex}
                        label={slot.label}
                        required={slot.required}
                        size="small"
                        previewUrl={uploadedPreviews[slotIndex] ?? null}
                        onUpload={(file) => handleFileUpload(file, slotIndex)}
                      />
                    ))}
                  </div>
                  <div className="flex items-start gap-2 mt-3 text-gray-500 text-xs">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>{t("frontViewRequired")}</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Provider Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm text-gray-300">{t("selectProvider")}</Label>
              <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as "tripo" | "tencentPro" | "tencentRapid")}
            >
              <SelectTrigger className="w-full bg-[#1a1f2e] border-[#2d3548] text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tripo">{t("providerTripo")}</SelectItem>
                <SelectItem value="tencentPro">{t("tencentHunyuanPro")}</SelectItem>
                <SelectItem value="tencentRapid">{t("tencentHunyuanRapid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model Type Selection */}
          <div className="space-y-2.5">
            <Label className="text-sm text-gray-300">{t("modelSelection")}</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setModelType("standard")}
                className={cn(
                  "px-3 py-2 rounded-md border transition-all text-sm",
                  modelType === "standard"
                    ? "border-blue-500 bg-[#1a1f2e] text-white"
                    : "border-[#2d3548] bg-[#1a1f2e]/50 text-gray-400 hover:border-[#3d4558]"
                )}
              >
                {t("standardTexture")}
              </button>
              <button
                onClick={() => setModelType("white")}
                className={cn(
                  "px-3 py-2 rounded-md border transition-all text-sm",
                  modelType === "white"
                    ? "border-blue-500 bg-[#1a1f2e] text-white"
                    : "border-[#2d3548] bg-[#1a1f2e]/50 text-gray-400 hover:border-[#3d4558]"
                )}
              >
                {t("whiteModel")}
              </button>
            </div>
          </div>

          {/* Smart Low Poly Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="smart-low-poly"
                  className="cursor-pointer text-sm text-gray-300"
                >
                  {t("smartLowPoly")}
                </Label>
                <Crown className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <Switch
                id="smart-low-poly"
                checked={smartLowPoly}
                onCheckedChange={handleSmartLowPolyChange}
              />
            </div>

            {/* Public Visibility */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="public-visibility"
                  className="cursor-pointer text-sm text-gray-300"
                >
                  {t("publicVisibility")}
                </Label>
                <Crown className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <Switch
                id="public-visibility"
                checked={publicVisibility}
                onCheckedChange={handlePublicVisibilityChange}
              />
            </div>
          </div>

          {/* Output Format */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-300">{t("outputFormat")}</Label>
              <Select value={outputFormat} onValueChange={(value) => !isOutputFormatLocked && setOutputFormat(value)}>
                <SelectTrigger
                  className={cn(
                    "w-24 bg-[#1a1f2e] border-[#2d3548] text-sm h-8 text-white",
                    isOutputFormatLocked && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={isOutputFormatLocked}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Credit Cost Display */}
          <div className="bg-[#1a1f2e] rounded-lg p-3 border border-[#2d3548]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{t("requiredCredits")}</span>
              <span className="text-lg font-semibold text-white">
                {requiredCredits}
              </span>
            </div>
            {benefits && (
              <div className="text-xs text-gray-500 mt-1">
                {t("availableCredits")}: {benefits.totalAvailableCredits ?? 0}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button
            className="w-full bg-white hover:bg-gray-200 text-black py-5 mt-6"
            size="lg"
            onClick={handleCreate}
            disabled={
              isGenerating ||
              !canGenerate() ||
              isLoadingBenefits
            }
          >
            {isGenerating
              ? t("generating")
              : isLoadingBenefits
                ? "Loading..."
                : t("create")}
          </Button>
        </div>
      </div>

      {/* Right Panel - 3D Preview Area (2/3) */}
      <div className="basis-full lg:basis-2/3 flex-1 min-h-[360px] lg:min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 relative">
          <Model3DViewer
            modelUrl={generatedModelUrl}
            autoRotate={true}
            showInfo={shouldShowViewerInfo}
            showControls={true}
            modelInfo={generatedModelInfo}
            generationParams={currentGenerationParams}
            generationStatus={generationStatus}
            className="h-full w-full"
            defaultModelUrl="/models/ai3d-demo.glb"
            suppressDefaultModel={hasRestoredModel}
          />
        </div>

      </div>
    </div>
  );
}

