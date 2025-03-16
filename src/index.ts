import pc from "ansi-colors";
const { red, blue, yellow, green, bold } = pc;
import { EventEmitter } from "node:events";
import pLimit from "p-limit";
import { seed, Note } from "./seed.js";
import { stdin, stdout } from "process";
import { SequentialChain } from "langchain/chains";
import { StructuredTool } from "langchain/tools";
import { z } from "zod";

const emitter = new EventEmitter();
const kv = new Map<string, Note>();
const limit = pLimit(10);
const log: string[] = [];

class SpawnTool extends StructuredTool {
    name = "spawn";
    description = "Creates a new Note";
    schema = z.object({ content: z.any() });

    async _call({ content }: { content: any }) {
        const newNote: Note = {
            id: content.id || `${content.type || "note"}-${Date.now()}`,
            content,
            state: content.state || { status: "running", priority: 50, entropy: 0 },
            graph: [],
            memory: [],
            tools: {},
            context: content.context || ["root"],
            ts: new Date().toISOString(),
            resources: content.resources || { tokens: 100, cycles: 100 },
            logic: content.logic || {}
        };
        await saveNote(newNote);
        if (newNote.content.name !== "spawn") await runNote(newNote.id); // Avoid recursion
        log.push(`${green("🟢")} Spawned ${newNote.id}`);
        return { status: "done", content: newNote };
    }
}

class CodeGenTool extends StructuredTool {
    name = "code_gen";
    description = "Generates code (placeholder)";
    schema = z.object({});

    async _call(_: any) {
        log.push(`${yellow("⚙️")} Code generation placeholder`);
        return { status: "done", content: {} };
    }
}

class ReflectTool extends StructuredTool {
    name = "reflect";
    description = "Self-analyzes (placeholder)";
    schema = z.object({});

    async _call(_: any) {
        log.push(`${blue("🔍")} Reflection placeholder`);
        return { status: "done", content: {} };
    }
}

class UIRenderTool extends StructuredTool {
    name = "ui_render";
    description = "Renders console UI";
    schema = z.object({ target: z.enum(["tree", "log"]), desc: z.string() });

    async _call({ target, desc }: { target: "tree" | "log"; desc: string }) {
        if (target === "tree") {
            const notes = Array.from(kv.values())
                .filter(n => n.state.status === "running" || n.state.status === "pending")
                .sort((a, b) => b.state.priority - a.state.priority);
            let output = "";
            for (const n of notes) {
                const status = n.state.status === "running" ? green("●") : yellow("○");
                output += `${status} ${n.id} (${n.content.desc || "Untitled"}) [${n.state.priority}]\n`;
                const subgoals = n.graph
                    .filter(g => g.rel === "embeds")
                    .map(g => kv.get(g.target))
                    .filter(Boolean) as Note[];
                if (subgoals.length) {
                    output += subgoals
                        .map(s => `  ├─ ${s.state.status === "running" ? green("●") : yellow("○")} ${s.id} [${s.state.priority}]`)
                        .join("\n") + "\n";
                }
            }
            stdout.write(`${blue("Active Notes:\n")}${output}\n`);
        } else if (target === "log") {
            const logOutput = log.slice(-20).join("\n");
            stdout.write(`${blue("Log:\n")}${logOutput}\n`);
        }
        return { status: "running", memory: `${desc}` };
    }
}

class UIInputTool extends StructuredTool {
    name = "ui_input";
    description = "Handles user input";
    schema = z.object({});

    async _call(_: any) {
        stdout.write("> ");
        stdin.setRawMode(true);
        stdin.on("data", async (data) => {
            const input = data.toString().trim();
            if (input === "pause" || input === "resume") {
                const task: Note = {
                    id: `control-${Date.now()}`,
                    content: { type: "task", desc: input, logic: { type: "sequential", steps: [{ tool: "ui_control", input: { command: input, desc: "Toggle execution" } }] } },
                    state: { status: "running", priority: 90, entropy: 0 },
                    graph: [],
                    memory: [],
                    tools: {},
                    context: ["ui-prompt"],
                    ts: new Date().toISOString(),
                    resources: { tokens: 100, cycles: 100 }
                };
                await saveNote(task);
            } else if (input.startsWith("spawn")) {
                const [_, type, desc] = input.match(/spawn\s+(\w+)\s+"([^"]+)"/) || [];
                if (type && desc) {
                    const newNote: Note = {
                        id: `${type}-${Date.now()}`,
                        content: { type, desc },
                        state: { status: "pending", priority: 50, entropy: 0 },
                        graph: [],
                        memory: [],
                        tools: {},
                        context: ["root"],
                        ts: new Date().toISOString(),
                        resources: { tokens: 100, cycles: 100 },
                        logic: {}
                    };
                    await saveNote(newNote);
                }
            }
        });
        return { status: "running" };
    }
}

