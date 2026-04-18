import { beforeAll, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

beforeAll(() => {
  localStorage.setItem("authToken", "test-token");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
