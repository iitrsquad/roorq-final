import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/auth',
          '/cart',
          '/checkout',
          '/orders',
          '/profile',
          '/referrals',
          '/signup',
          '/test-connection',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
