import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://satisfactory-editor.com/sitemap.xml",
    host: "satisfactory-editor.com",
  };
}
