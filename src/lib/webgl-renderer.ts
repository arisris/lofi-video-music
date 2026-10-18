// Offscreen WebGL Renderer Helper for GPU-Accelerated VFX
// Strictly uses 2-space indentation and English comments.

let canvas: HTMLCanvasElement | null = null;
let gl: WebGLRenderingContext | null = null;
let quadBuffer: WebGLBuffer | null = null;
let isSupportedCached: boolean | null = null;
const uniformLocationCache = new Map<WebGLProgram, Record<string, WebGLUniformLocation | null>>();

function getUniformLocation(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  let programCache = uniformLocationCache.get(program);
  if (!programCache) {
    programCache = {};
    uniformLocationCache.set(program, programCache);
  }
  if (programCache[name] === undefined) {
    programCache[name] = gl.getUniformLocation(program, name);
  }
  return programCache[name];
}

export type UniformValue = number | boolean | number[];

export const WebGLRenderer = {
  DEFAULT_VERTEX_SHADER: `
    attribute vec2 position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `,

  isSupported(): boolean {
    if (isSupportedCached !== null) return isSupportedCached;
    try {
      const testCanvas = document.createElement("canvas");
      isSupportedCached = !!(
        window.WebGLRenderingContext &&
        (testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl"))
      );
      return isSupportedCached;
    } catch (e) {
      isSupportedCached = false;
      return false;
    }
  },

  init(): boolean {
    if (gl) return true;

    canvas = document.createElement("canvas");
    const glOpts = {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    };

    gl = (canvas.getContext("webgl", glOpts) ||
      (canvas.getContext("experimental-webgl", glOpts) as WebGLRenderingContext | null)) as
      | WebGLRenderingContext
      | null;
    if (!gl) {
      console.error("Unable to initialize WebGL context.");
      return false;
    }

    // Create full screen quad buffer (-1 to 1 bounds)
    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);

    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    return true;
  },

  /**
   * The raw context, for callers that need texture management on top of the
   * quad path. drawQuad owns uniforms and the draw call; texture work has to
   * run on this same context, before it.
   */
  getContext(): WebGLRenderingContext | null {
    return this.init() ? gl : null;
  },

  compileProgram(vsSource: string, fsSource: string): WebGLProgram | null {
    if (!this.init()) return null;
    const g = gl as WebGLRenderingContext;

    const vs = g.createShader(g.VERTEX_SHADER);
    if (!vs) return null;
    g.shaderSource(vs, vsSource);
    g.compileShader(vs);
    if (!g.getShaderParameter(vs, g.COMPILE_STATUS)) {
      console.error("Vertex shader compile error:", g.getShaderInfoLog(vs));
      g.deleteShader(vs);
      return null;
    }

    const fs = g.createShader(g.FRAGMENT_SHADER);
    if (!fs) {
      g.deleteShader(vs);
      return null;
    }
    g.shaderSource(fs, fsSource);
    g.compileShader(fs);
    if (!g.getShaderParameter(fs, g.COMPILE_STATUS)) {
      console.error("Fragment shader compile error:", g.getShaderInfoLog(fs));
      g.deleteShader(fs);
      g.deleteShader(vs);
      return null;
    }

    const program = g.createProgram();
    if (!program) return null;
    g.attachShader(program, vs);
    g.attachShader(program, fs);
    g.linkProgram(program);

    if (!g.getProgramParameter(program, g.LINK_STATUS)) {
      console.error("Program link error:", g.getProgramInfoLog(program));
      return null;
    }

    return program;
  },

  /**
   * Grows the backing canvas to `w` x `h`, but only when it actually differs.
   *
   * Assigning to canvas.width reallocates the drawing buffer, so a caller that
   * resizes per draw pays that cost every frame. Callers that draw several
   * quads of different sizes into one shared canvas should size it once to the
   * destination and use drawQuadAt for each region instead.
   */
  ensureSize(w: number, h: number): boolean {
    if (!this.init()) return false;
    if (!canvas) return false;
    const tw = Math.max(1, Math.round(w));
    const th = Math.max(1, Math.round(h));
    if (canvas.width === tw && canvas.height === th) return true;
    canvas.width = tw;
    canvas.height = th;
    return true;
  },

  getCanvas(): HTMLCanvasElement | null {
    return this.init() ? canvas : null;
  },

  /**
   * Draws the quad into one rectangle of the shared canvas.
   *
   * The rectangle is clipped by both the viewport and the scissor box, and the
   * clear is scissored to match, so consecutive draws into different regions
   * cannot leak into each other. `y` is measured from the bottom, as WebGL
   * measures it, unlike every other coordinate in this codebase.
   */
  drawQuadAt(
    program: WebGLProgram,
    uniforms: Record<string, UniformValue>,
    x: number,
    y: number,
    w: number,
    h: number,
    intUniforms?: Record<string, number>,
  ): HTMLCanvasElement | null {
    if (!this.init() || !canvas) return null;
    const g = gl as WebGLRenderingContext;

    // A region partly off-canvas still has to produce a valid scissor box.
    const rx = Math.max(0, Math.min(Math.round(x), canvas.width));
    const ry = Math.max(0, Math.min(Math.round(y), canvas.height));
    const rw = Math.max(0, Math.min(Math.round(x + w), canvas.width) - rx);
    const rh = Math.max(0, Math.min(Math.round(y + h), canvas.height) - ry);
    if (rw === 0 || rh === 0) return canvas;

    g.viewport(rx, ry, rw, rh);
    g.enable(g.SCISSOR_TEST);
    g.scissor(rx, ry, rw, rh);
    g.clearColor(0.0, 0.0, 0.0, 0.0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.disable(g.SCISSOR_TEST);

    g.useProgram(program);

    // Bind full screen quad vertices
    if (quadBuffer) {
      g.bindBuffer(g.ARRAY_BUFFER, quadBuffer);
    }
    const posAttr = g.getAttribLocation(program, "position");
    if (posAttr !== -1) {
      g.enableVertexAttribArray(posAttr);
      g.vertexAttribPointer(posAttr, 2, g.FLOAT, false, 0, 0);
    }

    for (const [name, val] of Object.entries(uniforms)) {
      const loc = getUniformLocation(g, program, name);
      if (loc === null) continue;

      if (typeof val === "number") {
        g.uniform1f(loc, val);
      } else if (Array.isArray(val)) {
        if (val.length === 2) {
          g.uniform2f(loc, val[0], val[1]);
        } else if (val.length === 3) {
          g.uniform3f(loc, val[0], val[1], val[2]);
        } else if (val.length === 4) {
          g.uniform4f(loc, val[0], val[1], val[2], val[3]);
        }
      } else if (typeof val === "boolean") {
        g.uniform1i(loc, val ? 1 : 0);
      }
    }

    // Render quad
    if (intUniforms) {
      for (const [name, val] of Object.entries(intUniforms)) {
        const loc = getUniformLocation(g, program, name);
        if (loc !== null) g.uniform1i(loc, val);
      }
    }

    g.drawArrays(g.TRIANGLES, 0, 6);

    return canvas;
  },

  /**
   * Convenience wrapper for drawing across the whole canvas. Kept for callers
   * that own the full surface; prefer ensureSize + drawQuadAt when several
   * quads of different sizes share one canvas.
   */
  drawQuad(
    program: WebGLProgram,
    uniforms: Record<string, UniformValue>,
    w: number,
    h: number,
    intUniforms?: Record<string, number>,
  ): HTMLCanvasElement | null {
    if (!this.ensureSize(w, h)) return null;
    return this.drawQuadAt(program, uniforms, 0, 0, w, h, intUniforms);
  },
};
