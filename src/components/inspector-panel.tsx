import m from "mithril";
import { ClipsPanel } from "./clips-panel";
import { MithrilBridge } from "../compat/mithril-bridge";

/** Inspector dock: hosts the legacy Mithril ClipsPanel during migration. */
export const InspectorPanel = () => (
  <div className="flex flex-col h-full overflow-hidden">
    <div className="flex-1 overflow-hidden">
      <MithrilBridge render={() => m(ClipsPanel)} />
    </div>
  </div>
);
