// Loading environment variables from .env files
// https://docs.astro.build/en/guides/configuring-astro/#environment-variables
import { loadEnv } from "vite";
const {
  PUBLIC_SANITY_STUDIO_PROJECT_ID,
  PUBLIC_SANITY_STUDIO_DATASET,
  PUBLIC_SANITY_STUDIO_URL,
  PUBLIC_SANITY_VISUAL_EDITING_ENABLED,
  VERCEL_ISR_BYPASS_TOKEN,
} = loadEnv(import.meta.env.MODE, process.cwd(), "");
import { defineConfig } from "astro/config";

const projectId = PUBLIC_SANITY_STUDIO_PROJECT_ID;
const dataset = PUBLIC_SANITY_STUDIO_DATASET;
const studioUrl = PUBLIC_SANITY_STUDIO_URL || "http://localhost:3333";
const visualEditingEnabled = PUBLIC_SANITY_VISUAL_EDITING_ENABLED === "true";

// Контент оновлюється кілька разів на тиждень, тому рендерити сторінку на кожен
// запит немає сенсу: ISR кешує відповідь, і функція прокидається лише на промах.
// bypassToken (необовʼязковий) дозволяє скидати кеш вебхуком із Sanity одразу
// після публікації — без нього сторінка оновиться максимум через годину.
//
// Там, де увімкнене візуальне редагування (локально та на прев'ю), кеш має бути
// вимкнений: Presentation tool показував би застарілі чернетки.
const isr = visualEditingEnabled
  ? undefined
  : {
      expiration: 60 * 60,
      ...(VERCEL_ISR_BYPASS_TOKEN ? { bypassToken: VERCEL_ISR_BYPASS_TOKEN } : {}),
    };

import sanity from "@sanity/astro";
import react from "@astrojs/react";

// Change this depending on your hosting provider (Vercel, Netlify etc)
// https://docs.astro.build/en/guides/server-side-rendering/#adding-an-adapter
import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  // Set to 'server' for Visual Editing and on-demand rendering
  // Requires an adapter for deployment (Vercel, Netlify, Cloudflare, Node, etc.)
  output: "server",
  adapter: vercel({ isr }),
  integrations: [
    sanity({
      projectId,
      dataset,
      // studioBasePath: "/admin",
      // Set useCdn to false if you're building statically.
      useCdn: false,
      apiVersion: "2026-03-26", // Set to date of setup to use the latest API version
      stega: {
        studioUrl,
      },
    }),
    react(), // Required for Sanity Studio
  ],
  vite: {
    optimizeDeps: {
      include: [
        "react/compiler-runtime",
        "lodash/isObject.js",
        "lodash/groupBy.js",
        "lodash/keyBy.js",
        "lodash/partition.js",
        "lodash/sortedIndex.js",
      ],
    },

    plugins: [tailwindcss()],
  },
});