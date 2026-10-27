# OpenCode Execution Plan & Technical Directives

## Mandatory Stack & Guidelines
- **Frontend**: React + TypeScript (Vite + KaTeX for math rendering).
- **Backend**: Node.js + Express + TypeScript.
- **Database & Persistence**: SQLite (using `better-sqlite3` or Prisma/SQLite). Must persist in `./backend/data/database.sqlite`.
- **Testing**: Vitest or Jest for backend unit/integration tests.
- **Environment**: Docker & Docker Compose (`docker compose up --build`).

## Core Principles
1. **Server-Side Deterministic State Engine**: ALL state transitions, evaluation of answers, and rule calculations MUST happen in the Node.js backend. The frontend is strictly a presentational layer that renders state and submits option IDs.
2. **Context First**: Read `CONTEXT.md` (or `context7.md`) before generating or modifying any code. Adhere strictly to the business rules and state machine logic defined there.
3. **No External AI/LLM Calls**: Do NOT call LLMs or external models in the runtime application.
4. **Data Privacy**: Never send correct option indicators/answers to the frontend for active/pending activities.

## Monorepo Structure
```text
matematicas-web/
├── .opencode/
│   └── rules.md             # Strict AI coding guidelines
├── AGENTS.md                # AI agent instruction file
├── CONTEXT.md               # Complete domain specification and initial seed data
├── DECISIONS.md             # Technical choices, product reflections, and self-evaluation
├── README.md                # Execution guide, setup instructions, and Docker info
├── docker-compose.yml       # Docker orchestration file
├── backend/
│   ├── src/
│   │   ├── engine/          # Deterministic State Machine (FSM)
│   │   ├── db/              # SQLite connection and seed script
│   │   ├── routes/          # Express API endpoints
│   │   └── index.ts         # Express server entry point
│   ├── Dockerfile
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/      # React UI components (Pathway, Questions, Theory)
    │   ├── api/             # API client
    │   └── App.tsx
    ├── Dockerfile
    └── package.json