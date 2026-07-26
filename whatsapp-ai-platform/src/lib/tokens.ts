import type { Contact } from "@prisma/client";

/**
 * Fill named tokens like {{name}}, {{city}}, {{phone}} in a template body
 * using a contact's fields. Unknown tokens are left blank.
 */
export function fillTokens(body: string, contact: Partial<Contact>): string {
  return body.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, key: string) => {
    const map: Record<string, string> = {
      name: contact.name || "there",
      city: contact.city || "",
      phone: contact.phone || "",
      email: contact.email || "",
    };
    return map[key.toLowerCase()] ?? "";
  });
}

/** List the distinct token names used in a body, e.g. ["name","city"]. */
export function extractTokens(body: string): string[] {
  const set = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([\w]+)\s*\}\}/g)) set.add(m[1].toLowerCase());
  return [...set];
}
