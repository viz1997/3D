export const BLOGS_IMAGE_PATH = "blog-images";

export const ADMIN_UPLOAD_IMAGE_PATH = "admin-uploads-images";

// Home showcase models (only two entries will be displayed).
// Replace `modelUrl` to switch the showcased models without touching components.
// Model showcase configuration (technical parameters only)
// Text content is managed through i18n/messages/{locale}/Landing.json -> ModelGallery
export const TEXTURE_SHOWCASE_CARDS = [
  {
    id: "texture-showcase-1",
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