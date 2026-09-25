export const API_CONFIG = {
  /** 개발: Vite 프록시(/api) / 운영: Cloudflare Worker 프록시 */
  BASE_URL: import.meta.env.PROD ? 'https://coupang-proxy.cheadev5831.workers.dev' : '/api',
  /** mc.coupang.com 주문 목록 엔드포인트 */
  ORDERS_ENDPOINT: '/ssr/api/myorders/model/page',
  PAGE_SIZE: 10,
} as const;
