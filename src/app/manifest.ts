import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Margin · Học cùng PDF",
    short_name: "Margin",
    description: "Đọc PDF và học Y khoa, Răng Hàm Mặt bằng tiếng Việt",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f0",
    theme_color: "#f6f5f0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
