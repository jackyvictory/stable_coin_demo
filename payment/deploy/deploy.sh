#!/bin/bash

# Stable Coin Payment 部署脚本
# 支持多种部署模式：全量部署、单独部署前端、单独部署后端、更新nginx配置等

set -e

# 确保在正确的目录中运行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }
log_success() { echo -e "${PURPLE}[SUCCESS]${NC} $1"; }
log_highlight() { echo -e "${CYAN}[HIGHLIGHT]${NC} $1"; }

# 默认参数
DEPLOY_MODE="full"  # 部署模式: full(全量), frontend(前端), backend(后端), nginx(nginx配置)
REBUILD_IMAGE="true"  # 是否重新构建镜像: true(重新构建), false(使用现有镜像)

show_help() {
    echo "🚀 Stable Coin Payment 部署脚本"
    echo "============================"
    echo "使用方法: $0 <user@host> <domain> <ssh-key> <email> [options]"
    echo ""
    echo "参数说明:"
    echo "  <user@host>  - SSH连接信息"
    echo "  <domain>     - 域名"
    echo "  <ssh-key>    - SSH私钥路径"
    echo "  <email>      - SSL证书邮箱"
    echo ""
    echo "可选参数:"
    echo "  --mode <mode>     - 部署模式: full(全量), frontend(前端), backend(后端), nginx(nginx配置)"
    echo "  --rebuild <flag>  - 是否重新构建镜像: true(重新构建), false(使用现有镜像)"
    echo ""
    echo "示例:"
    echo "  全量部署(重新构建镜像): $0 ubuntu@18.141.172.113 payment.example.com ~/.ssh/key.pem admin@example.com"
    echo "  全量部署(使用现有镜像): $0 ubuntu@18.141.172.113 payment.example.com ~/.ssh/key.pem admin@example.com --rebuild false"
    echo "  单独部署前端:          $0 ubuntu@18.141.172.113 payment.example.com ~/.ssh/key.pem admin@example.com --mode frontend"
    echo "  单独部署后端:          $0 ubuntu@18.141.172.113 payment.example.com ~/.ssh/key.pem admin@example.com --mode backend"
    echo "  更新nginx配置:         $0 ubuntu@18.141.172.113 payment.example.com ~/.ssh/key.pem admin@example.com --mode nginx"
}

# 解析命令行参数
parse_args() {
    if [ $# -lt 4 ]; then
        show_help
        exit 1
    fi

    TARGET_HOST=$1
    DOMAIN_NAME=$2
    SSH_KEY=$3
    EMAIL=$4
    shift 4

    # 解析可选参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode)
                DEPLOY_MODE="$2"
                shift 2
                ;;
            --rebuild)
                REBUILD_IMAGE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 验证部署模式
    if [[ ! "$DEPLOY_MODE" =~ ^(full|frontend|backend|nginx)$ ]]; then
        log_error "无效的部署模式: $DEPLOY_MODE"
        show_help
        exit 1
    fi

    # 验证rebuild参数
    if [[ ! "$REBUILD_IMAGE" =~ ^(true|false)$ ]]; then
        log_error "无效的rebuild参数: $REBUILD_IMAGE"
        show_help
        exit 1
    fi

    # 构建 SSH 命令
    SSH_CMD="ssh -i $SSH_KEY"
    SCP_CMD="scp -i $SSH_KEY"
}

# 根据部署模式和是否重新构建镜像设置镜像标签
setup_image_tag() {
    if [ "$REBUILD_IMAGE" = "true" ]; then
        IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
    else
        # 使用最新的镜像标签
        if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "backend" ]; then
            LATEST_BACKEND_IMAGE=$(docker images payment-backend --format "{{.Tag}}" | grep -E "^[0-9]{8}-[0-9]{6}$" | head -1)
            if [ -z "$LATEST_BACKEND_IMAGE" ]; then
                log_error "未找到可用的后端镜像，请先进行完整部署或设置 rebuild=true"
                exit 1
            fi
        fi

        if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "frontend" ]; then
            LATEST_FRONTEND_IMAGE=$(docker images payment-frontend --format "{{.Tag}}" | grep -E "^[0-9]{8}-[0-9]{6}$" | head -1)
            if [ "$DEPLOY_MODE" = "full" ] && [ -z "$LATEST_FRONTEND_IMAGE" ]; then
                log_error "未找到可用的前端镜像，请先进行完整部署或设置 rebuild=true"
                exit 1
            fi
        fi

        if [ "$DEPLOY_MODE" = "full" ]; then
            IMAGE_TAG="$LATEST_BACKEND_IMAGE"
        elif [ "$DEPLOY_MODE" = "backend" ]; then
            IMAGE_TAG="$LATEST_BACKEND_IMAGE"
        elif [ "$DEPLOY_MODE" = "frontend" ]; then
            IMAGE_TAG="$LATEST_FRONTEND_IMAGE"
        fi
    fi
}

