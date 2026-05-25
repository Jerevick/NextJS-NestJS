# Workflow coverage audit (Phase 4 — WP-4.1)

| Workflow code         | Module      | Status                              |
| --------------------- | ----------- | ----------------------------------- |
| GRADE_SUBMISSION      | grades      | Wired via `WorkflowEngineService`   |
| GRADE_OVERRIDE        | grades      | Wired                               |
| GRADUATION_CLEARANCE  | students    | Wired                               |
| LEAVE_REQUEST         | leave       | Wired                               |
| SCHOLARSHIP_AWARD     | finance     | Wired                               |
| BACKFILL_REQUEST      | backfill    | Wired                               |
| CONDITIONAL_PROMOTION | progression | Wired                               |
| FULL_REPEAT_APPROVAL  | progression | Wired                               |
| FINANCE_REFUND        | finance     | Verify institution seed definitions |

Ad-hoc approvals should not exist outside `apps/api/src/workflow-engine/`.
