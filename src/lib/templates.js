import { State } from "./state";
import m from "mithril";
import { loadGoogleFont } from "./fonts";

export const Templates = [
  {
    id: "midnight_jazz",
    name: "Midnight Jazz",
    description: "Deep blue vibes with heavy rain and soft circle visualizer.",
    icon: "icon-[ri--moon-clear-line]",
    settings: {
      clipSettings: {
        visualizer: { style: "circle", color: "#3b82f6", intensity: 0.6, density: 1.5, opacity: 1, rainbow: false },
        playlist: { textColor: "#94a3b8", fontFamily: "'Roboto Mono', monospace", fontSize: 16 },
        title: { textColor: "#f1f5f9", fontFamily: "'Playfair Display', serif", fontSize: 42 }
      },
      effectSettings: {
        rain: { enabled: true, intensity: 250, lightning: true },
        smoke: { enabled: true, intensity: 30 },
        kenburns: { enabled: true }
      },
      bgTransitionStyle: "fade"
    }
  },
  {
    id: "lofi_study",
    name: "Lofi Study",
    description: "Warm amber tones, simple bars, and subtle smoke.",
    icon: "icon-[ri--book-open-line]",
    settings: {
      clipSettings: {
        visualizer: { style: "bars", color: "#f59e0b", intensity: 0.4, density: 1.2, opacity: 0.8, rainbow: false },
        playlist: { textColor: "#ffffff", fontFamily: "'Inter', sans-serif", fontSize: 18 },
        title: { textColor: "#ffffff", fontFamily: "'Outfit', sans-serif", fontSize: 38 }
      },
      effectSettings: {
        rain: { enabled: false, lightning: false },
        smoke: { enabled: true, intensity: 45 },
        kenburns: { enabled: true }
      },
      bgTransitionStyle: "zoom"
    }
  },
  {
    id: "synth_wave",
    name: "Synthwave Night",
    description: "Neon rainbow colors with digital waveform and high energy.",
    icon: "icon-[ri--flashlight-line]",
    settings: {
      clipSettings: {
        visualizer: { style: "waveform", color: "#ff00ff", intensity: 1.2, density: 2, opacity: 1, rainbow: true },
        playlist: { textColor: "#00ffff", fontFamily: "'Righteous', cursive", fontSize: 18 },
        title: { textColor: "#ff00ff", fontFamily: "'Bungee', cursive", fontSize: 40 }
      },
      effectSettings: {
        rain: { enabled: false },
        smoke: { enabled: false },
        kenburns: { enabled: false }
      },
      bgTransitionStyle: "slide"
    }
  },
  {
    id: "forest_dream",
    name: "Forest Dream",
    description: "Soft green colors, organic movement, and peaceful atmosphere.",
    icon: "icon-[ri--leaf-line]",
    settings: {
      clipSettings: {
        visualizer: { style: "circle", color: "#10b981", intensity: 0.5, density: 1, opacity: 0.7, rainbow: false },
        playlist: { textColor: "#d1fae5", fontFamily: "'Lexend', sans-serif", fontSize: 17 },
        title: { textColor: "#ffffff", fontFamily: "'Outfit', sans-serif", fontSize: 36 }
      },
      effectSettings: {
        rain: { enabled: true, intensity: 100, lightning: false },
        smoke: { enabled: true, intensity: 20 },
        kenburns: { enabled: true }
      },
      bgTransitionStyle: "fade"
    }
  }
];

export const applyTemplate = (templateId) => {
  const template = Templates.find(t => t.id === templateId);
  if (!template) return;

  // Mutate existing settings objects to maintain references in Clips/Effects
  if (template.settings.clipSettings) {
    Object.keys(template.settings.clipSettings).forEach(clipId => {
      if (State.clipSettings[clipId]) {
        Object.assign(State.clipSettings[clipId], template.settings.clipSettings[clipId]);
        
        // Lazy load fonts if specified in template
        if (template.settings.clipSettings[clipId].fontFamily) {
          loadGoogleFont(template.settings.clipSettings[clipId].fontFamily);
        }
      }
    });
  }

  if (template.settings.effectSettings) {
    Object.keys(template.settings.effectSettings).forEach(effId => {
      if (State.effectSettings[effId]) {
        Object.assign(State.effectSettings[effId], template.settings.effectSettings[effId]);
      }
    });
  }

  if (template.settings.bgTransitionStyle) {
    State.bgTransitionStyle = template.settings.bgTransitionStyle;
  }

  // Trigger redraw
  m.redraw();
};
