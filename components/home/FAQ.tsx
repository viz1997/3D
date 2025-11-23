"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { MousePointerClick } from "lucide-react";
import { useTranslations } from "next-intl";

type FAQItem = {
  question: string;
  answer: string;
};

export default function FAQ() {
  const t = useTranslations("Landing.FAQ");

  const faqs: FAQItem[] = t.raw("items");
  const ctaText = t("cta.button");

  return (
    <section id="testimonials" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-center z-10 text-lg md:text-5xl font-sans font-semibold mb-4">
            <span className="title-gradient">{t("title")}</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-8">
            {t("description")}
          </p>
          <div className="flex justify-center">
            <div
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="cursor-pointer"
            >
              <RainbowButton>
                <MousePointerClick className="w-5 h-5" />
                {ctaText}
              </RainbowButton>
            </div>
          </div>
        </div>

        <Accordion
          type="single"
          collapsible
          className="bg-card ring-muted w-full rounded-2xl border px-8 py-3 shadow-xs ring-4 dark:ring-0"
        >
          {faqs.map((item) => (
            <AccordionItem
              key={item.question}
              value={item.question}
              className="border-dashed"
            >
              <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-base whitespace-pre-line">{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
