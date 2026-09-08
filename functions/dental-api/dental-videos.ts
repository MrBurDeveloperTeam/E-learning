// Public Pages Function entry kept outside /api/* so the legacy production
// Worker route does not intercept dental video requests.
export { onRequestGet, onRequestOptions } from "../api/dental-videos";
