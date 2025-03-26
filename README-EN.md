# Download MCP Tool

[![ISC License](https://img.shields.io/badge/License-ISC-3a86ff?style=flat-square)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-ff006e?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-8338ec?style=flat-square)](https://www.typescriptlang.org/)
[![Download](https://img.shields.io/badge/Download-MCP-fb5607?style=flat-square)](https://github.com/shuakami/mcp-download)

[中文版 (README.md)](README.md)

## What is this?

This is a download tool based on MCP (Model Context Protocol) that allows AI models to manage file download tasks through standardized interfaces.

In simple terms, it enables AI assistants to perform various download operations such as initiating multi-threaded downloads, monitoring download progress, managing download tasks, etc., without requiring users to manually input complex commands or switch to other download tools.

<details>
<summary><b>Supported Features</b> (click to expand)</summary>

- **Download Files**: Automatically create multi-threaded download tasks with resume capability
- **Task Management**: List, get, pause, resume, cancel, and clean up download tasks
- **Multi-threading**: Support up to 32 threads for parallel downloading, significantly improving download speed
- **Persistence**: Download tasks can continue running in the background, even after closing the frontend application
- **Status Monitoring**: Real-time tracking of download progress, speed, and time spent
- **Flexible Configuration**: Support for blocking/non-blocking, persistent/non-persistent modes
</details>

<details>
<summary><b>Key Features</b> (click to expand)</summary>

Here are some core features of the Download MCP tool:

- **High-speed Multi-threaded Downloads**: Support for up to 32 parallel threads, greatly enhancing download speed
- **Smart Resume Capability**: Automatically detect interrupted downloads and continue from where they left off
- **Persistent Download Tasks**: Downloads continue in the background even after closing the frontend process
- **Real-time Status Monitoring**: Provides real-time information on download speed, progress, remaining time, etc.
- **Flexible Working Modes**: Support for blocking or non-blocking downloads, depending on your needs
- **Complete Task Management**: Full lifecycle management for creating, pausing, resuming, canceling, and cleaning up download tasks
- **Intelligent Error Handling**: Automatic retry for failed downloads, ensuring high success rate

With simple natural language instructions, AI can help you complete all the above operations without having to manually write complex commands or use specialized download software.
</details>

## Quick Start

### 0. Environment Setup

<details>
<summary>If you haven't used Node.js before (click to expand)</summary>

1. Install Node.js and npm
   - Visit the [Node.js website](https://nodejs.org/)
   - Download and install the LTS (Long Term Support) version
   - Select default options during installation; the package will install both Node.js and npm

2. Verify Installation
   - After installation, open Command Prompt (CMD) or PowerShell
   - Enter the following commands to confirm successful installation:
     ```bash
     node --version
     npm --version
     ```
   - If version numbers appear, the installation was successful

3. Install Git (if not already installed)
   - Visit the [Git website](https://git-scm.com/)
   - Download and install Git
   - Use default options during installation

4. Install Python 3.11 or higher (required)
   - Visit the [Python website](https://www.python.org/downloads/)
   - Download and install Python 3.11 or higher
   - **Important**: Check the "Add Python to PATH" option during installation
   - **Restart your computer** after installation to ensure environment variables take effect
</details>

### 1. Clone and Install

```bash
git clone https://github.com/shuakami/mcp-download.git
cd mcp-download
npm install
npm run build
```

### 2. Build the Project

```bash
npm run build
```

### 3. Add to Cursor MCP Configuration

Configure MCP according to your operating system by following these steps:

<details>
<summary><b>Windows Configuration</b> (click to expand)</summary>

1. In Cursor, open or create the MCP configuration file: `C:\\Users\\YourUsername\\.cursor\\mcp.json`
   - Note: Replace `YourUsername` with your Windows username

2. Add or modify the configuration as follows:

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python",
      "args": [
        "C:/Users/YourUsername/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **Please note**:
> - Replace `YourUsername` with your Windows username
> - Ensure the path correctly points to the project directory you cloned or extracted
> - The path should reflect the actual location where you placed the project files
> - **Do not delete the cloned or extracted folder**, as this will cause MCP to malfunction
</details>

<details>
<summary><b>macOS Configuration</b> (click to expand)</summary>

1. In Cursor, open or create the MCP configuration file: `/Users/YourUsername/.cursor/mcp.json`
   - Note: Replace `YourUsername` with your macOS username

2. Add or modify the configuration as follows:

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python3",
      "args": [
        "/Users/YourUsername/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **Please note**:
> - Replace `YourUsername` with your macOS username
> - Ensure the path correctly points to the project directory you cloned or extracted
> - The path should reflect the actual location where you placed the project files
> - **Do not delete the cloned or extracted folder**, as this will cause MCP to malfunction
</details>

<details>
<summary><b>Linux Configuration</b> (click to expand)</summary>

1. In Cursor, open or create the MCP configuration file: `/home/YourUsername/.cursor/mcp.json`
   - Note: Replace `YourUsername` with your Linux username

2. Add or modify the configuration as follows:

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python3",
      "args": [
        "/home/YourUsername/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **Please note**:
> - Replace `YourUsername` with your Linux username
> - Ensure the path correctly points to the project directory you cloned or extracted
> - The path should reflect the actual location where you placed the project files
> - **Do not delete the cloned or extracted folder**, as this will cause MCP to malfunction
</details>

### 4. Start the Service

After configuration, restart the Cursor editor, which will automatically start the MCP service. Then you can begin using it.

<details>
<summary>Usage Examples (click to expand)</summary>

You can ask the AI to perform the following operations:
- "Download https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi to my downloads folder"
- "Show all current download tasks" 
- "Check the status of download ID abc123"
- "Pause the current download task"
- "Resume download ID abc123 using 8 threads"
- "Cancel the ongoing download"
- "Clean up all completed download tasks"

Advanced usage:
- "Download https://dlcdn.apache.org/tomcat/tomcat-10/v10.1.19/bin/apache-tomcat-10.1.19.zip using 32 threads"
- "Download https://dl.google.com/android/repository/platform-tools-latest-windows.zip in blocking mode" (waits for download to complete before continuing)
- "Start a persistent download of https://repo.anaconda.com/archive/Anaconda3-2023.09-0-Windows-x86_64.exe" (continues downloading even if the frontend program is closed)
</details>

## How It Works

<details>
<summary>Technical Implementation Details (click to expand)</summary>

This tool is implemented based on the **MCP (Model Context Protocol)** standard, serving as a bridge between AI models and file download services. It uses **node-fetch** as the underlying download client and **Zod** for request validation and type checking.

Key technical components include:
- **Multi-threaded Download Manager**: Splits large files into multiple segments, downloads them concurrently, and then merges them
- **Resume System**: Tracks the download progress of each segment, supporting resumption after interruption
- **Persistent Storage**: Saves download task states, allowing recovery even after program restart
- **Real-time Monitoring**: Calculates key metrics such as download speed and estimated time remaining
- **Flexible Working Modes**: Supports blocking/non-blocking and persistent/non-persistent modes

Each download operation is encapsulated as a standardized MCP tool, receiving structured parameters and returning formatted results. All download tasks are managed as independent processes, ensuring that downloads can safely continue even if the frontend program is closed.

This design allows AI models to clearly understand and process download states, and communicate download progress, speed, and other key information to users in a more natural way.
</details>

## License

ISC

---

If this project is helpful to you, please consider giving it a Star ⭐️ (｡♥‿♥｡) 