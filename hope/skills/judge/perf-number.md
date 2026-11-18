# Vetting a performance number

Answer each check from a run, never from reading the code. A ballpark the user asked for takes one run: check Errors and Work ran, and say it is one run. A choice between options is never a ballpark.

| Check | Holds when |
| --- | --- |
| Load | `uptime` and the core count show a quiet machine, or the verdict says it was not |
| Limiter | the resource that bounds the number is named, from a separate profiling run, never a timed one |
| Tuning | every side runs with production settings; no side wins while one runs untuned |
| Limits | the result fits disk, network and core limits, and the time saved is at most the time the changed piece took |
| Errors | every timed run counts its failures and checks its outputs are correct; a fast failure never reads as speed |
| Spread | each side runs 5 times or more, alternating A, B, A, B; a gap smaller than the run-to-run spread is no difference |
| Work ran | the timed work happened: requests arrived, rows were written, results were used |

The verdict is faster, slower, no measurable difference, or inconclusive, then the number with its unit, the run count, the range and the limiter. It is inconclusive, naming the gap, when the limiter is unknown, a side ran untuned, or Errors or Work ran went unchecked.
