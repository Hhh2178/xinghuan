# System Interface Documentation Template

Copy this structure into `docs/systems/<system>/` when a system gains new durable API, permission, runtime, or UI-node behavior.

## Responsibility

Describe what this system owns and what it does not own.

## Public Interfaces

| Interface | Method | Permission | Request | Response | Error contract |
| --- | --- | --- | --- | --- | --- |

## Data Model

Describe durable entities, fields, ownership, and revision rules.

## Runtime Flow

Describe frontend, API, worker, provider, storage, and output flow.

## Permissions And Roles

Describe admin-only, group-scoped, owner-scoped, and public behavior.

## Verification

List exact commands and manual checks.

## Agent Verified

List what automation can verify.

## User Acceptance Required

List what requires human product or visual acceptance.
