# Experience Extraction default flow

## Purpose

Reusable default program for an Agent bound to the **Model Experience Extractor** role.

A concrete workflow imports/binds this program and supplies the target model/deployment, Extractor Agent binding, target execution route, verifier/reviewer and authorized Commands.

## Entry

Required:
- target Model and deployment/route;
- intended use / delegation decision to inform;
- canonical model directory;
- Extractor Agent whose capability satisfies the role contract;
- independent acceptance route;
- public-information sources or an existing Experience Profile.

## Steps

1. **Bootstrap** — if no profile exists, collect attributable public/model-card claims and initialize a **draft** Experience Profile. Do not convert declared claims into observed competence.
2. **Read state** — load the current profile, preserved evidence and remaining unknowns.
3. **Choose uncertainty** — select the highest decision-relevant uncertainty for the intended use. If none blocks the decision, go to Stop.
4. **Form hypotheses** — state what competing explanations the next probe should distinguish (for example communication gap vs implementation/reasoning gap).
5. **Select/freeze probe** — choose a reusable probe family or create a bounded fixture; freeze starter, task, verifier and acceptance before execution.
6. **Choose treatments** — change one meaningful variable. Use repeated/interleaved arms when variance matters. For domain communication, task-only/raw/translated context is the default comparison when applicable.
7. **Execute target** — delegate the frozen task to the target Agent/Model. The target cannot define acceptance or alter the experiment.
8. **Independent acceptance** — verifier/reviewer checks the artifact/behavior. Completion prose and successful process exit are not acceptance.
9. **Interpret** — determine exactly what the evidence supports and what it does not prove. Separate communication, implementation/reasoning, runtime/tool and verifier failures.
10. **Update profile** — use the Experience Extractor Command to append evidence and mark claims confirmed, refined, contradicted, inferred-but-unverified or unknown.
11. **Transfer when needed** — before generalizing a promising communication pattern, test it on another relevant task family.
12. **Decide** — if another probe is likely to change the intended delegation decision, return to Choose uncertainty. Otherwise Stop.
13. **Stop** — mark the profile sufficient for the current purpose, preserve remaining unknowns, and report what changed and why.

## Exit

Outputs:
- updated `models/<model>/experience-profile.yml`;
- preserved extraction evidence under the model;
- extraction report;
- explicit remaining unknowns;
- profiling status.

Success means **sufficiently accurate understanding for the intended use**, not that the target passed every probe.
