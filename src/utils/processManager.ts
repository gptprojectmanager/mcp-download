import * as fs from 'fs';
import * as path from 'path';

// Lock file path configuration
const LOCK_FILE = path.join(process.cwd(), '.mcp-download.lock');

export class ProcessManager {
  private instanceId: string;

  constructor() {
    // Generate unique instance ID
    this.instanceId = Date.now().toString();
    
    // Register process exit handler
    this.registerCleanup();
  }

  private registerCleanup(): void {
    // Register multiple signals to ensure cleanup
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('exit', () => this.cleanup());
  }

  private cleanup(): void {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        // Only clean up own lock file
        if (lockData.instanceId === this.instanceId) {
          fs.unlinkSync(LOCK_FILE);
          console.log('Lock file cleaned up');
        }
      }
    } catch (error) {
      console.error('Error cleaning up lock file:', error);
    }
  }

  private async waitForProcessEnd(pid: number): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        process.kill(pid, 0);
        // If process is still running, wait 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      } catch (e) {
        // Process has already exited
        return;
      }
    }
  }

  public async checkAndCreateLock(): Promise<boolean> {
    try {
      // Check if lock file exists
      if (fs.existsSync(LOCK_FILE)) {
        const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        
        try {
          // Check if process is still running
          process.kill(lockData.pid, 0);
          console.log('Detected existing MCP download service instance running, requesting its exit...');
          // Send termination signal to existing process
          process.kill(lockData.pid, 'SIGTERM');
          // Wait for old process to exit
          await this.waitForProcessEnd(lockData.pid);
        } catch (e) {
          // Process doesn't exist, can continue
          console.log('Detected expired lock file, will create new instance');
        }
      }

      // Create new lock file
      fs.writeFileSync(LOCK_FILE, JSON.stringify({
        pid: process.pid,
        instanceId: this.instanceId,
        timestamp: Date.now()
      }));

      return true;
    } catch (error) {
      console.error('Error handling lock file:', error);
      return false;
    }
  }
}