// Middleware chain. Applied in order by app.js to every request.
// GLOBAL TASK: a logging middleware that stamps req.requestId must be added
// to this array. It must run for ALL routes, so it belongs here, not per-handler.
export const middlewares = [];
