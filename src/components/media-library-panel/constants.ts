import type { SubTab } from "./types";

export const SUB_TABS: Array<{ id: SubTab; label: string; icon: string }> = [
  { id: "uploads", label: "Uploads", icon: "icon-[ri--upload-cloud-2-line]" },
  { id: "pixabay", label: "Pixabay", icon: "icon-[ri--global-line]" },
  { id: "pexels", label: "Pexels", icon: "icon-[ri--camera-lens-line]" },
  { id: "emoji", label: "Emoji", icon: "icon-[ri--emotion-happy-line]" },
];

export const EMOJI_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  { id: "Smileys and emotions", label: "Smileys" },
  { id: "People", label: "People" },
  { id: "Animals and nature", label: "Animals" },
  { id: "Food and drink", label: "Food" },
  { id: "Travel and places", label: "Places" },
  { id: "Activities and events", label: "Activities" },
  { id: "Objects", label: "Objects" },
  { id: "Symbols", label: "Symbols" },
  { id: "Flags", label: "Flags" },
];

export const stockRequest = (
  url: string,
  params: Record<string, unknown>,
): Promise<any> =>
  fetch(
    `${url}?${new URLSearchParams(params as Record<string, string>).toString()}`,
  ).then((res) => {
    if (!res.ok) {
      throw new Error(`Stock API ${url} failed (${res.status})`);
    }
    return res.json();
  });
