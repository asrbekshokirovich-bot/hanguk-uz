import { useRef, useState, useCallback, useEffect } from 'react';

const HD_COLS = 8;
const HD_ROWS = 4;
const TILE_SIZE = 512;
const HD_WIDTH = HD_COLS * TILE_SIZE;  // 4096
const HD_HEIGHT = HD_ROWS * TILE_SIZE; // 2048

/** Build the HD tile URL for a given tile number (1-based). */
function buildTileUrl(imagePath: string, tileNum: number): string {
  const lastSlash = imagePath.lastIndexOf('/');
  const lastSegment = imagePath.substring(lastSlash);
  return `https://map0.daumcdn.net/map_roadview${imagePath}${lastSegment}_${String(tileNum).padStart(2, '0')}.jpg`;
}

/** Build the low-res preview URL. */
function buildPreviewUrl(imagePath: string): string {
  return `https://map.daumcdn.net/map_roadview${imagePath}.jpg`;
}

export interface PanoEngineState {
  previewUrl: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imageLoaded: boolean;
  imageError: boolean;
  hdLoaded: boolean;
}

/**
 * Manages HD tile stitching with progressive loading.
 * Returns the preview URL immediately and a canvas ref for the stitched HD source.
 */
export function useHDTiles(imagePath: string) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [hdLoaded, setHdLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(() => buildPreviewUrl(imagePath));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const url = buildPreviewUrl(imagePath);
    setPreviewUrl(url);
    setImageLoaded(false);
    setImageError(false);
    setHdLoaded(false);

    const currentAbort = { aborted: false };

    // Load preview
    const previewImg = new Image();
    previewImg.crossOrigin = 'anonymous';
    previewImg.onload = () => { if (!currentAbort.aborted) setImageLoaded(true); };
    previewImg.onerror = () => { if (!currentAbort.aborted) { setImageError(true); setImageLoaded(true); } };
    previewImg.src = url;

    // Load HD tiles in parallel → draw directly to canvas
    const loadHDTiles = async () => {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      canvas.width = HD_WIDTH;
      canvas.height = HD_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const tilePromises: Promise<void>[] = [];

      for (let row = 0; row < HD_ROWS; row++) {
        for (let col = 0; col < HD_COLS; col++) {
          const tileNum = row * HD_COLS + col + 1;
          const tileUrl = buildTileUrl(imagePath, tileNum);

          tilePromises.push(
            new Promise<void>((resolve) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                if (!currentAbort.aborted) {
                  ctx.drawImage(img, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
                resolve();
              };
              img.onerror = () => resolve(); // gracefully skip missing tiles
              img.src = tileUrl;
            })
          );
        }
      }

      await Promise.all(tilePromises);

      if (!currentAbort.aborted) {
        setHdLoaded(true);
      }
    };

    loadHDTiles();

    return () => {
      currentAbort.aborted = true;
    };
  }, [imagePath]);

  return { previewUrl, canvasRef, imageLoaded, imageError, hdLoaded };
}

// ─── WebGL Equirectangular-to-Perspective Projection ───────────────────────

const VERT_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_panorama;
uniform float u_yaw;
uniform float u_pitch;
uniform float u_fov;
uniform float u_aspect;

const float PI = 3.14159265359;

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

