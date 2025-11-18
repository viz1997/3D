"use client";

import Model3DViewer from "@/components/ai-3d/Model3DViewer";
import FeatureBadge from "@/components/shared/FeatureBadge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { Box as Cube, Download, Settings, Share2, Sparkles, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { SiDiscord } from "react-icons/si";
import InlineGenerator from "./InlineGenerator";

export default function Hero() {
  const t = useTranslations("Landing.Hero");
  const defaultModelUrl = "/models/ai3d-2.glb";
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | undefined>();

  return (
    <div className="w-full relative overflow-hidden min-h-screen flex flex-col bg-gradient-to-br from-[#0a0e14] via-[#0f1419] to-[#1a1f2e]">
      {/* Professional 3D Platform Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid pattern - more subtle for professional look */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px]" />

        {/* Subtle gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto relative z-10 flex-1 flex flex-col">
        {/* Top Bar - Professional Toolbar Style */}
        <div className="flex items-center justify-between py-6 border-b border-[#2d3548]/50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Cube className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">AI 3D Studio</h1>
            </div>
            <FeatureBadge
              label={t("badge.label")}
              text={t("badge.text")}
              href={t("badge.href")}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
              asChild
            >
              <Link
                href={
                  siteConfig.socialLinks?.discord ||
                  "https://discord.com/invite/R7bUxWKRqZ"
                }
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                <SiDiscord className="w-4 h-4 mr-2" />
                Discord
              </Link>
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              onClick={() => setShowGenerator(!showGenerator)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {showGenerator ? "隐藏生成器" : "开始生成"}
            </Button>
          </div>
        </div>

        {/* Main Content Area - Split View Layout */}
        <div className="flex-1 grid lg:grid-cols-[1fr,1.5fr] gap-6 py-6">
          {/* Left Panel - Controls & Info */}
          <div className="flex flex-col gap-6">
            {/* Title Section */}
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">
                  {t("title")}
                </span>
              </h2>
              <p className="text-lg text-gray-400 leading-relaxed">
                {t("description")}
              </p>
            </div>

            {/* Quick Stats - Professional Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1a1f2e]/80 backdrop-blur-sm border border-[#2d3548]/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-white mb-1">1536³</div>
                <div className="text-xs text-gray-500">分辨率</div>
              </div>
              <div className="bg-[#1a1f2e]/80 backdrop-blur-sm border border-[#2d3548]/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-white mb-1">3min</div>
                <div className="text-xs text-gray-500">生成时间</div>
              </div>
              <div className="bg-[#1a1f2e]/80 backdrop-blur-sm border border-[#2d3548]/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-white mb-1">50%+</div>
                <div className="text-xs text-gray-500">精度提升</div>
              </div>
            </div>

            {/* Generator Panel */}
            {showGenerator && (
              <div className="flex-1 bg-[#1a1f2e]/80 backdrop-blur-sm border border-[#2d3548]/50 rounded-xl p-6 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">快速生成</h3>
                </div>
                <InlineGenerator
                  onModelGenerated={(url, info) => setGeneratedModelUrl(url)}
                />
              </div>
            )}

            {/* Action Buttons */}
            {!showGenerator && (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold"
                  onClick={() => setShowGenerator(true)}
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  {t("getStarted")}
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#2d3548] text-gray-400 hover:text-white hover:border-purple-500"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载模型
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#2d3548] text-gray-400 hover:text-white hover:border-purple-500"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    分享
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - 3D Viewer */}
          <div className="relative bg-[#0f1419] rounded-xl border border-[#2d3548]/50 overflow-hidden shadow-2xl">
            {/* Viewer Header */}
            <div className="absolute top-0 left-0 right-0 z-20 bg-[#1a1f2e]/90 backdrop-blur-sm border-b border-[#2d3548]/50 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cube className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-white">3D 预览</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-white"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 3D Canvas */}
            <div className="w-full h-[600px] lg:h-[700px] pt-12">
              <Model3DViewer
                modelUrl={generatedModelUrl}
                defaultModelUrl={defaultModelUrl}
                autoRotate={true}
                showInfo={!!generatedModelUrl}
                showControls={true}
                className="w-full h-full"
              />
            </div>

            {/* Preview Hint */}
            {!generatedModelUrl && (
              <div className="absolute bottom-6 left-6 right-6 bg-[#1a1f2e]/90 backdrop-blur-md rounded-lg p-4 border border-[#2d3548]/50">
                <p className="text-sm font-medium text-center text-gray-300">
                  ✨ {t("previewText", { default: "实时 3D 预览 · 交互式查看" })}
                </p>
                <p className="text-xs text-center text-gray-500 mt-1">
                  支持拖拽、缩放、旋转操作
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
