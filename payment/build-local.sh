#!/bin/bash

# 本地构建脚本，用于构建适用于当前平台的二进制文件

set -e

echo "构建本地开发环境的前后端应用..."

# 确保在正确的目录中
cd "$(dirname "$0")"

# 构建后端二进制文件
echo "正在构建后端二进制文件..."
cd backend
CGO_ENABLED=1 go build -a -installsuffix cgo -tags sqlite_omit_load_extension -o bin/api ./cmd/api
echo "后端二进制文件构建完成: backend/bin/api"

# 构建后端Docker镜像
echo "正在构建后端Docker镜像..."
docker build -t payment-backend-local .
echo "后端Docker镜像构建完成: payment-backend-local"

# 返回根目录
cd ..

# 构建前端应用（在Docker中进行构建）
echo "正在构建前端应用..."
docker-compose -f docker-compose-dev.yml build --no-cache frontend
echo "前端应用构建完成"

echo "启动服务..."
docker-compose -f docker-compose-dev.yml up -d

echo "服务已启动!"
echo "后端API: http://localhost:8080"
echo "前端页面: http://localhost:3000"