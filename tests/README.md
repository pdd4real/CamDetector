# Tests

`algorithm_smoke_test.mjs` is dependency-free so it can run before installing frontend packages:

```bash
node tests/algorithm_smoke_test.mjs
```

It verifies camera classification, non-camera classification, CDF generation, and CUSUM-style bitrate change detection against the synthetic samples.

