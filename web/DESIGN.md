# Interface direction

Flight planning, with the globe as the focal point and instruments kept quiet.
The black background is requested; gold is a restrained reference to spacecraft
thermal blankets, not an extra status color. Success, selection and progress use
the same accent with icons and explicit text to convey meaning.

- Space `#000000`, panel `#101010`, raised `#1a1a1a`.
- Text `#f2f1ed`, secondary `#aaa9a3`, accent `#d6b77c`.
- Self-hosted type: Inter (reading and controls) and DM Mono (figures, labels), the faces of
  nasa.gov, and Michroma for the wordmark. Variables `--font-ui`, `--font-data`, `--font-display`.
- Buttons are neutral paper on black (`--btn*`): solid for the main action, a paper outline
  for the rest. Gold marks what is selected or flagged, not every control.
- Left-aligned content. Large globe next to a compact location list; configuration
  has a quiet route summary and a wider control panel. Telemetry uses tabular numbers.
- Short stage fades, selected-state feedback, continuous camera motion. No ambient
  animations, decorative gradients or unrelated success/warning hues.

Layout: header / stage navigation / task title / [globe | location details] / credits.
On mobile, the globe precedes details and all five navigation stages remain visible.

Review against brief: avoid a generic space dashboard by keeping actual terrain as
the visual identity. Remove marketing headlines, repeated card borders and teal
status chips. Gold appears on actionable controls and selection, not every label.

`src/styles.css` owns interface tokens and components. Three.js accent values in
Globe/TerrainExplorer match these tokens. The team's physics viewer stays isolated.
