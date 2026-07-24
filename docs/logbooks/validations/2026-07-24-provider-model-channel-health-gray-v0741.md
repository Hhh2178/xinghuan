# Provider Model Channel Health Gray v0.7.41 Validation

## Planned Gray Checks

- Apply `042_provider_model_channel_health.sql` only after the shared Gray environment file confirms `xinghuan_canvas_gray`.
- Verify internal and public `0.7.41 / gray / enforced` status, API and Worker service activity, and five-release retention protection.
- Use authenticated isolated test accounts to create settled image, video, audio and LLM tasks; confirm cancelled and running tasks do not affect success rates.
- Confirm 24-hour and 72-hour feedback windows, owner eligibility, atomic vote replacement, aggregate-only responses, ETag behavior, and Admin filters.
- Capture report screenshots at `1920x1080` and `2560x1440`; record any remaining limitation rather than implying completion.
