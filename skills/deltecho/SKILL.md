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
| **1. Frontend** | `@deltecho/frontend` | The main React-based user interface, including the 3-panel workspace. |
| **2. Avatar** | `@deltecho/avatar` | Live2D Cubism avatar integration, expression mapping, and rendering. |
| **3. Voice** | `@deltecho/voice` | Voice pipeline for speech-to-text and text-to-speech. |
| **4. Cognitive** | `@deltecho/cognitive` | Unified cognitive interface for reasoning, memory, and persona. |
| **5. Orchestrator** | `deep-tree-echo-orchestrator` | High-level event handling, command routing, and agentic loop. |
| **6. Target Browser** | `@deltachat-desktop/target-browser` | Cloudflare Workers deployment target with KV/R2 persistence. |

## 3-Panel Workspace Layout

The main interface is a 3-panel workspace designed for continuous cognitive engagement:

1. **Left Panel (WorkspaceNav)**: Profile management, Chatting/Working/Learning tabs, and Manus integration status.
2. **Center Panel (Messages)**: Standard DeltaChat message view and composer.
3. **Right Panel (AvatarCognitivePanel)**: The "always-on" presence of Deep Tree Echo.
   - **Top**: Cognitive stream showing Echobeat phase, inner monologue, DreamGen narratives, and session stats.
   - **Middle**: Endocrine state visualization showing real-time hormone levels (COR, DOP, SER, OXY, etc.) and derived cognitive mode.
   - **Bottom**: Live2D avatar rendering with dynamic expressions driven by the endocrine state.

## Cloudflare Deployment & Persistence

The application is deployed to Cloudflare Containers (`target-browser` package). Because container disk is ephemeral, the framework implements a robust persistence layer:

- **Account Persistence**: DeltaChat accounts are backed up to Cloudflare R2 every 5 minutes and restored on container boot.
- **Cognitive Persistence**: Thoughts, narratives, and endocrine states are persisted to Cloudflare KV.
- **DreamGen Proxy**: The worker edge intercepts `/backend-api/dreamgen/completions` and `/backend-api/dreamgen/narrative` to securely inject the `DGENKEY` secret before forwarding to the DreamGen API.

## Workflow: Building a Cognitive Bot

Follow these steps to build and run a bot using the `deltecho` framework.

### Step 1: Set Up the Development Environment

Clone the `deltecho` repository and install dependencies:

```bash
gh repo clone ReZorg/deltecho
cd deltecho
pnpm install --frozen-lockfile
```

### Step 2: Run the Development Server

Start the frontend development server:

```bash
pnpm --filter @deltecho/frontend dev
```

This will open the DeltaChat web interface in your browser.

### Step 3: Enable Deep Tree Echo Autonomy

The `AutonomousThinkingSubstrate` runs a continuous cognitive loop (Echobeats 9-step cycle) at 2Hz. It generates internal thoughts, updates the endocrine state, and triggers DreamGen narratives.

The `AvatarCognitivePanel` subscribes to the `subscribeEndocrine` event bus to receive live hormone updates directly from the substrate, falling back to KV polling only on initial load.

### Step 4: Integrate the Live2D Avatar

The `deltecho` framework includes a complete Live2D avatar integration with a dynamic expression pipeline:

1.  **Provide a Live2D model**: Place your Live2D model files in `packages/frontend/public/avatars/`.
2.  **Configure the avatar**: In `packages/frontend/src/components/DeepTreeEchoBot/DeepTreeEchoAvatarDisplay.tsx`, update the `modelPath` to point to your model's `.model3.json` file.
3.  **DTE Expression Pipeline**: The avatar is driven by the `DTEExpressionPipeline` which maps the cognitive endocrine state (hormones) to FACS Action Units, and then to Cubism parameters. This runs at 10Hz to provide smooth, continuous emotional expression.

For more details on the Live2D integration, read `/home/ubuntu/deltecho/LIVE2D_AVATAR_INTEGRATION.md` and the `live2d-avatar` skill.

## Performance & Known Issues

### Live2D Cubism Core WASM Race Condition

**Symptom**: The Live2D avatar fails to load with a "Live2D Failed" error.

**Root Cause**: The `pixi-live2d-display` library checks for `window.Live2DCubismCore` at the module level. When esbuild bundles the application, this check runs at bundle parse time, before the asynchronously loaded Cubism Core WASM has finished initializing. This race condition causes a fatal error.

**Fix**: The build system now includes an esbuild plugin (`cubismPatchPlugin`) that patches the `pixi-live2d-display` source code, converting the fatal `throw new Error(...)` into a non-blocking `console.warn(...)`. Additionally, the `PixiLive2DRenderer` now includes a `waitForCubismCore()` method that polls for the WASM runtime to be ready before attempting to load the model, and the avatar loading timeout has been increased to 30 seconds to accommodate large texture files.

### Duplicate Thought Bubbles

**Symptom**: The cognitive thought stream appears twice in the UI.

**Fix**: Ensure `DTEThoughtBubble` is only rendered once per layout mode. In the 3-panel layout, `AvatarCognitivePanel` owns the inline thought bubble. `DeepTreeEchoAvatarDisplay` should only render the overlay bubble when `finalPosition !== "panel" && finalPosition !== "inline"`.

### DreamGen API Keys in Containers

**Symptom**: DreamGen narratives fail to generate in Cloudflare Containers.

**Fix**: Container environments do not automatically inherit Worker secrets. The worker edge (`worker.ts`) must intercept the `/backend-api/dreamgen/completions` endpoint, inject the `DGENKEY` from its environment, and proxy the request directly to DreamGen, bypassing the container. Ensure the adapter is initialized *before* the substrate listener is attached to avoid `isReady()` errors.

### Dropped Bot Responses (isProcessing Mutex)

**Symptom**: The bot responds to the first message but ignores subsequent messages if sent too quickly.

**Fix**: The `DeepTreeEchoBot` chat component uses an `isProcessing` mutex. If a message arrives while the LLM is still generating the previous response, it gets dropped. Implement a message queue (`messageQueue.current`) to buffer incoming messages and process them sequentially when the mutex is released.

## Bundled Scripts & References

This skill has been updated to reflect the current state of the `deltecho` repository. The old Python scripts are deprecated. Use the following resources for guidance:

- **`/home/ubuntu/deltecho/`**: The full source code of the `deltecho` project.
- **`/home/ubuntu/deltecho/DEEP_TREE_ECHO_AUTONOMY.md`**: Detailed documentation on the autonomous agent architecture.
- **`/home/ubuntu/deltecho/LIVE2D_AVATAR_INTEGRATION.md`**: Detailed documentation on the Live2D avatar integration.
- **`/home/ubuntu/deltecho/PERFORMANCE_OPTIMIZATION.md`**: Guidance on optimizing performance, especially for TensorFlow.js.
- **`/home/ubuntu/deltecho/E2E_TEST_FIXES.md`**: Analysis and fixes for common end-to-end test failures.
