# Admin RunningHub Overflow And Key Pool Validation

## Target

- Version: `v0.6.5`
- Release: `20260715-admin-runninghub-overflow-key-pool-v065`
- Environment: gray
- Production unchanged: `v0.5.22`

## Structural Evidence

- The RH Key pool panel appears after RunningHub statistics and before catalog filters and the rail/editor layout.
- The selected-item editor stack contains only the item editor and AI analysis workbench; it no longer contains Provider credentials.
- The Key pool summary identifies the current Provider, enabled-Key count, and total concurrency.
- Create, save, edit, default, enable/disable, and delete controls are available only in the expanded body.
- Catalog cards expose dedicated title, note, summary, warning, and footer elements.

## TDD Evidence

The updated contracts first failed on the old implementation:

- `catalog cards should expose an explicit title track`
- `workspace should describe the Key pool as Provider-owned configuration`

After implementation, both commands passed:

```text
node scripts/verify-admin-runninghub-workspace-contract.mjs
node scripts/verify-runninghub-key-pool-contract.mjs
```

The helper split contract also passed after correcting the older verifier to inspect the actual helper module.

## Runtime Evidence

- Gray API and Worker services are active.
- Public and internal status endpoints match `0.6.5 / gray`.
- Active release path is `/opt/apps/xinghuan-canvas-next/releases/20260715-admin-runninghub-overflow-key-pool-v065`.

## Responsive Measurements

All four required combinations returned:

- document horizontal overflow: `0px`;
- seven AI application cards;
- adjacent card overlaps: `0`;
- Provider Key pool before filters: true;
- Provider Key pool inside editor stack: false.

At `1920x1080` with the assistant open:

- Key pool width: `1212px`;
- collapsed Key pool bottom is before filter top;
- expanded Key pool contains two rows at `1172px` client and scroll width;
- all seven AI application cards are `132px` tall;
- the known long title has `188px` client width and `275px` scroll width, confirming controlled truncation instead of layout expansion.

## Page Regression

At `1920x1080` with the assistant open:

- API settings: rendered and interactive after fresh asset reload.
- Public resources: heading present, horizontal overflow `0px`.
- Users: heading present, horizontal overflow `0px`.
- Tasks: heading present, horizontal overflow `0px`.
- Environment sync: heading present, horizontal overflow `0px`.
- Final console query: zero errors and zero warnings.

## Paid Model Safety

No AICopy SD generation request was made in this phase. Validation used source contracts, local builds, gray Admin reads, and browser layout measurements only.
