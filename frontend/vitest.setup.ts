import { vi } from "vitest";

// `server-only` throws when it is not resolved through the react-server
// condition, which Next provides and plain vitest does not. The modules under
// test import it as a guard for real renders, not for behaviour.
vi.mock("server-only", () => ({}));
