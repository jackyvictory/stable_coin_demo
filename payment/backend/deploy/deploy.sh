#!/bin/bash

# Stable Coin Payment 后端部署脚本
# 使用方法: ./deploy.sh <user@host> <domain> <ssh-key> <email>

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

if [ $# -lt 4 ]; then
    echo "🚀 Stable Coin Payment 后端部署脚本"
    echo "============================"
    echo "使用方法: $0 <user@host> <domain> <ssh-key> <email> [rebuild]"
    echo "参数说明:"
    echo "  <user@host>  - SSH连接信息"
    echo "  <domain>     - 域名"
    echo "  <ssh-key>    - SSH私钥路径"
    echo "  <email>      - SSL证书邮箱"
    echo "  [rebuild]    - 可选，是否重新打镜像 (true/false，默认true)"
    echo ""
    echo "示例:"
    echo "  完整部署: $0 ubuntu@18.141.172.113 payment.example.com ~/.ssh/key.pem admin@example.com"
    echo "  仅部署:   $0 ubuntu@18.141.172.113 payment.example.com ~/.ssh/key.pem admin@example.com false"
    exit 1
fi

TARGET_HOST=$1
DOMAIN_NAME=$2
SSH_KEY=$3
EMAIL=$4
REBUILD_IMAGE=${5:-true}  # 默认为true，重新打镜像

# 根据是否重新打镜像设置镜像标签
if [ "$REBUILD_IMAGE" = "true" ]; then
    IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
else
    # 使用最新的镜像标签
    LATEST_BACKEND_IMAGE=$(docker images payment-backend --format "table {{.Tag}}" | grep -E "^[0-9]{8}-[0-9]{6}$" | head -1)

    if [ -z "$LATEST_BACKEND_IMAGE" ]; then
        log_error "未找到可用的后端镜像，请先进行完整部署或设置 rebuild=true"
        exit 1
    fi

    IMAGE_TAG="$LATEST_BACKEND_IMAGE"
fi

# 构建 SSH 命令
SSH_CMD="ssh -i $SSH_KEY"
SCP_CMD="scp -i $SSH_KEY"

echo "🚀 =================================="
if [ "$REBUILD_IMAGE" = "true" ]; then
    echo "   Stable Coin Payment 后端完整部署"
    echo "   智能缓存 - 快速镜像打包到HTTPS上线"
else
    echo "   Stable Coin Payment 后端快速部署"
    echo "   跳过镜像构建 - 直接部署现有镜像"
fi
echo "=================================="
log_info "目标主机: $TARGET_HOST"
log_info "域名: $DOMAIN_NAME"
log_info "SSL邮箱: $EMAIL"
log_info "镜像标签: $IMAGE_TAG"
log_info "重新打镜像: $REBUILD_IMAGE"

# 设置步骤计数器
CURRENT_STEP=1
TOTAL_STEPS=6

# 根据参数决定是否重新构建镜像
if [ "$REBUILD_IMAGE" = "true" ]; then
    # 检查缓存状态
    BACKEND_BASE_CACHE_EXISTS=$(docker images -q payment-backend-base:latest 2>/dev/null)

    if [ -n "$BACKEND_BASE_CACHE_EXISTS" ]; then
        log_info "✅ 后端基础镜像缓存存在，将跳过基础组件下载"
    else
        log_info "⚠️ 首次构建，将下载基础组件 (后续部署将重用缓存)"
    fi
    echo

    # 步骤1: 智能清理本地环境
    log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 智能清理本地环境"
    log_info "保留基础镜像缓存，仅清理旧的应用镜像..."
    # 只清理超过5个版本的旧镜像，保留最近的几个版本用于缓存
    docker images | grep payment-backend | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    log_success "本地环境智能清理完成"

    # 步骤2: 优化构建后端镜像
    CURRENT_STEP=$((CURRENT_STEP + 1))
    log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 优化构建后端Docker镜像 (利用缓存)"
    log_info "构建后端镜像: payment-backend:$IMAGE_TAG"

    # 检查后端Dockerfile
    BACKEND_DOCKERFILE="Dockerfile"
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
        docker build --platform linux/amd64 -f $BACKEND_DOCKERFILE --target builder -t payment-backend-base:latest .
        log_success "后端基础镜像构建完成，后续部署将重用此缓存"
    else
        log_info "✅ 后端基础镜像缓存存在，跳过基础组件下载"
    fi

    log_info "构建后端应用镜像 (仅打包项目文件)..."
    if docker build --platform linux/amd64 -f $BACKEND_DOCKERFILE -t payment-backend:$IMAGE_TAG .; then
        log_success "后端镜像构建完成 (利用缓存优化)"

        # 显示镜像信息
        log_info "后端镜像信息:"
        docker images | grep payment-backend | head -3
    else
        log_error "后端镜像构建失败"
        exit 1
    fi

    # 步骤3: 打包和推送镜像
    CURRENT_STEP=$((CURRENT_STEP + 1))
    log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 打包和推送镜像到远程主机"
    TEMP_DIR=$(mktemp -d)
    BACKEND_IMAGE_FILE="$TEMP_DIR/payment-backend-$IMAGE_TAG.tar"

    log_info "导出后端镜像..."
    docker save payment-backend:$IMAGE_TAG -o $BACKEND_IMAGE_FILE

    log_info "压缩镜像..."
    gzip $BACKEND_IMAGE_FILE
    BACKEND_IMAGE_FILE="$BACKEND_IMAGE_FILE.gz"

    BACKEND_FILE_SIZE=$(du -h $BACKEND_IMAGE_FILE | cut -f1)
    log_info "后端镜像文件大小: $BACKEND_FILE_SIZE"

    log_info "上传镜像到远程主机..."
    $SCP_CMD $BACKEND_IMAGE_FILE $TARGET_HOST:/tmp/

    # 清理本地临时文件
    rm -rf $TEMP_DIR
    log_success "镜像推送完成"
else
    # 跳过镜像构建，直接使用现有镜像
    log_step "步骤 $CURRENT_STEP-$((CURRENT_STEP + 2))/$TOTAL_STEPS: 跳过镜像构建和上传 (使用现有镜像)"
    CURRENT_STEP=$((CURRENT_STEP + 2))
    log_info "使用现有镜像: payment-backend:$IMAGE_TAG"

    # 验证镜像是否存在
    if ! docker images payment-backend:$IMAGE_TAG --format "table {{.Repository}}:{{.Tag}}" | grep -q "payment-backend:$IMAGE_TAG"; then
        log_error "镜像 payment-backend:$IMAGE_TAG 不存在，请先进行完整部署"
        exit 1
    fi

    log_info "镜像信息:"
    docker images payment-backend:$IMAGE_TAG --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    log_success "跳过镜像构建，直接使用现有镜像"
fi

# 步骤4: 智能清理远程环境
CURRENT_STEP=$((CURRENT_STEP + 1))
log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 智能清理远程环境"
$SSH_CMD $TARGET_HOST << 'EOF'
echo "停止Stable Coin后端容器..."
docker ps -q --filter "name=payment-backend" | xargs -r docker stop 2>/dev/null || true
docker ps -aq --filter "name=payment-backend" | xargs -r docker rm 2>/dev/null || true

echo "智能清理旧的后端镜像 (保留基础镜像缓存)..."
# 只清理旧的应用镜像，保留基础镜像用于缓存
docker images | grep payment-backend | grep -v base | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

echo "停止可能占用端口的服务..."
sudo systemctl stop apache2 2>/dev/null || true

# 检查并显示保留的缓存镜像
echo "保留的缓存镜像:"
docker images | grep -E "(payment-backend-base)" | head -3 || echo "  无缓存镜像"

echo "✅ 远程环境智能清理完成"
EOF
log_success "远程环境智能清理完成"

# 步骤5: 优化准备远程环境
CURRENT_STEP=$((CURRENT_STEP + 1))
log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 优化准备远程环境"
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
    if ! docker images payment-backend:$IMAGE_TAG --format "table {{.Repository}}:{{.Tag}}" | grep -q "payment-backend:$IMAGE_TAG"; then
        echo "❌ 远程主机缺少镜像 payment-backend:$IMAGE_TAG"
        echo "请先进行完整部署或手动推送镜像"
        exit 1
    fi
fi

# 显示镜像加载结果
echo "当前镜像列表:"
docker images | grep -E "(payment-backend|nginx)" | head -5

# 创建工作目录
sudo rm -rf /opt/payment-backend
sudo mkdir -p /opt/payment-backend/{ssl,data,logs}
sudo mkdir -p /var/www/certbot
sudo chown -R \$USER:\$USER /opt/payment-backend
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

# 从后端镜像中提取生产环境的配置到远程主机
echo "[INFO] 从后端镜像中提取生产环境配置文件..."
$SSH_CMD $TARGET_HOST << EOF
cd /opt/payment-backend

# 创建临时容器来提取配置文件
echo "从后端镜像中提取配置文件..."
docker create --name temp-extract payment-backend:$IMAGE_TAG

# 提取 docker-compose 配置
if docker cp temp-extract:/app/docker-compose.prod.yml ./docker-compose.prod.yml 2>/dev/null; then
    echo "✅ docker-compose.prod.yml 已提取"
else
    echo "⚠️ docker-compose.prod.yml 提取失败，将使用默认配置"
fi

# 提取管理脚本
if docker cp temp-extract:/app/manage.sh ./manage.sh 2>/dev/null; then
    echo "✅ manage.sh 已提取"
    chmod +x manage.sh
else
    echo "⚠️ manage.sh 提取失败，将在后续步骤中创建"
fi

# 清理临时容器
docker rm temp-extract

# 如果没有提取到生产配置，则使用默认配置
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "创建默认生产环境docker-compose配置..."
    cat > docker-compose.prod.yml << 'COMPOSE_YML'
version: '3.8'

services:
  backend:
    image: payment-backend:__IMAGE_TAG__
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      - SERVER_PORT=8080
      - DB_PATH=/app/data/payment.db
      - JWT_SECRET=payment_secret_key
      - BLOCKCHAIN_RPC=https://bsc-dataseed1.binance.org/
      - RECEIVER_ADDRESS=0xe27577B0e3920cE35f100f66430de0108cb78a04
      - PAYMENT_TIMEOUT=30
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
      - ./logs:/var/log/nginx
      - ./certbot/www:/var/www/certbot
      - ./certbot/conf:/etc/letsencrypt
    depends_on:
      - backend
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/www:/var/www/certbot
      - ./certbot/conf:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \${!}; done;'"

volumes:
  payment-data:
COMPOSE_YML
fi

# 替换镜像标签占位符（无论是从镜像提取的还是默认创建的配置都需要替换）
sed -i "s/__IMAGE_TAG__/$IMAGE_TAG/g" docker-compose.prod.yml

# 创建nginx配置
cat > nginx.conf << 'NGINX_CONF'
server {
    listen 80;
    server_name __DOMAIN_NAME__;

    # Let's Encrypt 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 重定向所有HTTP请求到HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name __DOMAIN_NAME__;

    # SSL证书配置
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # API请求转发到后端
    location /api {
        proxy_pass http://backend:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket支持
    location /ws {
        proxy_pass http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # 健康检查端点
    location /health {
        proxy_pass http://backend:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_CONF

# 替换域名占位符
sed -i "s/__DOMAIN_NAME__/$DOMAIN_NAME/g" nginx.conf

echo "✅ 后端配置文件准备完成"
EOF

log_success "远程环境准备完成"

# 步骤6: 部署后端应用
CURRENT_STEP=$((CURRENT_STEP + 1))
log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 部署后端应用"
$SSH_CMD $TARGET_HOST << EOF
cd /opt/payment-backend

# 使用生产环境的docker-compose配置
cp docker-compose.prod.yml docker-compose.yml

# 设置环境变量
cat > .env << ENV_FILE
IMAGE_TAG=$IMAGE_TAG
DOMAIN_NAME=$DOMAIN_NAME
EMAIL=$EMAIL
ENV_FILE

# 确保管理脚本存在
if [ ! -f "manage.sh" ]; then
    echo "创建后端管理脚本..."
    cat > manage.sh << 'MANAGE_SCRIPT'
#!/bin/bash
case "\$1" in
    "start")
        echo "启动 Stable Coin Payment 后端..."
        docker-compose up -d
        sleep 5
        docker-compose ps
        ;;
    "stop")
        echo "停止 Stable Coin Payment 后端..."
        docker-compose down
        ;;
    "restart")
        echo "重启 Stable Coin Payment 后端..."
        docker-compose restart
        sleep 5
        docker-compose ps
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "status")
        echo "=== 容器状态 ==="
        docker-compose ps
        echo
        echo "=== 健康检查 ==="
        if curl -f http://demo.ctbz.xyz/health > /dev/null 2>&1; then
            echo "✅ HTTP 健康检查通过"
        else
            echo "❌ HTTP 健康检查失败"
        fi
        if curl -f -k https://localhost/api/v1/health > /dev/null 2>&1; then
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
        ;;
    "ssl-renew")
        echo "手动续期SSL证书..."
        DOMAIN_NAME=\$(grep DOMAIN_NAME .env | cut -d= -f2)
        if [ -z "\$DOMAIN_NAME" ]; then
            echo "❌ 无法获取域名信息"
            exit 1
        fi

        # 确保webroot目录存在
        sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
        sudo chown -R \$USER:\$USER /var/www/certbot

        # 使用webroot方式续期
        if sudo certbot renew --force-renewal --webroot --webroot-path=/var/www/certbot; then
            sudo cp /etc/letsencrypt/live/\$DOMAIN_NAME/fullchain.pem ssl/cert.pem
            sudo cp /etc/letsencrypt/live/\$DOMAIN_NAME/privkey.pem ssl/key.pem
            sudo chown \$USER:\$USER ssl/cert.pem ssl/key.pem
            docker-compose restart
            echo "✅ SSL证书续期完成"
        else
            echo "❌ SSL证书续期失败"
            echo "请检查域名解析和网络连接"
            exit 1
        fi
        ;;
    *)
        echo "Stable Coin Payment 后端管理脚本"
        echo "使用方法: \$0 {start|stop|restart|logs|status|ssl-renew}"
        ;;
