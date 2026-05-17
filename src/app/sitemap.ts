import type { MetadataRoute } from "next";

// Single-page app — the only crawlable URL is the root. Updating
// `lastModified` to the build time keeps the sitemap fresh on every deploy
// without any backing data.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://satisfactory-editor.com",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
