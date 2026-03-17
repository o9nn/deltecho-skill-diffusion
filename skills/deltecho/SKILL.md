---
name: deltecho
description: "Orchestration framework for creating cognitive DeltaChat bots with Live2D avatars and Deep Tree Echo autonomy. Use for building bots with AI features, RAG knowledge bases, conversational state tracking (Reservoir Computing), multi-account support, and introspective capabilities. Triggers on: deltecho, DeltaChat bot, deltachat orchestration, cognitive chat bot, ReZorg DeltaChat, Live2D avatar, Deep Tree Echo."
---

# deltecho: Cognitive DeltaChat Bot Orchestration

This skill provides a comprehensive framework for building, orchestrating, and managing intelligent DeltaChat bots within a modern TypeScript/React architecture. It synthesizes multiple cognitive architecture skills (`echo-introspect`, `ec9o`, `unreal-echo`, `live2d-avatar`) into a practical toolset for creating bots that can reason, remember, learn, and express themselves through a Live2D avatar.

## Core Architecture

The `deltecho` framework is a monorepo with a layered architecture:

| Layer | Package | Purpose |
| :--- | :--- | :--- |
| **0. Core** | `@deltecho/core` | Low-level communication with the DeltaChat network via `deltachat-rpc-client`. |
| **1. Frontend** | `@deltecho/frontend` | The main React-based user interface. |
| **2. Avatar** | `@deltecho/avatar` | Live2D Cubism avatar integration, expression mapping, and rendering. |
| **3. Cognitive** | `@deltecho/cognitive` | Unified cognitive interface for reasoning, memory, and persona. |
| **4. Orchestrator** | `deep-tree-echo-orchestrator` | High-level event handling, command routing, and agentic loop. |

## Deployment Architecture

The production deployment uses **Cloudflare Containers** with a Worker proxy:

| Component | Role |
| :--- | :--- |
| **Worker** (`worker.ts`) | Auth, LLM proxy, cognitive KV API, WebSocket upgrade, routes to container |
| **Container** (Docker) | Full browser target server with deltachat-rpc-server binary |
| **KV** (`DTE_KV`) | Cognitive state persistence (endocrine, memory, config) |
| **R2** (`DTE_R2`) | Long-term echo memory archive |

**Production URL**: `https://deltecho-chat-preview.dan-cdc.workers.dev/`

**Deploy pipeline**: Push to `main` triggers `.github/workflows/deploy-cloudflare.yml` which builds Docker image, pushes to Cloudflare registry, and deploys via `wrangler deploy`.

## Workflow: Building a Cognitive Bot

### Step 1: Set Up the Development Environment

```bash
gh repo clone ReZorg/deltecho
cd deltecho
pnpm install --frozen-lockfile
pnpm build:ordered  # Build workspace packages in dependency order
```

### Step 2: Run the Development Server

```bash
pnpm build:browser  # Build the browser target
pnpm start:browser  # Start the server
```

### Step 3: Enable Deep Tree Echo Autonomy

The `DTESimulation` class in `DeepTreeEchoHub.tsx` runs an autonomous cognitive loop by default. The LLM integration uses a proxy through the worker:

- **LLM Chat**: `POST /backend-api/llm/chat` (proxied to OpenAI-compatible API)
- **DreamGen Completions**: `POST /backend-api/dreamgen/completions`
- **DreamGen Narrative**: `POST /backend-api/dreamgen/narrative`
- **Cognitive State**: `GET/POST /backend-api/cognitive/*` (KV-backed)

### Step 4: Integrate the Live2D Avatar

Model files are in `packages/frontend/static/models/miara/`. The avatar pipeline:

1. `Live2DAvatar` React component creates a `Live2DAvatarManager`
2. Manager creates `PixiLive2DRenderer` which initializes PixiJS + pixi-live2d-display
3. Cubism Core WASM loads from `live2dcubismcore.min.js` (in static/)
4. Model files loaded via XHR from `/models/miara/miara_pro_t03.model3.json`
5. Expression/motion driven by `EndocrineExpressionBridge` and cognitive state

## Performance & Known Issues

### Live2D Cubism4 Console.log Recursion Crash (CRITICAL - Fixed)

**Symptom**: Live2D avatar fails to load in the bundled app but works in the standalone test page (`avatar-test-v2.html`). Falls back to sprite avatar after 60s timeout.

**Root Cause**: There are TWO logging paths in the Cubism4 stack:
1. **Core SDK**: `Live2DCubismCore.Logging.csmSetLogFunction(fn)`
2. **Framework**: `CubismFramework.startUp({ logFunction: console.log })`

The `startUpCubism4()` function passes `console.log` directly as the framework's `logFunction`. When `console.log` has been wrapped by DeltaChat's error boundary, browser extensions, or debugging tools, this causes infinite recursion and a "Maximum call stack size exceeded" crash. The `cubism4Ready()` function retries 20 times but all fail.

**Fix (commit dc7775d)**: Two-layer defense:
1. **Build-time** (`cubismPatchPlugin` in `build-frontend-ts.mjs`): Replaces `logFunction: console.log` with `logFunction: function() {}` in the pixi-live2d-display source before bundling
2. **Runtime** (`patchCubismStartup()` in `pixi-live2d-renderer.ts`): Intercepts `csmSetLogFunction` to always use `safeLog`, and directly sets the safe logger on the Core SDK

### Live2D Cubism Core WASM Race Condition (Fixed)

**Symptom**: "Live2D Failed" error on first load.

**Root Cause**: `pixi-live2d-display` checks `window.Live2DCubismCore` at module level. When esbuild bundles the app, this check runs before WASM initialization completes.

**Fix**: The `cubismPatchPlugin` converts the fatal `throw new Error(...)` into `console.warn(...)`. The `PixiLive2DRenderer.waitForCubismCore()` polls for WASM readiness before loading.

### CSP Configuration

The `main.html` CSP must include:
- `script-src 'self' 'wasm-unsafe-eval'` — for Cubism Core WASM
- `connect-src 'self'` — for model file XHR loading and LLM proxy
- `img-src 'self' data: blob:` — for Live2D textures

### `sentbox_watch` and Deprecated Config Keys

**Fix**: Ensure `packages/frontend/src/stores/settings.ts` does not contain deprecated keys: `sentbox_watch`, `e2ee_enabled`, `webrtc_instance`, `webxdc_realtime_enabled`. Replace `addr` with `configured_addr`.

## Key Files

| File | Purpose |
| :--- | :--- |
| `packages/frontend/bin/build-frontend-ts.mjs` | esbuild config with `cubismPatchPlugin` |
| `packages/avatar/src/adapters/pixi-live2d-renderer.ts` | PixiJS Live2D renderer with safe logging |
| `packages/avatar/src/adapters/live2d-avatar.ts` | Manager wrapping the renderer |
| `packages/frontend/src/components/AICompanionHub/Live2DAvatar.tsx` | React component with fallback |
| `packages/frontend/src/components/screens/DeepTreeEchoHub/DeepTreeEchoHub.tsx` | Main hub with cognitive loop |
| `packages/target-browser/cloudflare/worker.ts` | CF Worker proxy with LLM/DreamGen endpoints |
| `packages/frontend/static/main.html` | CSP configuration |
| `.github/workflows/deploy-cloudflare.yml` | CI/CD deploy pipeline |
