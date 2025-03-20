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