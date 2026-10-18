import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely. Conflicting utilities resolve to the last
 * one (via tailwind-merge), and falsy values are ignored, so conditional
 * class strings can be composed without style conflicts.
 */
export const cn = (...inputs: Parameters<typeof twMerge>) => twMerge(...inputs);