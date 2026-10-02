# NEXUS PLAY — Open-source engineering references

The physical game rebuild was implemented specifically for NEXUS PLAY. External projects were inspected for rules, geometry, physics and architecture; their source was **not copied wholesale** into this repository.

## References

- **tailuge/billiards** — browser billiards physics, 8-ball/snooker/nine-ball examples, ball/cushion collision models and published equations. License: GPL-3.0. Because NEXUS PLAY is not GPL-licensed, its GPL source is not vendored into this project. We used the public technical concepts and references to design an independent implementation.
  - https://github.com/tailuge/billiards
- **neuralsorcerer/8ballpool** — server-authoritative 8-ball architecture, fixed-step simulation, collision handling, foul rules and ball-in-hand concepts. License: MIT.
  - https://github.com/neuralsorcerer/8ballpool
- **gartz/draughtsjs** — browser checkers rule/event reference. License/credit terms are retained by the upstream project; NEXUS PLAY uses its own checkers implementation.
  - https://github.com/gartz/draughtsjs
- **liabru/matter-js** — MIT 2D rigid-body physics engine reference for browser physics patterns. NEXUS PLAY's current physical games use its own deterministic server simulation rather than shipping Matter.js as an unused dependency.
  - https://github.com/liabru/matter-js

## NEXUS-specific implementation

The server is authoritative for pool, carrom, mini golf and racing state. The browser only supplies input (aim, power, steering, etc.) and renders the resulting state. This prevents a client from directly declaring a pocket, collision, score or race finish.
