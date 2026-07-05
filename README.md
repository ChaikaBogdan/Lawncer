# Lawncer

🌱🤖🔥📐🎲

Tactical lawn care with suspiciously familiar mechanics.

[![Quality Checks](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/quality.yml/badge.svg)](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/quality.yml)
[![Tests](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/test.yml/badge.svg)](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/test.yml)
[![Deploy](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/deploy.yml/badge.svg)](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/deploy.yml)

**[Play Now](https://chaikabogdan.github.io/Lawncer/)**

## Getting Started

### Prerequisites

- Node.js 24+ (LTS)
- pnpm

### Installation

```bash
pnpm install
```

### Development

Start the development server:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

### Building

Build for production:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Deployment

This project automatically deploys to GitHub Pages when:

1. ✅ Quality checks pass (linting, formatting, type checking)
2. ✅ Tests pass
3. 📦 Code is pushed to `main` branch

The deployment is protected by required status checks to ensure only quality code goes live.

## Development Workflow

### Local Checks

When you commit, [Lefthook](https://lefthook.dev/) automatically runs:

- **Linting** — ESLint with auto-fix
- **Formatting** — Prettier
- **Type checking** — TypeScript
- **Tests** — Vitest

Commits are blocked if checks fail.

### CI/CD Pipeline

GitHub Actions runs on every push and PR:

- **Quality Workflow** — lint, format, type-check
- **Test Workflow** — run unit tests
- **Deploy Workflow** — deploy to GitHub Pages (only after quality passes)

## Tech Stack

- **Vite** - Fast build tool
- **TypeScript** - Type-safe JavaScript
- **pnpm** - Package manager
