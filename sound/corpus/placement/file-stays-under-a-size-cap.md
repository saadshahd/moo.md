A commit that adds a file over 1,000 lines, or grows one already over, first splits it by concept in a commit of its own.
_Avoid_: splitting by position (`part1`, `part2`); a `utils`/`helpers` file for the overflow; a re-export stub at the old path; raising the cap; skipping the hook.
Detect: run `file-stays-under-a-size-cap.gate` as a pre-commit hook.
Not-when: the file is binary, or not written by hand (lock file, codegen, golden file) — judge that, then mark it `linguist-generated` in `.gitattributes`.
Cross-ref: complecting-shared-construct-split-by-reason-to-change — cut where parts change for different reasons.