class UIControlTool extends StructuredTool {
    name = "ui_control";
    description = "Controls execution state";
    schema = z.object({ command: z.string().optional(), desc: z.string() });

    async _call({ command, desc }: { command?: string; desc: string }) {
        let statusNote = kv.get("ui-status");
        if (!statusNote) {
            statusNote = { id: "ui-status", content: { paused: false }, state: { status: "running", priority: 90, entropy: 0 }, graph: [], memory: [], tools: {}, context: ["root"], ts: new Date().toISOString(), resources: { tokens: 100, cycles: 100 }, logic: {} };
            await saveNote(statusNote);
        }
        if (command === "pause") statusNote.content.paused = true;
        else if (command === "resume") statusNote.content.paused = false;
        const status = statusNote.content.paused ? yellow("PAUSED") : green("RUNNING");
        stdout.write(`${bold("Netention v5")} - ${status}\n`);
        await saveNote(statusNote);
        log.push(`${statusNote.content.paused ? yellow("⏸️") : green("▶️")} ${desc}`);
        return { status: "running", content: statusNote.content };
    }
}

// --- Core Functions ---
function loadNote(id: string): Note {
    const note = kv.get(id);
    if (!note) throw new Error(`Note ${id} not found`);
    return note;
}

async function saveNote(note: Note): Promise<void> {
    kv.set(note.id, note);
    emitter.emit("update", "change", note.id);
}

async function runNote(id: string): Promise<void> {
    try {
        const note = loadNote(id);
        const statusNote = kv.get("ui-status") || { content: { paused: false } };
        if (statusNote.content.paused || note.state.status !== "running") return;

        console.log(`${blue("▶️")} Running ${id}`);
        const tools = [new SpawnTool(), new CodeGenTool(), new ReflectTool(), new UIRenderTool(), new UIInputTool(), new UIControlTool()];

        if (note.logic.type === "sequential" && note.logic.steps) {
            const chain = new SequentialChain({
                chains: note.logic.steps.map((step: any) => ({
                    call: async (input: any) => {
                        const tool = tools.find(t => t.name === step.tool);
                        if (!tool) throw new Error(`Tool ${step.tool} not found`);
                        console.log(`${green("🔧")} ${id} executing ${step.tool}`);
                        return await tool.call(step.input || {});
                    }
                })),
                inputVariables: [],
                returnAll: true
            });
            const result = await chain.call({});
            note.state.status = result.status || "done";
            note.content = { ...note.content, ...result.content };
            if (result.memory) note.memory.push(await saveMemory(note.id, result.memory));
        } else if (note.content.name) {
            const tool = tools.find(t => t.name === note.content.name);
            if (!tool) throw new Error(`Tool ${note.content.name} not found`);
            console.log(`${green("🔧")} ${id} executing ${note.content.name}`);
            const result = await tool.call(note.logic.input || {});
            note.state.status = result.status || "done";
            note.content = { ...note.content, ...result.content };
            if (result.memory) note.memory.push(await saveMemory(note.id, result.memory));
        }
        await saveNote(note);
    } catch (err) {
        console.error(`${red("❌")} Error running ${id}: ${err.message}`);
        await saveMemory(id, `Error: ${err.message}`);
    }
}

async function saveMemory(parentId: string, entry: string): Promise<string> {
    const id = `${parentId}-${Date.now()}`;
    const memory: Note = {
        id,
        content: entry,
        state: { status: "done", priority: 0, entropy: 0 },
        graph: [],
        memory: [],
        tools: {},
        context: [parentId],
        ts: new Date().toISOString(),
        resources: { tokens: 0, cycles: 0 },
        logic: {}
    };
    await saveNote(memory);
    return id;
}

// --- Event Handling ---
async function handleEvent(event: string, id: string) {
    if (event === "change") await limit(() => runNote(id));
}

// --- Main ---
async function main() {
    console.log(`${green("🚀")} Starting Netention v5`);
    await saveNote(seed);
    await runNote("root");

    emitter.on("update", handleEvent);

    // Periodic UI refresh
    setInterval(async () => {
        stdout.write("\x1Bc"); // Clear screen
        await new UIControlTool().call({ desc: "Status update" });
        await new UIRenderTool().call({ target: "tree", desc: "Activity Tree" });
        await new UIRenderTool().call({ target: "log", desc: "Log Display" });
    }, 500);
}

main().catch(err => console.error(`${red("❌")} Main error: ${err.message}`));