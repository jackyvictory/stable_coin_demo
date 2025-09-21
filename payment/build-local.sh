#!/bin/bash

# 本地构建脚本，用于构建适用于当前平台的二进制文件

set -e

echo "构建本地开发环境的后端二进制文件..."

# 确保在正确的目录中
cd "$(dirname "$0")/backend"

# 构建支持CGO的二进制文件（适用于当前平台）
echo "正在构建支持CGO的二进制文件..."
CGO_ENABLED=1 go build -a -installsuffix cgo -tags sqlite_omit_load_extension -o bin/api ./cmd/api

echo "二进制文件构建完成: backend/bin/api"

# 构建Docker镜像（在Docker中会进行正确的Linux构建）
echo "正在构建Docker镜像..."
docker build -t payment-backend-local .

echo "Docker镜像构建完成: payment-backend-local"

echo "启动服务..."
cd ..
docker-compose -f docker-compose-dev.yml up -d

echo "服务已启动!"
echo "后端API: http://localhost:8080"
echo "前端页面: http://localhost:3000"