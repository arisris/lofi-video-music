
const loadedFonts = new Set();

export const loadGoogleFont = (fontFamily: string) => {
  if (!fontFamily) return;
  if (loadedFonts.has(fontFamily)) return;
  
  // Skip default system fonts
  const systemFonts = ["sans-serif", "serif", "monospace", "cursive", "fantasy"];
  if (systemFonts.some(f => fontFamily.toLowerCase().includes(f) && !fontFamily.includes("'"))) return;

  // Extract clean font name (e.g. "'Outfit', sans-serif" -> "Outfit")
  const match = fontFamily.match(/'([^']+)'/);
  const cleanName = match ? match[1] : fontFamily.split(",")[0].trim();
  
  if (loadedFonts.has(cleanName)) return;

  const fontUrlName = cleanName.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontUrlName}:wght@100;300;400;500;700;900&display=swap`;
  
  link.onload = () => {
    console.log(`Font loaded: ${cleanName}`);
    // Canvas re-renders every frame, so no explicit UI poke is needed here.
  };

  document.head.appendChild(link);
  loadedFonts.add(fontFamily);
  loadedFonts.add(cleanName);
};

export const GoogleFontsList = [
  "sans-serif",
  "serif",
  "monospace",
  "'Outfit', sans-serif",
  "'Inter', sans-serif",
  "'Montserrat', sans-serif",
  "'Poppins', sans-serif",
  "'Lexend', sans-serif",
  "'Space Grotesk', sans-serif",
  "'Quicksand', sans-serif",
  "'Josefin Sans', sans-serif",
  "'Syne', sans-serif",
  "'Jura', sans-serif",
  "'Anton', sans-serif",
  "'Archivo Black', sans-serif",
  "'Oswald', sans-serif",
  "'Bangers', cursive",
  "'Luckiest Guy', cursive",
  "'Lilita One', cursive",
  "'Fredoka', sans-serif",
  "'Comfortaa', cursive",
  "'Titan One', cursive",
  "'Pacifico', cursive",
  "'Lobster', cursive",
  "'Satisfy', cursive",
  "'Sacramento', cursive",
  "'Caveat', cursive",
  "'Permanent Marker', cursive",
  "'Gloria Hallelujah', cursive",
  "'Reenie Beanie', cursive",
  "'Righteous', cursive",
  "'Bungee', cursive",
  "'Press Start 2P', cursive",
  "'VT323', monospace",
  "'Share Tech Mono', monospace",
  "'Roboto Mono', monospace",
  "'Courier Prime', monospace",
  "'Playfair Display', serif",
  "'DM Serif Display', serif",
  "'Abril Fatface', serif",
  "'Cinzel', serif",
  "'Spectral', serif"
];
