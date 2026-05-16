export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function slugifyUsername(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 24);
  return normalized;
}

export function buildUsernameBase(name, email) {
  const fromName = slugifyUsername(name);
  if (fromName) return fromName;

  const localPart = normalizeEmail(email).split("@")[0];
  const fromEmail = slugifyUsername(localPart);
  return fromEmail || "user";
}

export async function generateUniqueUsername(prisma, preferredBase) {
  const base = slugifyUsername(preferredBase) || "user";

  const direct = await prisma.user.findUnique({ where: { username: base } });
  if (!direct) return base;

  for (let i = 1; i <= 1000; i += 1) {
    const candidate = `${base}${i}`;
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
    });
    if (!exists) return candidate;
  }

  return `${base}${Date.now().toString(36).slice(-6)}`;
}
