import pc from "ansi-colors"; const red = pc.red, blue = pc.blue, yellow = pc.yellow, green = pc.green, bold = pc.bold;
import { EventEmitter } from "node:events";
import pLimit from "p-limit";
import { seed, Note } from "./seed";
import { stdin, stdout } from "process";
import { SequentialChain } from "langchain/chains";
import { StructuredTool } from "langchain/tools";
import { z } from "zod";

const emitter = new EventEmitter();
const kv = new Map<string, Note>();
const limit = pLimit(10);

// --- Custom Tools ---
class SpawnTool extends StructuredTool {
    name = "spawn";
    description = "Creates a new Note in the system";
    schema = z.object({ content: z.any() });

    async _call(toolInput: { content: any }) {
        const content = toolInput.content || {};
        const newNote: Note = {
            id: content.id || `${content.type || "tool"}-${Date.now()}`,
            content: content,
            state: content.state || { status: "running", priority: 50, entropy: 0 },
            graph: [],
            memory: [],
            tools: {},
            context: content.context || ["root"],
            ts: new Date().toISOString(),
            resources: { tokens: 100, cycles: 100 },
            logic: content.logic || {}
        };
        await saveNote(newNote);
        // Only run if not self-spawning to avoid infinite recursion
        if (newNote.content.name !== "spawn") await runNote(newNote.id);
        return { status: "done", content: newNote, memory: `Spawned ${newNote.id}` };
    }
}

class CodeGenTool extends StructuredTool {
    name = "code_gen";
    description = "Placeholder for code generation";
    schema = z.object({});

    async _call(_: any) {
        return { status: "done", content: {}, memory: "Code generation placeholder" };
    }
}

class ReflectTool extends StructuredTool {
    name = "reflect";
    description = "Placeholder for self-analysis";
    schema = z.object({});

    async _call(_: any) {
        return { status: "done", content: {}, memory: "Reflection placeholder" };
    }
}

class UIRenderTool extends StructuredTool {
    name = "ui_render";
    description = "Renders the console UI";
    schema = z.object({ target: z.enum(["tree", "log"]), desc: z.string() });

    async _call(args: { target: "tree" | "log"; desc: string }) {
        if (args.target === "tree") {
            const notes = Array.from(kv.values())
                .filter(n => n.state.status === "running" || n.state.status === "pending")
                .sort((a, b) => b.state.priority - a.state.priority);
            let output = "";
            for (const n of notes) {
                const status = n.state.status === "running" ? green("●") : yellow("○");
                output += `${status} ${n.id} (${n.content.desc || "Untitled"}) [${n.state.priority}]\n`;
                const subgoals = n.graph.filter(g => g.rel === "embeds").map(g => kv.get(g.target)).filter(Boolean);
                if (subgoals.length) output += subgoals.map(s => `  ├─ ${s.state.status === "running" ? green("●") : yellow("○")} ${s.id} [${s.state.priority}]`).join("\n") + "\n";
            }
            stdout.write(`${blue("Active Notes:\n")}${output}\n`);
        } else if (args.target === "log") {
            const root = loadNote("root");
            const logNotes = root.memory.map(id => kv.get(id)).filter(Boolean).slice(-20);
            const logOutput = logNotes.map(n => n.content.includes("Error") ? `${red("🔴")} ${n.content}` : `${green("🟢")} ${n.content}`).join("\n");
            stdout.write(`${blue("Log:\n")}${logOutput}\n`);
        }
        return { status: "running", content: {}, memory: `${args.desc}` };
    }
}

class UIInputTool extends StructuredTool {
    name = "ui_input";
    description = "Handles console input";
    schema = z.object({});

    async _call(_: any) {
        stdout.write("> ");
        stdin.setRawMode(true);
        stdin.on("data", async (data) => {
            const input = data.toString().trim();
            if (input === "pause" || input === "resume") {
                const task: Note = { id: `control-${Date.now()}`, content: { type: "task", desc: input, logic: { type: "sequential", steps: [{ tool: "ui_control", input: { command: input, desc: "Toggle execution" } }] } }, state: { status: "running", priority: 90 }, graph: [], memory: [], tools: {}, context: ["ui-prompt"], ts: new Date().toISOString(), resources: { tokens: 100, cycles: 100 }, logic: {} };
                await saveNote(task);
            } else if (input.startsWith("spawn")) {
                const [_, type, desc] = input.match(/spawn\s+(\w+)\s+"([^"]+)"/) || [];
                if (type && desc) {
                    const newNote: Note = { id: `${type}-${Date.now()}`, content: { type, desc }, state: { status: "pending", priority: 50 }, graph: [], memory: [], tools: {}, context: ["root"], ts: new Date().toISOString(), resources: { tokens: 100, cycles: 100 }, logic: {} };
                    await saveNote(newNote);
                }
            }
        });
        return { status: "running", content: {}, memory: "Input handler started" };
    }
}

