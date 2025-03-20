import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DownloadService, DownloadStatus, DownloadTask } from './download-service.js';
import path from 'path';

export class DownloadMCP {
  private server: McpServer;
  private downloadService: DownloadService;

  constructor() {
    // 初始化下载服务
    this.downloadService = new DownloadService();

    // 初始化MCP服务器
    this.server = new McpServer({
      name: "download-mcp",
      version: "1.0.0"
    });

    // 注册工具
    this.registerTools();

    // 连接到标准输入/输出
    const transport = new StdioServerTransport();
    this.server.connect(transport).catch(err => {
      console.error('连接MCP传输错误:', err);
    });
  }

  /**
   * 注册所有MCP工具
   */
  private registerTools(): void {
    // 下载文件
    this.server.tool(
      "downloadFile",
      {
        url: z.string(),
        filename: z.string().optional(),
        savePath: z.string().optional()
      },
      async ({ url, filename, savePath }) => {
        try {
          const task = await this.downloadService.startDownload(url, filename, savePath);
          return {
            content: [{
              type: "text",
              text: this.formatTaskToString(task)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `下载失败: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // 获取所有下载任务
    this.server.tool(
      "listDownloads",
      {},
      () => {
        const tasks = this.downloadService.getAllTasks();
        return {
          content: [{
            type: "text",
            text: tasks.length > 0 
              ? tasks.map(task => this.formatTaskToString(task)).join('\n\n')
              : "当前没有下载任务"
          }]
        };
      }
    );

    // 获取指定下载任务
    this.server.tool(
      "getDownload",
      {
        taskId: z.string()
      },
      ({ taskId }) => {
        const task = this.downloadService.getTask(taskId);
        if (!task) {
          return {
            content: [{
              type: "text",
              text: "任务不存在"
            }],
            isError: true
          };
        }
        return {
          content: [{
            type: "text",
            text: this.formatTaskToString(task)
          }]
        };
      }
    );

    // 取消下载任务
    this.server.tool(
      "cancelDownload",
      {
        taskId: z.string()
      },
      ({ taskId }) => {
        const success = this.downloadService.cancelTask(taskId);
        return {
          content: [{
            type: "text",
            text: success ? "任务已取消" : "任务取消失败或任务不存在"
          }],
          isError: !success
        };
      }
    );

    // 清理已完成的任务
    this.server.tool(
      "cleanCompletedDownloads",
      {},
      () => {
        this.downloadService.cleanCompletedTasks();
        return {
          content: [{
            type: "text",
            text: "已清理完成的任务"
          }]
        };
      }
    );
  }

  /**
   * 格式化任务为人类可读字符串
   */
  private formatTaskToString(task: DownloadTask): string {
    const statusText = this.getStatusText(task.status);
    const sizeText = task.totalSize 
      ? `${this.formatSize(task.downloadedSize)} / ${this.formatSize(task.totalSize)}`
      : this.formatSize(task.downloadedSize);
    const durationText = this.formatDuration(task.startTime, task.endTime);
    
    let text = [
      `任务ID: ${task.id}`,
      `文件名: ${task.filename}`,
      `保存路径: ${task.savePath}`,
      `状态: ${statusText}`,
      `进度: ${task.progress}%`,
      `大小: ${sizeText}`,
      `用时: ${durationText}`
    ];
    
    if (task.error) {
      text.push(`错误: ${task.error}`);
    }
    
    return text.join('\n');
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: DownloadStatus): string {
    const statusMap = {
      [DownloadStatus.PENDING]: '等待中',
      [DownloadStatus.DOWNLOADING]: '下载中',
      [DownloadStatus.COMPLETED]: '已完成',
      [DownloadStatus.FAILED]: '失败',
      [DownloadStatus.CANCELLED]: '已取消'
    };
    return statusMap[status];
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(startTime: Date, endTime?: Date): string {
    if (!endTime) {
      const duration = Date.now() - startTime.getTime();
      return this.formatTime(duration);
    }
    const duration = endTime.getTime() - startTime.getTime();
    return this.formatTime(duration);
  }

  /**
   * 格式化时间
   */
  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    }
    if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    }
    return `${seconds}秒`;
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    // 清理资源
    this.downloadService.cleanCompletedTasks();
  }
} 