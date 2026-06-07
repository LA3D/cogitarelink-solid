export function getProfileToken(uri: string): string | undefined {
  const q = uri.split("?")[1];
  if (!q) return undefined;
  return new URLSearchParams(q).get("_profile") ?? undefined;
}

export function stripProfileQuery(uri: string): string {
  const [base, q] = uri.split("?");
  if (!q) return uri;
  const params = new URLSearchParams(q);
  params.delete("_profile");
  const rest = params.toString();
  return rest ? `${base}?${rest}` : base;
}
