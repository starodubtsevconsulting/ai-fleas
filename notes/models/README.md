# Models

Model-first knowledge registry.

Each `notes/models/<model>/` directory describes **who the model is** and keeps evidence about that model beneath it.

Recommended layout:

```
<model>/
  README.md
  education.yml
  benchmarks/
    <hardware>/
      ...
```

- `education.yml`: declared education, observed capability, unknowns, communication guidance, provisional role fit.
- `benchmarks/<hardware>/`: measurements and experiments for this model on a particular deployment/hardware.
- Shared benchmark fixtures, runners and methodology remain under `notes/benchmarks/local-models/` because the same protocol is reused across models.

Runtime representation (Q4/Q5/Q8/NVFP4), context and hardware are evidence/deployment properties, not education.
