# Praxis AI - High-Pressure Interview & Assessment Simulator

**Praxis AI** is an AI-powered desktop (Electron) application designed to help candidates build resilience under high-pressure recruitment environments (such as HRPeak). By exposing users to stressful conditions—such as a live camera feed and a strict countdown timer—it helps candidates overcome performance anxiety.

---

## 🌟 Key Features

### 1. Dynamic Talent Assessment Engine (Asynchronous Chunking)
To prevent token limit bottlenecks and optimize latency, a **Scatter-Gather (Split-Collect)** architecture is implemented. With one click, the system fires parallel requests to the Gemini API for each category:
*   **Numerical Reasoning:** Logic-based math problems focusing on analytical thinking and equation setting rather than simple formulas.
*   **Verbal Reasoning:** Logic puzzles focusing on reading comprehension, logical deduction, and analogy.
*   **Data & Chart Interpretation:** JSON-formatted datasets generated dynamically by the AI and rendered as interactive charts on the frontend using **Recharts**.
*   **Abstract Reasoning:** Pattern matching and visual sequence questions with clean, monochrome **SVG graphics** generated directly by the LLM.

### 2. High-Stress Simulation (Strict UI)
Mirrors the intimidating atmosphere of real HR assessment platforms:
*   **Countdown Timer:** A strict timer calculated per question based on difficulty (e.g., 60 seconds). Once it expires, the app automatically advances.
*   **Live Camera Mirroring:** Displays a mirrored webcam feed to simulate the self-view experience in recruitment portals, helping users get used to speaking under observation.
*   **Flashing Recording Alert:** A pulsing red "RECORDING" indicator to simulate live proctoring.

### 3. Gemini 3.5 Flash Integration
Utilizes Google's fast and highly structured **Gemini 3.5 Flash** model with JSON schema enforcement to guarantee consistent, syntax-error-free assessments based on the user's custom question count, duration, and language preferences.

---

## 🛠️ Tech Stack

*   **Core:** React (TypeScript) + Vite
*   **Desktop Wrapper:** Electron (electron-vite)
*   **Styling:** Tailwind CSS + Vanilla CSS (Glassmorphism & Industrial Dark Theme)
*   **Charts:** Recharts (Interactive SVG Charts)
*   **AI Integration:** `@google/generative-ai` (Gemini SDK)

---

## 🚀 Installation & Running

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   An active [Google AI Studio (Gemini) API Key](https://aistudio.google.com/)

### Step-by-Step Setup

1. Clone or download the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/praxis-ai-interview-simulator.git
   cd praxis-ai-interview-simulator
   ```

2. Install all required dependencies:
   ```bash
   npm install
   ```

3. Run the application in Development mode:
   ```bash
   npm run dev
   ```

4. Build and package the application as a standalone executable (Windows):
   ```bash
   npm run build
   ```
   *Note: Your packaged executable will be generated at `dist-electron/win-unpacked/Praxis.exe`.*

---

## 🔒 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.
