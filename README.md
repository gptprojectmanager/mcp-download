# Download MCP 工具

[![ISC License](https://img.shields.io/badge/License-ISC-3a86ff?style=flat-square)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-ff006e?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-8338ec?style=flat-square)](https://www.typescriptlang.org/)
[![Download](https://img.shields.io/badge/Download-MCP-fb5607?style=flat-square)](https://github.com/shuakami/mcp-download)

[English Version (README-EN.md)](README-EN.md)

## 这是什么

这是一个基于 MCP (Model Context Protocol) 的下载工具，它能让 AI 模型通过标准化接口管理文件下载任务。

简单来说，它让 AI 助手能够执行各种下载操作，如启动多线程下载、监控下载进度、管理下载任务等，无需用户手动输入复杂的命令或切换到其他下载工具。

<details>
<summary><b>支持的功能</b> (点击展开)</summary>

- **下载文件**：自动创建多线程下载任务，支持断点续传
- **任务管理**：列出、获取、暂停、恢复、取消和清理下载任务
- **多线程下载**：支持多达32线程并行下载，显著提升下载速度
- **持久化功能**：下载任务可在后台持续运行，即使关闭前台程序
- **状态监控**：实时跟踪下载进度、速度和耗时
- **灵活配置**：支持阻塞/非阻塞、持久化/非持久化等多种模式
</details>

<details>
<summary><b>功能特点</b> (点击展开)</summary>

以下是 Download MCP 工具的一些核心特点：

- **极速多线程下载**：最高支持32线程并行下载，大幅提升下载速度
- **智能断点续传**：自动检测中断的下载并从断点处继续
- **持久化下载任务**：即使关闭前台进程，下载任务也会在后台继续
- **实时状态监控**：提供下载速度、进度、剩余时间等实时信息
- **灵活的工作模式**：支持阻塞式或非阻塞式下载，根据需求选择
- **完整的任务管理**：创建、暂停、恢复、取消和清理下载任务的全流程管理
- **智能错误处理**：自动重试失败的下载，确保下载成功率

通过简单的自然语言指令，AI 可以帮助你完成上述所有操作，无需手动编写复杂命令或使用专门的下载软件。
</details>

## 快速上手

### 0. 环境准备

<details>
<summary>如果你之前没有使用过 Node.js (点击展开)</summary>

1. 安装 Node.js 和 npm
   - 访问 [Node.js 官网](https://nodejs.org/)
   - 下载并安装 LTS（长期支持）版本
   - 安装时选择默认选项即可，安装包会同时安装 Node.js 和 npm

2. 验证安装
   - 安装完成后，打开命令提示符（CMD）或 PowerShell
   - 输入以下命令确认安装成功：
     ```bash
     node --version
     npm --version
     ```
   - 如果显示版本号，则表示安装成功

3. 安装 Git（如果尚未安装）
   - 访问 [Git 官网](https://git-scm.com/)
   - 下载并安装 Git
   - 安装时使用默认选项即可

4. 安装 Python 3.11 或更高版本（必需）
   - 访问 [Python 官网](https://www.python.org/downloads/)
   - 下载并安装 Python 3.11 或更高版本
   - **重要**：安装时必须勾选"Add Python to PATH"选项
   - 安装完成后**重启电脑**，确保环境变量生效
</details>

### 1. 克隆并安装

```bash
git clone https://github.com/shuakami/mcp-download.git
cd mcp-download
npm install
npm run build
```

### 2. 构建项目

```bash
npm run build
```

### 3. 添加到 Cursor MCP 配置

根据你的操作系统，按照以下步骤配置 MCP：

<details>
<summary><b>Windows 配置</b> (点击展开)</summary>

1. 在 Cursor 中，打开或创建 MCP 配置文件：`C:\\Users\\你的用户名\\.cursor\\mcp.json`
   - 注意：请将 `你的用户名` 替换为你的 Windows 用户名

2. 添加或修改配置如下：

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python",
      "args": [
        "C:/Users/你的用户名/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **请注意**:
> - 将 `你的用户名` 替换为你的 Windows 用户名
> - 确保路径正确指向你克隆或解压的项目目录
> - 路径应该反映你将项目文件放置的实际位置
> - **不要删除克隆或解压的文件夹**，这会导致 MCP 无法正常工作
</details>

<details>
<summary><b>macOS 配置</b> (点击展开)</summary>

1. 在 Cursor 中，打开或创建 MCP 配置文件：`/Users/你的用户名/.cursor/mcp.json`
   - 注意：请将 `你的用户名` 替换为你的 macOS 用户名

2. 添加或修改配置如下：

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python3",
      "args": [
        "/Users/你的用户名/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **请注意**:
> - 将 `你的用户名` 替换为你的 macOS 用户名
> - 确保路径正确指向你克隆或解压的项目目录
> - 路径应该反映你将项目文件放置的实际位置
> - **不要删除克隆或解压的文件夹**，这会导致 MCP 无法正常工作
</details>

<details>
<summary><b>Linux 配置</b> (点击展开)</summary>

1. 在 Cursor 中，打开或创建 MCP 配置文件：`/home/你的用户名/.cursor/mcp.json`
   - 注意：请将 `你的用户名` 替换为你的 Linux 用户名

2. 添加或修改配置如下：

```json
{
  "mcpServers": {
    "download-mcp": {
      "command": "python3",
      "args": [
        "/home/你的用户名/mcp-download/bridging_download_mcp.py"
      ]
    }
  }
}
```

> ⚠️ **请注意**:
> - 将 `你的用户名` 替换为你的 Linux 用户名
> - 确保路径正确指向你克隆或解压的项目目录
> - 路径应该反映你将项目文件放置的实际位置
> - **不要删除克隆或解压的文件夹**，这会导致 MCP 无法正常工作
</details>

### 4. 启动服务

配置好之后，重启 Cursor 编辑器，它会自动启动 MCP 服务。然后你就可以开始使用了。

<details>
<summary>使用示例 (点击展开)</summary>

你可以要求 AI 执行以下操作：
- "下载 https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi 到我的下载文件夹"
- "显示当前的所有下载任务" 
- "查看下载ID为abc123的下载状态"
- "暂停当前的下载任务"
- "恢复ID为abc123的下载，使用8个线程"
- "取消正在进行的下载"
- "清理所有已完成的下载任务"

高级用法：
- "使用32线程下载 https://dlcdn.apache.org/tomcat/tomcat-10/v10.1.19/bin/apache-tomcat-10.1.19.zip"
- "以阻塞模式下载 https://dl.google.com/android/repository/platform-tools-latest-windows.zip"（等待下载完成后再继续）
- "启动持久化下载 https://repo.anaconda.com/archive/Anaconda3-2023.09-0-Windows-x86_64.exe"（即使关闭前台程序也会继续下载）
</details>

## 工作原理

<details>
<summary>技术实现细节 (点击展开)</summary>

本工具基于 **MCP (Model Context Protocol)** 标准实现，作为 AI 模型与文件下载服务之间的桥梁。它使用 **node-fetch** 作为底层下载客户端，并通过 **Zod** 进行请求验证和类型检查。

主要技术组件包括：
- **多线程下载管理器**：将大文件分割为多个段，并发下载，然后合并
- **断点续传系统**：跟踪每个段的下载进度，支持中断后恢复
- **持久化存储**：保存下载任务状态，即使程序重启也能恢复
- **实时监控**：计算下载速度、预估剩余时间等关键指标
- **灵活的工作模式**：支持阻塞/非阻塞、持久化/非持久化模式

每个下载操作都被封装为标准化的 MCP 工具，接收结构化参数并返回格式化结果。所有下载任务都作为独立进程管理，确保即使前台程序关闭，下载也能安全继续。

这种设计使 AI 模型能够清晰地理解和处理下载状态，并以更自然的方式与用户沟通下载进度、速度和其他关键信息。
</details>

## 许可证

ISC

---

如果这个项目对你有帮助，欢迎给个 Star ⭐️ (｡♥‿♥｡)
