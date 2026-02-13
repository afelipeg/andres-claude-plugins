# Measurement Framework — Incrementality Focus

See architect/measurement-architect/references/measurement-framework.md for complete trifecta.

## Incrementality Test Decision Tree

1. Can you randomize at user level? -> Conversion Lift (platform-native)
2. Can you hold out geographic regions? -> Geo-Lift
3. Can you stop a channel entirely? -> Holdout Test
4. None of the above? -> Use time-series quasi-experiments with caution

## Power Analysis Requirements

- Minimum effect size to detect (expected lift %)
- Baseline conversion rate or volume
- Test duration (longer = more power)
- Number of test/control units (geos, users)
- Significance level (typically 0.05)

## Revenue-at-Risk Framework

Every incrementality test sacrifices some revenue:
- Geo-lift: Revenue in holdout geos during test period
- Conversion lift: Revenue from users in control group
- Holdout: Full channel revenue during holdout period

Always calculate: Is the learning value > revenue-at-risk?
