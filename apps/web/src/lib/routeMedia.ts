/** Dataset images are served from the API at /assets (dev: Vite proxy). */
export function resolveRouteImageUrl(url: string): string {
  if (!url.startsWith("/assets/")) return url;
  return url;
}
