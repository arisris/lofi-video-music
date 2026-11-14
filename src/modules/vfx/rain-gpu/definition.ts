import { getAudioLevel } from "../../audio/audio-engine";
import {
  WebGLRenderer,
  type UniformValue,
} from "../../../shared/lib/webgl-renderer";
import type { VfxDefinition } from "../_core/types";

// GPU rain shader
let rainProgram: WebGLProgram | null = null;

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

    float xOffset = hash(ipos.x * 43.2 + idY * 71.3) * 0.6 - 0.3;

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

if (typeof window !== "undefined" && WebGLRenderer.isSupported()) {
  try {
    rainProgram = WebGLRenderer.compileProgram(
      WebGLRenderer.DEFAULT_VERTEX_SHADER,
      RAIN_FRAGMENT_SHADER_SRC,
    );
    if (rainProgram) {
      WebGLRenderer.drawQuad(
        rainProgram,
        {
          u_resolution: [1.0, 1.0],
          u_time: 0.0,
          u_intensity: 200.0,
          u_speed: 1.0,
          u_size: 1.0,
          u_opacity: 1.0,
        },
        1,
        1,
      );
    }
  } catch (e) {
    console.error("Failed to pre-compile Rain GPU shader:", e);
  }
}

export const rainGpuVfx: VfxDefinition = {
  type: "rain_gpu",
  name: "Rain (GPU)",
  icon: "icon-[ri--rainy-line]",
  defaultSettings: {
    intensity: 200,
    speed: 1,
    size: 1,
    opacity: 1,
    audioReactive: false,
  },
  schema: [
    {
      key: "intensity",
      label: "Intensity",
      kind: "slider",
      min: 0,
      max: 600,
      step: 10,
    },
    {
      key: "speed",
      label: "Speed",
      kind: "slider",
      min: 0.1,
      max: 3,
      step: 0.1,
    },
    { key: "size", label: "Size", kind: "slider", min: 0.2, max: 3, step: 0.1 },
    {
      key: "opacity",
      label: "Opacity",
      kind: "slider",
      min: 0,
      max: 1,
      step: 0.05,
    },
    { key: "audioReactive", label: "Audio reactive", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings, state }) {
    if (!WebGLRenderer.isSupported()) {
      ctx.save();
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
      ctx.font = "12px monospace";
      ctx.fillText("WebGL not supported - Rain (GPU) Disabled", 20, h - 20);
      ctx.restore();
      return;
    }
    if (!rainProgram && !state.shaderFailed) {
      rainProgram = WebGLRenderer.compileProgram(
        WebGLRenderer.DEFAULT_VERTEX_SHADER,
        RAIN_FRAGMENT_SHADER_SRC,
      );
      // compileProgram already logs the error once — remember the failure so
      // we don't spam the console on every frame.
      if (!rainProgram) state.shaderFailed = true;
      if (!rainProgram) return;
    }
    if (!rainProgram) return;

    const now = performance.now();
    if (typeof state.animTime !== "number") {
      state.animTime = 0;
    } else {
      const dt = Math.min(
        (now - (typeof state.last === "number" ? state.last : now)) / 1000,
        0.1,
      );
      state.animTime = (state.animTime as number) + dt;
    }
    state.last = now;

    const intensity =
      typeof settings.intensity === "number" ? settings.intensity : 200;
    const speed = typeof settings.speed === "number" ? settings.speed : 1;
    const size = typeof settings.size === "number" ? settings.size : 1;
    const opacity = typeof settings.opacity === "number" ? settings.opacity : 1;

    const uniforms: Record<string, UniformValue> = {
      u_resolution: [w, h],
      u_time: state.animTime as number,
      u_intensity: intensity,
      u_speed: speed,
      u_size: size,
      u_opacity: opacity,
    };
    if (settings.audioReactive) {
      const level = getAudioLevel("volume");
      uniforms.u_intensity = intensity * (0.25 + level * 0.75);
      uniforms.u_speed = speed * (0.4 + level * 1.6);
      uniforms.u_opacity = opacity * (0.3 + level * 0.7);
    }
    const canvas = WebGLRenderer.drawQuad(rainProgram, uniforms, w, h);
    if (canvas) ctx.drawImage(canvas, 0, 0);
  },
};
