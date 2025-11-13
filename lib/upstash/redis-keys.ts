import { siteConfig } from '@/config/site';

/**
 * Redis key generator - centralized key management for consistency
 */
export const RedisKeys = {
  /**
   * Blog view count keys
   */
  blog: {
    /**
     * Get blog view count key
     * @example blog:views:my-post:en
     */
    viewCount: (slug: string, locale: string) => `${siteConfig.name.trim()}:blog:views:${slug}:${locale}`,

    /**
     * Get blog IP tracking key (for deduplication)
     * @example blog:views:ip:my-post:en:192.168.1.1
     */
    viewIpTracking: (slug: string, locale: string, ip: string) =>
      `${siteConfig.name.trim()}:blog:views:ip:${slug}:${locale}:${ip}`,
  },

  // Add other modules here as needed
  // user: { ... },
  // cache: { ... },
};