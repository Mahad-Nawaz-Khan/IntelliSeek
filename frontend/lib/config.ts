export function getApiPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}
