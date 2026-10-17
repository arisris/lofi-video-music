import m from "mithril";
import { ClipsPanel } from "./clips-panel";

export const InspectorPanel = {
  view() {
    return m("div", { class: "flex flex-col h-full overflow-hidden" }, [
      m("div", { class: "flex-1 overflow-hidden" }, m(ClipsPanel))
    ]);
  }
};
