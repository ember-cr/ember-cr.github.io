import { useEffect, useRef } from "react";

/**
 * Full-screen WebGL2 "liquid glass" shader overlay.
 * Renders an animated, mouse-reactive refraction/caustics pattern that sits
 * above the background blobs but below all UI. Pointer-events: none.
 *
 * Falls back silently (renders nothing) if WebGL2 isn't available.
 */
export default function LiquidGlass({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
    if (!gl) return; // graceful fallback

    const vertSrc = `#version 300 es
      in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    // Animated liquid glass: layered domain-warped noise + radial mouse lens +
    // chromatic-ish color split, output as translucent highlights.
    const fragSrc = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 outColor;
      uniform float u_time;
      uniform vec2  u_res;
      uniform vec2  u_mouse;

      // Hash + value noise
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++){
          v += a * noise(p);
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = v_uv;
        vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
        float t = u_time * 0.18;

        // Domain warp for "liquid" feel
        vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 7.3));
        vec2 r = vec2(
          fbm(p * 2.1 + 1.8 * q + vec2(1.7, 9.2) + t * 0.7),
          fbm(p * 2.1 + 1.8 * q + vec2(8.3, 2.8) - t * 0.5)
        );
        float n = fbm(p * 2.2 + 2.4 * r);

        // Radial lens around mouse
        vec2 mp = (u_mouse - 0.5) * vec2(u_res.x / u_res.y, 1.0);
        float d = distance(p, mp);
        float lens = smoothstep(0.85, 0.0, d);
        n = mix(n, n + 0.35 * sin(d * 18.0 - u_time * 1.6), lens * 0.9);

        // Glassy highlights — bright thin caustics
        float highlight = pow(smoothstep(0.55, 0.95, n), 3.0);
        float rim       = pow(smoothstep(0.35, 0.55, n), 2.0) * 0.35;

        // Soft chromatic split
        vec3 tint = vec3(
          0.85 + 0.15 * sin(u_time * 0.5 + 0.0),
          0.85 + 0.15 * sin(u_time * 0.5 + 2.1),
          0.95 + 0.05 * sin(u_time * 0.5 + 4.2)
        );
        vec3 col = tint * (highlight + rim);

        // Subtle blue-violet base wash so it reads as glass on light bg
        col += vec3(0.05, 0.07, 0.12) * rim;

        // Final alpha — keeps UI readable
        float alpha = clamp(highlight * 0.55 + rim * 0.25 + lens * 0.08, 0.0, 0.7);
        outColor = vec4(col, alpha);
      }
    `;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(prog));
      return;
    }

    // Fullscreen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const locPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

    const uTime  = gl.getUniformLocation(prog, "u_time");
    const uRes   = gl.getUniformLocation(prog, "u_res");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = 1.0 - e.clientY / window.innerHeight;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      mouseRef.current.x = t.clientX / window.innerWidth;
      mouseRef.current.y = 1.0 - t.clientY / window.innerHeight;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });

    const start = performance.now();
    const frame = () => {
      const t = (performance.now() - start) / 1000;
      gl.useProgram(prog);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[1] pointer-events-none mix-blend-screen"
    />
  );
}