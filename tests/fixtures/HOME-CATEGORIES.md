# Home category regression preview

Run from E-learning:

```sh
node --test tests/horizontalWheelScroll.test.mjs
node node_modules/vite/bin/vite.js --config tests/fixtures/vite.home-categories.config.mjs
```

Open http://127.0.0.1:3014/tests/fixtures/qa-home-categories.html.
It mounts the real Home page, scroll hook, category normalization and unified
feed with local data mocks. No authentication, production queries or telemetry
are initialized. The test grid labels uploaded/curated items explicitly.

Verify mouse category selection and headings, uploaded+curated filtering,
Periodontology/Periodontics aliasing, empty Implantology, All restoration,
horizontal drag without selection, the following click, keyboard Enter/Space,
and search within the selected category. The fixture is outside the production
build entry and its mocks are configured only by the dedicated Vite config.
