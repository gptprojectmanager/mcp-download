# Download MCP Tool

[![ISC License](https://img.shields.io/badge/License-ISC-3a86ff?style=flat-square)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-ff006e?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-8338ec?style=flat-square)](https://www.typescriptlang.org/)
[![Download](https://img.shields.io/badge/Download-MCP-fb5607?style=flat-square)](https://github.com/shuakami/mcp-download)


## What is this

This is a download tool based on MCP (Model Context Protocol) that allows AI models to manage file download tasks through a standardized interface.

Simply put, it allows AI assistants to perform various download operations, such as starting multi-threaded downloads, monitoring download progress, managing download tasks, etc., without requiring users to manually input complex commands or switch to other download tools.

<details>
<summary><b>Supported Features</b> (click to expand)</summary>

- **Download Files**: Automatically create multi-threaded download tasks with resume support
- **Task Management**: List, get, pause, resume, cancel and clean download tasks
- **Multi-threaded Download**: Support up to 32 parallel download threads, significantly improving download speed
- **Persistence Feature**: Download tasks can continue running in the background, even if the frontend program is closed
- **Status Monitoring**: Real-time tracking of download progress, speed and elapsed time
- **Flexible Configuration**: Support for blocking/non-blocking, persistent/non-persistent and other modes
</details>

<details>
<summary><b>Feature Highlights</b> (click to expand)</summary>

Here are some core features of the Download MCP tool:

- **Ultra-fast Multi-threaded Download**: Support up to 32 parallel download threads, dramatically improving download speed
- **Smart Resume Support**: Automatically detect interrupted downloads and continue from breakpoints
- **Persistent Download Tasks**: Download tasks continue in the background even when the frontend process is closed
- **Real-time Status Monitoring**: Provides real-time information on download speed, progress, remaining time, etc.
- **Flexible Working Modes**: Support blocking or non-blocking downloads, choose according to your needs
- **Complete Task Management**: Full workflow management for creating, pausing, resuming, cancelling and cleaning download tasks
- **Smart Error Handling**: Automatically retry failed downloads to ensure download success rate

Through simple natural language commands, AI can help you complete all the above operations without manually writing complex commands or using specialized download software.
</details>

## Quick Start

### 0. Environment Setup

<details>
<summary>If you have not used Node.js before (Click to expand)</summary>

1. Install Node.js and npm
   - Visit the [Node.js official website](https://nodejs.org/)
   - Download and install the LTS (Long-Term Support) version
   - Select the default options during installation. The installer will install both Node.js and npm.

2. Verify Installation
   - After installation is complete, open Command Prompt (CMD) or PowerShell
   - Enter the following commands to confirm a successful installation:
     ```bash
     node --version
     npm --version
     ```
   - If the version numbers are displayed, the installation was successful

3. Install Git (if not already installed)
   - Visit the [Git official website](https://git-scm.com/)
   - Download and install Git
   - Use the default options during installation

4. Install Python 3.11 or higher (required)
   - Visit the [Python official website](https://www.python.org/downloads/)
   - Download and install Python 3.11 or a higher version
   - **Important**: You must check the "Add Python to PATH" option during installation
   - After installation, **restart your computer** to ensure the environment variables take effect
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

Follow the steps below to configure MCP according to your operating system:

<details>
<summary><b>Windows Configuration</b> (Click to expand)</summary>

1. In Cursor, open or create the MCP configuration file: `C:\\Users\\your_username\\.cursor\\mcp.json`
   - Note: Please replace `your_username` with your Windows username

2. Add or modify the configuration as follows:

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python",
      "args": [
        "C:/Users/your_username/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **Please note**:
> - Replace `your_username` with your Windows username
> - Ensure the path correctly points to the directory where you cloned or unzipped the project
> - The path should reflect the actual location where you placed the project files
> - **Do not delete the cloned or unzipped folder**, as this will prevent MCP from working correctly
</details>

<details>
<summary><b>macOS Configuration</b> (Click to expand)</summary>

1. In Cursor, open or create the MCP configuration file: `/Users/your_username/.cursor/mcp.json`
   - Note: Please replace `your_username` with your macOS username

2. Add or modify the configuration as follows:

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python3",
      "args": [
        "/Users/your_username/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **Please note**:
> - Replace `your_username` with your macOS username
> - Ensure the path correctly points to the directory where you cloned or unzipped the project
> - The path should reflect the actual location where you placed the project files
> - **Do not delete the cloned or unzipped folder**, as this will prevent MCP from working correctly
</details>

<details>
<summary><b>Linux Configuration</b> (Click to expand)</summary>

1. In Cursor, open or create the MCP configuration file: `/home/your_username/.cursor/mcp.json`
   - Note: Please replace `your_username` with your Linux username

2. Add or modify the configuration as follows:

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python3",
      "args": [
        "/home/your_username/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **Please note**:
> - Replace `your_username` with your Linux username
> - Ensure the path correctly points to the directory where you cloned or unzipped the project
> - The path should reflect the actual location where you placed the project files
> - **Do not delete the cloned or unzipped folder**, as this will prevent MCP from working correctly
</details>

### 4. Start the Service

Once configured, restart the Cursor editor, and it will automatically start the MCP service. You can then begin using it.

<details>
<summary>Usage Examples (Click to expand)</summary>

You can ask the AI to perform the following actions:
- "Download https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi to my downloads folder"
- "Show all current download tasks"
- "Check the status of download ID abc123"
- "Pause the current download task"
- "Resume download ID abc123 using 8 threads"
- "Cancel the ongoing download"
- "Clear all completed download tasks"

Advanced Usage:
- "Use 32 threads to download https://dlcdn.apache.org/tomcat/tomcat-10/v10.1.19/bin/apache-tomcat-10.1.19.zip"
- "Download https://dl.google.com/android/repository/platform-tools-latest-windows.zip in blocking mode" (waits for the download to complete before proceeding)
- "Start a persistent download of https://repo.anaconda.com/archive/Anaconda3-2023.09-0-Windows-x86_64.exe" (continues downloading even if the foreground application is closed)
</details>

## How It Works

<details>
<summary>Technical Implementation Details (Click to expand)</summary>

This tool is implemented based on the **MCP (Model Context Protocol)** standard, acting as a bridge between the AI model and the file download service. It uses **node-fetch** as the underlying download client and **Zod** for request validation and type checking.

Key technical components include:
- **Multi-threaded Download Manager**: Splits large files into multiple segments, downloads them concurrently, and then merges them.
- **Resumable Download System**: Tracks the download progress of each segment, supporting recovery after interruption.
- **Persistent Storage**: Saves the state of download tasks, allowing recovery even if the program restarts.
- **Real-time Monitoring**: Calculates key metrics such as download speed and estimated remaining time.
- **Flexible Operating Modes**: Supports blocking/non-blocking and persistent/non-persistent modes.

Each download operation is encapsulated as a standardized MCP tool, receiving structured parameters and returning formatted results. All download tasks are managed as independent processes, ensuring that downloads can continue safely even if the foreground application is closed.

This design enables the AI model to clearly understand and handle download statuses, and to communicate progress, speed, and other key information to the user in a more natural way.
</details>

## License

ISC

---

If you find this project helpful, please give it a Star ⭐️ (｡♥‿♥｡)
