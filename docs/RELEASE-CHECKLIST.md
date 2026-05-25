# Release Checklist

1. Run `npm run typecheck`, `npm run build`, `npm run compile`, and `npm test`; all must pass.
2. Run `npm run coverage` and record the verdict. Under ADR-0018, `NOT READY` is a saturation diagnostic, not a v0.1 RC blocker; do not claim full taxonomy coverage unless it prints `READY`.
3. Run the archive checks in `docs/CLAUDE-DESKTOP-LAST-MILE.md` and confirm no credential/local-state matches.
4. Download the `.mcpb` artifact from the GitHub Release.
5. Install the `.mcpb` in Claude Desktop via the Extensions UI.
6. Confirm `server_ready` appears in the MCP console logs.
7. Call `search_portal_entries` with query `청년 취업` and confirm a non-empty response.
8. Call `get_entry_detail` with a known `entry_id` and confirm the entry detail loads.
9. Call `rank_portal_entries` with a structured taxonomy context and confirm ranked results are returned.
10. Call `compose_genui_artifact` with a known `entry_id` and confirm a card with handoff copy is returned.
11. Trigger stale-catalog warning by setting the system clock +31 days; confirm stderr warning appears.
12. Confirm no credential strings appear in any tool response.
13. Run or review `docs/JUDGE-ROBUSTNESS-SCENARIOS.md` coverage before declaring the RC judge-ready.
