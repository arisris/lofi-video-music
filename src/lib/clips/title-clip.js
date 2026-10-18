import { State } from "../state";
import { getClipsToSearch } from "../../utils/helpers";
import { TitleSettingsView } from "../../components/clip-settings/title";
import { drawEmojiText, measureEmojiText, drawWavyEmojiText } from "../emoji-render";

export const TitleClip = {
  id: "title",
  name: "Track Title",
  icon: "icon-[ri--heading]",
  
  settings: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 36,
    fontWeight: "bold",
    textColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 0,
    shadowColor: "rgba(0,0,0,0.8)",
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    bgColor: "transparent",
    bgPadding: 10,
    bgRadius: 8,
    originX: 0,
    originY: 1,
    lineHeight: 1.2,
    textEffect: "none",
    typewriterSpeed: 15,
    typewriterOut: true,
    wavyAmplitude: 6,
    wavyFrequency: 4,
    wavySpacing: 0.15
  },

  getBoundingBox(ctx, w, h) {
    const padding = 40;
    const settings = this.settings;
    
    ctx.save();
    ctx.font = `${settings.fontWeight} ${settings.fontSize}px ${settings.fontFamily}`;
    const clipsToSearch = getClipsToSearch(State);
    const activeClip = clipsToSearch.find(c => 
      c.type === 'music' && 
      c.settings?.enabled !== false &&
      State.currentTime >= c.start && 
      State.currentTime <= c.start + c.duration
    );
    const text = activeClip ? (activeClip.settings?.name || "") : "No Music Playing";
    const width = measureEmojiText(ctx, text, settings.fontSize);
    ctx.restore();

    const boxWidth = width + (settings.bgPadding || 0) * 2; 
    const height = settings.fontSize * (settings.lineHeight || 1.2) + (settings.bgPadding || 0) * 2;
    
    let x, y;
    if (State.aspectRatio === "16:9") {
      x = padding;
      y = h - padding - height;
      this.settings.originX = 0;
    } else {
      x = w / 2 - boxWidth / 2;
      y = h - padding * 1.5 - height;
      this.settings.originX = 0.5;
    }
    this.settings.originY = 1;
    
    return { x, y, width: boxWidth, height };
  },

  draw(ctx, w, h) {
    const clipsToSearch = getClipsToSearch(State);
    const activeClip = clipsToSearch.find(c => 
      c.type === 'music' && 
      c.settings?.enabled !== false &&
      State.currentTime >= c.start && 
      State.currentTime <= c.start + c.duration
    );
    if (!activeClip) return;

    const settings = this.settings;
    const bbox = this.getBoundingBox(ctx, w, h);

    let textToDraw = activeClip.settings.name || "";
    let opacity = 1.0;

    if (settings.textEffect === "typewriter") {
      const speed = settings.typewriterSpeed || 15;
      const localTime = State.currentTime - activeClip.start;
      let charCount = Math.floor(localTime * speed);
      
      const duration = activeClip.duration;
      if (settings.typewriterOut !== false && isFinite(duration)) {
        const eraseCount = Math.floor((duration - localTime) * speed);
        charCount = Math.min(charCount, eraseCount);
      }
      charCount = Math.max(0, charCount);
      textToDraw = textToDraw.slice(0, charCount);
    }

    ctx.save();
    ctx.globalAlpha *= opacity;
    
    const size = State.aspectRatio === "9:16" ? settings.fontSize * 0.8 : settings.fontSize;
    ctx.font = `${settings.fontWeight} ${size}px ${settings.fontFamily}`;
    
    // Shadow
    if (settings.shadowBlur > 0 || settings.shadowOffsetX !== 0 || settings.shadowOffsetY !== 0) {
        ctx.shadowColor = settings.shadowColor || "rgba(0,0,0,0.8)";
        ctx.shadowBlur = settings.shadowBlur || 0;
        ctx.shadowOffsetX = settings.shadowOffsetX || 0;
        ctx.shadowOffsetY = settings.shadowOffsetY || 0;
    }

    // Background Box
    if (settings.bgColor && settings.bgColor !== "transparent") {
        ctx.fillStyle = settings.bgColor;
        ctx.beginPath();
        ctx.roundRect(bbox.x, bbox.y, bbox.width, bbox.height, settings.bgRadius || 0);
        ctx.fill();
    }

    // Keep shadow active for text drawing if shadow is set, otherwise reset it
    if (!(settings.shadowBlur > 0 || settings.shadowOffsetX !== 0 || settings.shadowOffsetY !== 0)) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Text Alignment Logic
    const textWidth = measureEmojiText(ctx, textToDraw, size);
    const textAlign = (State.aspectRatio === "16:9") ? "left" : "center";
    ctx.textBaseline = "middle";

    let textX = bbox.x + (settings.bgPadding || 0);
    if (textAlign === "center") {
      textX = bbox.x + bbox.width / 2 - textWidth / 2;
    }
    const textY = bbox.y + bbox.height / 2 - size / 2; // drawEmojiText uses top baseline internally or we adjust

    if (settings.textEffect === "wavy") {
      const time = performance.now() / 1000;
      drawWavyEmojiText(
        ctx,
        textToDraw,
        textX,
        bbox.y + (settings.bgPadding || 0),
        size,
        settings.textColor,
        settings.strokeColor || "#000000",
        settings.strokeWidth || 0,
        time,
        settings.wavyAmplitude !== undefined ? settings.wavyAmplitude : 6,
        settings.wavyFrequency !== undefined ? settings.wavyFrequency : 4,
        settings.wavySpacing !== undefined ? settings.wavySpacing : 0.15
      );
    } else {
      drawEmojiText(
        ctx,
        textToDraw,
        textX,
        bbox.y + (settings.bgPadding || 0), // Use top padding for easier align
        size,
        settings.textColor,
        settings.strokeColor || "#000000",
        settings.strokeWidth || 0
      );
    }
    
    ctx.restore();
  },

  onSettings: TitleSettingsView,
};
