export function originFromRequest(request: Request): string {
  return new URL(request.url).origin;
}
