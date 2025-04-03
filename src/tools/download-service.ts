import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import os from 'os';
import { Transform } from 'stream';
import fetch from 'node-fetch';
import { Response } from 'node-fetch';
import cluster from 'cluster';
import { EventEmitter } from 'events';

// 下载任务状态
export enum DownloadStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
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
  abortController?: AbortController;
  retryCount: number;
  speed: number; // 下载速度，单位：bytes/s
  segments?: DownloadSegment[]; // 多线程下载的段
  isBlocking?: boolean; // 是否是阻塞式下载
  isPersistent?: boolean; // 是否持久化（可在后台继续）
}

// 下载段信息（用于多线程下载）
export interface DownloadSegment {
  start: number;
  end: number;
  downloaded: number;
  status: DownloadStatus;
}

// 下载设置
export interface DownloadOptions {
  maxRetries?: number;
  retryDelay?: number;
  threads?: number; // 下载线程数
  isBlocking?: boolean; // 是否阻塞当前线程
  isPersistent?: boolean; // 是否在后台继续
}

// 全局事件发射器，用于在主进程和工作进程间通讯
const globalEmitter = new EventEmitter();

export class DownloadService {
  private tasks: Map<string, DownloadTask>;
  private defaultDownloadDir: string;
  private defaultOptions: DownloadOptions;
  private speedUpdateInterval: NodeJS.Timeout | null = null;
  private persistentTasks: Set<string>; // 存储持久化任务ID
  private lastSpeedCalcTime: number = Date.now();
  private lastDownloadedSizes: Map<string, number> = new Map();

  constructor() {
    this.tasks = new Map();
    this.persistentTasks = new Set();
    
    // 使用用户下载目录作为默认目录
    this.defaultDownloadDir = path.join(os.homedir(), 'Downloads', 'MCPDownloads');
    
    // 默认下载设置
    this.defaultOptions = {
      maxRetries: 3,
      retryDelay: 1000,
      threads: 32, // 默认32线程下载
      isBlocking: false, // 默认非阻塞
      isPersistent: true // 默认持久化
    };
    
    // 确保下载目录存在
    if (!fs.existsSync(this.defaultDownloadDir)) {
      fs.mkdirSync(this.defaultDownloadDir, { recursive: true });
    }

    // 启动速度计算器
    this.startSpeedCalculator();

    // 如果是主进程，设置工作进程消息处理
    if (cluster.isPrimary) {
      this.setupWorkerMessageHandling();
    }

    // 尝试恢复持久化任务
    this.restorePersistentTasks();
  }

  /**
   * 设置工作进程消息处理
   */
  private setupWorkerMessageHandling() {
    cluster.on('message', (worker, message) => {
      if (message.type === 'download_progress') {
        const { taskId, downloadedSize, totalSize, status } = message.data;
        const task = this.tasks.get(taskId);
        if (task) {
          task.downloadedSize = downloadedSize;
          if (totalSize) task.totalSize = totalSize;
          task.status = status;
          task.progress = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0;
        }
      }
    });
  }

