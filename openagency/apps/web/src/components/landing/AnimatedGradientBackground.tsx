// @ts-nocheck
/*
 * AnimatedGradientBackground — Dark canvas with animated white/gray elements
 * Subtle floating particles, connecting lines, and soft radial glow.
 * Pure black background with white/gray animated elements.
 *
 * Props:
 *  - particleCount: number of floating particles (default 80)
 *  - speed: animation speed multiplier (default 1.0)
 *  - enabled: toggle to disable animation and show static fallback
 *  - glowIntensity: intensity of the central radial glow (0-1, default 0.08)
 *  - className: additional CSS classes
 */
import { useRef, useEffect, useCallback } from "react";

export interface GradientConfig {
  particleCount?: number;
  speed?: number;
  enabled?: boolean;
  glowIntensity?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulseSpeed: number;
  pulsePhase: number;
}

export default function AnimatedGradientBackground({
  particleCount = 80,
  speed = 1.0,
  enabled = true,
  glowIntensity = 0.08,
  className = "",
}: GradientConfig) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1, y: -1 });
  const timeRef = useRef(0);

  const initParticles = useCallback((w: number, h: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3 * speed,
        vy: (Math.random() - 0.5) * 0.3 * speed,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        pulseSpeed: Math.random() * 0.02 + 0.005,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, [particleCount, speed]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cw = w * dpr;
    const ch = h * dpr;

    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      ctx.scale(dpr, dpr);
      initParticles(w, h);
    }

    timeRef.current += 0.016 * speed;
    const t = timeRef.current;

    // Clear with solid black
    ctx.fillStyle = "#09090B";
    ctx.fillRect(0, 0, w, h);

    // Subtle radial glow at top-center (like LaunchUI hero)
    const glowGrad = ctx.createRadialGradient(w * 0.5, h * 0.15, 0, w * 0.5, h * 0.15, w * 0.6);
    glowGrad.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity})`);
    glowGrad.addColorStop(0.5, `rgba(255, 255, 255, ${glowIntensity * 0.3})`);
    glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // Secondary subtle glow at bottom-right
    const glow2 = ctx.createRadialGradient(w * 0.8, h * 0.85, 0, w * 0.8, h * 0.85, w * 0.4);
    glow2.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity * 0.4})`);
    glow2.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, w, h);

    const particles = particlesRef.current;
    const connectionDist = 120;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    // Update and draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      // Mouse interaction — gentle push away
      if (mx >= 0 && my >= 0) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150 * 0.02;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      // Dampen velocity
      p.vx *= 0.999;
      p.vy *= 0.999;

      // Pulse opacity
      const pulseOpacity = p.opacity + Math.sin(t * p.pulseSpeed * 60 + p.pulsePhase) * 0.1;
      const finalOpacity = Math.max(0.05, Math.min(0.5, pulseOpacity));

      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
      ctx.fill();

      // Draw connections to nearby particles
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connectionDist) {
          const lineOpacity = (1 - dist / connectionDist) * 0.08;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Animated grid lines (very subtle)
    ctx.strokeStyle = `rgba(255, 255, 255, 0.02)`;
    ctx.lineWidth = 0.5;
    const gridSize = 80;
    const gridOffset = (t * 8) % gridSize;
    for (let x = -gridSize + gridOffset; x < w + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = -gridSize + gridOffset * 0.5; y < h + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    animFrameRef.current = requestAnimationFrame(render);
  }, [speed, glowIntensity, initParticles]);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1, y: -1 };
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [enabled, render]);

  // Static fallback
  if (!enabled) {
    return (
      <div className={`absolute inset-0 ${className}`}>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 50% 15%, rgba(255,255,255,0.06) 0%, transparent 60%),
              radial-gradient(ellipse 40% 30% at 80% 85%, rgba(255,255,255,0.03) 0%, transparent 60%),
              #09090B
            `,
          }}
        />
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      />
    </div>
  );
}
