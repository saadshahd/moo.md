import { routes } from './registry.js';
import { middlewares } from './middleware.js';

// Dispatch a request through the middleware chain, then to the route handler.
export function handle(path) {
  let req = { path };
  for (const m of middlewares) req = m(req) ?? req;
  const handler = routes[path];
  if (!handler) return { status: 404, req };
  return { status: 200, req, ...handler(req) };
}
