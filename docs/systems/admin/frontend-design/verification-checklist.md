# Admin Design Verification Checklist

- Page shell matches the admin layout standard.
- Primary action, secondary action, and danger action are visually distinct.
- Icon and text alignment is consistent in buttons, nav, cards, and table rows.
- Tables have loading, empty, error, and pagination states.
- Forms have consistent label, helper, error, and save states.
- Drawer/modal actions preserve permissions and confirmation rules.
- Ant Design usage is wrapped by project theme/tokens during pilot.
- Default Ant Design light surfaces do not leak into production admin pages.
- Permission-disabled controls remain readable and explain why the action is unavailable.
- Page has one identity/header zone and does not repeat the same title in workspace cards.
- New colors, font sizes, radius and spacing reuse `DESIGN.md` and `design-tokens.md`.
- Charts show unit, range, aggregation bucket, freshness and data source semantics.
- Charts define loading, empty, error, stale and insufficient-sample states.
- Critical/warning states explain threshold, baseline, duration and impact.
- Health data is scoped to one environment and exact queue namespace.
- Every actionable metric has a stable drill-down target that preserves filters.
- Trend endpoints return aggregated buckets instead of full task payload/result/log history.
