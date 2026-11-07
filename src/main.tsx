import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./tailwind.css";

// Fresh entry point (rewritten from scratch).
// Old implementation references: src_old/app.tsx, src_old/main.tsx
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
