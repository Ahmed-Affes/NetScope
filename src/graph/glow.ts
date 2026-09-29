import { Texture } from "pixi.js";

// Cache generated textures so we never recreate them
const textureCache = new Map<string, Texture>();

/**
 * Creates a reusable radial gradient glow texture using an offscreen canvas.
 * @param color Hex number (e.g. 0x22d3ee)
 * @param radius Size of the texture circle
 */
export function createGlowTexture(color: number, radius = 48): Texture {
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
      0,
      radius,
      radius,
      radius
    );
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.5)`);
    grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.15)`);
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
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.4, "rgba(56, 189, 248, 0.8)");
    grad.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = Texture.from(canvas);
  textureCache.set(key, texture);
  return texture;
}
