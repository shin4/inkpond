import { useEffect, useRef } from "react";
import {
  createInkPond,
  type InkPondOptions,
  type InkPond as Pond,
} from "./controller.js";

export interface InkPondProps extends Omit<InkPondOptions, "active"> {
  /** Whether the view under the pond is on screen (default true). */
  active?: boolean;
  className?: string;
  /** Receives the live pond (ripple, drop…) while mounted, null after. */
  pondRef?: { current: Pond | null };
}

/**
 * One canvas filling its positioned parent, which it also takes pointer input
 * from. Elements inside that parent marked `data-inkpond-avoid` keep a clear
 * zone. Options are read once per mount; `active` is pushed live.
 * Import "inkpond/inkpond.css" (or give the canvas your own sizing).
 */
export const InkPond = ({
  active = true,
  className,
  pondRef,
  ...options
}: InkPondProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const livePond = useRef<Pond | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const optionsRef = useRef(options);

  // biome-ignore lint/correctness/useExhaustiveDependencies: options are mount-time; remount (key) to change them
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pond = createInkPond(canvas, {
      ...optionsRef.current,
      active: activeRef.current,
    });
    livePond.current = pond;
    if (pondRef) pondRef.current = pond;
    return () => {
      pond.destroy();
      livePond.current = null;
      if (pondRef?.current === pond) pondRef.current = null;
    };
  }, [options.reducedMotion]);

  useEffect(() => {
    livePond.current?.setActive(active);
  }, [active]);

  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: purely decorative canvas, no tabIndex/handlers — never receives focus
    <canvas
      aria-hidden="true"
      className={className ? `inkpond ${className}` : "inkpond"}
      ref={canvasRef}
    />
  );
};
