import AI3DInteraction from "@/components/ai-3d";
import CTA from "@/components/home/CTA";
import FAQ from "@/components/home/FAQ";
import Features from "@/components/home/Features";
import ModelGallery from "@/components/home/ModelGallery";
import Pricing from "@/components/home/Pricing";
import { BG1 } from "@/components/shared/BGs";
import { getMessages } from "next-intl/server";

export default async function HomeComponent() {
  const messages = await getMessages();

  return (
    <div className="w-full">
      <BG1 />

      {/* First section: Full AI 3D generation area */}
      <AI3DInteraction />

      <ModelGallery />
      {messages.Landing.Features && <Features />}

      <Pricing />

      {messages.Landing.FAQ && <FAQ />}

      {messages.Landing.CTA && <CTA />}
    </div>
  );
}
