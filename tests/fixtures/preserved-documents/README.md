# Preserved document renderers

These test fixtures preserve the agreed working-tree baseline captured on **13 November 2026**, including its uncommitted changes. They are not a checkout of an exact Git commit.

Source archive: `Текущий-вариант-до-упрощения.zip`

Archive SHA-256: `6765ac42296ffa252cfaa5d3c88374b1bfda6fa17b286e63a9a79d0fbdbf9783`

The two entry modules are `src/data/contract.js` and `src/utils/estimate-html.js`. Their complete relative JavaScript dependency closure is included with its original paths. Every copied file was verified against the immutable archive manifest; individual SHA-256 values are recorded in `BASELINE-MANIFEST.json`.

Tests use this fixture to compare document text, financial tables, and exact legacy-template migration behavior. Production code does not import these files. Keeping the baseline here lets the tests run in a standalone repository checkout without a sibling application folder.
