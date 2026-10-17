// Offscreen WebGL Renderer Helper for GPU-Accelerated VFX
// Strictly uses 2-space indentation and English comments.

let canvas = null;
let gl = null;
let quadBuffer = null;
let isSupportedCached = null;
const uniformLocationCache = new Map();

function getUniformLocation(gl, program, name) {
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

export const WebGLRenderer = {
  DEFAULT_VERTEX_SHADER: `
    attribute vec2 position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `,

  isSupported() {
    if (isSupportedCached !== null) return isSupportedCached;
    try {
      const testCanvas = document.createElement("canvas");
      isSupportedCached = !!(window.WebGLRenderingContext && 
        (testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl")));
      return isSupportedCached;
    } catch (e) {
      isSupportedCached = false;
      return false;
    }
  },

  init() {
    if (gl) return true;

    canvas = document.createElement("canvas");
    const glOpts = {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      preserveDrawingBuffer: true
    };

    gl = canvas.getContext("webgl", glOpts) || canvas.getContext("experimental-webgl", glOpts);
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

  compileProgram(vsSource, fsSource) {
    if (!this.init()) return null;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error("Vertex shader compile error:", gl.getShaderInfoLog(vs));
      gl.deleteShader(vs);
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("Fragment shader compile error:", gl.getShaderInfoLog(fs));
      gl.deleteShader(fs);
      gl.deleteShader(vs);
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  },

  drawQuad(program, uniforms, w, h) {
    if (!this.init()) return null;

    // Rescale WebGL canvas if dimensions changed
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Bind full screen quad vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const posAttr = gl.getAttribLocation(program, "position");
    if (posAttr !== -1) {
      gl.enableVertexAttribArray(posAttr);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);
    }

    // Set custom uniforms dynamically
    for (const [name, val] of Object.entries(uniforms)) {
      const loc = getUniformLocation(gl, program, name);
      if (loc === null) continue;

      if (typeof val === "number") {
        gl.uniform1f(loc, val);
      } else if (Array.isArray(val)) {
        if (val.length === 2) {
          gl.uniform2f(loc, val[0], val[1]);
        } else if (val.length === 3) {
          gl.uniform3f(loc, val[0], val[1], val[2]);
        } else if (val.length === 4) {
          gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
        }
      } else if (typeof val === "boolean") {
        gl.uniform1i(loc, val ? 1 : 0);
      }
    }

    // Render quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return canvas;
  }
};
