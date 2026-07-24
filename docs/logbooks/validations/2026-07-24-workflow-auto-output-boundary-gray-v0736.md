# Workflow Automatic Output Boundary Gray v0.7.36 Validation

## Local

- The new compiler regression initially failed with `WORKFLOW_BOUNDARY_EDGE_INVALID:task-image-0->output-auto-task-image-0-123456-image-abc`.
- After the constrained terminal-leaf handling, focused compiler and shared workflow-boundary tests passed `24/24`; `@xinghuan/agent-core` TypeScript checking passed.

## Pending Gray Evidence

- Deploy the Gray release and confirm public/internal status, active API and Worker services.
- Create a Workflow Region with a hosted image node and its automatic Output leaf; verify Run Plan generation, start and actual image completion.
