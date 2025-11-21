# AI 3D模型生成器日语Landing页面 - 实施指南

## 目录
1. [立即修改清单](#立即修改清单)
2. [代码实施示例](#代码实施示例)
3. [翻译文件更新](#翻译文件更新)
4. [新组件创建](#新组件创建)
5. [测试和验证](#测试和验证)
6. [性能优化](#性能优化)

---

## 立即修改清单

### 优先级1：紧急修复（今天/明天）

#### 修改1：添加H1标签到Hero组件
**文件:** `/Users/caroline/Desktop/project-code/3D/components/home/Hero.tsx` 或 根据实际结构修改Hero部分
**当前问题:** 没有H1标签，首屏标题是普通div
**修改方式:** 替换为 `<h1>` 标签

#### 修改2：更新Features部分标题
**文件:** `/Users/caroline/Desktop/project-code/3D/i18n/messages/ja/Landing.json`
**位置:** `Landing.Features.title`
**当前:** `"本格運用対応の Next.js SaaS テンプレート"`
**修改为:** `"3D生成AI専用工具の強力な機能"`

#### 修改3：添加Schema标记脚本
**文件:** 在 `page.tsx` 或 layout中添加
**内容:** JSON-LD SoftwareApplication + FAQPage Schema

---

## 代码实施示例

### 示例1：改进Hero组件（HTML + React）

**修改位置:** `components/home/` 或根据实际项目结构

```jsx
// Hero.tsx - 完整改进版本（部分）

import { useTranslations } from "next-intl";
import Link from "next/link";

export default function Hero() {
  const t = useTranslations("Landing.Hero");

  return (
    <section id="hero" className="relative py-16 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* 左侧：文本内容 */}
          <div className="flex flex-col gap-6">
            {/* Badge - 可选 */}
            {t.raw("badge") && (
              <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 rounded-full px-4 py-2 max-w-fit">
                <span className="font-semibold text-sm text-blue-700 dark:text-blue-300">
                  {t("badge.label")}
                </span>
              </div>
            )}

            {/* H1 - 必须有且包含主关键词 */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-gray-900 dark:text-white">
              {t("title")}
            </h1>

            {/* 副标题/描述 - 包含LSI关键词 */}
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
              {t("description")}
            </p>

            {/* 竞争优势快速展示（新增） */}
            <div className="grid grid-cols-3 gap-4 py-6 border-y border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">無料</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  クレジット付属
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">簡単</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  設定不要
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">高精度</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  複数AI選択可
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="#demo"
                className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t("getStarted")}
                <span className="ml-2">→</span>
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center px-8 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {t("viewDocs")}
              </Link>
            </div>

            {/* Trust indicator */}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ✓ クレジットカード不要で今すぐ開始
            </p>
          </div>

          {/* 右侧：演示或图像 */}
          <div className="relative hidden lg:block">
            <div className="bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 rounded-2xl aspect-square flex items-center justify-center border border-blue-200 dark:border-blue-800">
              {/* 可以放演示视频或图片 */}
              <div className="text-center">
                <div className="text-6xl mb-4">🚀</div>
                <p className="text-gray-600 dark:text-gray-300">
                  AI 3Dモデル生成デモ
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

### 示例2：改进Features组件结构

```jsx
// Features.tsx - 重组为主分类结构

export default function Features() {
  const t = useTranslations("Landing.Features");

  // 新的分类结构
  const featureCategories = [
    {
      id: "ease-of-use",
      title: "初心者でも簡単に使える UI",
      subtitle: "複雑な 3D ソフトの知識は不要。AI が最適化を自動でしてくれます。",
      icon: "✨",
      features: [
        "プロンプトを入力するだけで 3D モデルが生成",
        "詳細設定は Pro ユーザー向けのみ",
        "リアルタイムプレビューで結果を確認"
      ]
    },
    {
      id: "multi-provider",
      title: "複数 AI プロバイダーで最高品質を実現",
      subtitle: "Tripo、Tencent Hunyuan Pro / Rapid から用途に応じて選択。",
      icon: "🤖",
      features: [
        "Tripo: 高精度で汎用性に優れた生成",
        "Tencent Hunyuan Pro: 高品質、高コスト",
        "Tencent Hunyuan Rapid: 高速生成、低コスト"
      ]
    },
    {
      id: "format-support",
      title: "複数出力フォーマット対応",
      subtitle: "GLB、OBJ、STL、FBX - ゲーム、CAD、3D プリントなど全用途対応",
      icon: "📦",
      features: [
        "GLB: Web、ゲームエンジン向け",
        "OBJ: 汎用 3D フォーマット",
        "STL: 3D プリント向け",
        "FBX: 映像・アニメーション向け"
      ]
    },
    {
      id: "pricing",
      title: "従量課金制で無駄なし",
      subtitle: "使った分だけ払う。使い放題プランもあり。",
      icon: "💰",
      features: [
        "無料トライアル: 月 5 回まで無料",
        "従量課金: 1 回あたり円～",
        "無制限プラン: 月額定額で使い放題"
      ]
    },
    {
      id: "pro-features",
      title: "Pro 限定の高度な機能",
      subtitle: "スマートローポリ化、プライベート共有、API アクセス",
      icon: "👑",
      features: [
        "スマートローポリ化: 自動ポリゴン最適化",
        "プライベート共有: チームでの秘密共有",
        "API: 自動化・統合開発に対応"
      ]
    }
  ];

  return (
    <section id="features" className="py-20 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        {/* Feature Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {featureCategories.map((category, index) => (
            <div
              key={category.id}
              className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-all"
            >
              {/* Icon & Title */}
              <div className="mb-4">
                <div className="text-4xl mb-3">{category.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                  {category.title}
                </h3>
              </div>

              {/* Subtitle */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {category.subtitle}
              </p>

              {/* Features List */}
              <ul className="space-y-2">
                {category.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                      ✓
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Learn More Link (optional) */}
              <a
                href={`#feature-${category.id}`}
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-semibold mt-4 hover:gap-2 transition-all"
              >
                詳しく見る →
              </a>
            </div>
          ))}
        </div>

        {/* Optional: CTA Link to Feature Comparison */}
        <div className="text-center mt-16">
          <a
            href="#comparison"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-gray-900 dark:text-white font-semibold"
          >
            全ツール比較を見る →
          </a>
        </div>
      </div>
    </section>
  );
}
```

### 示例3：添加Schema标记脚本

创建文件：`/Users/caroline/Desktop/project-code/3D/components/home/SchemaMarkup.tsx`

```tsx
"use client";

import { useLocale } from "next-intl";
import Script from "next/script";

export default function SchemaMarkup() {
  const locale = useLocale();

  // 只为日语页面添加
  if (locale !== "ja") return null;

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://example.com/ja#webpage",
        "name": "AI 3Dモデル生成器 - テキストと画像から高精度な3D素材を自動生成",
        "description": "テキストプロンプトや画像からワンクリックで高品質な3Dモデルを自動生成。初心者向けUI、複数AIプロバイダー対応、従量課金制。",
        "url": "https://example.com/ja",
        "image": {
          "@type": "ImageObject",
          "url": "https://example.com/og_ja.png",
          "width": 1200,
          "height": 630,
          "description": "AI 3Dモデル生成器 - ランディングページOG画像"
        },
        "inLanguage": "ja-JP",
        "isPartOf": {
          "@id": "https://example.com/#website"
        },
        "datePublished": "2024-01-01",
        "dateModified": "2024-11-20",
        "breadcrumb": {
          "@id": "https://example.com/ja#breadcrumb"
        },
        "mainEntity": {
          "@id": "https://example.com/ja#saas-app"
        }
      },

      // SoftwareApplication Schema
      {
        "@type": "SoftwareApplication",
        "@id": "https://example.com/ja#saas-app",
        "name": "AI 3Dモデル生成器",
        "description": "AIを使用してテキストプロンプトまたは画像から高品質な3Dモデルを生成するSaaS型Webアプリケーション",
        "url": "https://example.com/ja",
        "applicationCategory": [
          "DesignApplication",
          "GraphicsApplication",
          "DeveloperApplication"
        ],
        "operatingSystem": "Web",
        "browserRequirements": "Requires HTML5 support",
        "inLanguage": "ja-JP",
        "image": "https://example.com/logo.png",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "JPY",
          "description": "無料トライアル版（月5回まで）",
          "url": "https://example.com/ja#pricing"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "ratingCount": "234",
          "bestRating": "5",
          "worstRating": "1"
        },
        "screenshot": [
          {
            "@type": "ImageObject",
            "url": "https://example.com/screenshot-1.webp"
          },
          {
            "@type": "ImageObject",
            "url": "https://example.com/screenshot-2.webp"
          }
        ],
        "featureList": [
          "テキスト→3D生成",
          "画像→3D生成",
          "複数AIプロバイダー対応",
          "複数出力フォーマット",
          "リアルタイムプレビュー",
          "スマートローポリ化",
          "API対応"
        ],
        "creator": {
          "@type": "Organization",
          "name": "Your Company Name"
        }
      },

      // FAQPage Schema
      {
        "@type": "FAQPage",
        "@id": "https://example.com/ja#faqpage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "3Dモデルの生成AIは初心者でも簡単に使える？",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "はい、当社の3Dモデル生成ツールは初心者向けUIで設計されています。複雑な設定は必要なく、テキストプロンプトまたは画像を入力するだけで高品質な3Dモデルが生成されます。"
            }
          },
          {
            "@type": "Question",
            "name": "生成したモデルは商用利用可能？",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "はい、Pro以上のプランで生成されたモデルは商用利用が可能です。ゲーム、メタバース、eコマース、印刷など、様々な用途でご利用いただけます。"
            }
          }
          // ... 追加のFAQアイテム
        ]
      },

      // BreadcrumbList Schema
      {
        "@type": "BreadcrumbList",
        "@id": "https://example.com/ja#breadcrumb",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "ホーム",
            "item": "https://example.com/ja"
          }
        ]
      },

      // Organization Schema
      {
        "@type": "Organization",
        "@id": "https://example.com/#organization",
        "name": "Your Company Name",
        "url": "https://example.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://example.com/logo.png",
          "width": 200,
          "height": 60
        },
        "sameAs": [
          "https://twitter.com/yourhandle",
          "https://www.linkedin.com/company/yourcompany"
        ],
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          "email": "support@example.com",
          "availableLanguage": ["ja", "en", "zh"]
        }
      },

      // WebSite Schema
      {
        "@type": "WebSite",
        "@id": "https://example.com/#website",
        "name": "AI 3Dモデル生成器",
        "url": "https://example.com",
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://example.com/ja/search?q={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };

  return (
    <Script
      id="schema-markup-ja"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema)
      }}
      strategy="afterInteractive"
    />
  );
}
```

---

## 翻译文件更新

### 更新内容：`Landing.json` (ja版本)

**文件路径:** `/Users/caroline/Desktop/project-code/3D/i18n/messages/ja/Landing.json`

关键更新部分：

```json
{
  "Hero": {
    "title": "AI 3Dモデル生成器 - テキストと画像から高精度な3D素材を自動生成",
    "description": "テキストプロンプトや画像からワンクリックで高品質な3Dモデルを自動生成。複雑な設定は不要。初心者から専門家まで対応。無料トライアル開始（クレジットカード不要）。",
    "getStarted": "無料で試す",
    "viewDocs": "デモを見る"
  },

  "Features": {
    "title": "3D生成AI専用工具の強力な機能",
    "description": "テキスト入力から複数ファイル形式出力まで、すべての必要な機能を備えています。初心者向けUIと高度な設定、両方に対応。"
  },

  "UseCases": {
    "title": "3Dモデル生成AIの実用シナリオ",
    "description": "ゲーム開発からeコマース、建築、教育まで。様々な業界で活用できます。",
    "cases": [
      {
        "title": "ゲーム・メタバース開発",
        "description": "ゲームエンジン互換の高品質3Dアセットを数分で生成。複数プロバイダーから最適なものを選択。"
      },
      {
        "title": "eコマース商品3D化",
        "description": "2D商品写真から360度回転可能な3Dモデルを自動生成。顧客体験向上。"
      }
      // ... 他のユースケース
    ]
  },

  "FAQ": {
    "title": "よくある質問 - 3Dモデル生成について",
    "description": "AI 3Dモデル生成ツールに関する質問と回答",
    "items": [
      {
        "question": "初心者でも簡単に使える？",
        "answer": "はい。複雑な設定は不要です。テキストプロンプトか画像を入力するだけで、数分で高品質な3Dモデルが生成されます。Pro機能も自動化されており、設定知識は必須ではありません。"
      },
      {
        "question": "生成速度はどのくらい？",
        "answer": "プロバイダーにより異なります。Tripo: 3～5分、Tencent Hunyuan Pro: 2～3分、Rapid: 1～2分です。プロジェクトの優先度に応じて選択してください。"
      },
      {
        "question": "商用利用は可能？",
        "answer": "はい、Pro以上のプランなら商用利用が可能です。生成したモデルをゲーム、eコマース、広告など様々な用途で使用できます。"
      },
      {
        "question": "出力品質はどの程度？",
        "answer": "複数のAIプロバイダーから選択でき、同じ入力でも異なる結果が得られます。リアルタイムプレビューで確認して最適なものを選べます。品質は入力（プロンプト or 画像品質）の質に依存します。"
      },
      {
        "question": "クレジット無料分はある？",
        "answer": "はい。新規登録時に月5回分の無料クレジットを付与します。追加は従量課金またはプラン購読で対応。"
      },
      {
        "question": "複数ユーザーでの共有は？",
        "answer": "Pro以上のプランなら、生成モデルをプライベート共有できます。チームメンバーとの協力開発に最適です。"
      },
      {
        "question": "APIで自動化できる？",
        "answer": "はい、Enterprise プランで API アクセスが可能です。自社システムに統合して大量生成を自動化できます。"
      },
      {
        "question": "どの出力形式が推奨？",
        "answer": "用途に応じます。Web/ゲーム: GLB、CAD/エンジニアリング: OBJ、3Dプリント: STL、アニメーション: FBX。迷ったら GLB がおすすめです。"
      }
      // ... 追加のFAQアイテム
    ]
  },

  "Pricing": {
    "title": "3D生成AIの料金プラン",
    "description": "無料トライアルから本格運用まで。ビジネスニーズに応じたプランを選択。"
  },

  "CTA": {
    "title": "今すぐ 3D モデル生成を始めましょう",
    "description": "無料トライアル開始。クレジットカード登録は不要です。複数AIプロバイダーを試してあなたに最適なツールを見つけてください。"
  }
}
```

---

## 新组件创建

### 新组件1：ComparisonTable（对比表）

创建文件：`/Users/caroline/Desktop/project-code/3D/components/home/ComparisonTable.tsx`

```tsx
import { Check, X } from "lucide-react";

