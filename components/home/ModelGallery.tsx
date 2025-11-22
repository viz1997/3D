"use client";

import { TEXTURE_SHOWCASE_CARDS } from "@/config/common";
import { Download, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

const LazyModel3DViewer = dynamic(() => import("@/components/ai-3d/Model3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-[#0b1224] via-[#0a0f1c] to-[#05070c] text-gray-300">
      <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
      <div className="text-center text-sm">
        <div className="font-medium">3D Preview</div>
        <div className="text-gray-500 text-xs">正在加载模型…</div>
      </div>
    </div>
  ),
});

type TextureCard = (typeof TEXTURE_SHOWCASE_CARDS)[number];

type GalleryCardProps = {
  card: TextureCard;
  animationDelay?: number;
  className?: string;
  onDownload: (modelUrl: string, fileName: string) => void;
};

const GalleryCard = ({ card, animationDelay = 0, className = "", onDownload }: GalleryCardProps) => {
  const t = useTranslations("Landing.ModelGallery");
  const primaryVariant = card.variants[0];

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Download clicked:', primaryVariant.modelUrl);
    const fileName = `${card.id || 'model'}.glb`;
    onDownload(primaryVariant.modelUrl, fileName);
  };

  return (
    <div
      className={`relative w-full overflow-hidden aspect-[4/3] md:aspect-[16/9] min-h-[300px] md:min-h-[420px] rounded-2xl focus-within:ring-2 focus-within:ring-white/40 transition-transform hover:scale-[1.01] ${className}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <LazyModel3DViewer
        key={`model-${primaryVariant?.id || primaryVariant?.modelUrl}`}
        modelUrl={primaryVariant?.modelUrl}
        defaultModelUrl={primaryVariant?.modelUrl}
        autoRotate
        showInfo={false}
        showControls={false}
        transparentBackground={true}
        enableZoom={false}
        className="w-full h-full bg-transparent"
        modelScaleFactor={primaryVariant?.scale ?? 6}
      />
      <div className="absolute inset-x-4 bottom-4 flex justify-end pointer-events-none z-10">
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur border border-white/20 hover:bg-white/20 flex items-center gap-2 transition-colors"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4" />
          {t("downloadButton")}
        </button>
      </div>
    </div>
  );
};

export default function ModelGallery({ cards = TEXTURE_SHOWCASE_CARDS }: { cards?: TextureCard[] }) {
  const t = useTranslations("Landing.ModelGallery");

  const handleDownload = async (modelUrl: string, fileName: string) => {
    console.log('handleDownload called with:', { modelUrl, fileName });

    try {
      // Try to fetch and download with blob (works if CORS is enabled)
      console.log('Attempting fetch download...');
      const response = await fetch(modelUrl);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);
      console.log('Download completed successfully');
    } catch (error) {
      console.error('Download via fetch failed, trying direct link:', error);

      // Fallback: direct link (may open in new tab if cross-origin)
      const link = document.createElement('a');
      link.href = modelUrl;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('Fallback download triggered');
    }
  };

  return (
    <section id="gallery" className="relative px-4 pb-20">
      <div className="mx-auto max-w-7xl space-y-12">
        {/* 顶部文案 */}
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-balance text-2xl md:text-3xl font-semibold text-foreground">
            {t("title")}
          </p>
          <p className="text-balance text-lg text-muted-foreground max-w-4xl mx-auto">
            {t("description")}
          </p>
        </div>

        {/* 模型展示 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {cards.map((card, index) => (
            <GalleryCard
              key={card.id}
              card={card}
              animationDelay={index * 100}
              onDownload={handleDownload}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
