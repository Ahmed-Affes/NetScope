# Contributing to NetScope

Thank you for your interest in contributing to **NetScope**!

---

## 1. Development Prerequisites

- **Node.js:** v20+ or v24+
- **pnpm:** v9+ or v12+
- **Rust Toolchain:** `rustc` and `cargo` v1.80+
- **Tauri Prerequisites:** System C++ build tools and OS dependencies (see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/))

---

## 2. Setup & Development Workflow

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ahmed-Affes/NetScope.git
   cd NetScope
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Run in Web Simulator Mode (Zero native compile needed):**
   ```bash
   pnpm dev
   ```
   Open `http://localhost:5173` to interact with the full cyber-ops HUD and 60 FPS simulator.

4. **Run Native Desktop Shell (Tauri 2):**
   ```bash
   pnpm tauri dev
   ```

5. **Run Tests & Verification:**
   ```bash
   pnpm test          # Vitest store & delta tests
   pnpm build         # TypeScript typecheck & production bundle
   ```

---

## 3. Git Commit Conventions

We follow Conventional Commits:
- `feat(...)`: New features
- `fix(...)`: Bug fixes
- `test(...)`: Adding or updating test suites
- `docs(...)`: Documentation updates
- `phase N: <title>`: Milestone delivery commits

---

## 4. Code Standards

- **TypeScript:** Strict mode enabled (`tsconfig.json`). Zero implicit `any`.
- **Canvas Rendering:** PixiJS rendering must execute imperatively outside React state loops.
- **Physics:** Heavy graph force calculations must run in `src/graph/layout.worker.ts`.
