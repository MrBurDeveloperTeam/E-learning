// Public Pages Function entry kept outside /api/* so the legacy production
// Worker route does not intercept dental video import requests.
export { onRequest } from "../api/fetch-dental-videos";
