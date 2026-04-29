import type { MetadataRoute } from "next";
import { FAVICON_PATH, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Ninja Typing",
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#05070f",
    theme_color: "#05070f",
    orientation: "landscape-primary",
    icons: [
      {
        src: FAVICON_PATH,
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any"
      },
      {
        src: FAVICON_PATH,
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
