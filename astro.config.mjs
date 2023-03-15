import { defineConfig } from "astro/config";
import unocss from "unocss/astro";
import solidJs from "@astrojs/solid-js";
import vercelDisableBlocks from "./plugins/vercelDisableBlocks";

import node from "@astrojs/node";
import vercel from "@astrojs/vercel/edge";
import netlify from "@astrojs/netlify/edge-functions";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const envAdapter = () => {
  console.log("OUTPUT", process.env.OUTPUT);
  if (process.env.OUTPUT == "vercel") {
    return vercel();
  } else if (process.env.OUTPUT == "netlify") {
    return netlify();
  } else {
    return node({
      mode: "standalone",
    });
  }
};

// https://astro.build/config
export default defineConfig({
  integrations: [unocss(), solidJs()],
  output: "server",
  adapter: envAdapter(),
  vite: {
    plugins: [
      wasm(),
      topLevelAwait(),
      process.env.OUTPUT == "vercel" && vercelDisableBlocks(),
      process.env.OUTPUT == "netlify" && vercelDisableBlocks(),
    ],
  },
});
