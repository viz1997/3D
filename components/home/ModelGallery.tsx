"use client";

import { TEXTURE_SHOWCASE_CARDS } from "@/config/common";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

const LazyModel3DViewer = dynamic(() => import("@/components/ai-3d/Model3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
    </div>
  ),
});

type TextureCard = (typeof TEXTURE_SHOWCASE_CARDS)[number];

const GalleryCard = ({
  card,
  animationDelay = 0,
  className = "",
}: {
  card: TextureCard;
  animationDelay?: number;
  className?: string;
}) => {
  const primaryVariant = card.variants[0];
  const [hasEnteredView] = useState(true);

  return (
    <div
      // 不再使用 IntersectionObserver 懒加载，直接渲染 3D 模型
      className={`relative w-full overflow-hidden bg-transparent aspect-[1/1] md:aspect-[4/3] ${className}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <LazyModel3DViewer
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
    </div>
  );
};

export default function ModelGallery({ cards = TEXTURE_SHOWCASE_CARDS }: { cards?: TextureCard[] }) {
  const firstCard = cards[0];

  return (
    <section id="gallery" className="relative px-4 py-20">
      <div className="mx-auto max-w-6xl space-y-16">
        {/* 顶部文案 */}
        {firstCard && (
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="uppercase tracking-wider font-semibold font-mono bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-green-600 text-lg">
              {firstCard.title}
            </h2>
            <p className="text-balance text-2xl md:text-3xl font-semibold text-foreground">
              {firstCard.subtitle}
            </p>
            <p className="text-balance text-lg text-muted-foreground max-w-4xl mx-auto">
              {firstCard.description}
            </p>
          </div>
        )}

        {/* 模型展示 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {cards.map((card, index) => (
            <GalleryCard
              key={card.id}
              card={card}
              animationDelay={index * 100}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

