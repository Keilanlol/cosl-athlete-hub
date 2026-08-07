import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Slugify un libellé en code technique snake_case.
 * Normalise les accents (NFD), supprime les diacritiques, remplace les
 * caractères non alphanumériques par des underscores, sans préfixe.
 * Ex: "Kiné" → "kine", "Charte éthique" → "charte_ethique"
 */
export function slugifyCode(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `item_${Date.now()}`
  );
}
