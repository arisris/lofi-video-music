import m from "mithril";
import { useEffect, useRef } from "react";

interface MithrilBridgeProps {
  /**
   * Legacy Mithril render function returning a vnode tree.
   * Called on every Mithril redraw; the closure is kept fresh via a ref so the
   * container does not remount when its render closure changes.
   */
  render: () => m.Vnode<any>;
}

/**
 * Mounts a legacy Mithril component tree inside a React shell during the
 * migration. Each bridge owns one Mithril root. On unmount it unmounts the
 * Mithril root and removes the hosted DOM.
 */
export const MithrilBridge = ({ render }: MithrilBridgeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef(render);
  renderRef.current = render;

  const mountedRef = useRef(false);

  useEffect(() => {
    const host = containerRef.current;
    if (!host || mountedRef.current) return;

    m.mount(host, { view: () => renderRef.current() });
    mountedRef.current = true;

    return () => {
      m.mount(host, null);
      mountedRef.current = false;
    };
  }, []);

  return <div className="contents" ref={containerRef} />;
};
