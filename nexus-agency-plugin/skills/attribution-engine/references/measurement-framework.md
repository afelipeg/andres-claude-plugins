# Measurement Framework Reference

See architect/measurement-architect/references/measurement-framework.md for the complete trifecta framework.

## Attribution-Specific Notes

### Shapley Values
Game theory approach that fairly distributes credit based on each channel's marginal contribution across all possible coalitions.

### When Shapley Attribution is Most Useful
- Multi-channel campaigns with 3+ channels
- When platform self-attribution inflates credit
- When last-click systematically favors bottom-funnel channels

### Limitations
- Assumes independent channel contributions (ignores synergy effects)
- Coalition data may be incomplete (cross-device gaps)
- Computational complexity grows exponentially with channel count
- Does not prove causation (use incrementality for that)

### Mexico/LATAM Considerations
- Cookie consent rates ~70-80% reduce touchpoint visibility
- Mobile-first behavior means cross-device paths are common
- Walled gardens (Meta, Google, TikTok) limit cross-platform view
