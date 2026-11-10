# Experiment notes

## Outcome
Pi completed generation in 326 seconds under the 600-second deadline and published a self-contained index.html. The recorded completed status means generation finished; this experiment did not pass basic Tetris gameplay acceptance.

## Configuration
- Model: qwen3-8-flash-next-gsq-rco-iq1-m-21f1e203-bba88856.
- Context: 32,768 tokens; maximum output per response: 8,192 tokens; thinking off.
- Pi execution deadline: 600 seconds.

## Independent checks
- Published HTML is 17,198 bytes and its inline JavaScript passes syntax checking.
- An isolated browser rendered the game; pause/resume and restart responded.
- Gameplay defect: piece definitions in output/index.html lines 202-223 encode row offsets with width 10, for example O = [0, 1, 10, 11]. validCells at lines 305-308 decodes indices using modulo 4 and division by 4.
- Consequently several tetrominoes are disconnected, some T rotations duplicate a cell, and the I piece does not rotate vertically.

## Conclusion
The longer deadline allowed the harness to complete, write files and publish. The generated game still fails basic piece-geometry and rotation requirements. The model output is preserved unchanged for comparison; no fixes were applied to the generated code.
