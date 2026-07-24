# Canvas Hosted Run Projection Gray v0.7.37 Validation

## Local

- Canvas node projection and Run projection regressions pass `6/6`; Web TypeScript checking passes.

## Gray Runtime

- Release `20260724-canvas-hosted-run-projection-gray-r1-v0737` passed public/internal `0.7.37 / gray / enforced` status checks. API and Worker are active; all 41 migrations remain current.
- The prior real hosted Workflow Run `canvas_run_0edc737e-795a-4c34-82ae-afe0d0a51295` completed with an automatic external Output leaf, three upstream Provider task IDs, `providerRequestCount=3`, three generation artifacts and three materialized images. The node projection consumes this same durable Run/Event source and does not mutate saved Canvas node data.
