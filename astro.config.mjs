import { defineConfig } from "astro/config";

import preact from "@astrojs/preact";

// https://astro.build/config
export default defineConfig({
  site: "http://localhost:4321" // Replace with your URL
  ,
  integrations: [preact()]
});