import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import os from 'os';
import { Transform } from 'stream';
import fetch from 'node-fetch';
import { Response } from 'node-fetch';
import cluster from 'cluster';
import { EventEmitter } from 'events';

// Download task status
export enum DownloadStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

// Download task information
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
  speed: number; // Download speed, unit: bytes/s
  segments?: DownloadSegment[]; // Multi-threaded download segments
  isBlocking?: boolean; // Whether it's a blocking download
  isPersistent?: boolean; // Whether persistent (can continue in background)
}

// Download segment information (for multi-threaded download)
export interface DownloadSegment {
  start: number;
  end: number;
  downloaded: number;
  status: DownloadStatus;
}

// Download settings
export interface DownloadOptions {
  maxRetries?: number;
  retryDelay?: number;
  threads?: number; // Number of download threads
  isBlocking?: boolean; // Whether to block current thread
  isPersistent?: boolean; // Whether to continue in background
}

// Global event emitter for communication between main process and worker processes
const globalEmitter = new EventEmitter();

export class DownloadService {
  private tasks: Map<string, DownloadTask>;
  private defaultDownloadDir: string;
  private defaultOptions: DownloadOptions;
  private speedUpdateInterval: NodeJS.Timeout | null = null;
  private persistentTasks: Set<string>; // Store persistent task IDs
  private lastSpeedCalcTime: number = Date.now();
  private lastDownloadedSizes: Map<string, number> = new Map();

  constructor() {
    this.tasks = new Map();
    this.persistentTasks = new Set();
    
    // Use user download directory as default directory
    this.defaultDownloadDir = path.join(os.homedir(), 'Downloads', 'MCPDownloads');
    
    // Default download settings
    this.defaultOptions = {
      maxRetries: 3,
      retryDelay: 1000,
      threads: 32, // Default 32-thread download
      isBlocking: false, // Default non-blocking
      isPersistent: true // Default persistent
    };
    
    // Ensure download directory exists
    if (!fs.existsSync(this.defaultDownloadDir)) {
      fs.mkdirSync(this.defaultDownloadDir, { recursive: true });
    }

    // Start speed calculator
    this.startSpeedCalculator();

    // If it's the main process, set up worker process message handling
    if (cluster.isPrimary) {
      this.setupWorkerMessageHandling();
    }

    // Try to restore persistent tasks
    this.restorePersistentTasks();
  }