# 显示部署信息
show_deploy_info() {
    echo "🚀 =================================="
    case "$DEPLOY_MODE" in
        "full")
            if [ "$REBUILD_IMAGE" = "true" ]; then
                echo "   Stable Coin Payment 全量部署(重新构建镜像)"
            else
                echo "   Stable Coin Payment 全量部署(使用现有镜像)"
            fi
            ;;
        "frontend")
            if [ "$REBUILD_IMAGE" = "true" ]; then
                echo "   Stable Coin Payment 前端部署(重新构建镜像)"
            else
                echo "   Stable Coin Payment 前端部署(使用现有镜像)"
            fi
            ;;
        "backend")
            if [ "$REBUILD_IMAGE" = "true" ]; then
                echo "   Stable Coin Payment 后端部署(重新构建镜像)"
            else
                echo "   Stable Coin Payment 后端部署(使用现有镜像)"
            fi
            ;;
        "nginx")
            echo "   Stable Coin Payment Nginx配置更新"
            ;;
    esac
    echo "=================================="
    log_info "目标主机: $TARGET_HOST"
    log_info "域名: $DOMAIN_NAME"
    log_info "SSL邮箱: $EMAIL"
    if [ "$DEPLOY_MODE" != "nginx" ]; then
        log_info "镜像标签: $IMAGE_TAG"
        log_info "重新打镜像: $REBUILD_IMAGE"
    fi
    log_info "部署模式: $DEPLOY_MODE"
}

# 构建后端镜像
build_backend_image() {
    log_step "构建后端Docker镜像"
    log_info "构建后端镜像: payment-backend:$IMAGE_TAG"

    # 检查后端Dockerfile
    BACKEND_DOCKERFILE="backend/Dockerfile"
    if [ ! -f "$BACKEND_DOCKERFILE" ]; then
        log_error "未找到后端Dockerfile: $BACKEND_DOCKERFILE"
        exit 1
    fi
    log_info "使用后端Dockerfile (多阶段构建)"

    # 构建基础镜像缓存
    log_info "检查后端基础镜像缓存..."
    BACKEND_BASE_IMAGE_EXISTS=$(docker images -q payment-backend-base:latest 2>/dev/null)

    if [ -z "$BACKEND_BASE_IMAGE_EXISTS" ]; then
        log_info "构建后端基础镜像 (首次构建，包含系统依赖)..."
        docker build --platform linux/amd64 -f $BACKEND_DOCKERFILE --target builder -t payment-backend-base:latest backend
        log_success "后端基础镜像构建完成，后续部署将重用此缓存"
    else
        log_info "✅ 后端基础镜像缓存存在，跳过基础组件下载"
    fi

    log_info "构建后端应用镜像 (仅打包项目文件)..."
    if docker build --platform linux/amd64 -f $BACKEND_DOCKERFILE -t payment-backend:$IMAGE_TAG backend; then
        log_success "后端镜像构建完成 (利用缓存优化)"

        # 显示镜像信息
        log_info "后端镜像信息:"
        docker images | grep payment-backend | head -3
    else
        log_error "后端镜像构建失败"
        exit 1
    fi
}

