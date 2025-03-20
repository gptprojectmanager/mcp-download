import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { promisify } from 'util';

// 下载任务状态
export enum DownloadStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// 下载任务信息
export interface DownloadTask {
  id: string;
  url: string;
  filename: string;
  savePath: string;
  status: DownloadStatus;
  progress: number;
  totalSize?: number;
  downloadedSize: number;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export class DownloadService {
  private tasks: Map<string, DownloadTask>;
  private defaultDownloadDir: string;

  constructor() {
    this.tasks = new Map();
    this.defaultDownloadDir = path.join('C:', 'download');
    
    // 确保下载目录存在
    if (!fs.existsSync(this.defaultDownloadDir)) {
      fs.mkdirSync(this.defaultDownloadDir, { recursive: true });
    }
  }

  /**
   * 开始下载任务
   */
  async startDownload(url: string, filename?: string, savePath?: string): Promise<DownloadTask> {
    // 生成任务ID
    const taskId = Math.random().toString(36).substring(2, 15);
    
    // 确定文件名
    const finalFilename = filename || this.getFilenameFromUrl(url);
    
    // 确定保存路径
    const finalSavePath = savePath || this.defaultDownloadDir;
    
    // 创建任务
    const task: DownloadTask = {
      id: taskId,
      url,
      filename: finalFilename,
      savePath: finalSavePath,
      status: DownloadStatus.PENDING,
      progress: 0,
      downloadedSize: 0,
      startTime: new Date()
    };
    
    this.tasks.set(taskId, task);
    
    try {
      // 开始下载
      const response = await axios({
        method: 'GET',
        url: task.url,
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            task.totalSize = progressEvent.total;
            task.progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          }
          task.downloadedSize = progressEvent.loaded;
        }
      });
      
      // 更新任务状态
      task.status = DownloadStatus.DOWNLOADING;
      task.totalSize = parseInt(response.headers['content-length'] || '0');
      
      // 创建写入流
      const writer = fs.createWriteStream(path.join(task.savePath, task.filename));
      
      // 写入文件
      await new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // 更新任务状态为完成
      task.status = DownloadStatus.COMPLETED;
      task.progress = 100;
      task.endTime = new Date();
      
    } catch (error) {
      // 更新任务状态为失败
      task.status = DownloadStatus.FAILED;
      task.error = error instanceof Error ? error.message : String(error);
      task.endTime = new Date();
    }
    
    return task;
  }

  /**
   * 获取所有下载任务
   */
  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取指定任务
   */
  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 取消下载任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && task.status === DownloadStatus.DOWNLOADING) {
      task.status = DownloadStatus.CANCELLED;
      task.endTime = new Date();
      return true;
    }
    return false;
  }

  /**
   * 从URL中提取文件名
   */
  private getFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      let filename = path.basename(pathname);
      
      // 如果没有扩展名，尝试从Content-Disposition获取
      if (!path.extname(filename)) {
        filename = `file_${Date.now()}${path.extname(pathname) || ''}`;
      }
      
      return filename;
    } catch {
      return `file_${Date.now()}`;
    }
  }

  /**
   * 清理已完成的任务
   */
  cleanCompletedTasks(): void {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === DownloadStatus.COMPLETED || 
          task.status === DownloadStatus.FAILED || 
          task.status === DownloadStatus.CANCELLED) {
        this.tasks.delete(taskId);
      }
    }
  }
} 