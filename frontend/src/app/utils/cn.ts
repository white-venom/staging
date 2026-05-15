import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Clean atomic CSS Class name merger matching shadcn/ui configuration schemas.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
