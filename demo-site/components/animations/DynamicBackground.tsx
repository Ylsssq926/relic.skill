"use client";

import { useEffect, useRef } from "react";

const colors = [
  { r: 250, g: 248, b: 245 },
  { r: 217, g: 119, b: 6 },
  { r: 59, g: 130, b: 196 },
  { r: 243, g: 240, b: 236 },
];

class Orb {
  x: number;
  y: number;
  radius: number;
  color: { r: number; g: number; b: number };
  vx: number;
  vy: number;
  alpha: number;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = Math.random() * (width * 0.35) + (width * 0.15);
    this.color = colors[Math.floor(Math.random() * colors.length)]!;
    this.vx = (Math.random() - 0.5) * 0.25;
    this.vy = (Math.random() - 0.5) * 0.25;
    this.alpha = Math.random() * 0.18 + 0.06;
  }

  update(width: number, height: number) {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < -this.radius || this.x > width + this.radius) this.vx *= -1;
    if (this.y < -this.radius || this.y > height + this.radius) this.vy *= -1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius,
    );
    gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`);
    gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function DynamicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let orbs: Orb[] = [];

    const init = () => {
      width = window.innerWidth;
      height = document.documentElement.scrollHeight;
      canvas.width = width;
      canvas.height = height;

      orbs = [];
      const numOrbs = width < 768 ? 3 : 5;
      for (let i = 0; i < numOrbs; i++) {
        orbs.push(new Orb(width, height));
      }
    };

    const render = () => {
      ctx.fillStyle = "#FAF8F5";
      ctx.fillRect(0, 0, width, height);

      orbs.forEach(orb => {
        orb.update(width, height);
        orb.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener("resize", handleResize);
    init();
    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[-1] h-full w-full"
      aria-hidden="true"
    />
  );
}
