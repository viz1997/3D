export const BLOGS_IMAGE_PATH = "blog-images";

export const ADMIN_UPLOAD_IMAGE_PATH = "admin-uploads-images";

// Home showcase models (only two entries will be displayed).
// Replace `modelUrl` to switch the showcased models without touching components.
export const TEXTURE_SHOWCASE_CARDS = [
  {
    id: "texture-showcase-1",
    title: "",
    subtitle: "高保真材质合成引擎",
    description:
      "专业级纹理生成，尖端AI驱动。创建令人惊叹的PBR材质，呈现无与伦比的表面细节、无缝拼接、智能风格迁移——从概念到成品资产，只需几秒。",
    variants: [
      {
        id: "texture-1",
        name: "Showcase 1",
        modelUrl: "https://assets.ai3dmodel.app/pgc/ai3d-1.glb",
        gradient: "from-indigo-500 via-purple-500 to-pink-500",
        scale: 6,
      }
    ],
  },
  {
    id: "texture-showcase-2",
    title: "",
    subtitle: "高保真材质合成引擎",
    description:
      "专业级纹理生成，尖端AI驱动。创建令人惊叹的PBR材质，呈现无与伦比的表面细节、无缝拼接、智能风格迁移——从概念到成品资产，只需几秒。",
    variants: [
      {
        id: "texture-2",
        name: "Showcase 2",
        modelUrl: "https://assets.ai3dmodel.app/pgc/ai3d-2.glb",
        gradient: "from-emerald-500 via-green-500 to-lime-400",
        scale: 6,
      }
    ],
  },
];