esac
MANAGE_SCRIPT
    chmod +x manage.sh
    echo "✅ 后端管理脚本已创建"
else
    echo "✅ 后端管理脚本已存在"
fi

# 启动后端服务
echo "🚀 启动后端服务..."
docker-compose up -d

echo "等待服务启动..."
sleep 20

# 初始化SSL证书
echo "🔐 初始化SSL证书..."
if ./manage.sh init-ssl; then
    echo "✅ SSL证书初始化完成"
else
    echo "❌ SSL证书初始化失败"
    echo "请检查域名解析和网络连接"
    exit 1
fi

echo "=== 最终部署状态 ==="
docker-compose ps

echo
echo "=== 健康检查 ==="
if curl -f http://demo.ctbz.xyz/health > /dev/null 2>&1; then
    echo "✅ HTTP 健康检查通过"
else
    echo "❌ HTTP 健康检查失败"
fi

if curl -f -k https://localhost/api/v1/health > /dev/null 2>&1; then
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
log_success "后端应用部署完成"

echo
echo "🎉 =================================="
echo "     后端部署成功！"
echo "=================================="
echo
log_success "Stable Coin Payment 后端已部署到 $TARGET_HOST"
echo
log_highlight "📍 后端访问地址:"
log_highlight "  🔒 HTTPS API: https://$DOMAIN_NAME/api/v1/"
log_highlight "  🌐 HTTP API:  http://$DOMAIN_NAME/api/v1/ (将重定向到HTTPS)"
echo
log_info "🛠️ 后端管理命令 (在远程主机 /opt/payment-backend 目录下):"
log_info "  启动: ./manage.sh start"
log_info "  停止: ./manage.sh stop"
log_info "  重启: ./manage.sh restart"
log_info "  日志: ./manage.sh logs"
log_info "  状态: ./manage.sh status"
log_info "  续期: ./manage.sh ssl-renew"
echo
log_info "🔗 SSH 连接: $SSH_CMD $TARGET_HOST"
log_info "📁 工作目录: cd /opt/payment-backend"
echo
log_info "📦 部署信息:"
log_info "  镜像标签: $IMAGE_TAG"
log_info "  构建优化: ✅ 使用多阶段构建和缓存"
log_info "  SSL证书: Let's Encrypt 免费证书"
log_info "  自动续期: 已设置 (每天中午12点检查)"
log_info "  证书位置: /opt/payment-backend/ssl/"
echo
log_success "🚀 后端服务已成功部署！"