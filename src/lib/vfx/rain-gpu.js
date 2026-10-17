import m from "mithril";
import { State } from "../state";
import { getAudioReactivity } from "../../utils/helpers";
import { SliderControl, ToggleControl } from "./shared-controls";
import { WebGLRenderer } from "../webgl-renderer";

let rainProgram = null;

const RAIN_FRAGMENT_SHADER_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_intensity;
  uniform float u_speed;
  uniform float u_size;
  uniform float u_opacity;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;
    
    float columns = 20.0 + (u_intensity * 0.35);
    vec2 st = uv * vec2(columns * aspect, 15.0);
    
    st.y += u_time * 12.0 * u_speed;
    
    vec2 ipos = floor(st);
    vec2 fpos = fract(st);
    
    float colHash = hash(ipos.x);
    
    float speedOffset = colHash * 0.4 + 0.8;
    float yOffset = colHash * 200.0;
    
    float localY = st.y * speedOffset + yOffset;
    float tileLocalY = fract(localY);
    float idY = floor(localY);
    
    // Scatter drops horizontally within columns to break grid lines
    float xOffset = hash(ipos.x * 43.2 + idY * 71.3) * 0.6 - 0.3;
    
    // Randomize drop size and opacity for an organic look
    float dropSizeScale = hash(ipos.x * 89.1 + idY * 31.4) * 0.5 + 0.75;
    float dropOpacity = hash(ipos.x * 53.7 + idY * 19.3) * 0.5 + 0.5;
    
    float densityThreshold = 0.90;
    float cellHash = hash(ipos.x * 37.1 + idY * 11.3);
    float active = step(densityThreshold, cellHash);
    
    float colWidth = u_resolution.x / (columns * aspect);
    float thickness = clamp((1.2 * u_size * dropSizeScale) / colWidth, 0.02, 0.45);
    float xGlow = smoothstep(thickness, 0.0, abs(fpos.x - 0.5 - xOffset));
    
    float yGlow = smoothstep(1.0, 0.0, tileLocalY);
    
    float rainStrength = xGlow * yGlow * active * dropOpacity;
    
    gl_FragColor = vec4(1.0, 1.0, 1.0, rainStrength * u_opacity);
  }