void main() {
  float halfFov = u_fov * 0.5;
  float tanHalf = tan(halfFov);

  // Screen-space ray in camera space
  vec3 ray = normalize(vec3(
    (v_uv.x - 0.5) * 2.0 * tanHalf * u_aspect,
    (v_uv.y - 0.5) * 2.0 * tanHalf,
    -1.0
  ));

  // Rotate by pitch then yaw
  ray = rotX(u_pitch) * ray;
  ray = rotY(u_yaw) * ray;

  // Spherical coordinates to equirectangular UV
  float theta = atan(ray.x, -ray.z); // longitude
  float phi = asin(clamp(ray.y, -1.0, 1.0)); // latitude

  float u = theta / (2.0 * PI) + 0.5;
  float v = -phi / PI + 0.5;

  gl_FragColor = texture2D(u_panorama, vec2(u, v));
}
`;

interface GLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  uniforms: {
    yaw: WebGLUniformLocation;
    pitch: WebGLUniformLocation;
    fov: WebGLUniformLocation;
    aspect: WebGLUniformLocation;
  };
  textureReady: boolean;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initGL(canvas: HTMLCanvasElement): GLState | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  const vert = createShader(gl, gl.VERTEX_SHADER, VERT_SHADER);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER);
  if (!vert || !frag) return null;

  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }

  gl.useProgram(program);

  // Full-screen quad
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Texture
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uniforms = {
    yaw: gl.getUniformLocation(program, 'u_yaw')!,
    pitch: gl.getUniformLocation(program, 'u_pitch')!,
    fov: gl.getUniformLocation(program, 'u_fov')!,
    aspect: gl.getUniformLocation(program, 'u_aspect')!,
  };

  return { gl, program, texture, uniforms, textureReady: false };
}

/**
 * WebGL panorama renderer with rAF loop.
 * Reads yaw/pitch/zoom from refs for zero-lag rendering.
 * Issue 6: Uploads preview image as temporary texture immediately.
 * Issue 3: Invalidates texture on navigation (new previewUrl).
 */
export function usePanoramaGL(
  displayCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  hdSourceCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  hdLoaded: boolean,
  yawRef: React.RefObject<number>,
  pitchRef: React.RefObject<number>,
  zoomRef: React.RefObject<number>,
  previewUrl?: string,
  headingRef?: React.RefObject<number>,
) {
  const glStateRef = useRef<GLState | null>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(true);
  const previewUploadedRef = useRef<string>('');

  // Initialize GL context
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    const state = initGL(canvas);
    glStateRef.current = state;

    return () => {
      activeRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (state) {
        // Unbind textures and buffers before deleting
        state.gl.bindTexture(state.gl.TEXTURE_2D, null);
        state.gl.bindBuffer(state.gl.ARRAY_BUFFER, null);
        state.gl.useProgram(null);

        state.gl.deleteProgram(state.program);
        state.gl.deleteTexture(state.texture);

        // Problem 14: Explicitly lose WebGL context to free GPU resources quickly
        // This is crucial for rapid mount/unmount in React
        const loseCtx = state.gl.getExtension('WEBGL_lose_context');
        if (loseCtx) {
          loseCtx.loseContext();
        }
      }
      glStateRef.current = null;
    };
  }, [displayCanvasRef]);

  // Issue 6+3: Upload preview image as temporary texture immediately
  useEffect(() => {
    const state = glStateRef.current;
    if (!state || !previewUrl) return;

    // Invalidate old texture immediately (Issue 3)
    state.textureReady = false;
    previewUploadedRef.current = '';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const currentState = glStateRef.current;
      if (!currentState) return;
      // Only upload if HD hasn't loaded yet for this same panorama
      if (previewUploadedRef.current === previewUrl) return;

      const { gl, texture } = currentState;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      currentState.textureReady = true;
      previewUploadedRef.current = previewUrl;
    };
    img.src = previewUrl;
  }, [previewUrl]);

  // Upload HD texture when ready (overwrites preview)
  useEffect(() => {
    const state = glStateRef.current;
    const hdCanvas = hdSourceCanvasRef.current;
    if (!state || !hdLoaded || !hdCanvas) return;

    const { gl, texture } = state;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, hdCanvas);
    state.textureReady = true;
  }, [hdLoaded, hdSourceCanvasRef]);

  // rAF render loop
  useEffect(() => {
    activeRef.current = true;

    const renderFrame = () => {
      if (!activeRef.current) return;

      const state = glStateRef.current;
      const canvas = displayCanvasRef.current;
      if (state && state.textureReady && canvas) {
        const { gl, uniforms } = state;

        // Resize canvas to container
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }

        const yaw = (yawRef.current ?? 0) * Math.PI / 180;
        const headingRad = ((headingRef?.current ?? 0)) * Math.PI / 180;
        const pitch = (pitchRef.current ?? 0) * Math.PI / 180;
        const fov = (90 / (zoomRef.current ?? 1)) * Math.PI / 180;
        const aspect = w / h;

        // Subtract heading to align image center with its actual compass bearing
        gl.uniform1f(uniforms.yaw, -yaw);
        gl.uniform1f(uniforms.pitch, pitch);
        gl.uniform1f(uniforms.fov, fov);
        gl.uniform1f(uniforms.aspect, aspect);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    };

    rafRef.current = requestAnimationFrame(renderFrame);

    return () => {
      activeRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [displayCanvasRef, yawRef, pitchRef, zoomRef]);

  return { glAvailable: glStateRef };
}

// ─── Drag Inertia ──────────────────────────────────────────────────────────

/**
 * Drag inertia physics: tracks velocity in DEGREES during drag and applies
 * momentum after release. Friction tuned to 0.965 for smooth Kakao-like glide.
 */
export function useDragInertia(
  onYawDelta: (delta: number) => void,
  onPitchDelta: (delta: number) => void,
  pxToDegRef: React.RefObject<(px: number) => number>,
  onDecayFrame?: () => void,
) {
  const velocityRef = useRef({ x: 0, y: 0 }); // stored in degrees
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const isDecayingRef = useRef(false);

  const recordVelocity = useCallback((dx: number, dy: number) => {
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;
    if (dt > 0 && dt < 100) {
      const pxToDeg = pxToDegRef.current;
      const degX = pxToDeg ? pxToDeg(dx) : dx * 0.1;
      const degY = pxToDeg ? pxToDeg(dy) : dy * 0.1;
      const frameRate = 16 / dt;
      velocityRef.current.x = 0.7 * velocityRef.current.x + 0.3 * (degX * frameRate);
      velocityRef.current.y = 0.7 * velocityRef.current.y + 0.3 * (degY * frameRate);
    }
  }, [pxToDegRef]);

  const startDrag = useCallback(() => {
    isDecayingRef.current = false;
    velocityRef.current = { x: 0, y: 0 };
    lastTimeRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const endDrag = useCallback(() => {
    isDecayingRef.current = true;

    const decay = () => {
      const v = velocityRef.current;
      if (Math.abs(v.x) < 0.05 && Math.abs(v.y) < 0.05) {
        isDecayingRef.current = false;
        return;
      }

      onYawDelta(-v.x);
      onPitchDelta(-v.y);
      onDecayFrame?.();

      v.x *= 0.965;
      v.y *= 0.965;

      rafRef.current = requestAnimationFrame(decay);
    };
    rafRef.current = requestAnimationFrame(decay);
  }, [onYawDelta, onPitchDelta, onDecayFrame]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { recordVelocity, startDrag, endDrag, isDecayingRef };
}

// ─── Smooth Yaw Animation ──────────────────────────────────────────────────

/**
 * Smooth yaw animation: animates yaw from current to target over ~400ms.
 * Issue 1 fix: writes directly to yawRef for zero-lag rendering.
 */
export function useSmoothYaw(
  yawRef: React.MutableRefObject<number>,
  syncToState: () => void,
) {
  const rafRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);

  const cancelAnimation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    isAnimatingRef.current = false;
  }, []);

  const animateToYaw = useCallback((targetAngle: number) => {
    cancelAnimation();
    isAnimatingRef.current = true;

    const startTime = performance.now();
    const duration = 400;
    const startYaw = yawRef.current;
    let diff = targetAngle - startYaw;
    diff = ((diff + 540) % 360) - 180;

    const animate = (now: number) => {
      if (!isAnimatingRef.current) return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      yawRef.current = startYaw + diff * eased;

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        isAnimatingRef.current = false;
        syncToState();
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [yawRef, cancelAnimation, syncToState]);

  useEffect(() => {
    return () => cancelAnimation();
  }, [cancelAnimation]);

  return { animateToYaw, cancelAnimation, isAnimatingRef };
}

// ─── Preload ───────────────────────────────────────────────────────────────

/**
 * Preloads by keeping a preconnect to the Kakao CDN.
 */
export function usePreloadNextPano(
  links: Array<{ id: number; angle: number }>,
  imagePath: string,
) {
  useEffect(() => {
    if (links.length === 0) return;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://map0.daumcdn.net';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [links, imagePath]);
}
