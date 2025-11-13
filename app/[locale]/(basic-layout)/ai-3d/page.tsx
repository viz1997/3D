import AI3DInteraction from "@/components/ai-3d";
import { Locale } from "@/i18n/routing";
import { constructMetadata } from "@/lib/metadata";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import FullscreenWrapper from "./FullscreenWrapper";

type Params = Promise<{ locale: string }>;

type MetadataProps = {
  params: Params;
};

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "AI3D",
  });

  return constructMetadata({
    page: "AI3D",
    title: t("title"),
    description: t("metaDescription"),
    locale: locale as Locale,
    path: `/ai-3d`,
  });
}

export default function AI3DPage() {
  return (
    <FullscreenWrapper>
      <AI3DInteraction />
    </FullscreenWrapper>
  );
}