  /**
   * Set up worker process message handling
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
   * Restore persistent tasks
   */
  private restorePersistentTasks() {
    try {
      const persistentTasksFile = path.join(this.defaultDownloadDir, 'persistent_tasks.json');
      if (fs.existsSync(persistentTasksFile)) {
        const data = JSON.parse(fs.readFileSync(persistentTasksFile, 'utf8'));
        for (const taskData of data) {
          // Restore task
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
            
            // Restore download
            if (task.status === DownloadStatus.DOWNLOADING) {
              this.executeDownload(task, {
                threads: task.segments?.length || this.defaultOptions.threads,
                isBlocking: false,
                isPersistent: true
              }).catch(err => {
                console.error(`Download task restore execution error: ${err.message}`);
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore persistent tasks:', error);
    }
  }

  /**
   * Save persistent task status
   */
  private savePersistentTasks() {
    try {
      const persistentTasksFile = path.join(this.defaultDownloadDir, 'persistent_tasks.json');
      const persistentTasksData = Array.from(this.persistentTasks)
        .map(taskId => this.tasks.get(taskId))
        .filter(Boolean)
        .map(task => {
          // Exclude properties that don't need serialization
          const { abortController, ...serializableTask } = task as any;
          return serializableTask;
        });
      
      fs.writeFileSync(persistentTasksFile, JSON.stringify(persistentTasksData, null, 2));
    } catch (error) {
      console.error('Failed to save persistent tasks:', error);
    }
  }

  /**
   * Start speed calculator
   */
  private startSpeedCalculator() {
    // Calculate download speed once per second
    this.speedUpdateInterval = setInterval(() => {
      const now = Date.now();
      const timeDiff = (now - this.lastSpeedCalcTime) / 1000; // Convert to seconds
      
      for (const [taskId, task] of this.tasks.entries()) {
        if (task.status === DownloadStatus.DOWNLOADING) {
          const lastSize = this.lastDownloadedSizes.get(taskId) || 0;
          const currentSize = task.downloadedSize;
          const bytesPerSecond = (currentSize - lastSize) / timeDiff;
          
          // Use simple moving average to smooth speed display
          task.speed = Math.round(bytesPerSecond);
          this.lastDownloadedSizes.set(taskId, currentSize);
        }
      }
      
      this.lastSpeedCalcTime = now;
      
      // Save persistent task status
      if (this.persistentTasks.size > 0) {
        this.savePersistentTasks();
      }
    }, 1000);
  }

  /**
   * Clear speed calculator
   */
  private stopSpeedCalculator() {
    if (this.speedUpdateInterval) {
      clearInterval(this.speedUpdateInterval);
      this.speedUpdateInterval = null;
    }
  }

  /**
   * Start download task
   */
  async startDownload(url: string, filename?: string, savePath?: string, options?: DownloadOptions): Promise<DownloadTask> {
    // Merge options
    const downloadOptions = { ...this.defaultOptions, ...options };
    
    // Validate save path
    if (savePath) {
      // Check if it's an absolute path
      if (!path.isAbsolute(savePath)) {
        throw new Error('Save path must be an absolute path. Please use a complete path (like C:/Downloads/folder), or don\'t specify a path to use the default download directory.');
      }
    }
    
    // Generate task ID
    const taskId = Math.random().toString(36).substring(2, 15);
    
    // Determine filename
    const finalFilename = filename || this.getFilenameFromUrl(url);
    
    // Determine save path
    const finalSavePath = savePath || this.defaultDownloadDir;
    
    // Ensure save path exists
    if (!fs.existsSync(finalSavePath)) {
      fs.mkdirSync(finalSavePath, { recursive: true });
    }
    
    // Create task
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
    
    // If it's a persistent task, add to persistent collection
    if (task.isPersistent) {
      this.persistentTasks.add(taskId);
    }
    
    // Start download
    if (downloadOptions.isBlocking) {
      // Blocking download, wait for completion
      await this.executeDownload(task, downloadOptions);
    } else {
      // Non-blocking download, don't wait for completion
      this.executeDownload(task, downloadOptions).catch(err => {
        console.error(`Download task execution error: ${err.message}`);
      });
    }
    
    return task;
  }
  
  /**
   * Check if multi-threaded download is supported
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
      console.error('Error checking multi-thread support:', error);
      return { supported: false };
    }
  }
  
  /**
   * Execute download operation
   */
  private async executeDownload(task: DownloadTask, options: DownloadOptions): Promise<void> {
    // Set abort controller
    task.abortController = new AbortController();
    task.status = DownloadStatus.DOWNLOADING;
    
    try {
      // Check if multi-threaded download is supported
      const { supported: supportsMultiThread, contentLength } = await this.checkMultiThreadSupport(task.url);
      
      // Set total file size
      if (contentLength) {
        task.totalSize = contentLength;
      }
      
      // Prepare file path
      const filePath = path.join(task.savePath, task.filename);
      
      // If multi-threaded download is supported and file size is large enough, use multi-threaded download
      if (supportsMultiThread && contentLength && contentLength > 1024 * 1024 && options.threads && options.threads > 1) {
        await this.executeMultiThreadDownload(task, filePath, contentLength, options.threads);
      } else {
        // Doesn't support multi-threading or file too small, use single-threaded download
        await this.executeSingleThreadDownload(task, filePath);
      }
      
      // Update task status to completed
      task.status = DownloadStatus.COMPLETED;
      task.progress = 100;
      task.endTime = new Date();
      
      // If it's a persistent task, remove from persistent collection
      if (this.persistentTasks.has(task.id)) {
        this.persistentTasks.delete(task.id);
        this.savePersistentTasks();
      }
      
    } catch (error: unknown) {
      // Handle abort situation
      const err = error as Error;
      if (err.name === 'AbortError') {
        task.status = DownloadStatus.CANCELLED;
        task.error = 'Download cancelled';
      } else {
        // Handling other errors, trying to retry
        console.error(`Download error (${task.url}):`, err);
        
        if (task.retryCount < (options.maxRetries || 3)) {
          task.retryCount++;
          task.error = `Retry ${task.retryCount}/${options.maxRetries || 3}: ${err.message}`;
          
          // Retrying after delay
          await new Promise(resolve => {
            setTimeout(resolve, options.retryDelay || 1000);
          });
          return this.executeDownload(task, options);
        } else {
          // Maximum number of retries reached
          task.status = DownloadStatus.FAILED;
          task.error = err instanceof Error ? err.message : String(err);
        }
      }
      
      task.endTime = new Date();
      
      // If it is a persistent task and it fails or is canceled, remove it from the persistent set
      if (this.persistentTasks.has(task.id) && 
         (task.status === DownloadStatus.FAILED || task.status === DownloadStatus.CANCELLED)) {
        this.persistentTasks.delete(task.id);
        this.savePersistentTasks();
      }
    }
  }

  /**
   * Single-threaded download
   */
  private async executeSingleThreadDownload(task: DownloadTask, filePath: string): Promise<void> {
    // Set request signal
    const controller = task.abortController!;
    const signal = controller.signal;
    
    // Use node-fetch to initiate the request
    const response = await fetch(task.url, { 
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    
    // Check response status
    if (!response.ok) {
      throw new Error(`Server returned status code: ${response.status} ${response.statusText}`);
    }
    
    // Get file size
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      task.totalSize = parseInt(contentLength, 10);
    }
    
    // Create write stream
    const writeStream = fs.createWriteStream(filePath);
    
    // Create progress monitor
    let downloadedBytes = 0;
    
    // Create progress transform stream
    const progressStream = new Transform({
      transform(chunk: Buffer, encoding: string, callback: Function) {
        downloadedBytes += chunk.length;
        
        // Update download progress
        task.downloadedSize = downloadedBytes;
        if (task.totalSize) {
          task.progress = Math.round((downloadedBytes / task.totalSize) * 100);
        }
        
        this.push(chunk);
        callback();
      }
    });
    
    // Use pipeline to connect streams for more reliable stream processing
    if (response.body) {
      await pipeline(response.body, progressStream, writeStream);
    } else {
      throw new Error('Response body is empty');
    }
  }

  /**
   * Multi-threaded download
   */
  private async executeMultiThreadDownload(task: DownloadTask, filePath: string, contentLength: number, threadCount: number): Promise<void> {
    // Calculate the byte range for each thread to download
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
    
    // Create temporary files to store each segment
    const tempFiles = segments.map((_, index) => `${filePath}.part${index}`);
    
    // Create Promises for all segment downloads
    const downloadPromises = segments.map((segment, index) =>
      this.downloadSegment(task, segment, tempFiles[index])
    );
    
    // Wait for all segment downloads to complete
    await Promise.all(downloadPromises);
    
    // Merge all segments
    await this.mergeSegments(filePath, tempFiles);
    
    // Delete temporary files
    for (const tempFile of tempFiles) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * Download a single segment
   */
  private async downloadSegment(task: DownloadTask, segment: DownloadSegment, tempFile: string): Promise<void> {
    // Skip completed segments
    if (segment.status === DownloadStatus.COMPLETED) {
      return;
    }
    
    segment.status = DownloadStatus.DOWNLOADING;
    
    try {
      // Set the range for resumable download
      const response = await fetch(task.url, {
        headers: {
          'Range': `bytes=${segment.start + segment.downloaded}-${segment.end}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      });
      
      // Check response status
      if (!response.ok && response.status !== 206) {
        throw new Error(`Server returned status code: ${response.status} ${response.statusText}`);
      }
      
      // Create a write stream, append content if it's a resume
      const writeStream = fs.createWriteStream(tempFile, { 
        flags: segment.downloaded > 0 ? 'a' : 'w' 
      });
      
      // Create progress monitor
      let segmentDownloadedBytes = 0;
      
      // Create progress transform stream
      const progressStream = new Transform({
        transform(chunk: Buffer, encoding: string, callback: Function) {
          segmentDownloadedBytes += chunk.length;

          // Update segment download progress
          segment.downloaded += chunk.length;

          // Update total download progress
          task.downloadedSize = (task.segments || [])
            .reduce((total, seg) => total + seg.downloaded, 0);
          
          if (task.totalSize) {
            task.progress = Math.round((task.downloadedSize / task.totalSize) * 100);
          }
          
          this.push(chunk);
          callback();
        }
      });
      
      // Use pipeline to connect streams
      if (response.body) {
        await pipeline(response.body, progressStream, writeStream);
      } else {
        throw new Error('Response body is empty');
      }
      
      segment.status = DownloadStatus.COMPLETED;
      
    } catch (error) {
      segment.status = DownloadStatus.FAILED;
      throw error;
    }
  }

  /**
   * Merge all segments
   */
  private async mergeSegments(targetFile: string, tempFiles: string[]): Promise<void> {
    const writeStream = fs.createWriteStream(targetFile);
    
    for (const tempFile of tempFiles) {
      if (!fs.existsSync(tempFile)) {
        throw new Error(`Temporary file ${tempFile} does not exist`);
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
   * Get all download tasks
   */
  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Pause download task
   */
  pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== DownloadStatus.DOWNLOADING) {
      return false;
    }
    
    // Cancel the current download, but keep the task state
    if (task.abortController) {
      task.abortController.abort();
    }
    
    task.status = DownloadStatus.PAUSED;
    
    // If it is a persistent task, update the persistent state
    if (this.persistentTasks.has(taskId)) {
      this.savePersistentTasks();
    }
    
    return true;
  }

  /**
   * Resume download task
   */
  resumeTask(taskId: string, options?: DownloadOptions): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== DownloadStatus.PAUSED) {
      return false;
    }
    
    // Create a new abort controller
    task.abortController = new AbortController();
    
    // Merge options
    const downloadOptions = { 
      ...this.defaultOptions, 
      ...options,
      isBlocking: false, // Resuming download is always non-blocking
    };
    
    // Resume download
    this.executeDownload(task, downloadOptions).catch(err => {
      console.error(`Error executing resume download task: ${err.message}`);
    });
    
    return true;
  }

  /**
   * Cancel download task
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
      
      // If it's a persistent task, remove from persistent collection
      if (this.persistentTasks.has(taskId)) {
        this.persistentTasks.delete(taskId);
        this.savePersistentTasks();
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Get filename from URL
   */
  private getFilenameFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      let pathname = parsedUrl.pathname;
      
      // Remove query parameters
      pathname = pathname.split('?')[0];
      
      // Get the last part of the path
      const segments = pathname.split('/');
      let filename = segments[segments.length - 1];
      
      // If the filename is empty, generate a random filename
      if (!filename) {
        filename = `download_${Date.now()}.bin`;
      }
      
      // If the filename contains illegal characters, replace them
      filename = filename.replace(/[/\\?%*:|"<>]/g, '_');
      
      return filename;
    } catch (error) {
      // URL parsing failed, returning default filename
      return `download_${Date.now()}.bin`;
    }
  }
  
  /**
   * Format speed
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
   * Clean up completed tasks
   */
  cleanCompletedTasks(): void {
    const completedStatuses = [
      DownloadStatus.COMPLETED,
      DownloadStatus.FAILED,
      DownloadStatus.CANCELLED
    ];
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (completedStatuses.includes(task.status)) {
        // Remove from the persistent set
        if (this.persistentTasks.has(taskId)) {
          this.persistentTasks.delete(taskId);
        }
        
        this.tasks.delete(taskId);
      }
    }
    
    // Update persistent task state
    this.savePersistentTasks();
  }
  
  /**
   * Close service
   */
  close(): void {
    // Stop speed calculator
    this.stopSpeedCalculator();
    
    // Save persistent task state
    this.savePersistentTasks();
  }
} 