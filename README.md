# Support ticket triage app

This repository is the starting point for an educational project in which
computer science students will build a support ticket triage application. The
planned application will use a large language model (LLM) from the backend to
help analyze incoming support requests and support the triage process.

The codebase is intentionally a basic skeleton. It provides a small chat
interface and server endpoint as a first step: before building the full triage
workflow, students can use this mock chat to validate the connection between
the application and an LLM provider.

## Features

- **Chat** with memory: the browser sends the whole conversation to `/api/chat`, which forwards it to the LLM.
- **Triage**: category, priority, human-review flag and summary for one ticket. Requests and responses are validated with
  Zod; invalid requests show a clear error. Each result shows token usage, latency, cost and the model(s) used.
  The JSON Schemas are served at `/api/schema`.
- **Strategies** (menu in the front end): `llm`, `dm` (decision model) or `dm+llm`.
- **Smoke test**: choose the labelled 100 set or the 500 set and a random sample size; predicted vs expected labels and
  mismatch counts are displayed. Works with every strategy.
- **/admin**: every logged run (accuracy, outcomes, latency, cost, model used) and recent calls; tick two runs to
  compare them side by side.
- **Model switching**: menus list `LLM_MODELS` and `DM_MODELS`.

Report: see [`LLM-DM-report.md`](./LLM-DM-report.md).

## Configuration

Copy `.env.example` to `.env.local` (PowerShell: `Copy-Item .env.example .env.local`) and fill in:

- an OpenAI-compatible LLM (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, optional `LLM_MODELS`);
- a free decision-model key from https://decision.vllm-sr.ai (`DM_API_KEY`).

Logs are written to `data/logs/` (git-ignored).

## Sample data

The `data/` folder contains two support-ticket datasets:

- **500 unlabelled tickets** in
  [`support_tickets_500.csv`](./data/support_tickets_500.csv) and
  [`support_tickets_500.json`](./data/support_tickets_500.json), for exploring
  and developing the triage workflow.
- **100 labelled tickets** in
  [`support_tickets_100_labelled.csv`](./data/support_tickets_100_labelled.csv)
  and
  [`support_tickets_100_labelled.json`](./data/support_tickets_100_labelled.json).
  These include triage annotations such as category, priority, and whether a
  ticket needs human review, making them useful for testing and evaluating
  triage approaches.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3033 and send a message. Both `npm run dev` and
`npm run start` use port 3033.

The Send button is disabled when the message is empty or contains only spaces,
and while a request is in progress.

Invalid requests return HTTP 400 with an `error` (and an `issues` list).

## Checks

```sh
npm run typecheck
npm run build
```
