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

    // Pause download task
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
            text: success ? "Task paused" : "Failed to pause task or task does not exist"
          }],
          isError: !success
        };
      }
    );

    // Resume download task
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
            text: success ? "Task resumed" : "Failed to resume task or task does not exist"
          }],
          isError: !success
        };
      }
    );

    // Cancel download task
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
            text: success ? "Task cancelled" : "Failed to cancel task or task does not exist"
          }],
          isError: !success
        };
      }
    );

    // Clean up completed tasks
    this.server.tool(
      "cleanCompletedDownloads",
      {},
      () => {
        this.downloadService.cleanCompletedTasks();
        return {
          content: [{
            type: "text",
            text: "Completed tasks have been cleaned up"
          }]
        };
      }
    );
  }

  /**
   * Format task into a human-readable string
   */
  private formatTaskToString(task: DownloadTask): string {
    const statusText = this.getStatusText(task.status);
    const sizeText = task.totalSize 
      ? `${this.formatSize(task.downloadedSize)} / ${this.formatSize(task.totalSize)}`
      : this.formatSize(task.downloadedSize);
    const durationText = this.formatDuration(task.startTime, task.endTime);
    const speedText = task.speed > 0 
      ? this.formatSpeed(task.speed)
      : "Waiting";

    // Basic Information
    let text = [
      `Task ID: ${task.id}`,
      `File Name: ${task.filename}`,
      `Save Path: ${task.savePath}`,
      `Status: ${statusText}`,
      `Progress: ${task.progress}%`,
      `Size: ${sizeText}`,
      `Speed: ${speedText}`,
      `Time Elapsed: ${durationText}`
    ];
    
    // Additional Information (if any)
    if (task.segments) {
      text.push(`Threads: ${task.segments.length}`);
    }
    
    if (task.isBlocking !== undefined || task.isPersistent !== undefined) {
      const modeText = [];
      if (task.isBlocking !== undefined) {
        modeText.push(task.isBlocking ? 'Blocking' : 'Non-blocking');
      }
      if (task.isPersistent !== undefined) {
        modeText.push(task.isPersistent ? 'Persistent' : 'Non-persistent');
      }
      text.push(`Mode: ${modeText.join(', ')}`);
    }
    
    // Error Information (if any)
    if (task.error) {
      text.push(`Error: ${task.error}`);
    }
    
    return text.join('\n');
  }

  /**
   * Get status text
   */
  private getStatusText(status: DownloadStatus): string {
    const statusMap = {
      [DownloadStatus.PENDING]: 'Waiting',
      [DownloadStatus.DOWNLOADING]: 'Downloading',
      [DownloadStatus.COMPLETED]: 'Completed',
      [DownloadStatus.FAILED]: 'Failed',
      [DownloadStatus.CANCELLED]: 'Cancelled',
      [DownloadStatus.PAUSED]: 'Paused'
    };
    return statusMap[status];
  }

  /**
   * Format file size
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
   * Format speed
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
   * Format duration
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
   * Format time
   */
  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours} hours ${minutes % 60} minutes`;
    }
    if (minutes > 0) {
      return `${minutes} minutes ${seconds % 60} seconds`;
    }
    return `${seconds} seconds`;
  }

  /**
   * Shutdown service
   */
  async close(): Promise<void> {
    // Clean up resources
    this.downloadService.close();
  }
} 