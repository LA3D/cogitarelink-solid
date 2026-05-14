const MEMENTO_RE = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

export function toMementoString(d: Date): string {
  return (
    pad(d.getUTCFullYear(), 4) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

export function fromMementoString(s: string): Date {
  const m = MEMENTO_RE.exec(s);
  if (!m) throw new Error(`invalid memento datetime string: ${s}`);
  const [, y, mo, da, h, mi, se] = m;
  const d = new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi, +se));
  if (Number.isNaN(d.getTime())) throw new Error(`invalid memento datetime: ${s}`);
  return d;
}

export function toRFC7231(d: Date): string {
  return d.toUTCString();
}

export function fromRFC7231(s: string): Date {
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new Error(`invalid RFC 7231 date: ${s}`);
  return new Date(t);
}

export function closestPrior(target: Date, available: Date[]): Date | null {
  let best: Date | null = null;
  for (const d of available) {
    if (d.getTime() <= target.getTime() && (best === null || d.getTime() > best.getTime())) {
      best = d;
    }
  }
  return best;
}
