#!/bin/bash

# Stable Coin 缓存管理脚本
# 用于管理Docker镜像缓存，优化部署速度

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_usage() {
    echo "Stable Coin 缓存管理脚本"
    echo "========================"
    echo "使用方法: $0 <command>"
    echo
    echo "命令:"
    echo "  status    - 显示缓存状态"
    echo "  clean     - 清理旧镜像 (保留缓存)"
    echo "  rebuild   - 重建基础镜像缓存"
    echo "  purge     - 完全清理所有镜像"
    echo "  size      - 显示镜像大小统计"
    echo
    echo "示例:"
    echo "  $0 status   # 查看当前缓存状态"
    echo "  $0 clean    # 清理旧版本，保留缓存"
    echo "  $0 rebuild  # 强制重建基础镜像"
}

show_status() {
    echo "📊 Stable Coin 镜像缓存状态"
    echo "=========================="
    
    # 基础镜像状态
    BASE_IMAGE=$(docker images -q evo-payment-base:latest 2>/dev/null)
    if [ -n "$BASE_IMAGE" ]; then
        BASE_SIZE=$(docker images evo-payment-base:latest --format "table {{.Size}}" | tail -1)
        BASE_DATE=$(docker images evo-payment-base:latest --format "table {{.CreatedAt}}" | tail -1)
        log_info "✅ 基础镜像缓存: 存在"
        echo "   大小: $BASE_SIZE"
        echo "   创建时间: $BASE_DATE"
    else
        log_warn "❌ 基础镜像缓存: 不存在"
        echo "   下次部署将需要下载基础组件"
    fi
    
    echo
    
    # 应用镜像统计
    APP_COUNT=$(docker images | grep evo-payment | grep -v base | wc -l)
    if [ $APP_COUNT -gt 0 ]; then
        log_info "📦 应用镜像版本: $APP_COUNT 个"
        echo "   最新版本:"
        docker images | grep evo-payment | grep -v base | head -3 | while read line; do
            echo "   $line"
        done
    else
        log_warn "📦 应用镜像版本: 0 个"
    fi
    
    echo
    
    # Nginx基础镜像
    NGINX_COUNT=$(docker images | grep "nginx.*alpine" | wc -l)
    if [ $NGINX_COUNT -gt 0 ]; then
        log_info "🌐 Nginx基础镜像: $NGINX_COUNT 个"
        docker images | grep "nginx.*alpine" | head -2 | while read line; do
            echo "   $line"
        done
    fi
}

clean_old_images() {
    echo "🧹 清理旧镜像 (保留缓存)"
    echo "======================"
    
    # 清理旧的应用镜像，保留最新的3个版本
    OLD_APPS=$(docker images | grep evo-payment | grep -v base | tail -n +4 | awk '{print $3}')
    if [ -n "$OLD_APPS" ]; then
        log_info "清理旧的应用镜像版本..."
        echo "$OLD_APPS" | xargs -r docker rmi -f 2>/dev/null || true
        log_info "✅ 旧应用镜像清理完成"
    else
        log_info "✅ 无需清理应用镜像"
    fi
    
    # 清理悬空镜像
    DANGLING=$(docker images -f "dangling=true" -q)
    if [ -n "$DANGLING" ]; then
        log_info "清理悬空镜像..."
        echo "$DANGLING" | xargs -r docker rmi -f 2>/dev/null || true
        log_info "✅ 悬空镜像清理完成"
    else
        log_info "✅ 无悬空镜像需要清理"
    fi
    
    echo
    log_info "清理完成，缓存已保留"
}

rebuild_base() {
    echo "🔨 重建基础镜像缓存"
    echo "=================="
    
    if [ ! -f "deploy/Dockerfile" ]; then
        log_error "未找到 deploy/Dockerfile"
        exit 1
    fi
    
    # 删除现有基础镜像
    BASE_IMAGE=$(docker images -q evo-payment-base:latest 2>/dev/null)
    if [ -n "$BASE_IMAGE" ]; then
        log_info "删除现有基础镜像..."
        docker rmi -f evo-payment-base:latest 2>/dev/null || true
    fi
    
    # 重建基础镜像
    log_info "重建基础镜像 (包含所有系统依赖)..."
    if docker build -f deploy/Dockerfile --target base -t evo-payment-base:latest .; then
        log_info "✅ 基础镜像重建完成"
        
        # 显示新镜像信息
        BASE_SIZE=$(docker images evo-payment-base:latest --format "table {{.Size}}" | tail -1)
        log_info "新基础镜像大小: $BASE_SIZE"
    else
        log_error "❌ 基础镜像重建失败"
        exit 1
    fi
}

purge_all() {
    echo "💥 完全清理所有镜像"
    echo "=================="
    log_warn "⚠️ 这将删除所有Stable Coin相关镜像，包括缓存"
    read -p "确认继续? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "删除所有Stable Coin镜像..."
        docker images | grep evo-payment | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
        log_info "✅ 所有镜像已删除"
        log_warn "下次部署将需要重新下载所有组件"
    else
        log_info "操作已取消"
    fi
}

show_size_stats() {
    echo "📏 镜像大小统计"
    echo "=============="
    
    # 计算总大小
    TOTAL_SIZE=$(docker images | grep evo-payment | awk '{print $7}' | sed 's/MB//' | sed 's/GB/*1024/' | bc 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
    
    echo "Stable Coin 相关镜像:"
    docker images | grep evo-payment | while read line; do
        echo "  $line"
    done
    
    echo
    if [ "$TOTAL_SIZE" != "0" ]; then
        log_info "总占用空间: 约 ${TOTAL_SIZE}MB"
    fi
    
    # 显示系统镜像占用
    echo
    echo "系统基础镜像:"
    docker images | grep nginx | head -3 | while read line; do
        echo "  $line"
    done
}

# 主逻辑
case "${1:-}" in
    "status")
        show_status
        ;;
    "clean")
        clean_old_images
        ;;
    "rebuild")
        rebuild_base
        ;;
    "purge")
        purge_all
        ;;
    "size")
        show_size_stats
        ;;
    *)
        show_usage
        exit 1
        ;;
esac