  /**
   * 恢复持久化任务
   */
  private restorePersistentTasks() {
    try {
      const persistentTasksFile = path.join(this.defaultDownloadDir, 'persistent_tasks.json');
      if (fs.existsSync(persistentTasksFile)) {
        const data = JSON.parse(fs.readFileSync(persistentTasksFile, 'utf8'));
        for (const taskData of data) {
          // 恢复任务
          if (taskData.status === DownloadStatus.DOWNLOADING || taskData.status === DownloadStatus.PAUSED) {
            const task: DownloadTask = {
              ...taskData,
              startTime: new Date(taskData.startTime),
              endTime: taskData.endTime ? new Date(taskData.endTime) : undefined,
              abortController: new AbortController(),
              speed: 0
            };
            
            this.tasks.set(task.id, task);
            this.persistentTasks.add(task.id);
            
            // 恢复下载
            if (task.status === DownloadStatus.DOWNLOADING) {
              this.executeDownload(task, {
                threads: task.segments?.length || this.defaultOptions.threads,
                isBlocking: false,
                isPersistent: true
              }).catch(err => {
                console.error(`恢复下载任务执行错误: ${err.message}`);
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('恢复持久化任务失败:', error);
    }
  }

  /**
   * 保存持久化任务状态
   */
  private savePersistentTasks() {
    try {
      const persistentTasksFile = path.join(this.defaultDownloadDir, 'persistent_tasks.json');
      const persistentTasksData = Array.from(this.persistentTasks)
        .map(taskId => this.tasks.get(taskId))
        .filter(Boolean)
        .map(task => {
          // 排除不需要序列化的属性
          const { abortController, ...serializableTask } = task as any;
          return serializableTask;
        });
      
      fs.writeFileSync(persistentTasksFile, JSON.stringify(persistentTasksData, null, 2));
    } catch (error) {
      console.error('保存持久化任务失败:', error);
    }
  }

  /**
   * 启动速度计算器
   */
  private startSpeedCalculator() {
    // 每秒计算一次下载速度
    this.speedUpdateInterval = setInterval(() => {
      const now = Date.now();
      const timeDiff = (now - this.lastSpeedCalcTime) / 1000; // 转换为秒
      
      for (const [taskId, task] of this.tasks.entries()) {
        if (task.status === DownloadStatus.DOWNLOADING) {
          const lastSize = this.lastDownloadedSizes.get(taskId) || 0;
          const currentSize = task.downloadedSize;
          const bytesPerSecond = (currentSize - lastSize) / timeDiff;
          
          // 使用简单的移动平均来平滑速度显示
          task.speed = Math.round(bytesPerSecond);
          this.lastDownloadedSizes.set(taskId, currentSize);
        }
      }
      
      this.lastSpeedCalcTime = now;
      
      // 保存持久化任务状态
      if (this.persistentTasks.size > 0) {
        this.savePersistentTasks();
      }
    }, 1000);
  }

  /**
   * 清理速度计算器
   */
  private stopSpeedCalculator() {
    if (this.speedUpdateInterval) {
      clearInterval(this.speedUpdateInterval);
      this.speedUpdateInterval = null;
    }
  }

  /**
   * 开始下载任务
   */
  async startDownload(url: string, filename?: string, savePath?: string, options?: DownloadOptions): Promise<DownloadTask> {
    // 合并选项
    const downloadOptions = { ...this.defaultOptions, ...options };
    
    // 验证保存路径
    if (savePath) {
      // 检查是否为绝对路径
      if (!path.isAbsolute(savePath)) {
        throw new Error('保存路径必须是绝对路径。请使用完整的路径（如 C:/Downloads/folder），或者不指定路径使用默认下载目录。');
      }
    }
    
    // 生成任务ID
    const taskId = Math.random().toString(36).substring(2, 15);
    
    // 确定文件名
    const finalFilename = filename || this.getFilenameFromUrl(url);
    
    // 确定保存路径
    const finalSavePath = savePath || this.defaultDownloadDir;
    
    // 确保保存路径存在
    if (!fs.existsSync(finalSavePath)) {
      fs.mkdirSync(finalSavePath, { recursive: true });
    }
    
    // 创建任务
    const task: DownloadTask = {
      id: taskId,
      url,
      filename: finalFilename,
      savePath: finalSavePath,
      status: DownloadStatus.PENDING,
      progress: 0,
      downloadedSize: 0,
      startTime: new Date(),
      retryCount: 0,
      speed: 0,
      isBlocking: downloadOptions.isBlocking,
      isPersistent: downloadOptions.isPersistent
    };
    
    this.tasks.set(taskId, task);
    
    // 如果是持久化任务，添加到持久化集合
    if (task.isPersistent) {
      this.persistentTasks.add(taskId);
    }
    
    // 开始下载
    if (downloadOptions.isBlocking) {
      // 阻塞式下载，等待完成
      await this.executeDownload(task, downloadOptions);
    } else {
      // 非阻塞式下载，不等待完成
      this.executeDownload(task, downloadOptions).catch(err => {
        console.error(`下载任务执行错误: ${err.message}`);
      });
    }
    
    return task;
  }
  
  /**
   * 检查是否支持多线程下载
   */
  private async checkMultiThreadSupport(url: string): Promise<{supported: boolean, contentLength?: number}> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      });
      
      const acceptRanges = response.headers.get('accept-ranges');
      const contentLength = response.headers.get('content-length');
      
      return {
        supported: acceptRanges === 'bytes' && !!contentLength,
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined
      };
    } catch (error) {
      console.error('检查多线程支持时出错:', error);
      return { supported: false };
    }
  }
  
  /**
   * 执行下载操作
   */
  private async executeDownload(task: DownloadTask, options: DownloadOptions): Promise<void> {
    // 设置中止控制器
    task.abortController = new AbortController();
    task.status = DownloadStatus.DOWNLOADING;
    
    try {
      // 检查是否支持多线程下载
      const { supported: supportsMultiThread, contentLength } = await this.checkMultiThreadSupport(task.url);
      
      // 设置总文件大小
      if (contentLength) {
        task.totalSize = contentLength;
      }
      
      // 准备文件路径
      const filePath = path.join(task.savePath, task.filename);
      
      // 如果支持多线程下载并且文件大小足够大，使用多线程下载
      if (supportsMultiThread && contentLength && contentLength > 1024 * 1024 && options.threads && options.threads > 1) {
        await this.executeMultiThreadDownload(task, filePath, contentLength, options.threads);
      } else {
        // 不支持多线程或文件太小，使用单线程下载
        await this.executeSingleThreadDownload(task, filePath);
      }
      
      // 更新任务状态为完成
      task.status = DownloadStatus.COMPLETED;
      task.progress = 100;
      task.endTime = new Date();
      
      // 如果是持久化任务，从持久化集合中移除
      if (this.persistentTasks.has(task.id)) {
        this.persistentTasks.delete(task.id);
        this.savePersistentTasks();
      }
      
    } catch (error: unknown) {
      // 处理中止情况
      const err = error as Error;
      if (err.name === 'AbortError') {
        task.status = DownloadStatus.CANCELLED;
        task.error = '下载已取消';
      } else {
        // 处理其他错误，尝试重试
        console.error(`下载错误 (${task.url}):`, err);
        
        if (task.retryCount < (options.maxRetries || 3)) {
          task.retryCount++;
          task.error = `重试 ${task.retryCount}/${options.maxRetries || 3}: ${err.message}`;
          
          // 延迟后重试
          await new Promise(resolve => {
            setTimeout(resolve, options.retryDelay || 1000);
          });
          return this.executeDownload(task, options);
        } else {
          // 已达到最大重试次数
          task.status = DownloadStatus.FAILED;
          task.error = err instanceof Error ? err.message : String(err);
        }
      }
      
      task.endTime = new Date();
      
      // 如果是持久化任务且失败或取消，从持久化集合中移除
      if (this.persistentTasks.has(task.id) && 
         (task.status === DownloadStatus.FAILED || task.status === DownloadStatus.CANCELLED)) {
        this.persistentTasks.delete(task.id);
        this.savePersistentTasks();
      }
    }
  }

  /**
   * 单线程下载
   */
  private async executeSingleThreadDownload(task: DownloadTask, filePath: string): Promise<void> {
    // 设置请求信号
    const controller = task.abortController!;
    const signal = controller.signal;
    
    // 使用node-fetch发起请求
    const response = await fetch(task.url, { 
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    
    // 检查响应状态
    if (!response.ok) {
      throw new Error(`服务器返回状态码: ${response.status} ${response.statusText}`);
    }
    
    // 获取文件大小
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      task.totalSize = parseInt(contentLength, 10);
    }
    
    // 创建写入流
    const writeStream = fs.createWriteStream(filePath);
    
    // 创建进度监控
    let downloadedBytes = 0;
    
    // 创建进度转换流
    const progressStream = new Transform({
      transform(chunk: Buffer, encoding: string, callback: Function) {
        downloadedBytes += chunk.length;
        
        // 更新下载进度
        task.downloadedSize = downloadedBytes;
        if (task.totalSize) {
          task.progress = Math.round((downloadedBytes / task.totalSize) * 100);
        }
        
        this.push(chunk);
        callback();
      }
    });
    
    // 使用 pipeline 连接流，更可靠的流处理
    if (response.body) {
      await pipeline(response.body, progressStream, writeStream);
    } else {
      throw new Error('响应体为空');
    }
  }

  /**
   * 多线程下载
   */
  private async executeMultiThreadDownload(task: DownloadTask, filePath: string, contentLength: number, threadCount: number): Promise<void> {
    // 计算每个线程下载的字节范围
    const chunkSize = Math.floor(contentLength / threadCount);
    const segments: DownloadSegment[] = [];
    
    for (let i = 0; i < threadCount; i++) {
      const start = i * chunkSize;
      const end = i === threadCount - 1 ? contentLength - 1 : (i + 1) * chunkSize - 1;
      
      segments.push({
        start,
        end,
        downloaded: 0,
        status: DownloadStatus.PENDING
      });
    }
    
    task.segments = segments;
    
    // 创建临时文件以存储每个段
    const tempFiles = segments.map((_, index) => `${filePath}.part${index}`);
    
    // 创建所有分段下载的Promise
    const downloadPromises = segments.map((segment, index) => 
      this.downloadSegment(task, segment, tempFiles[index])
    );
    
    // 等待所有分段下载完成
    await Promise.all(downloadPromises);
    
    // 合并所有分段
    await this.mergeSegments(filePath, tempFiles);
    
    // 删除临时文件
    for (const tempFile of tempFiles) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * 下载单个分段
   */
  private async downloadSegment(task: DownloadTask, segment: DownloadSegment, tempFile: string): Promise<void> {
    // 跳过已经完成的段
    if (segment.status === DownloadStatus.COMPLETED) {
      return;
    }
    
    segment.status = DownloadStatus.DOWNLOADING;
    
    try {
      // 设置断点续传的范围
      const response = await fetch(task.url, {
        headers: {
          'Range': `bytes=${segment.start + segment.downloaded}-${segment.end}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      });
      
      // 检查响应状态
      if (!response.ok && response.status !== 206) {
        throw new Error(`服务器返回状态码: ${response.status} ${response.statusText}`);
      }
      
      // 创建写入流，如果是续传则追加内容
      const writeStream = fs.createWriteStream(tempFile, { 
        flags: segment.downloaded > 0 ? 'a' : 'w' 
      });
      
      // 创建进度监控
      let segmentDownloadedBytes = 0;
      
      // 创建进度转换流
      const progressStream = new Transform({
        transform(chunk: Buffer, encoding: string, callback: Function) {
          segmentDownloadedBytes += chunk.length;
          
          // 更新段的下载进度
          segment.downloaded += chunk.length;
          
          // 更新总下载进度
          task.downloadedSize = (task.segments || [])
            .reduce((total, seg) => total + seg.downloaded, 0);
          
          if (task.totalSize) {
            task.progress = Math.round((task.downloadedSize / task.totalSize) * 100);
          }
          
          this.push(chunk);
          callback();
        }
      });
      
      // 使用 pipeline 连接流
      if (response.body) {
        await pipeline(response.body, progressStream, writeStream);
      } else {
        throw new Error('响应体为空');
      }
      
      segment.status = DownloadStatus.COMPLETED;
      
    } catch (error) {
      segment.status = DownloadStatus.FAILED;
      throw error;
    }
  }

  /**
   * 合并所有分段
   */
  private async mergeSegments(targetFile: string, tempFiles: string[]): Promise<void> {
    const writeStream = fs.createWriteStream(targetFile);
    
    for (const tempFile of tempFiles) {
      if (!fs.existsSync(tempFile)) {
        throw new Error(`临时文件 ${tempFile} 不存在`);
      }
      
      const readStream = fs.createReadStream(tempFile);
      await new Promise<void>((resolve, reject) => {
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
    }
    
    writeStream.end();
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
   * 暂停下载任务
   */
  pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== DownloadStatus.DOWNLOADING) {
      return false;
    }
    
    // 取消当前的下载，但保留任务状态
    if (task.abortController) {
      task.abortController.abort();
    }
    
    task.status = DownloadStatus.PAUSED;
    
    // 如果是持久化任务，更新持久化状态
    if (this.persistentTasks.has(taskId)) {
      this.savePersistentTasks();
    }
    
    return true;
  }

  /**
   * 恢复下载任务
   */
  resumeTask(taskId: string, options?: DownloadOptions): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== DownloadStatus.PAUSED) {
      return false;
    }
    
    // 创建新的中止控制器
    task.abortController = new AbortController();
    
    // 合并选项
    const downloadOptions = { 
      ...this.defaultOptions, 
      ...options,
      isBlocking: false, // 恢复下载总是非阻塞的
    };
    
    // 恢复下载
    this.executeDownload(task, downloadOptions).catch(err => {
      console.error(`恢复下载任务执行错误: ${err.message}`);
    });
    
    return true;
  }

  /**
   * 取消下载任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    
    if (task.status === DownloadStatus.DOWNLOADING && task.abortController) {
      task.abortController.abort();
      task.status = DownloadStatus.CANCELLED;
      task.endTime = new Date();
      
      // 如果是持久化任务，从持久化集合中移除
      if (this.persistentTasks.has(taskId)) {
        this.persistentTasks.delete(taskId);
        this.savePersistentTasks();
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 从URL中获取文件名
   */
  private getFilenameFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      let pathname = parsedUrl.pathname;
      
      // 删除查询参数
      pathname = pathname.split('?')[0];
      
      // 获取路径的最后一部分
      const segments = pathname.split('/');
      let filename = segments[segments.length - 1];
      
      // 如果文件名为空，生成随机文件名
      if (!filename) {
        filename = `download_${Date.now()}.bin`;
      }
      
      // 如果文件名包含非法字符，替换它们
      filename = filename.replace(/[/\\?%*:|"<>]/g, '_');
      
      return filename;
    } catch (error) {
      // URL解析失败，返回默认文件名
      return `download_${Date.now()}.bin`;
    }
  }
  
  /**
   * 格式化速度
   */
  formatSpeed(bytesPerSecond: number): string {
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
   * 清理已完成的任务
   */
  cleanCompletedTasks(): void {
    const completedStatuses = [
      DownloadStatus.COMPLETED,
      DownloadStatus.FAILED,
      DownloadStatus.CANCELLED
    ];
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (completedStatuses.includes(task.status)) {
        // 从持久化集合中移除
        if (this.persistentTasks.has(taskId)) {
          this.persistentTasks.delete(taskId);
        }
        
        this.tasks.delete(taskId);
      }
    }
    
    // 更新持久化任务状态
    this.savePersistentTasks();
  }
  
  /**
   * 关闭服务
   */
  close(): void {
    // 停止速度计算器
    this.stopSpeedCalculator();
    
    // 保存持久化任务状态
    this.savePersistentTasks();
  }
} 