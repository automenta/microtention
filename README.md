## **Overview**
Netention is a self-evolving, intelligent system built around a unified entity called a **Note**. Each Note encapsulates data, behavior, and state, forming a recursive, fractal-like structure where Notes can spawn and manage other Notes. The system is minimalistic, leveraging **LangChain.js** for AI-driven workflows and a graph memory. Designed for Node.js, Netention is event-driven, priority-based, and continuously self-optimizing.

### **Key Features**
- **Unified Notes**: Every entity—data, tools, tasks, UI components—is a Note.
- **Recursive Design**: Notes can create and manage other Notes, enabling infinite scalability.
- **Tool-Driven**: Special Notes (Tools) extend the system’s capabilities (e.g., code generation, reflection).
- **AI-Powered**: Language Models (via LangChain.js) drive intelligent behavior and self-evolution.
- **Console UI**: An interactive, dynamic interface for real-time system control and visualization.

---

## **Design**
Netention is built on a few core principles that ensure simplicity, extensibility, and autonomy:

### **1. Unified Notes**
Everything in Netention is a **Note**, a self-contained entity with:
- **Data** (`content`): Flexible JSON for any purpose (e.g., task description, tool logic).
- **Behavior** (`logic`): A LangChain.js `Runnable` specification defining how the Note acts.
- **State** (`state`): Status (e.g., "running", "pending"), priority, and entropy for resource management.
- **Relationships** (`graph`): Links to other Notes (e.g., subgoals, tools).
- **Memory** (`memory`): References to Memory Notes for historical context.
- **Context** (`context`): Parent Note references for hierarchical organization.
- **Timestamp** (`ts`): Creation/update time.
- **Resources** (`resources`): Token and CPU cycle budgets for fair allocation.

### **2. Recursive Structure**
The system starts from a single **seed Note** (the "root") that spawns other Notes, including Tools and UI components. This recursion allows the system to grow and evolve autonomously.

### **3. Tool-Driven Behavior**
**Tools** are special Notes that extend functionality. They are invoked within other Notes’ `logic` to perform actions like creating new Notes (`know`), generating code (`code_gen`), or rendering the UI (`ui_render`).

### **4. Event-Driven Execution**
The system reacts to Note changes via an event emitter, ensuring that updates (e.g., new Notes, state changes) trigger the appropriate actions (e.g., running a Note’s logic).

---

## **Note Examples**
Here are examples of different Note types to illustrate their structure and purpose:

### **System Note (Root)**
- **Purpose**: Bootstraps the system by spawning core Tools and UI Notes.
- **Key Fields**:
    - `id: "root"`
    - `content: { type: "system", desc: "Netention: Self-evolving knowledge fabric" }`
    - `logic: { type: "sequential", steps: [ ... ] }` (spawns Tools and UI Notes)
    - `state: { status: "running", priority: 100 }`

### **Tool Note**
- **Purpose**: Defines a tool that can be used by other Notes (e.g., `know`, `code_gen`).
- **Key Fields**:
    - `id: "know-tool"`
    - `content: { type: "tool", name: "know", desc: "Create Note", execute: "..." }`
    - `state: { status: "running", priority: 50 }`

### **UI Note**
- **Purpose**: Manages a part of the console UI (e.g., rendering the activity tree).
- **Key Fields**:
    - `id: "ui-tree"`
    - `content: { type: "UI", desc: "Activity Tree" }`
    - `logic: { type: "sequential", steps: [{ tool: "ui_render", input: { target: "tree" } }] }`
    - `state: { status: "running", priority: 80 }`

### **Task Note**
- **Purpose**: Represents a user-defined task (e.g., "Plan day").
- **Key Fields**:
    - `id: "task-123"`
    - `content: { type: "task", desc: "Plan day" }`
    - `state: { status: "pending", priority: 50 }`
    - `logic: { }` (can be extended with custom behavior)

---

## **Tool Examples**
Tools are the building blocks of Netention’s functionality. Here are the core Tools:

### **KnowTool**
- **Role**: Creates new Notes, enabling the system to grow recursively.
- **Usage**: Invoked to spawn new Tasks, Tools, or UI components.

### **CodeGenTool**
- **Role**: Generates JavaScript code using a Language Model.
- **Usage**: Extends the system by creating new tools or modifying existing logic.

### **ReflectTool**
- **Role**: Analyzes a Note’s state and suggests fixes for errors.
- **Usage**: Supports self-healing by spawning corrective Tasks.

### **UIRenderTool**
- **Role**: Renders the console UI (activity tree or log).
- **Usage**: Called by UI Notes to display real-time system state.

### **UIInputTool**
- **Role**: Handles user input from the console.
- **Usage**: Listens for commands like `know task "Plan day"` or `pause`.

### **UIControlTool**
- **Role**: Manages the system’s execution state (pause/resume).
- **Usage**: Toggles the system’s running state and updates the UI.

---

## **Quickstart Guide**
Follow these steps to get started with Netention:

### **1. Setup**
- Ensure **Node.js** is installed (v16+ recommended).
- Install dependencies: `npm install langchain @langchain/google-genai ansi-colors p-limit zod`.

### **2. Run the System**
- Start the system with `node index.js`.
- The console UI will initialize, showing the root Note and UI components.

### **3. Interact via Console**
- At the `> ` prompt, enter commands:
    - `know task "Plan day"`: Creates a new Task Note.
    - `pause`: Pauses the system.
    - `resume`: Resumes the system.
- Observe the activity tree and log update in real-time.

### **4. Extend the System**
- **Create New Tools**: Use `know tool "new_tool"` to define custom tools.
- **Modify Notes**: Update a Note’s `logic` to change its behavior.
- **Experiment**: The system is designed to evolve—try spawning new Notes or adjusting priorities.

---

## **Understanding the System**
- **Notes are Autonomous**: Each Note manages its own lifecycle via its `logic`.
- **Tools Extend Functionality**: Tools are reusable components that can be invoked by any Note.
- **UI is Note-Driven**: The console UI is composed of Notes that render and handle input.
- **Self-Healing**: Errors trigger reflection and corrective actions via the `ReflectTool`.

This README provides a solid foundation for understanding and extending Netention. As the system evolves, so too will its documentation—feel free to contribute!