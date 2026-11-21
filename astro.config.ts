import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

const site = process.env.PUBLIC_SITE_URL ?? 'https://makostar.github.io'
const base = process.env.PUBLIC_BASE_PATH ?? '/ss-gacha-pool/'

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory'
  },
  integrations: [sitemap()]
})
