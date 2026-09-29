import { Container, Sprite } from "pixi.js";
import { createParticleTexture } from "./glow";

export interface Particle {
  sprite: Sprite;
  sourceId: string;
  targetId: string;
  progress: number; // 0.0 to 1.0
  speed: number;    // increment per frame
  active: boolean;
}

export class ParticleSystem {
  public container: Container;
  private pool: Particle[] = [];
  private activeCount = 0;
  private maxParticles = 2000;

  constructor() {
    this.container = new Container();
    const texture = createParticleTexture();

    // Pre-allocate particle pool
    for (let i = 0; i < this.maxParticles; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = 6;
      sprite.height = 6;
      sprite.visible = false;
      this.container.addChild(sprite);

      this.pool.push({
        sprite,
        sourceId: "",
        targetId: "",
        progress: 0,
        speed: 0.01,
        active: false,
      });
    }
  }

  /**
   * Spawns a particle between two nodes.
   */
  public spawn(
    sourceId: string,
    targetId: string,
    tint = 0x38bdf8,
    speed = 0.012
  ): void {
    if (this.activeCount >= this.maxParticles) return;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.sourceId = sourceId;
        p.targetId = targetId;
        p.progress = Math.random() * 0.1; // slight stagger
        p.speed = speed * (0.8 + Math.random() * 0.4);
        p.sprite.tint = tint;
        p.sprite.visible = true;
        this.activeCount++;
        break;
      }
    }
  }

  /**
   * Updates all active particles along link trajectories.
   */
  public update(nodePositions: Map<string, { x: number; y: number }>): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      const src = nodePositions.get(p.sourceId);
      const tgt = nodePositions.get(p.targetId);

      if (!src || !tgt) {
        p.active = false;
        p.sprite.visible = false;
        this.activeCount--;
        continue;
      }

      p.progress += p.speed;

      if (p.progress >= 1.0) {
        // Reset or loop
        p.progress = 0;
      }

      // Linear interpolation between source and target
      p.sprite.x = src.x + (tgt.x - src.x) * p.progress;
      p.sprite.y = src.y + (tgt.y - src.y) * p.progress;
    }
  }

  public clear(): void {
    for (const p of this.pool) {
      p.active = false;
      p.sprite.visible = false;
    }
    this.activeCount = 0;
  }
}
