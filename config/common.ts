export const BLOGS_IMAGE_PATH = "blog-images";

export const ADMIN_UPLOAD_IMAGE_PATH = "admin-uploads-images";

// Home showcase models (only two entries will be displayed).
// Replace `modelUrl` to switch the showcased models without touching components.
export const TEXTURE_SHOWCASE_CARDS = [
  {
    id: "texture-showcase-1",
    title: "AI 3D模型生成器",
    subtitle: "高保真材质合成引擎",
    description:
      "专业级纹理生成，尖端AI驱动。创建令人惊叹的PBR材质，呈现无与伦比的表面细节、无缝拼接、智能风格迁移——从概念到成品资产，只需几秒。",
    variants: [
      {
        id: "texture-1",
        name: "霓虹金属",
        modelUrl: "/models/ai3d-demo.glb",
        gradient: "from-indigo-500 via-purple-500 to-pink-500",
      }
    ],
  },
  {
    id: "texture-showcase-2",
    title: "材质库一键调换",
    subtitle: "智能风格迁移",
    description:
      "通过缩略图快速切换不同渲染风格，实现材质实时对比与预览。支持导出高精度贴图集，大幅缩短美术工作流。",
    variants: [
      {
        id: "texture-6",
        name: "森林苔藓",
        modelUrl: "/models/ai3d-demo.glb",
        gradient: "from-emerald-500 via-green-500 to-lime-400",
      }
    ],
  },
];