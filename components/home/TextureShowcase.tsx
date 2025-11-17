"use client";

import { TEXTURE_SHOWCASE_CARDS } from "@/config/common";
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
    <div ref={ref} className="relative aspect-[4/3] w-full bg-[#0f1419]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1f2e] via-[#0f1419] to-[#1a1f2e]" />
      <div className="relative w-full h-full">
        {hasEnteredView ? (
          <LazyModel3DViewer
            key={primaryVariant?.id}
            modelUrl={primaryVariant?.modelUrl}
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
  );
};

export default function TextureShowcaseSection() {
  return (
    <section id="feature-4-texture" className="relative px-4 py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-green-950/10 to-transparent -z-10" />
      <div className="mx-auto max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {TEXTURE_SHOWCASE_CARDS.map((card) => (
            <TextureShowcaseCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

