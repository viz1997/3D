"use client";

import { TEXTURE_SHOWCASE_CARDS } from "@/config/common";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

const LazyModel3DViewer = dynamic(() => import("@/components/ai-3d/Model3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0f1419]">
      <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
    </div>
  ),
});

type TextureCard = (typeof TEXTURE_SHOWCASE_CARDS)[number];

const GalleryCard = ({ card, animationDelay = 0 }: { card: TextureCard; animationDelay?: number }) => {
  const primaryVariant = card.variants[0];
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

  return (
    <div
      ref={ref}
      className={cn(
        "group relative rounded-2xl border border-border/50 bg-card/70 backdrop-blur-sm overflow-hidden transition-all duration-500",
        "hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2 hover:bg-card/80"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />

      <div className="relative aspect-video bg-gradient-to-br from-[#1a1f2e] via-[#0f1419] to-[#1a1f2e] overflow-hidden">
        {hasEnteredView ? (
          <LazyModel3DViewer
            modelUrl={primaryVariant?.modelUrl}
            defaultModelUrl={primaryVariant?.modelUrl}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      <div className="p-6 flex flex-col gap-3 text-center">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-primary/80 uppercase tracking-wide">{card.title}</h3>
          <p className="text-xl font-semibold text-foreground">{card.subtitle}</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
      </div>
    </div>
  );
};

export default function ModelGallery({ cards = TEXTURE_SHOWCASE_CARDS }: { cards?: TextureCard[] }) {
  const heroCard = cards[0];

  return (
    <section id="gallery" className="relative px-4 py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/10 to-background" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="mx-auto max-w-5xl space-y-12 relative z-10">
        {heroCard && (
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="uppercase tracking-wider font-semibold font-mono bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-green-600">
              {heroCard.title}
            </h2>
            <p className="text-balance text-2xl md:text-3xl font-semibold text-foreground">
              {heroCard.subtitle}
            </p>
            <p className="text-balance text-lg text-muted-foreground max-w-4xl mx-auto">
              {heroCard.description}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {cards.map((card, index) => (
            <GalleryCard key={card.id} card={card} animationDelay={index * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}

