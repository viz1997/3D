"use client";

import { TEXTURE_SHOWCASE_CARDS } from "@/config/common";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";

const LazyModel3DViewer = dynamic(() => import("@/components/ai-3d/Model3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0f1419]">
      <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
    </div>
  ),
});

type TextureVariant = {
  id: string;
  name: string;
  modelUrl: string;
  thumbnail?: string;
  gradient?: string;
};

type TextureCard = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  variants: TextureVariant[];
};

const TextureShowcaseCard = ({ card }: { card: TextureCard }) => {
  const [activeVariantId, setActiveVariantId] = useState(card.variants[0]?.id ?? "");
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "200px",
  });
  const [hasEnteredView, setHasEnteredView] = useState(false);

  useEffect(() => {
    if (inView) {
      setHasEnteredView(true);
    }
  }, [inView]);

  const activeVariant = useMemo(
    () => card.variants.find((variant) => variant.id === activeVariantId) ?? card.variants[0],
    [card.variants, activeVariantId]
  );

  return (
    <div ref={ref} className="flex flex-col items-center space-y-5">
      <div className="flex-1 relative overflow-hidden rounded-xl aspect-[4/3] w-full max-w-xl border border-border/50 bg-[#0f1419]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1f2e] via-[#0f1419] to-[#1a1f2e]" />
        <div className="relative w-full h-full">
          {hasEnteredView ? (
            <LazyModel3DViewer
              key={activeVariant?.id}
              modelUrl={activeVariant?.modelUrl}
              autoRotate
              showInfo={false}
              showControls={false}
              className="w-full h-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              模型加载中...
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 flex-wrap">
        {card.variants.map((variant) => {
          const isActive = variant.id === activeVariantId;
          const ringClasses = isActive
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "ring-0 opacity-70 hover:opacity-100";

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => setActiveVariantId(variant.id)}
              className={cn(
                "relative w-12 h-12 rounded-full cursor-pointer transition-all overflow-hidden flex items-center justify-center",
                ringClasses
              )}
              title={variant.name}
            >
              {variant.thumbnail ? (
                <Image src={variant.thumbnail} alt={variant.name} fill className="object-cover" />
              ) : (
                <span
                  className={cn(
                    "absolute inset-0 rounded-full",
                    variant.gradient
                      ? `bg-gradient-to-br ${variant.gradient}`
                      : "bg-gradient-to-br from-slate-500 to-slate-800"
                  )}
                />
              )}
              <span className="sr-only">{variant.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function TextureShowcaseSection() {
  return (
    <section id="feature-4-texture" className="relative px-4 py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-green-950/10 to-transparent -z-10" />
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="uppercase tracking-wider font-semibold font-mono bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-green-600">
            AI 3D模型生成器
          </h2>
          <p className="text-balance text-2xl md:text-3xl font-semibold text-foreground">
            高保真材质合成引擎
          </p>
          <p className="text-balance text-lg text-muted-foreground max-w-4xl mx-auto">
            专业级纹理生成，尖端AI驱动。创建令人惊叹的PBR材质，呈现无与伦比的表面细节、无缝拼接、智能风格迁移——从概念到成品资产，只需几秒。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {TEXTURE_SHOWCASE_CARDS.map((card) => (
            <div key={card.id} className="flex flex-col items-center space-y-5">
              <TextureShowcaseCard card={card} />
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{card.subtitle}</h3>
                <p className="text-sm text-muted-foreground px-4">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

