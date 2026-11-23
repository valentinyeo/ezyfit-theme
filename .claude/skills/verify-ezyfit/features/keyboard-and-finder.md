# Keyboard finder and mobile menu

Goal. Shoppers can choose a vehicle by keyboard and return to the finder from either wiper product link.

`gates-keyboard.mjs` runs through `gates.yml` on GitHub-hosted runners only. It refuses the live theme.

- K0 checks the requested theme at 390 and 1280 pixels.
- K1 checks that both wiper return links target `/#find`. K2 follows the first link to the homepage finder.
- K3 selects Toyota and Hilux by keyboard from the real catalog. K4 submits by keyboard and requires the real Hilux product URL.
- K5 opens the phone menu by keyboard, requires a native modal, attempts to focus its background opener, and cycles Tab and Shift+Tab through every control. Browser chrome can receive focus, but background page controls cannot.
- K6 checks Escape and focus return. K7 checks the Close button and focus return.
- K8 replaces only the homepage's product JSON response with a four-product fixture. It exercises multiple models and years, Enter, Space, both arrow directions, first-option focus with hidden search, and Escape. It does not prove that multiple Hilux years exist in the store.

Evidence includes the filled finder at both widths, the phone menu and `gates.json`.

Execution is pending. No theme upload, browser session or local test was run for MACL-32. Before merge, an authorized operator must arrange an unpublished preview containing the PR, run the hosted gates and obtain an independent pstack verifier verdict.
