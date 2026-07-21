Don't compute, fetch, or transform a value until it's needed — eager evaluation couples a value's computation to where the code sits rather than when the value is required.
_Avoid_: computing every branch's inputs up front then discarding most; eagerly fetching a collection you then filter down to one item.
Detect: a costly expression evaluated before the guard or branch that decides whether its result is used — move it past the decision, or defer it behind a thunk/getter.
Not-when: the value is cheap, or the work must run eagerly for a side effect that has to happen regardless of whether the result is consumed.
