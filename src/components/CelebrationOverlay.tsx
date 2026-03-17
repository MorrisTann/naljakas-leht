import { useEffect, useRef } from "react";
import { playCelebrationSound } from "../lib/audioUtils";

type CelebrationOverlayProps = {
  seconds: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
};

export function CelebrationOverlay({ seconds }: CelebrationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    playCelebrationSound();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#e84a5f", "#3d7dd8", "#2ea872", "#d4a02c", "#ff6b9d"];
    const particles: Particle[] = [];
    let spawnTimer = 0;

    const addFirework = (x: number, y: number) => {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const count = 40 + Math.floor(Math.random() * 30);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random();
        const speed = 2 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          life: 1,
        });
      }
    };

    let animationId: number;
    const animate = () => {
      ctx.fillStyle = "rgba(26,26,30,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      spawnTimer++;
      if (spawnTimer % 25 === 0) {
        const x = canvas.width * (0.2 + Math.random() * 0.6);
        const y = canvas.height * (0.3 + Math.random() * 0.3);
        addFirework(x, y);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= 0.012;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (particles.length > 0 || spawnTimer < 200) {
        animationId = requestAnimationFrame(animate);
      }
    };
    addFirework(canvas.width / 2, canvas.height * 0.4);
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="celebration-overlay">
      <canvas
        ref={canvasRef}
        className="celebration-canvas"
        aria-hidden
      />
      <div className="celebration-content">
        <h1 className="celebration-title">Võitsid {seconds} sekundit!</h1>
      </div>
    </div>
  );
}