class UIControlTool extends StructuredTool {
    name = "ui_control";
    description = "Controls execution state";
    schema = z.object({ command: z.string().optional(), desc: z.string() });

    async _call(args: { command?: string; desc: string }) {
        let statusNote: Note;
        for (let i = 0; i < 10; i++) {
            try {
                statusNote = loadNote("ui-status");
                break;
            } catch {
                await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
            }
        }
        if (!statusNote!) statusNote = { id: "ui-status", content: { paused: false }, state: { status: "running", priority: 90, entropy: 0 }, graph: [], memory: [], tools: {}, context: ["root"], ts: new Date().toISOString(), resources: { tokens: 100, cycles: 100 }, logic: {} };

        if (args.command === "pause") statusNote.content.paused = true;
        else if (args.command === "resume") statusNote.content.paused = false;
        const status = statusNote.content.paused ? yellow("PAUSED") : green("RUNNING");
        stdout.write(`${bold("Netention v5")} - ${status}\n`);
        await saveNote(statusNote);
        return { status: "running", content: statusNote.content, memory: `${args.desc}` };
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
    console.log(`${yellow("⚡")} Saved ${note.id}`);
    emitter.emit("update", "change", note.id);
}

async function runNote(id: string): Promise<void> {
    try {
        const note = loadNote(id);
        const statusNote = kv.get("ui-status") || { content: { paused: false } };
        if (statusNote.content.paused || note.state.status !== "running") return;

        console.log(`${blue("▶️")} Running ${id}`);
        const tools = [new SpawnTool(), new CodeGenTool(), new ReflectTool(), new UIRenderTool(), new UIInputTool(), new UIControlTool()];

        if (note.logic.steps) {
            // Chain Note
            const chain = new SequentialChain({
                chains: note.logic.steps.map((step: any) => ({
                    call: async (input: any) => {
                        const tool = tools.find(t => t.name === step.tool);
                        if (!tool) throw new Error(`Tool ${step.tool} not found`);
                        console.log(`${green("🔧")} ${id} executing ${step.tool}`);
                        return await tool.call(step.input);
                    }
                })),
                inputVariables: [],
                returnAll: true
            });

            const result = await chain.call({});
            note.state.status = result.status || "done";
            note.content = { ...note.content, ...result.content };
            if (result.memory) note.memory.push(await saveMemory(note.id, result.memory));
        } else if (note.logic.execute) {
            // Tool Note
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
    const memory: Note = { id, content: entry, state: { status: "done", priority: 0 }, graph: [], memory: [], tools: {}, context: [parentId], ts: new Date().toISOString(), resources: { tokens: 0, cycles: 0 }, logic: {} };
    await saveNote(memory);
    return id;
}

// --- Event Handling ---
async function handleEvent(event: string, id: string) {
    if (event === "change") {
        limit(() => runNote(id)).catch(err => {
            console.error(`${red("❌")} Error running ${id}: ${err.message}`);
            saveMemory(id, `Error: ${err.message}`);
        });
    }
}

// --- Main ---
async function main() {
    console.log(`${green("🚀")} Starting Netention v5`);
    await saveNote(seed);
    await runNote("root");

    emitter.on("update", handleEvent);

    // Initial UI render
    await new UIRenderTool().call({ target: "tree", desc: "Activity Tree" });
    await new UIRenderTool().call({ target: "log", desc: "Log Display" });

    setInterval(async () => {
        //stdout.write("\x1Bc"); // Clear screen
        await new UIRenderTool().call({ target: "tree", desc: "Activity Tree" });
        await new UIRenderTool().call({ target: "log", desc: "Log Display" });
    }, 500);

    await saveMemory("root", "System started");
}

main().catch(err => console.error(`${red("❌")} Main error: ${err.message}`));