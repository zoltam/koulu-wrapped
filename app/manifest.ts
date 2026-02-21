import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lukio Wrapped",
    short_name: "Wrapped",
    description: "Lukuvuotesi kohokohdat Wrapped-tyyliin.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#03142d",
    theme_color: "#03142d",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
