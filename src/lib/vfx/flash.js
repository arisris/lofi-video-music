import { State } from "../state";
import { FlashSettingsView } from "../../components/clip-settings/vfx/flash";
import { getAudioReactivity } from "../../utils/helpers";

export const FlashVFX = {
  id: "flash",
  name: "Lightning Flash",
  icon: "icon-[ri--flashlight-line]",
  
  settings: {
    frequency: 0.5,
    audioReactive: false
  },

  drawItem(ctx, w, h, settings, localTime, clip) {
    if (clip.flashOpacity === undefined) {
      clip.flashOpacity = 0;
    }
    if (clip.flashCooldown === undefined) {
      clip.flashCooldown = 0;
    }

    if (clip.flashCooldown > 0) {
      clip.flashCooldown--;
    }

    if (settings.audioReactive) {
      const bassLevel = getAudioReactivity(State, "bass");
      const threshold = 0.85 - (settings.frequency || 0.5) * 0.35;
      
      if (bassLevel > threshold && clip.flashOpacity <= 0 && clip.flashCooldown === 0) {
        clip.flashOpacity = 0.2 + Math.random() * 0.3; // opacity of flash
        clip.flashCooldown = 30; // ~0.5s cooldown at 60fps
      }
    } else {
      // Trigger lightning flash randomly; frequency scales the probability
      const baseProbability = 0.002;
      const probability = baseProbability * (settings.frequency || 0.5) * 5;

      if (Math.random() < probability && clip.flashOpacity <= 0) {
        clip.flashOpacity = 0.2 + Math.random() * 0.3; // opacity of flash
      }
    }

    if (clip.flashOpacity > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${clip.flashOpacity})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      clip.flashOpacity -= 0.04; // Fade out quickly
    }
  },

  onSettings: FlashSettingsView,
};