# 构建前端镜像
build_frontend_image() {
    log_step "构建前端Docker镜像"
    log_info "构建前端镜像: payment-frontend:$IMAGE_TAG"

    # 检查前端Dockerfile
    FRONTEND_DOCKERFILE="frontend/Dockerfile"
    if [ ! -f "$FRONTEND_DOCKERFILE" ]; then
        log_error "未找到前端Dockerfile: $FRONTEND_DOCKERFILE"
        exit 1
    fi
    log_info "使用前端Dockerfile (多阶段构建)"

    # 构建基础镜像缓存
    log_info "检查前端基础镜像缓存..."
    FRONTEND_BASE_IMAGE_EXISTS=$(docker images -q payment-frontend-base:latest 2>/dev/null)

    if [ -z "$FRONTEND_BASE_IMAGE_EXISTS" ]; then
        log_info "构建前端基础镜像 (首次构建，包含系统依赖)..."
        docker build --platform linux/amd64 -f $FRONTEND_DOCKERFILE --target builder -t payment-frontend-base:latest frontend
        log_success "前端基础镜像构建完成，后续部署将重用此缓存"
    else
        log_info "✅ 前端基础镜像缓存存在，跳过基础组件下载"
    fi

    log_info "构建前端应用镜像 (仅打包项目文件)..."
    if docker build --platform linux/amd64 -f $FRONTEND_DOCKERFILE -t payment-frontend:$IMAGE_TAG frontend; then
        log_success "前端镜像构建完成 (利用缓存优化)"

        # 显示镜像信息
        log_info "前端镜像信息:"
        docker images | grep payment-frontend | head -3
    else
        log_error "前端镜像构建失败"
        exit 1
    fi
}

# 打包和推送镜像
package_and_push_images() {
    log_step "打包和推送镜像到远程主机"
    TEMP_DIR=$(mktemp -d)

    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "backend" ]; then
        BACKEND_IMAGE_FILE="$TEMP_DIR/payment-backend-$IMAGE_TAG.tar"
        log_info "导出后端镜像..."
        docker save payment-backend:$IMAGE_TAG -o $BACKEND_IMAGE_FILE
    fi

    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "frontend" ]; then
        FRONTEND_IMAGE_FILE="$TEMP_DIR/payment-frontend-$IMAGE_TAG.tar"
        log_info "导出前端镜像..."
        docker save payment-frontend:$IMAGE_TAG -o $FRONTEND_IMAGE_FILE
    fi

    log_info "压缩镜像..."
    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "backend" ]; then
        gzip $BACKEND_IMAGE_FILE
        BACKEND_IMAGE_FILE="$BACKEND_IMAGE_FILE.gz"
        BACKEND_FILE_SIZE=$(du -h $BACKEND_IMAGE_FILE | cut -f1)
        log_info "后端镜像文件大小: $BACKEND_FILE_SIZE"
    fi

    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "frontend" ]; then
        gzip $FRONTEND_IMAGE_FILE
        FRONTEND_IMAGE_FILE="$FRONTEND_IMAGE_FILE.gz"
        FRONTEND_FILE_SIZE=$(du -h $FRONTEND_IMAGE_FILE | cut -f1)
        log_info "前端镜像文件大小: $FRONTEND_FILE_SIZE"
    fi

    log_info "上传镜像到远程主机..."
    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "backend" ]; then
        $SCP_CMD $BACKEND_IMAGE_FILE $TARGET_HOST:/tmp/
    fi

    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "frontend" ]; then
        $SCP_CMD $FRONTEND_IMAGE_FILE $TARGET_HOST:/tmp/
    fi

    # 清理本地临时文件
    rm -rf $TEMP_DIR
    log_success "镜像推送完成"
}

# 验证现有镜像
verify_existing_images() {
    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "backend" ]; then
        if ! docker images payment-backend:$IMAGE_TAG --format "{{.Repository}}:{{.Tag}}" | grep -q "payment-backend:$IMAGE_TAG"; then
            log_error "镜像 payment-backend:$IMAGE_TAG 不存在，请先进行完整部署"
            exit 1
        fi
    fi

    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "frontend" ]; then
        if ! docker images payment-frontend:$IMAGE_TAG --format "{{.Repository}}:{{.Tag}}" | grep -q "payment-frontend:$IMAGE_TAG"; then
            log_error "镜像 payment-frontend:$IMAGE_TAG 不存在，请先进行完整部署"
            exit 1
        fi
    fi

    log_info "验证镜像完成"
}

