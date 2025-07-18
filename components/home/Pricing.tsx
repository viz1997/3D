import { getPublicPricingPlans } from "@/actions/prices/public";
import { PricingCardDisplay } from "@/components/home/PricingCardDisplay";
import FeatureBadge from "@/components/shared/FeatureBadge";
import { DEFAULT_LOCALE } from "@/i18n/routing";
import { PricingPlan } from "@/types/pricing";
import { getLocale, getTranslations } from "next-intl/server";

export default async function Pricing() {
  const t = await getTranslations("Landing.Pricing");

  const locale = await getLocale();

  let newPlans: PricingPlan[] = [];
  const result = await getPublicPricingPlans();

  if (result.success) {
    newPlans = result.data || [];
  } else {
    console.error("Failed to fetch public pricing plans:", result.error);
  }

  return (
    <section id="pricing" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <FeatureBadge
            label={t("badge.label")}
            text={t("badge.text")}
            className="mb-8"
          />
          <h2 className="text-center z-10 text-lg md:text-5xl font-sans font-semibold mb-4">
            <span className="bg-clip-text bg-gradient-to-b from-foreground to-muted-foreground text-transparent">
              {t("title")}
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div
          className={`grid grid-cols-1  gap-8 md:grid-cols-${
            newPlans.length > 0 ? newPlans.length : 1
          }`}
        >
          {newPlans.map((plan) => {
            const localizedPlan =
              plan.lang_jsonb?.[locale] || plan.lang_jsonb?.[DEFAULT_LOCALE];

            if (!localizedPlan) {
              console.warn(
                `Missing localization for locale '${locale}' or fallback 'en' for plan ID ${plan.id}`
              );
              return null;
            }

            return (
              <PricingCardDisplay
                key={plan.id}
                plan={plan}
                localizedPlan={localizedPlan}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