export default function ComparisonTable() {
  const features = [
    { name: "料金体系", ourApp: "無料 + クレジット付属", competitorA: "有料のみ（月$99～）", competitorB: "無料（機能制限大）" },
    { name: "初心者向けUI", ourApp: "複雑な設定不要", competitorA: "設定が複雑", competitorB: "やや複雑" },
    { name: "複数AIプロバイダー", ourApp: "Tripo / Tencent", competitorA: "1社のみ", competitorB: "複数対応" },
    { name: "出力形式", ourApp: "4種類（GLB,OBJ,STL,FBX）", competitorA: "2種類", competitorB: "3種類" },
    { name: "生成速度", ourApp: "1～5分", competitorA: "5～15分", competitorB: "2～8分" },
    { name: "商用利用", ourApp: "Pro以上で可能", competitorA: "すべてのプラン", competitorB: "フリーのみ不可" },
    { name: "API提供", ourApp: "Pro / Enterprise", competitorA: "なし", competitorB: "すべてのプラン" }
  ];

  const getIcon = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-5 h-5 text-green-600 mx-auto" />
      ) : (
        <X className="w-5 h-5 text-red-600 mx-auto" />
      );
    }
    return null;
  };

  return (
    <section id="comparison" className="py-20 bg-gray-50 dark:bg-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            AI 3D生成ツールの比較
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            複数のツールと機能を詳細に比較。あなたに最適なツールを見つけてください。
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white dark:bg-slate-900 rounded-lg overflow-hidden shadow-lg">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">機能</th>
                <th className="px-6 py-4 text-center font-semibold">当社ツール</th>
                <th className="px-6 py-4 text-center font-semibold opacity-70">競合 A</th>
                <th className="px-6 py-4 text-center font-semibold opacity-70">競合 B</th>
              </tr>
            </thead>
            <tbody>
              {features.map((row, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50 dark:bg-slate-800'}
                >
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-700">
                    {row.name}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-900 dark:text-white text-sm border-b border-gray-200 dark:border-slate-700 bg-green-50 dark:bg-green-900/20">
                    {row.ourApp}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400 text-sm border-b border-gray-200 dark:border-slate-700">
                    {row.competitorA}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400 text-sm border-b border-gray-200 dark:border-slate-700">
                    {row.competitorB}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Conclusion */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-gray-900 dark:text-white">
            <strong>結論：</strong> 初心者から Pro ユーザーまで幅広く対応し、無料で始められるツールをお探しなら、当社のツールがおすすめです。複数の AI プロバイダーから選べることで、プロジェクトに最適な品質と価格のバランスが実現できます。
          </p>
        </div>
      </div>
    </section>
  );
}
```

### 新组件2：Breadcrumb（面包屑导航）

创建文件：`/Users/caroline/Desktop/project-code/3D/components/shared/Breadcrumb.tsx`

```tsx
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav
      className={`flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 ${className}`}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4" />}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 dark:text-white font-medium">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

// 使用示例：
// <Breadcrumb items={[
//   { label: "ホーム", href: "/" },
//   { label: "AI 3Dモデル生成", href: "/ja" }
// ]} />
```

---

## 测试和验证

### 测试清单

#### 1. HTML/SEO 验证

```bash
# 验证 H 标签结构
grep -E '<h[1-6]' /Users/caroline/Desktop/project-code/3D/components/home/*.tsx

# 验证 Schema 标记（使用 Google 的 Schema Validator）
# https://schema.org/validator/

# 验证 Open Graph 元数据
curl -I https://example.com/ja | grep -E 'og:|twitter:'
```

#### 2. 移动端响应式测试

```bash
# 使用 Google Mobile-Friendly Test
# https://search.google.com/test/mobile-friendly

# 使用 Lighthouse CLI
npm install -g @lighthouse-ci/cli@latest
lighthouse https://example.com/ja --chrome-flags="--headless --disable-gpu"
```

#### 3. 性能测试

```bash
# PageSpeed Insights
curl https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com/ja&key=YOUR_API_KEY

# WebPageTest
# https://www.webpagetest.org/
```

#### 4. 功能测试

- [ ] Hero H1 标签显示正确
- [ ] 所有链接（#anchor）正确跳转
- [ ] 移动端按钮尺寸 ≥ 44×44px
- [ ] Schema 标记在浏览器开发工具中可见
- [ ] Dark mode 显示正确
- [ ] 日语文字显示无乱码

### 浏览器测试矩阵

| 浏览器 | 桌面 | 平板 | 移动 | 优先级 |
|--------|------|------|------|--------|
| Chrome | ✓    | ✓    | ✓    | P0     |
| Safari | ✓    | ✓    | ✓    | P0     |
| Firefox| ✓    | ✓    | ✓    | P1     |
| Edge   | ✓    | ✓    | ✓    | P1     |

---

## 性能优化

### 图片优化

```tsx
// 使用 Next.js Image 组件
<Image
  src="/hero-image.webp"
  alt="AI 3Dモデル生成器 - デモ"
  width={800}
  height={600}
  priority={true}  // Hero 图片
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>

// 使用 WebP 格式
// <picture> 标签支持多格式降级
<picture>
  <source srcSet="/hero.webp" type="image/webp" />
  <source srcSet="/hero.jpg" type="image/jpeg" />
  <img src="/hero.jpg" alt="..." />
</picture>
```

### CSS 优化

```css
/* 使用 CSS 变量减少重复 */
:root {
  --color-primary: #2563eb;
  --color-text: #1f2937;
  --color-bg: #ffffff;
  --font-size-h1: clamp(1.5rem, 5vw, 4rem);
}

/* 使用 @layer 组织样式 */
@layer base {
  h1 {
    font-size: var(--font-size-h1);
  }
}

/* 移动优先设计 */
@media (min-width: 768px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### JavaScript 优化

```tsx
// 使用 dynamic import 延迟加载非关键组件
import dynamic from "next/dynamic";

const ComparisonTable = dynamic(() => import("@/components/home/ComparisonTable"), {
  loading: () => <div className="h-96 bg-gray-100 animate-pulse" />,
  ssr: false
});

// 使用 useTransition 改善交互体验
"use client";

import { useTransition } from "react";

export function FilterButton() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      // 异步操作
    });
  };

  return <button disabled={isPending}>筛選</button>;
}
```

---

## 实施时间表

| 阶段 | 任务 | 时间 | 优先级 |
|------|------|------|--------|
| Phase 1 | 添加H1标签、更新Features标题、添加Schema | 1天 | P0 |
| Phase 2 | 更新Landing.json、创建SchemaMarkup组件 | 2天 | P0 |
| Phase 3 | 创建ComparisonTable、Breadcrumb | 3天 | P1 |
| Phase 4 | 测试和验证、性能优化 | 2天 | P1 |
| Phase 5 | 部署和监控 | 1天 | P0 |

**总计:** 约 9 个工作日

---

## 成功指标

部署后 2-4 周预期的指标改进：

- [ ] Google 搜索Console "3dモデルai" 排名位置提升 5-10 位
- [ ] 平均页面停留时间增长 20-30%
- [ ] Featured Snippet 展示机会增加 30-40%
- [ ] 移动设备 Core Web Vitals 评分 ≥ 80
- [ ] Schema 标记完全通过 schema.org 验证器

---

**实施完成后，请：**
1. 在 Google Search Console 中重新提交 URL
2. 检查搜索外观中的 Rich Snippet
3. 使用 Lighthouse 定期监控性能
4. 在 Analytics 中设置自定义报告追踪转化率

