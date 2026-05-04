import { useEffect, useRef } from "react";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Animated gradient background that subtly follows mouse / touch position.
 * Uses CSS variables (--mx, --my in range -1..1) updated via rAF — no React re-renders.
 */
export default function AnimatedBackground() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const { prefs } = usePreferences();
  const parallaxOff = prefs.disableParallax || prefs.reduceMotion;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (parallaxOff) {
      el.style.setProperty("--mx", "0");
      el.style.setProperty("--my", "0");
      return;
    }

    const tick = () => {
      // Ease toward target for smoothness
      current.current.x += (target.current.x - current.current.x) * 0.06;
      current.current.y += (target.current.y - current.current.y) * 0.06;
      el.style.setProperty("--mx", current.current.x.toFixed(3));
      el.style.setProperty("--my", current.current.y.toFixed(3));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    const setFromPoint = (clientX: number, clientY: number) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      target.current.x = (clientX / w) * 2 - 1; // -1..1
      target.current.y = (clientY / h) * 2 - 1;
    };

    const onMouse = (e: MouseEvent) => setFromPoint(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setFromPoint(t.clientX, t.clientY);
    };

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchstart", onTouch);
    };
  }, [parallaxOff]);

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 z-0 pointer-events-none bg-parallax"
      style={{ ["--mx" as any]: 0, ["--my" as any]: 0 }}
    >
      <div className="absolute inset-0 bg-aurora parallax-aurora opacity-60" />
      <div className="parallax-layer parallax-strong absolute -top-40 -left-20 w-[520px] h-[520px]">
        <div className="bg-blob bg-blob-a w-full h-full rounded-full bg-primary/40 blur-3xl" />
      </div>
      <div className="parallax-layer parallax-medium absolute top-1/3 -right-32 w-[560px] h-[560px]">
        <div className="bg-blob bg-blob-b w-full h-full rounded-full bg-accent/35 blur-3xl" />
      </div>
      <div className="parallax-layer parallax-soft absolute top-1/2 left-1/2 w-[460px] h-[460px] -translate-x-1/2 -translate-y-1/2">
        <div className="bg-blob bg-blob-c w-full h-full rounded-full bg-violet/30 blur-3xl" />
      </div>
    </div>
  );
}