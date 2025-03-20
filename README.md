# MCP Download Tool

基于MCP协议的文件下载工具，为Cursor编辑器提供AI操作文件下载的能力。

## 功能特点

- 支持下载任意URL的文件
- 可指定保存文件名和保存路径
- 默认保存到C盘download文件夹
- 支持查看下载进度和状态
- 支持取消下载任务
- 支持查看所有下载任务
- 所有输出均为人类可读格式

## 安装

1. 克隆仓库：
```bash
git clone https://github.com/shuakami/mcp-download.git
cd mcp-download
```

2. 安装依赖：
```bash
npm install
```

3. 编译TypeScript：
```bash
npm run build
```

## 使用方法

### 下载文件

```typescript
// 基本下载
await mcp.downloadFile({
  url: "https://example.com/file.zip"
});

// 指定文件名和保存路径
await mcp.downloadFile({
  url: "https://example.com/file.zip",
  filename: "custom-name.zip",
  savePath: "D:/downloads"
});
```

### 查看下载任务

```typescript
// 列出所有下载任务
await mcp.listDownloads();

// 查看特定任务
await mcp.getDownload({
  taskId: "task-id"
});
```

### 取消下载

```typescript
await mcp.cancelDownload({
  taskId: "task-id"
});
```

### 清理已完成任务

```typescript
await mcp.cleanCompletedDownloads();
```

## 输出示例

下载任务信息示例：
```
任务ID: abc123
文件名: example.zip
保存路径: C:\download
状态: 下载中
进度: 45%
大小: 45.5 MB / 100 MB
用时: 1分钟30秒
```

## 注意事项

1. 默认下载目录为`C:\download`，如果不存在会自动创建
2. 下载过程是阻塞的，直到下载完成或失败
3. 如果未指定文件名，将尝试从URL或Content-Disposition中获取
4. 所有输出均为人类可读的文本格式，不包含JSON

## 开发

1. 修改代码后需要重新编译：
```bash
npm run build
```

2. 开发时可以使用watch模式：
```bash
npm run dev
```

## 许可证

ISC 