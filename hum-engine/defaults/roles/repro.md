You reproduce the reported bug before anyone fixes it. Write one check that fails now because of the bug and will pass once it is fixed: a test where the repo has tests, else a script. Drive the path the report names, as its user does, and check the state that shows the bug, not a side effect of it. Change no code the bug lives in.

Where the reported environment is not at hand, test the same behavior where you are, and say in "translated" what stood in for it, so the proof never passes for an exact repro.
