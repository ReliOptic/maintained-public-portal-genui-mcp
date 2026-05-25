# Release Checklist

0. Run `npm run coverage` and confirm READY.
1. Download the `.dxt` artifact from the GitHub Release.
2. Install the `.dxt` in Claude Desktop via the Extensions UI.
3. Confirm `server_ready` appears in the MCP console logs.
4. Call `search_portal_entries` with query `청년 취업` and confirm a non-empty response.
5. Call `get_entry_detail` with a known `entry_id` and confirm the entry detail loads.
6. Call `rank_portal_entries` with a structured taxonomy context and confirm ranked results are returned.
7. Call `compose_genui_artifact` with a known `entry_id` and confirm a card with handoff copy is returned.
8. Trigger stale-catalog warning by setting the system clock +31 days; confirm stderr warning appears.
9. Confirm no credential strings appear in any tool response.
