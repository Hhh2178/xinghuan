# Canvas Generation Batch Gray v0.7.34 Validation

## Runtime

- Release `20260724-canvas-generation-batch-gray-r1-v0734` passed public/internal `0.7.34 / gray / enforced` status checks. API and Worker services were active; no migration was applied (`41` skipped).

## Paid Image Evidence

- A real `grsai / nano-banana-fast` text-to-image task persisted `generationCount=3` and `n=3`, then succeeded with three materialized image URLs, three generation artifacts, `imageCount=3`, and `providerRequestCount=3`.
- A second real image-to-image task used the first task's owner-scoped materialized image as its reference. It succeeded with three materialized image URLs, `imageCount=3`, and `providerRequestCount=3`.
- The prior `v0.7.33` validation task is retained as the reproduction evidence: it succeeded with only one image and one Provider request when the API discarded `generationCount`.
