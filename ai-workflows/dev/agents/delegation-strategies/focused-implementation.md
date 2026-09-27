# Focused implementation

Use when the relevant code path and acceptance behavior are known. Give Coder a small outcome, the exact write root,
the closest source and contract files, and the evidence it must return. Let Coder inspect nearby authorized files,
edit, and inspect its diff before reporting. Admin does not request progress after each file.

Stop when the bounded change is ready for Command Runner checks, when a required design decision or write-scope
expansion appears, or when the transport reports failure. Coder does not run tests, commit, push, or claim independent
review. Admin inspects the resulting diff and obtains owned verification afterward.