# 清理远程环境
cleanup_remote_environment() {
    log_step "智能清理远程环境"
    $SSH_CMD $TARGET_HOST << 'EOF'
echo "停止Stable Coin相关容器..."
docker ps -q --filter "name=payment-" | xargs -r docker stop 2>/dev/null || true
docker ps -aq --filter "name=payment-" | xargs -r docker rm 2>/dev/null || true

echo "智能清理旧的镜像 (保留基础镜像缓存)..."
# 只清理旧的应用镜像，保留基础镜像用于缓存
docker images | grep payment-backend | grep -v base | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
docker images | grep payment-frontend | grep -v base | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

echo "停止可能占用端口的服务..."
sudo systemctl stop apache2 2>/dev/null || true

# 检查并显示保留的缓存镜像
echo "保留的缓存镜像:"
docker images | grep -E "(payment-(backend|frontend)-base)" | head -5 || echo "  无缓存镜像"

echo "✅ 远程环境智能清理完成"
EOF
    log_success "远程环境智能清理完成"
}

# 准备远程环境
prepare_remote_environment() {
    log_step "优化准备远程环境"
    $SSH_CMD $TARGET_HOST << EOF
if [ "$REBUILD_IMAGE" = "true" ]; then
    # 加载新镜像
    cd /tmp
    echo "解压镜像文件..."
    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "backend" ]; then
        gunzip payment-backend-$IMAGE_TAG.tar.gz 2>/dev/null || true
    fi
    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "frontend" ]; then
        gunzip payment-frontend-$IMAGE_TAG.tar.gz 2>/dev/null || true
    fi

    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "backend" ]; then
        echo "加载后端应用镜像 (基础组件已缓存)..."
        docker load -i payment-backend-$IMAGE_TAG.tar
        rm payment-backend-$IMAGE_TAG.tar
    fi

    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "frontend" ]; then
        echo "加载前端应用镜像 (基础组件已缓存)..."
        docker load -i payment-frontend-$IMAGE_TAG.tar
        rm payment-frontend-$IMAGE_TAG.tar
    fi
else
    echo "跳过镜像加载，使用现有镜像..."
    # 检查远程主机是否有所需镜像
    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "backend" ]; then
        if ! docker images payment-backend:$IMAGE_TAG --format "{{.Repository}}:{{.Tag}}" | grep -q "payment-backend:$IMAGE_TAG"; then
            echo "❌ 远程主机缺少镜像 payment-backend:$IMAGE_TAG"
            echo "请先进行完整部署或手动推送镜像"
            exit 1
        fi
    fi

    if [ "$DEPLOY_MODE" = "full" ] || [ "$DEPLOY_MODE" = "frontend" ]; then
        if ! docker images payment-frontend:$IMAGE_TAG --format "{{.Repository}}:{{.Tag}}" | grep -q "payment-frontend:$IMAGE_TAG"; then
            echo "❌ 远程主机缺少镜像 payment-frontend:$IMAGE_TAG"
            echo "请先进行完整部署或手动推送镜像"
            exit 1
        fi
    fi
fi

# 显示镜像加载结果
echo "当前镜像列表:"
docker images | grep -E "(payment-(backend|frontend)|nginx)" | head -7

# 创建工作目录
sudo rm -rf /opt/payment
sudo mkdir -p /opt/payment/{backend,frontend}/{ssl,data,logs}
sudo mkdir -p /var/www/certbot
sudo chown -R \$USER:\$USER /opt/payment
sudo chown -R \$USER:\$USER /var/www/certbot

# 修复Docker权限
if ! groups \$USER | grep -q docker; then
    echo "修复Docker权限..."
    sudo usermod -aG docker \$USER
    sudo systemctl restart docker
    sleep 3
fi

# 安装依赖
if ! command -v certbot &> /dev/null; then
    echo "安装 certbot..."
    sudo apt-get update > /dev/null 2>&1
    sudo apt-get install -y certbot > /dev/null 2>&1
fi

# 开放防火墙端口
sudo ufw allow 80/tcp 2>/dev/null || true
sudo ufw allow 443/tcp 2>/dev/null || true

