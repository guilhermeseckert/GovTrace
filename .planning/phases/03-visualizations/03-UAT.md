---
status: complete
phase: 03-visualizations
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md
started: 2026-04-03T12:00:00Z
updated: 2026-04-03T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Visualizations Tab Visible on Entity Profile
expected: Navigate to any entity profile page. A 6th "Visualizations" tab appears in the tab bar alongside Donations, Contracts, Grants, Lobbying, and Connections.
result: pass

### 2. Network Graph Renders
expected: Click the Visualizations tab, then the "Network" sub-tab. A force-directed graph should render with color-coded nodes (different colors per entity type). The center node is the current entity. Connected entities appear as surrounding nodes with edges.
result: issue
reported: "hover on the network shows the tooltip on top of the application not next to the circle I am hovering"
severity: major

### 3. Network Graph Interaction
expected: On the network graph: zoom in/out with scroll wheel or pinch. Pan by dragging the background. Click a non-center node to expand it (loads its connections). Hover a node to see a tooltip with name, type, and connection details.
result: pass

### 4. Network Graph Connection Filter
expected: Below or beside the network graph, toggle buttons let you filter by connection type (e.g. donations, contracts, lobbying). Toggling a type off removes those edges and re-fetches/re-renders the graph.
result: pass

### 5. Money Flow Sankey Diagram
expected: Click the "Money Flow" sub-tab. A Sankey diagram shows money flowing from donors on the left through parties/entities in the middle to departments/recipients on the right. Colored bands show flow amounts.
result: pass

### 6. Activity Timeline
expected: Click the "Timeline" sub-tab. A horizontal timeline shows events (donations, contracts, grants, lobbying) as shaped markers along a time axis. Different shapes/colors represent different event types. A legend explains the shapes.
result: pass

### 7. Timeline Election Year Lines
expected: On the activity timeline, vertical reference lines mark Canadian federal election years. These help contextualize when political activity occurred relative to elections.
result: pass

### 8. Dark Mode Visualizations
expected: Toggle to dark mode via the theme toggle in the header. All three visualizations (graph, sankey, timeline) should adapt colors to dark backgrounds — no white-on-white or invisible elements.
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Hover tooltip appears next to the hovered node in the network graph"
  status: failed
  reason: "User reported: hover on the network shows the tooltip on top of the application not next to the circle I am hovering"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
