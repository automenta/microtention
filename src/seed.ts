// seed.ts
export const seed: Note = {
    id: "root",
    content: {
        type: "system",
        desc: "Netention v5: Self-evolving knowledge fabric",
        config: { maxMemory: 50, tickRate: 10, tokenBudget: 5000, defaultPriority: 50 },
        metamodel: { note: { id: "string", content: "any", graph: "array" }, rules: ["spawn", "prune"] },
        prompts: { plan: "Plan: {desc}", gen: "Generate: {prompt}", eval: "Eval: {expr}" }
    },
    graph: [],
    state: { status: "running", priority: 100, entropy: 0 },
    memory: [],
    tools: {},
    context: [],
    ts: new Date().toISOString(),
    resources: { tokens: 5000, cycles: 10000 },
    logic: {
        type: "sequential",
        steps: [
            { tool: "spawn", input: { content: { type: "tool", name: "spawn", desc: "Create Note", execute: "kv.put" } } },
            { tool: "spawn", input: { content: { type: "tool", name: "code_gen", desc: "Generate JS", execute: "code_gen" } } },
            { tool: "spawn", input: { content: { type: "tool", name: "reflect", desc: "Self-analyze", execute: "reflect" } } },
            { tool: "spawn", input: { content: { type: "tool", name: "ui_render", desc: "Render UI", execute: "uiRender" } } },
            { tool: "spawn", input: { content: { type: "tool", name: "ui_input", desc: "Handle input", execute: "uiInput" } } },
            { tool: "spawn", input: { content: { type: "tool", name: "ui_control", desc: "Control execution", execute: "uiControl" } } },
            { tool: "spawn", input: { content: { type: "UI", id: "ui-tree", desc: "Activity Tree", state: { status: "running", priority: 80 }, logic: { type: "sequential", steps: [{ tool: "ui_render", input: { target: "tree", desc: "Render tree" } }] } } } },
            { tool: "spawn", input: { content: { type: "UI", id: "ui-log", desc: "Log Display", state: { status: "running", priority: 70 }, logic: { type: "sequential", steps: [{ tool: "ui_render", input: { target: "log", desc: "Render log" } }] } } } },
            { tool: "spawn", input: { content: { type: "UI", id: "ui-prompt", desc: "Input Prompt", state: { status: "running", priority: 60 }, logic: { type: "sequential", steps: [{ tool: "ui_input", input: {} }] } } } },
            { tool: "spawn", input: { content: { type: "UI", id: "ui-status", desc: "Execution Status", content: { paused: false }, state: { status: "running", priority: 90 }, logic: { type: "sequential", steps: [{ tool: "ui_control", input: { desc: "Update status" } }] } } } }
        ]
    }
};

export type Note = {
    id: string;
    content: any;
    graph: { target: string; rel: string }[];
    state: { status: string; priority: number; entropy: number };
    memory: string[];
    tools: Record<string, string>;
    context: string[];
    ts: string;
    resources: { tokens: number; cycles: number };
    logic: any;
};