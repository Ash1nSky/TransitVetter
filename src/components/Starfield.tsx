import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  tw: number;
  hue: number;
}

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;
    let t = 0;
    const shooting: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.min(520, Math.floor((w * h) / 3200));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        r: Math.random() * 1.3 + 0.2,
        tw: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.15 ? 210 : Math.random() < 0.1 ? 35 : 0,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + s.z * 1.6) + s.tw);
        const alpha = (0.35 + s.z * 0.65) * tw;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.7 + s.z * 0.6), 0, Math.PI * 2);
        if (s.hue === 210) ctx.fillStyle = `rgba(170,205,255,${alpha})`;
        else if (s.hue === 35) ctx.fillStyle = `rgba(255,220,170,${alpha})`;
        else ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
        // slow drift (parallax)
        s.x -= 0.02 * (0.3 + s.z);
        if (s.x < -2) s.x = w + 2;
      }
      // occasional shooting star
      if (Math.random() < 0.004 && shooting.length < 2) {
        shooting.push({ x: Math.random() * w, y: Math.random() * h * 0.5, vx: 6 + Math.random() * 4, vy: 3 + Math.random() * 2, life: 1 });
      }
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 8, s.y - s.vy * 8);
        grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 8, s.y - s.vy * 8);
        ctx.stroke();
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.02;
        if (s.life <= 0) shooting.splice(i, 1);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 -z-20 bg-[#03040c]" />
      <div className="nebula fixed inset-0 -z-10 pointer-events-none" />
      <canvas ref={ref} className="fixed inset-0 -z-10 pointer-events-none" />
    </>
  );
}
