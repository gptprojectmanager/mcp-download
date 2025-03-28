#!/usr/bin/env node

import { DownloadMCP } from './tools/download.js';
import { config } from 'dotenv';
import { ProcessManager } from './utils/processManager.js';

// 加载环境变量
config();

// 创建进程管理器
const processManager = new ProcessManager();

// 主函数
async function main() {
  // 检查进程互斥
  if (!await processManager.checkAndCreateLock()) {
    console.error('无法创建锁文件，程序退出');
    process.exit(1);
  }

  // 实例化下载MCP
  const downloadMCP = new DownloadMCP();

  // 处理进程退出
  process.on('SIGINT', async () => {
    console.log('正在关闭下载MCP服务...');
    await downloadMCP.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('正在关闭下载MCP服务...');
    await downloadMCP.close();
    process.exit(0);
  });

  // 处理未捕获的异常，避免崩溃
  process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
    // 不退出进程，保持下载服务运行
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    // 不退出进程，保持下载服务运行
  });

  console.log('下载MCP服务已启动');
}

// 启动程序
main().catch(error => {
  console.error('程序启动失败:', error);
  process.exit(1);
});