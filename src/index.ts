#!/usr/bin/env node

import { DownloadMCP } from './tools/download.js';
import { config } from 'dotenv';

// 加载环境变量
config();

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