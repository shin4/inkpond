// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pond = vi.hoisted(() => ({
  destroy: vi.fn(),
  drop: vi.fn(),
  refreshInk: vi.fn(),
  ripple: vi.fn(),
  setActive: vi.fn(),
}));
const create = vi.hoisted(() => vi.fn((..._args: unknown[]) => pond));
vi.mock("../src/controller", () => ({ createInkPond: create }));

import type { InkPond as Pond } from "../src/controller";
import { InkPond } from "../src/react";

describe("InkPond (React)", () => {
  afterEach(() => vi.clearAllMocks());

  it("mounts one decorative canvas and hands it the options", () => {
    const { container } = render(<InkPond strength={0.8} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveProperty("className", "inkpond");
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    expect(create).toHaveBeenCalledWith(canvas, {
      active: true,
      strength: 0.8,
    });
  });

  it("hands the live pond to pondRef and clears it on unmount", () => {
    const pondRef: { current: Pond | null } = { current: null };
    const { unmount } = render(<InkPond pondRef={pondRef} />);
    expect(pondRef.current).toBe(pond);
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty("pondRef");
    unmount();
    expect(pondRef.current).toBeNull();
  });

  it("pushes active live and stops on unmount", () => {
    const { rerender, unmount } = render(<InkPond active={false} />);
    expect(create.mock.calls[0]?.[1]).toMatchObject({ active: false });
    act(() => rerender(<InkPond active />));
    expect(pond.setActive).toHaveBeenLastCalledWith(true);
    unmount();
    expect(pond.destroy).toHaveBeenCalledTimes(1);
  });
});