echo "✅ 远程环境准备完成"
EOF
}

# 上传配置文件
upload_config_files() {
    log_step "上传生产环境配置文件"
    # 上传docker-compose配置文件
    $SCP_CMD $SCRIPT_DIR/docker-compose.prod.yml $TARGET_HOST:/tmp/
    # 上传nginx配置文件
    $SCP_CMD $SCRIPT_DIR/nginx.conf $TARGET_HOST:/tmp/
    # 上传前端nginx配置文件
    $SCP_CMD $SCRIPT_DIR/../frontend/frontend-nginx.conf $TARGET_HOST:/tmp/
}

# 部署应用
deploy_application() {
    log_step "部署应用"
    $SSH_CMD $TARGET_HOST << EOF
# 创建部署目录结构
sudo mkdir -p /opt/payment/{backend,frontend}
sudo chown -R \$USER:\$USER /opt/payment

# 部署后端
echo "部署应用..."
cd /opt/payment/backend
# 移动配置文件
mv /tmp/docker-compose.prod.yml ./docker-compose.yml
mv /tmp/nginx.conf ../nginx.conf
mv /tmp/frontend-nginx.conf ../frontend-nginx.conf

# 设置环境变量
cat > .env << ENV_FILE
IMAGE_TAG=$IMAGE_TAG
DOMAIN_NAME=$DOMAIN_NAME
EMAIL=$EMAIL
ENV_FILE

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

echo "等待服务启动..."
sleep 20

# 初始化SSL证书
echo "🔐 初始化SSL证书..."
DOMAIN_NAME=$DOMAIN_NAME
EMAIL=$EMAIL

# 确保证书目录存在
mkdir -p ssl
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo chown -R \$USER:\$USER /var/www/certbot

# 检查是否已有证书
if [ ! -f "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" ]; then
    echo "申请新的SSL证书..."
    # 使用webroot方式申请证书
    if sudo certbot certonly --webroot --webroot-path=/var/www/certbot --email $EMAIL --agree-tos --no-eff-email --non-interactive -d $DOMAIN_NAME; then
        echo "✅ SSL证书申请成功"
    else
        echo "❌ SSL证书申请失败"
        exit 1
    fi
else
    echo "✅ SSL证书已存在"
fi

# 复制证书到本地目录
sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
sudo chown \$USER:\$USER ssl/cert.pem ssl/key.pem
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem

# 重启nginx以应用新证书
docker-compose restart nginx
echo "✅ SSL证书初始化完成"

echo "=== 最终部署状态 ==="
docker-compose ps

echo
echo "=== 健康检查 ==="
if curl -f http://$DOMAIN_NAME/health > /dev/null 2>&1; then
    echo "✅ HTTP 健康检查通过"
else
    echo "❌ HTTP 健康检查失败"
fi

if curl -f -k https://$DOMAIN_NAME/health > /dev/null 2>&1; then
    echo "✅ HTTPS 健康检查通过"
else
    echo "❌ HTTPS 健康检查失败"
fi

echo
echo "=== SSL 证书状态 ==="
if [ -f "ssl/cert.pem" ]; then
    CERT_DATES=\$(openssl x509 -in ssl/cert.pem -dates -noout 2>/dev/null || echo "无法读取证书")
    echo "证书信息: \$CERT_DATES"
else
    echo "未找到 SSL 证书"
fi
EOF
    log_success "应用部署完成"
}

# 更新Nginx配置
update_nginx_config() {
    log_step "更新Nginx配置"
    # 上传新的nginx配置文件
    $SCP_CMD $SCRIPT_DIR/nginx.conf $TARGET_HOST:/tmp/

    # 更新nginx配置
    $SSH_CMD $TARGET_HOST << EOF
cd /opt/payment
mv /tmp/nginx.conf ./nginx.conf

# 重启nginx服务
cd backend
docker-compose restart nginx

echo "✅ Nginx配置更新完成"
EOF
    log_success "Nginx配置更新完成"
}