`;

// Pre-compile shader program during module load to prevent block/stutter in the render loop
if (typeof window !== "undefined" && WebGLRenderer.isSupported()) {
  try {
    rainProgram = WebGLRenderer.compileProgram(
      WebGLRenderer.DEFAULT_VERTEX_SHADER,
      RAIN_FRAGMENT_SHADER_SRC
    );
    // Force GPU pipeline warmup to compile shaders to machine code & initialize WebGL state
    // before requestAnimationFrame loop runs
    if (rainProgram) {
      WebGLRenderer.drawQuad(rainProgram, {
        u_resolution: [1.0, 1.0],
        u_time: 0.0,
        u_intensity: 200.0,
        u_speed: 1.0,
        u_size: 1.0,
        u_opacity: 1.0
      }, 1, 1);
    }
  } catch (e) {
    console.error("Failed to pre-compile and warm up Rain GPU shader:", e);
  }
}

export const RainGPUVFX = {
  id: "rain_gpu",
  name: "Rain (GPU)",
  icon: "icon-[ri--rainy-line] text-blue-400",

  settings: {
    intensity: 200,
    speed: 1.0,
    size: 1.0,
    opacity: 1.0,
    audioReactive: false
  },

  drawItem(ctx, w, h, settings, localTime, clip) {
    const isSupported = WebGLRenderer.isSupported();
    if (!isSupported) {
      ctx.save();
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
      ctx.font = "12px monospace";
      ctx.fillText("WebGL not supported - Rain (GPU) Disabled", 20, h - 20);
      ctx.restore();
      return;
    }

    // Fallback compilation in case pre-compilation failed or environment was not ready
    if (!rainProgram) {
      rainProgram = WebGLRenderer.compileProgram(
        WebGLRenderer.DEFAULT_VERTEX_SHADER,
        RAIN_FRAGMENT_SHADER_SRC
      );
      if (!rainProgram) {
        console.error("[RainGPU] Failed to compile Rain GPU shader program.");
        return;
      }
    }

    // Keep track of a running animation clock so the rain falls continuously 
    // even when the timeline playback is paused (matching CPU behavior)
    const now = performance.now();
    if (clip.animTime === undefined) {
      clip.animTime = 0;
    } else {
      let dt = (now - (clip.lastRenderTime || now)) / 1000;
      dt = Math.min(dt, 0.1); // Cap delta time to prevent speed jumps
      clip.animTime += dt;
    }
    clip.lastRenderTime = now;

    const intensity = settings.intensity !== undefined ? settings.intensity : 200;
    const speed = settings.speed !== undefined ? settings.speed : 1.0;
    const size = settings.size !== undefined ? settings.size : 1.0;
    const opacity = settings.opacity !== undefined ? settings.opacity : 1.0;


    const uniforms = {
      u_resolution: [w, h],
      u_time: clip.animTime,
      u_intensity: intensity,
      u_speed: speed,
      u_size: size,
      u_opacity: opacity
    };

    if (settings.audioReactive) {
      const audioLevel = getAudioReactivity(State, "volume");
      uniforms.u_intensity = intensity * (0.25 + audioLevel * 0.75);
      uniforms.u_speed = speed * (0.4 + audioLevel * 1.6);
      uniforms.u_opacity = opacity * (0.3 + audioLevel * 0.7);
    }

    const webglCanvas = WebGLRenderer.drawQuad(rainProgram, uniforms, w, h);
    if (webglCanvas) {
      ctx.drawImage(webglCanvas, 0, 0);
    }
  },

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === 'rain_gpu');
    if (!selectedClip) return null;

    if (selectedClip.settings.intensity === undefined) selectedClip.settings.intensity = 200;
    if (selectedClip.settings.speed === undefined) selectedClip.settings.speed = 1.0;
    if (selectedClip.settings.size === undefined) selectedClip.settings.size = 1.0;
    if (selectedClip.settings.opacity === undefined) selectedClip.settings.opacity = 1.0;
    if (selectedClip.settings.audioReactive === undefined) selectedClip.settings.audioReactive = false;

    return m("div", { class: "space-y-4 animate-in fade-in duration-300" }, [
      m(ToggleControl, {
        label: "Audio Reactive",
        checked: selectedClip.settings.audioReactive,
        description: "Rain intensity, speed, and opacity will react to music volume",
        onchange: (e) => {
          selectedClip.settings.audioReactive = e.target.checked;
          m.redraw();
        }
      }),

      m(SliderControl, {
        label: `Rain Intensity: ${selectedClip.settings.intensity || 200}`,
        min: 50,
        max: 500,
        step: 10,
        value: selectedClip.settings.intensity || 200,
        minLabel: "Light",
        maxLabel: "Heavy",
        oninput: (e) => {
          selectedClip.settings.intensity = parseInt(e.target.value);
        }
      }),

      m(SliderControl, {
        label: `Fall Speed: ${Math.round(selectedClip.settings.speed * 100)}%`,
        min: 0.1,
        max: 3.0,
        step: 0.1,
        value: selectedClip.settings.speed,
        minLabel: "Slow",
        maxLabel: "Fast",
        oninput: (e) => {
          selectedClip.settings.speed = parseFloat(e.target.value);
        }
      }),

      m(SliderControl, {
        label: `Drop Size: ${Math.round(selectedClip.settings.size * 100)}%`,
        min: 0.2,
        max: 3.0,
        step: 0.1,
        value: selectedClip.settings.size,
        minLabel: "Thin/Short",
        maxLabel: "Thick/Long",
        oninput: (e) => {
          selectedClip.settings.size = parseFloat(e.target.value);
        }
      }),

      m(SliderControl, {
        label: `Rain Opacity: ${Math.round(selectedClip.settings.opacity * 100)}%`,
        min: 0.1,
        max: 1.0,
        step: 0.05,
        value: selectedClip.settings.opacity,
        minLabel: "Faint",
        maxLabel: "Solid",
        oninput: (e) => {
          selectedClip.settings.opacity = parseFloat(e.target.value);
        }
      })
    ]);
  }
};
