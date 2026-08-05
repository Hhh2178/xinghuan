# Retired Permission Cleanup

退役主体和退役规则是两个不同的生命周期对象。

- Disabled models become `restricted` and keep existing rules so a later re-enable can reuse the policy.
- Deleted or missing models/providers become `retired`; reconciliation removes every rule targeting those retired subjects.
- Retired subjects remain as archive identities for historical task explanation and audit traceability. The permission editor hides them by default and exposes an explicit retired archive view.
- Rule cleanup affects future authorization configuration only. It does not delete tasks, execution identity snapshots, cost snapshots, or audit logs. Each cleanup batch adds a system audit record.
- Readiness continues to fail when a retired subject still has rules, preventing stale metadata from entering enforced runtime.