# 主函数
main() {
    # 解析命令行参数
    parse_args "$@"

    # 根据部署模式和是否重新构建镜像设置镜像标签
    if [ "$DEPLOY_MODE" != "nginx" ]; then
        setup_image_tag
    fi

    # 显示部署信息
    show_deploy_info

    # 根据部署模式执行相应的操作
    case "$DEPLOY_MODE" in
        "full")
            # 全量部署
            if [ "$REBUILD_IMAGE" = "true" ]; then
                # 检查缓存状态
                BACKEND_BASE_CACHE_EXISTS=$(docker images -q payment-backend-base:latest 2>/dev/null)
                FRONTEND_BASE_CACHE_EXISTS=$(docker images -q payment-frontend-base:latest 2>/dev/null)

                if [ -n "$BACKEND_BASE_CACHE_EXISTS" ]; then
                    log_info "✅ 后端基础镜像缓存存在，将跳过基础组件下载"
                else
                    log_info "⚠️ 后端首次构建，将下载基础组件 (后续部署将重用缓存)"
                fi

                if [ -n "$FRONTEND_BASE_CACHE_EXISTS" ]; then
                    log_info "✅ 前端基础镜像缓存存在，将跳过基础组件下载"
                else
                    log_info "⚠️ 前端首次构建，将下载基础组件 (后续部署将重用缓存)"
                fi
                echo

                # 智能清理本地环境
                log_step "智能清理本地环境"
                log_info "保留基础镜像缓存，仅清理旧的应用镜像..."
                docker images | grep payment-backend | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
                docker images | grep payment-frontend | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
                log_success "本地环境智能清理完成"

                # 构建镜像
                build_backend_image
                build_frontend_image

                # 打包和推送镜像
                package_and_push_images
            else
                # 验证现有镜像
                verify_existing_images
            fi

            # 清理远程环境
            cleanup_remote_environment

            # 准备远程环境
            prepare_remote_environment

            # 上传配置文件
            upload_config_files

            # 部署应用
            deploy_application

            # 显示最终结果
            echo
            echo "🎉 =================================="
            echo "     全量部署成功！"
            echo "=================================="
            echo
            log_success "Stable Coin Payment 已部署到 $TARGET_HOST"
            echo
            log_highlight "📍 访问地址:"
            log_highlight "  🔒 HTTPS: https://$DOMAIN_NAME/"
            log_highlight "  🌐 HTTP:  http://$DOMAIN_NAME/ (将重定向到HTTPS)"
            echo
            log_info "📁 工作目录: cd /opt/payment"
            log_info "  后端目录: cd /opt/payment/backend"
            log_info "  前端目录: cd /opt/payment/frontend"
            echo
            log_info "📦 部署信息:"
            log_info "  镜像标签: $IMAGE_TAG"
            log_info "  构建优化: ✅ 使用多阶段构建和缓存"
            log_info "  SSL证书: Let's Encrypt 免费证书"
            log_info "  自动续期: 已设置 (每天中午12点检查)"
            log_info "  证书位置: /opt/payment/backend/ssl/"
            echo
            log_success "🚀 Stable Coin Payment 服务已成功部署！"
            ;;
        "frontend")
            # 单独部署前端
            if [ "$REBUILD_IMAGE" = "true" ]; then
                # 检查缓存状态
                FRONTEND_BASE_CACHE_EXISTS=$(docker images -q payment-frontend-base:latest 2>/dev/null)

                if [ -n "$FRONTEND_BASE_CACHE_EXISTS" ]; then
                    log_info "✅ 前端基础镜像缓存存在，将跳过基础组件下载"
                else
                    log_info "⚠️ 前端首次构建，将下载基础组件 (后续部署将重用缓存)"
                fi
                echo

                # 智能清理本地环境
                log_step "智能清理本地环境"
                log_info "保留基础镜像缓存，仅清理旧的前端应用镜像..."
                docker images | grep payment-frontend | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
                log_success "本地环境智能清理完成"

                # 构建前端镜像
                build_frontend_image

                # 打包和推送镜像
                package_and_push_images
            else
                # 验证现有镜像
                verify_existing_images
            fi

            # 准备远程环境（部分）
            log_step "准备远程环境"
            $SSH_CMD $TARGET_HOST << EOF
