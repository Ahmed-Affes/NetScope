import { Texture } from "pixi.js";

// Cache generated textures
const textureCache = new Map<string, Texture>();

/**
 * Creates a sleek neon cyber glow texture using an offscreen canvas.
 * Produces crisp neon haloes without blowing out into blinding white fog.
 */
export function createGlowTexture(color: number, radius = 32): Texture {
  const key = `${color}_${radius}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const canvas = document.createElement("canvas");
  const size = radius * 2;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;

    const grad = ctx.createRadialGradient(
      radius,
      radius,
      radius * 0.25,
      radius,
      radius,
      radius
    );
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
    grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.35)`);
    grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.1)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = Texture.from(canvas);
  textureCache.set(key, texture);
  return texture;
}

/**
 * Creates a soft particle texture for link particle animations.
 */
export function createParticleTexture(): Texture {
  const key = "particle_texture";
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const canvas = document.createElement("canvas");
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const grad = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.4, "rgba(0, 242, 254, 0.8)");
    grad.addColorStop(1, "rgba(0, 242, 254, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = Texture.from(canvas);
  textureCache.set(key, texture);
  return texture;
}
