import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./tailwind.css";

// React entry point (replaces the legacy Mithril entry `main.js`).
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // Fast Refresh handles component updates; a full accept keeps state.
  });
}
