import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  const site = import.meta.env.SITE
  const base = import.meta.env.BASE_URL
  const sitemap = new URL(`${base}sitemap-index.xml`, site).href
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    ''
  ].join('\n')
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
