import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DownloadService, DownloadStatus, DownloadTask } from './download-service.js';
import path from 'path';

export class DownloadMCP {
  private server: McpServer;
  private downloadService: DownloadService;

  constructor() {
    // Initialize download service
    this.downloadService = new DownloadService();

    // Initialize MCP server
    this.server = new McpServer({
      name: "download-mcp",
      version: "1.0.0"
    });

    // Register tools
    this.registerTools();

    // Connect to standard input/output
    const transport = new StdioServerTransport();
    this.server.connect(transport).catch(err => {
      console.error('MCP transport connection error:', err);
    });
  }

  /**
   * Register all MCP tools
   */
  private registerTools(): void {
    // Download file
    this.server.tool(
      "downloadFile",
      {
        url: z.string(),
        filename: z.string().optional(),
        savePath: z.string().optional(),
        threads: z.number().min(1).max(32).optional(),
        isBlocking: z.boolean().optional(),
        isPersistent: z.boolean().optional()
      },
      async ({ url, filename, savePath, threads, isBlocking, isPersistent }) => {
        try {
          const task = await this.downloadService.startDownload(url, filename, savePath, {
            threads,
            isBlocking,
            isPersistent
          });
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
              text: `Download failed: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Get all download tasks
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
              : "No download tasks currently"
          }]
        };
      }
    );

    // Get specified download task
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
              text: "Task does not exist"
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

    // 暂停下载任务
    this.server.tool(
      "pauseDownload",
      {
        taskId: z.string()
      },
      ({ taskId }) => {
        const success = this.downloadService.pauseTask(taskId);
        return {
          content: [{
            type: "text",
            text: success ? "任务已暂停" : "任务暂停失败或任务不存在"
          }],
          isError: !success
        };
      }
    );

    // 恢复下载任务
    this.server.tool(
      "resumeDownload",
      {
        taskId: z.string(),
        threads: z.number().min(1).max(32).optional()
      },
      ({ taskId, threads }) => {
        const success = this.downloadService.resumeTask(taskId, { threads });
        return {
          content: [{
            type: "text",
            text: success ? "任务已恢复" : "任务恢复失败或任务不存在"
          }],
          isError: !success
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
    const speedText = task.speed > 0 
      ? this.formatSpeed(task.speed)
      : "等待中";

    // 基本信息
    let text = [
      `任务ID: ${task.id}`,
      `文件名: ${task.filename}`,
      `保存路径: ${task.savePath}`,
      `状态: ${statusText}`,
      `进度: ${task.progress}%`,
      `大小: ${sizeText}`,
      `速度: ${speedText}`,
      `用时: ${durationText}`
    ];
    
    // 附加信息（如果有）
    if (task.segments) {
      text.push(`线程数: ${task.segments.length}`);
    }
    
    if (task.isBlocking !== undefined || task.isPersistent !== undefined) {
      const modeText = [];
      if (task.isBlocking !== undefined) {
        modeText.push(task.isBlocking ? '阻塞' : '非阻塞');
      }
      if (task.isPersistent !== undefined) {
        modeText.push(task.isPersistent ? '持久化' : '非持久化');
      }
      text.push(`模式: ${modeText.join(', ')}`);
    }
    
    // 错误信息（如果有）
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
      [DownloadStatus.CANCELLED]: '已取消',
      [DownloadStatus.PAUSED]: '已暂停'
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
   * 格式化速度
   */
  private formatSpeed(bytesPerSecond: number): string {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let speed = bytesPerSecond;
    let unitIndex = 0;
    
    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }
    
    return `${speed.toFixed(2)} ${units[unitIndex]}`;
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
    this.downloadService.close();
  }
} 