import m from "mithril";
import { State } from "../state";
import { SharedTransformSettings, SharedTextSettings, SharedAnimationSettings } from "../../components/shared-clip-settings";
import { CharBox } from "../../components/char-box";
import { drawEmojiText, measureEmojiText, drawWavyEmojiText } from "../emoji-render";

export const TextClip = {
  id: "text",
  name: "Text",
  icon: "icon-[ri--text-spacing]",

  settings: {
    items: [],
  },

  getItemBoundingBox(ctx, w, h, item) {
    ctx.save();
    const family = item.fontFamily || "sans-serif";
    const weight = item.fontWeight || "normal";
    const fontSize = item.fontSize || 32;
    const lineHeight = item.lineHeight || 1.2;
    ctx.font = `${weight} ${fontSize}px ${family}`;
    
    const lines = (item.content || "").split(/\n|\\n/);
    let maxWidth = 0;
    lines.forEach(line => {
      const width = measureEmojiText(ctx, line, fontSize);
      if (width > maxWidth) maxWidth = width;
    });

    const totalHeight = lines.length * fontSize * lineHeight;
    const padding = item.bgPadding || 0;
    
    const width = maxWidth + padding * 2;
    const height = totalHeight + padding * 2;
    
    ctx.restore();

    return {
      x: w / 2 - width / 2,
      y: h / 2 - 100 - height / 2,
      width,
      height,
    };
  },

  drawItem(ctx, w, h, item, localTime = 0, clip = null) {
    if (!item.content) return;
    
    ctx.save();
    
    const family = item.fontFamily || "sans-serif";
    const weight = item.fontWeight || "normal";
    const fontSize = item.fontSize || 32;
    const lineHeight = item.lineHeight || 1.2;
    const textAlign = item.textAlign || "center";
    
    ctx.font = `${weight} ${fontSize}px ${family}`;
    ctx.textBaseline = "top";

    const lines = (item.content || "").split(/\n|\\n/);
    const lineInfo = lines.map(line => {
      const width = measureEmojiText(ctx, line, fontSize);
      return { content: line, width };
    });

    let maxWidth = Math.max(...lineInfo.map(l => l.width));
    const totalHeight = lines.length * fontSize * lineHeight;
    const padding = item.bgPadding || 0;
    const bgWidth = maxWidth + padding * 2;
    const bgHeight = totalHeight + padding * 2;

    const centerX = w / 2;
    const centerY = h / 2 - 100;
    
    const bgX = centerX - bgWidth / 2;
    const bgY = centerY - bgHeight / 2;

    // Apply Shadow
    if (item.shadowBlur > 0 || item.shadowOffsetX !== 0 || item.shadowOffsetY !== 0) {
      ctx.shadowColor = item.shadowColor || "rgba(0,0,0,0.8)";
      ctx.shadowBlur = item.shadowBlur || 0;
      ctx.shadowOffsetX = item.shadowOffsetX || 0;
      ctx.shadowOffsetY = item.shadowOffsetY || 0;
    }

    // Draw Background
    if (item.bgColor && item.bgColor !== "transparent") {
      ctx.fillStyle = item.bgColor;
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgWidth, bgHeight, item.bgRadius || 0);
      ctx.fill();
    }

    // Keep shadow active for text drawing if shadow is set, otherwise reset it
    if (!(item.shadowBlur > 0 || item.shadowOffsetX !== 0 || item.shadowOffsetY !== 0)) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Slice content if typewriter effect is active
    let contentToDraw = item.content || "";
    const isThumbnailMode = State.currentRoute === "/image";
    if (item.textEffect === "typewriter" && !isThumbnailMode) {
      const speed = item.typewriterSpeed || 15;
      let charCount = Math.floor(localTime * speed);
      
      const duration = clip ? clip.duration : Infinity;
      if (item.typewriterOut !== false && isFinite(duration)) {
        const eraseCount = Math.floor((duration - localTime) * speed);
        charCount = Math.min(charCount, eraseCount);
      }
      charCount = Math.max(0, charCount);
      contentToDraw = contentToDraw.slice(0, charCount);
      
      // If we sliced in the middle of a literal "\\n" (leaving a trailing backslash), trim it to avoid showing a stray backslash
      if (contentToDraw.endsWith("\\") && (item.content || "").charAt(charCount) === "n") {
        contentToDraw = contentToDraw.slice(0, -1);
      }
    }
    const linesToDraw = contentToDraw.split(/\n|\\n/);

    // Draw Lines
    linesToDraw.forEach((lineText, i) => {
      const lineWidth = measureEmojiText(ctx, lineText, fontSize);
      let x = centerX - maxWidth / 2;
      if (textAlign === "center") {
        x = centerX - lineWidth / 2;
      } else if (textAlign === "right") {
        x = centerX + maxWidth / 2 - lineWidth;
      }
      
      const y = bgY + padding + i * fontSize * lineHeight;
      
      if (item.textEffect === "wavy" && !isThumbnailMode) {
        const time = performance.now() / 1000;
        drawWavyEmojiText(
          ctx,
          lineText,
          x,
          y,
          fontSize,
          item.textColor || "#ffffff",
          item.strokeColor || "#000000",
          item.strokeWidth || 0,
          time,
          item.wavyAmplitude !== undefined ? item.wavyAmplitude : 6,
          item.wavyFrequency !== undefined ? item.wavyFrequency : 4,
          item.wavySpacing !== undefined ? item.wavySpacing : 0.15
        );
      } else {
        drawEmojiText(
          ctx, 
          lineText, 
          x, 
          y, 
          fontSize, 
          item.textColor || "#ffffff",
          item.strokeColor || "#000000",
          item.strokeWidth || 0
        );
      }
    });

    ctx.restore();
  },

  draw(ctx, w, h) {},

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === 'text');
    if (!selectedClip) {
      return m(
        "div",
        { class: "text-slate-500 text-xs italic text-center py-8" },
        "Select a text from the list to change settings",
      );
    }

    const isThumbnailMode = State.currentRoute === "/image";

    return m(
      "div",
      {
        class: "space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
      },
      [
        m("div", { class: "relative" }, [
          m("textarea", {
            id: "text-editor-" + selectedClip.id,
            value: selectedClip.settings.content,
            class:
              "w-full bg-slate-800 text-white text-xs p-2 rounded border border-slate-700 focus:border-blue-500 outline-none min-h-[60px] resize-y",
            oninput: (e) => (selectedClip.settings.content = e.target.value),
          }),
          m("div", { class: "flex items-center justify-between mt-1.5" }, [
            m("div", { class: "relative" }, [
              m("button", {
                class: `flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-slate-400 transition-all ${this.showCharBoxMap?.[selectedClip.id] ? "text-blue-400 border-blue-500/30" : ""}`,
                oncreate: (v) => {
                  this.charBoxTriggers = this.charBoxTriggers || {};
                  this.charBoxTriggers[selectedClip.id] = v.dom;
                },
                onclick: () => {
                  this.showCharBoxMap = this.showCharBoxMap || {};
                  this.showCharBoxMap[selectedClip.id] = !this.showCharBoxMap[selectedClip.id];
                }
              }, [
                m("i", { class: "icon-[ri--chat-smile-2-line] w-3 h-3" }),
                "Emoji & Chars"
              ]),
              this.showCharBoxMap?.[selectedClip.id] && m(CharBox, {
                trigger: this.charBoxTriggers?.[selectedClip.id],
                onSelect: (char) => {
                  const el = document.getElementById("text-editor-" + selectedClip.id);
                  if (el) {
                    const start = el.selectionStart;
                    const end = el.selectionEnd;
                    const text = selectedClip.settings.content;
                    selectedClip.settings.content = text.substring(0, start) + char + text.substring(end);
                    m.redraw();
                    // Reset cursor position after redraw
                    setTimeout(() => {
                      el.focus();
                      el.setSelectionRange(start + char.length, start + char.length);
                    }, 0);
                  } else {
                      selectedClip.settings.content += char;
                  }
                   this.showCharBoxMap[selectedClip.id] = false;
                 },
                 onClose: () => {
                   this.showCharBoxMap[selectedClip.id] = false;
                   m.redraw();
                 }
               })
             ]),
             m("p", { class: "text-[10px] text-slate-500" }, "Use \\n for multiple lines"),
           ]),
         ]),
        SharedTextSettings(null, -1, selectedClip.settings),
        SharedTransformSettings(null, -1, selectedClip.settings),
        !isThumbnailMode && SharedAnimationSettings(null, -1, selectedClip.settings),
      ]
    );
  },
};
