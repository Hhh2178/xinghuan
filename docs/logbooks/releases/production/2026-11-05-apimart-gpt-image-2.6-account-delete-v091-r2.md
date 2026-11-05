# Starflow Production: APIMart GPT-Image-2.6 and account deletion repair

- Date: 2026-11-05
- Target: Starflow Production, `canvas.starflow.xin`
- Version: `0.9.1`
- Release: `20261105-apimart-26-account-delete-v091-r2`
- Source commit: `4d6d56caeb76e1c8a957c47e6820329c43b62226`
- Runtime archive SHA-256: `59b9210259dc675bf24c08cf9c14947c50b97e6c1b07135bc53ee219287214df`
- Database: `xinghuan_canvas_next`

The release includes APIMart GPT-Image-2.6 request support, including reference-image payload handling and GIF/SVG parameters. User deletion now removes that user's permission rules in the same transaction. Migration `051_deleted_user_permission_rules.sql` removes historical permission rules whose user principal no longer exists.

During the first deployment attempt, release r1 did not pass startup permission readiness because 60 permission rules referenced 6 already-deleted users. The r1 release was rolled back. The 60 unreachable rules were removed transactionally; no rule for an existing account or group was targeted. Release r2 then applied migration 051 and started successfully.

Post-deployment verification found API and Worker active; internal and public status both reported `0.9.1 / production`, permission mode `enforced`. Permission readiness passed with 192 subjects, 2,614 rules, 11 principals, and 0 failures. Starflow Gray remains decommissioned.

See `../../validations/2026-11-05-apimart-gpt-image-2.6-account-delete-v091-r2.md` for command and verification evidence. No real APIMart generation request or UI account deletion was performed during release validation.