if [ "$REBUILD_IMAGE" = "true" ]; then
    # 加载新镜像
    cd /tmp
    echo "解压前端镜像文件..."
    gunzip payment-frontend-$IMAGE_TAG.tar.gz 2>/dev/null || true

    echo "加载前端应用镜像 (基础组件已缓存)..."
    docker load -i payment-frontend-$IMAGE_TAG.tar
    rm payment-frontend-$IMAGE_TAG.tar
else
    echo "跳过镜像加载，使用现有镜像..."
    # 检查远程主机是否有所需镜像
    if ! docker images payment-frontend:$IMAGE_TAG --format "{{.Repository}}:{{.Tag}}" | grep -q "payment-frontend:$IMAGE_TAG"; then
        echo "❌ 远程主机缺少镜像 payment-frontend:$IMAGE_TAG"
        echo "请先进行完整部署或手动推送镜像"
        exit 1
    fi
fi

# 显示镜像加载结果
echo "当前镜像列表:"
docker images | grep -E "(payment-frontend|nginx)" | head -7

echo "✅ 远程环境准备完成"
EOF

            # 更新前端服务
            log_step "更新前端服务"
            $SSH_CMD $TARGET_HOST << EOF
cd /opt/payment/backend
# 更新环境变量中的镜像标签
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$IMAGE_TAG/" .env

# 重启前端服务
docker-compose restart frontend

echo "=== 前端服务状态 ==="
docker-compose ps frontend
EOF
            log_success "前端部署完成"
            ;;
        "backend")
            # 单独部署后端
            if [ "$REBUILD_IMAGE" = "true" ]; then
                # 检查缓存状态
                BACKEND_BASE_CACHE_EXISTS=$(docker images -q payment-backend-base:latest 2>/dev/null)

                if [ -n "$BACKEND_BASE_CACHE_EXISTS" ]; then
                    log_info "✅ 后端基础镜像缓存存在，将跳过基础组件下载"
                else
                    log_info "⚠️ 后端首次构建，将下载基础组件 (后续部署将重用缓存)"
                fi
                echo

                # 智能清理本地环境
                log_step "智能清理本地环境"
                log_info "保留基础镜像缓存，仅清理旧的后端应用镜像..."
                docker images | grep payment-backend | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
                log_success "本地环境智能清理完成"

                # 构建后端镜像
                build_backend_image

                # 打包和推送镜像
                package_and_push_images
            else
                # 验证现有镜像
                verify_existing_images
            fi

            # 准备远程环境（部分）
            log_step "准备远程环境"
            $SSH_CMD $TARGET_HOST << EOF
if [ "$REBUILD_IMAGE" = "true" ]; then
    # 加载新镜像
    cd /tmp
    echo "解压后端镜像文件..."
    gunzip payment-backend-$IMAGE_TAG.tar.gz 2>/dev/null || true

    echo "加载后端应用镜像 (基础组件已缓存)..."
    docker load -i payment-backend-$IMAGE_TAG.tar
    rm payment-backend-$IMAGE_TAG.tar
else
    echo "跳过镜像加载，使用现有镜像..."
    # 检查远程主机是否有所需镜像
    if ! docker images payment-backend:$IMAGE_TAG --format "{{.Repository}}:{{.Tag}}" | grep -q "payment-backend:$IMAGE_TAG"; then
        echo "❌ 远程主机缺少镜像 payment-backend:$IMAGE_TAG"
        echo "请先进行完整部署或手动推送镜像"
        exit 1
    fi
fi

# 显示镜像加载结果
echo "当前镜像列表:"
docker images | grep -E "(payment-backend|nginx)" | head -7

echo "✅ 远程环境准备完成"
EOF

            # 更新后端服务
            log_step "更新后端服务"
            $SSH_CMD $TARGET_HOST << EOF
cd /opt/payment/backend
# 更新环境变量中的镜像标签
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$IMAGE_TAG/" .env

# 重启后端服务
docker-compose restart backend

echo "=== 后端服务状态 ==="
docker-compose ps backend
EOF
            log_success "后端部署完成"
            ;;
        "nginx")
            # 更新nginx配置
            update_nginx_config
            ;;
    esac
}

# 执行主函数
main "$@"