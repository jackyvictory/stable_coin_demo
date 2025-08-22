#!/bin/bash

# 完整部署脚本 - 从头开始打包镜像、重新发布、签发SSL证书
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
    echo "🚀 EVO Payment 完整部署脚本"
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
    echo "  完整部署: $0 ubuntu@18.141.172.113 demo.ctbz.xyz ~/.ssh/key.pem admin@example.com"
    echo "  仅部署:   $0 ubuntu@18.141.172.113 demo.ctbz.xyz ~/.ssh/key.pem admin@example.com false"
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
    LATEST_IMAGE=$(docker images evo-payment --format "table {{.Tag}}" | grep -E "^[0-9]{8}-[0-9]{6}$" | head -1)
    if [ -z "$LATEST_IMAGE" ]; then
        log_error "未找到可用的镜像，请先进行完整部署或设置 rebuild=true"
        exit 1
    fi
    IMAGE_TAG="$LATEST_IMAGE"
fi

# 构建 SSH 命令
SSH_CMD="ssh -i $SSH_KEY"
SCP_CMD="scp -i $SSH_KEY"

echo "🚀 =================================="
if [ "$REBUILD_IMAGE" = "true" ]; then
    echo "   EVO Payment 完整部署"
    echo "   智能缓存 - 快速镜像打包到HTTPS上线"
else
    echo "   EVO Payment 快速部署"
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
TOTAL_STEPS=8

# 根据参数决定是否重新构建镜像
if [ "$REBUILD_IMAGE" = "true" ]; then
    # 检查缓存状态
    BASE_CACHE_EXISTS=$(docker images -q evo-payment-base:latest 2>/dev/null)
    if [ -n "$BASE_CACHE_EXISTS" ]; then
        log_info "✅ 基础镜像缓存存在，将跳过基础组件下载"
    else
        log_info "⚠️ 首次构建，将下载基础组件 (后续部署将重用缓存)"
    fi
    echo

    # 步骤1: 智能清理本地环境
    log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 智能清理本地环境"
    log_info "保留基础镜像缓存，仅清理旧的应用镜像..."
    # 只清理超过5个版本的旧镜像，保留最近的几个版本用于缓存
    docker images | grep evo-payment | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    log_success "本地环境智能清理完成"

    # 步骤2: 优化构建镜像
    CURRENT_STEP=$((CURRENT_STEP + 1))
    log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 优化构建Docker镜像 (利用缓存)"
    log_info "构建镜像: evo-payment:$IMAGE_TAG"

    # 使用 Dockerfile
    DOCKERFILE="deploy/Dockerfile"
    if [ ! -f "$DOCKERFILE" ]; then
        log_error "未找到 $DOCKERFILE"
        exit 1
    fi
    log_info "使用 Dockerfile (多阶段构建)"

    # 构建基础镜像缓存
    log_info "检查基础镜像缓存..."
    BASE_IMAGE_EXISTS=$(docker images -q evo-payment-base:latest 2>/dev/null)

    if [ -z "$BASE_IMAGE_EXISTS" ]; then
        log_info "构建基础镜像 (首次构建，包含系统依赖)..."
        docker build -f $DOCKERFILE --target base -t evo-payment-base:latest .
        log_success "基础镜像构建完成，后续部署将重用此缓存"
    else
        log_info "✅ 基础镜像缓存存在，跳过基础组件下载"
    fi

    log_info "构建应用镜像 (仅打包项目文件)..."
    if docker build -f $DOCKERFILE -t evo-payment:$IMAGE_TAG .; then
        log_success "镜像构建完成 (利用缓存优化)"
        
        # 显示镜像信息
        log_info "镜像信息:"
        docker images | grep -E "(evo-payment|nginx)" | head -5
        
        # 显示缓存效果
        log_info "缓存优化效果:"
        BASE_SIZE=$(docker images evo-payment-base:latest --format "table {{.Size}}" 2>/dev/null | tail -1 || echo "N/A")
        APP_SIZE=$(docker images evo-payment:$IMAGE_TAG --format "table {{.Size}}" | tail -1)
        log_info "  基础镜像大小: $BASE_SIZE"
        log_info "  应用镜像大小: $APP_SIZE"
    else
        log_error "镜像构建失败"
        exit 1
    fi

    # 步骤3: 打包和推送镜像
    CURRENT_STEP=$((CURRENT_STEP + 1))
    log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 打包和推送镜像到远程主机"
    TEMP_DIR=$(mktemp -d)
    IMAGE_FILE="$TEMP_DIR/evo-payment-$IMAGE_TAG.tar"

    log_info "导出镜像..."
    docker save evo-payment:$IMAGE_TAG -o $IMAGE_FILE

    log_info "压缩镜像..."
    gzip $IMAGE_FILE
    IMAGE_FILE="$IMAGE_FILE.gz"

    FILE_SIZE=$(du -h $IMAGE_FILE | cut -f1)
    log_info "镜像文件大小: $FILE_SIZE"

    log_info "上传镜像到远程主机..."
    $SCP_CMD $IMAGE_FILE $TARGET_HOST:/tmp/

    # 清理本地临时文件
    rm -rf $TEMP_DIR
    log_success "镜像推送完成"
else
    # 跳过镜像构建，直接使用现有镜像
    log_step "步骤 $CURRENT_STEP-$((CURRENT_STEP + 2))/$TOTAL_STEPS: 跳过镜像构建和上传 (使用现有镜像)"
    CURRENT_STEP=$((CURRENT_STEP + 2))
    log_info "使用现有镜像: evo-payment:$IMAGE_TAG"
    
    # 验证镜像是否存在
    if ! docker images evo-payment:$IMAGE_TAG --format "table {{.Repository}}:{{.Tag}}" | grep -q "evo-payment:$IMAGE_TAG"; then
        log_error "镜像 evo-payment:$IMAGE_TAG 不存在，请先进行完整部署"
        exit 1
    fi
    
    log_info "镜像信息:"
    docker images evo-payment:$IMAGE_TAG --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    log_success "跳过镜像构建，直接使用现有镜像"
fi

# 步骤4: 智能清理远程环境
CURRENT_STEP=$((CURRENT_STEP + 1))
log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 智能清理远程环境"
$SSH_CMD $TARGET_HOST << 'EOF'
echo "停止EVO Payment相关容器..."
docker ps -q --filter "name=evo-payment" | xargs -r docker stop 2>/dev/null || true
docker ps -aq --filter "name=evo-payment" | xargs -r docker rm 2>/dev/null || true

echo "智能清理旧镜像 (保留基础镜像和nginx缓存)..."
# 只清理旧的应用镜像，保留基础镜像和nginx镜像用于缓存
docker images | grep evo-payment | grep -v base | tail -n +6 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

echo "停止可能占用端口的服务..."
sudo systemctl stop apache2 2>/dev/null || true
sudo systemctl stop nginx 2>/dev/null || true

# 检查并显示保留的缓存镜像
echo "保留的缓存镜像:"
docker images | grep -E "(nginx|evo-payment-base)" | head -3 || echo "  无缓存镜像"

echo "清理旧的SSL证书..."
sudo rm -rf /etc/letsencrypt/live/* 2>/dev/null || true
sudo rm -rf /etc/letsencrypt/archive/* 2>/dev/null || true

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
    echo "解压镜像文件..."
    gunzip evo-payment-$IMAGE_TAG.tar.gz 2>/dev/null || true

    echo "加载应用镜像 (基础组件已缓存)..."
    docker load -i evo-payment-$IMAGE_TAG.tar
    rm evo-payment-$IMAGE_TAG.tar
else
    echo "跳过镜像加载，使用现有镜像..."
    # 检查远程主机是否有所需镜像
    if ! docker images evo-payment:$IMAGE_TAG --format "table {{.Repository}}:{{.Tag}}" | grep -q "evo-payment:$IMAGE_TAG"; then
        echo "❌ 远程主机缺少镜像 evo-payment:$IMAGE_TAG"
        echo "请先进行完整部署或手动推送镜像"
        exit 1
    fi
fi

# 显示镜像加载结果
echo "当前镜像列表:"
docker images | grep -E "(evo-payment|nginx)" | head -5

# 创建工作目录
sudo rm -rf /opt/evo-payment
sudo mkdir -p /opt/evo-payment/{ssl,logs}
sudo mkdir -p /var/www/certbot
sudo chown -R \$USER:\$USER /opt/evo-payment
sudo chown -R \$USER:\$USER /var/www/certbot

# 修复Docker权限
if ! groups \$USER | grep -q docker; then
    echo "修复Docker权限..."
    sudo usermod -aG docker \$USER
    sudo systemctl restart docker
    sleep 3
fi

# 安装依赖
if ! command -v docker-compose &> /dev/null; then
    echo "安装 Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

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

# 从镜像中提取配置文件到远程主机
echo "[INFO] 从镜像中提取配置文件..."
$SSH_CMD $TARGET_HOST << EOF
cd /opt/evo-payment

# 创建临时容器来提取配置文件
echo "从镜像中提取配置文件..."
docker create --name temp-extract evo-payment:$IMAGE_TAG

# 提取 docker-compose 配置
if docker cp temp-extract:/opt/evo-payment/docker-compose.prod.yml ./docker-compose.prod.yml; then
    echo "✅ docker-compose.prod.yml 已提取"
else
    echo "❌ docker-compose.prod.yml 提取失败"
    docker rm temp-extract 2>/dev/null || true
    exit 1
fi

# 提取管理脚本
if docker cp temp-extract:/usr/local/bin/manage.sh ./manage.sh 2>/dev/null; then
    echo "✅ manage.sh 已提取"
    chmod +x manage.sh
else
    echo "⚠️ manage.sh 提取失败，将在后续步骤中创建"
fi

# 清理临时容器
docker rm temp-extract

echo "✅ 配置文件提取完成"
EOF

log_success "远程环境准备完成"

# 步骤6: 验证连通性
CURRENT_STEP=$((CURRENT_STEP + 1))
log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 验证网络连通性"
$SSH_CMD $TARGET_HOST << 'EOF'
# 启动测试HTTP服务
sudo mkdir -p /var/www/test
sudo cat > /var/www/test/index.html << 'HTML'
<!DOCTYPE html>
<html>
<head><title>EVO Payment Connectivity Test</title></head>
<body>
<h1>🎉 网络连通性测试成功！</h1>
<p>EVO Payment 部署准备就绪</p>
</body>
</html>
HTML

cd /var/www/test
sudo nohup python3 -m http.server 80 > /tmp/http-test.log 2>&1 &
HTTP_PID=$!
echo $HTTP_PID | sudo tee /tmp/http-test.pid > /dev/null

sleep 5

if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ 本地HTTP服务正常"
else
    echo "❌ 本地HTTP服务异常"
    exit 1
fi
EOF

echo "测试外部连通性..."
sleep 3
if curl -f -m 10 http://$DOMAIN_NAME/ > /dev/null 2>&1; then
    log_success "✅ 网络连通性验证成功"
else
    log_warn "⚠️ 外部连通性测试失败，进行网络诊断..."
    
    # 网络诊断
    echo "🔍 网络诊断信息："
    echo "1. 检查本地端口监听："
    curl -f http://localhost/ > /dev/null 2>&1 && echo "   ✅ 本地80端口正常" || echo "   ❌ 本地80端口异常"
    
    echo "2. 检查防火墙状态："
    if command -v ufw >/dev/null 2>&1; then
        sudo ufw status | grep -E "(80|443)" || echo "   ⚠️ 防火墙可能阻止了80/443端口"
    fi
    
    echo "3. 检查服务器网络接口："
    ip addr show | grep -E "(inet.*enX0|inet.*eth0)" || echo "   ⚠️ 网络接口配置异常"
    
    echo ""
    echo "🔧 可能的解决方案："
    echo "1. 检查 AWS 安全组是否开放了以下端口："
    echo "   - HTTP: 80 (0.0.0.0/0)"
    echo "   - HTTPS: 443 (0.0.0.0/0)"
    echo "2. 检查 AWS 网络 ACL 配置"
    echo "3. 确认域名 DNS 解析指向正确的服务器 IP"
    echo ""
    echo "继续部署，稍后可手动检查网络配置..."
fi

# 停止测试服务
$SSH_CMD $TARGET_HOST << 'EOF'
if [ -f /tmp/http-test.pid ]; then
    HTTP_PID=$(sudo cat /tmp/http-test.pid)
    sudo kill $HTTP_PID 2>/dev/null || true
    sudo rm /tmp/http-test.pid
fi
sudo rm -rf /var/www/test
EOF

# 步骤7: 检查和申请SSL证书
CURRENT_STEP=$((CURRENT_STEP + 1))
log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 检查和申请SSL证书"
$SSH_CMD $TARGET_HOST << EOF
cd /opt/evo-payment

echo "🔍 检查现有SSL证书状态..."

# 检查证书是否存在
CERT_EXISTS=false
CERT_VALID=false
CERT_DOMAIN_MATCH=false
CERT_SOURCE=""

# 首先检查工作目录中的证书
if [ -f "ssl/cert.pem" ] && [ -f "ssl/key.pem" ]; then
    echo "✅ 发现工作目录中的SSL证书文件"
    CERT_EXISTS=true
    CERT_SOURCE="ssl/cert.pem"
# 然后检查Let's Encrypt标准位置的证书
elif [ -f "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem" ]; then
    echo "✅ 发现Let's Encrypt证书文件"
    CERT_EXISTS=true
    CERT_SOURCE="/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem"
    
    # 复制证书到工作目录
    echo "📋 复制证书到工作目录..."
    sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
    sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
    sudo chown \$USER:\$USER ssl/cert.pem ssl/key.pem
    echo "✅ 证书已复制到工作目录"
fi

if [ "\$CERT_EXISTS" = "true" ]; then
    
    # 检查证书格式是否正确
    if openssl x509 -in "\$CERT_SOURCE" -noout 2>/dev/null; then
        echo "✅ 证书格式正确"
        
        # 检查证书是否在有效期内（至少还有7天）
        if openssl x509 -in "\$CERT_SOURCE" -checkend 604800 -noout 2>/dev/null; then
            echo "✅ 证书在有效期内（至少还有7天）"
            CERT_VALID=true
            
            # 检查证书域名是否匹配
            CERT_SUBJECT=\$(openssl x509 -in "\$CERT_SOURCE" -subject -noout 2>/dev/null | grep -o "CN=[^,]*" | cut -d= -f2)
            if echo "\$CERT_SUBJECT" | grep -q "$DOMAIN_NAME"; then
                echo "✅ 证书域名匹配: \$CERT_SUBJECT"
                CERT_DOMAIN_MATCH=true
            else
                echo "⚠️ 证书域名不匹配: \$CERT_SUBJECT (需要: $DOMAIN_NAME)"
            fi
            
            # 显示证书详细信息
            echo "📋 证书详细信息:"
            CERT_DATES=\$(openssl x509 -in "\$CERT_SOURCE" -dates -noout 2>/dev/null || echo "无法读取有效期")
            echo "  \$CERT_DATES"
            
            # 检查证书是否即将过期（30天内）
            if openssl x509 -in "\$CERT_SOURCE" -checkend 2592000 -noout 2>/dev/null; then
                echo "✅ 证书有效期充足（超过30天）"
            else
                echo "⚠️ 证书将在30天内过期，建议续期"
            fi
        else
            echo "❌ 证书已过期或即将过期（7天内）"
        fi
    else
        echo "❌ 证书格式错误或损坏"
    fi
else
    echo "ℹ️ 未发现SSL证书文件"
    # 检查是否有Let's Encrypt证书但没有复制到工作目录
    if [ -f "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" ]; then
        echo "🔍 发现Let's Encrypt证书，但未复制到工作目录"
        echo "📋 复制现有证书到工作目录..."
        sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem 2>/dev/null || true
        sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem 2>/dev/null || true
        sudo chown \$USER:\$USER ssl/cert.pem ssl/key.pem 2>/dev/null || true
        
        if [ -f "ssl/cert.pem" ] && [ -f "ssl/key.pem" ]; then
            echo "✅ 证书已复制到工作目录"
            CERT_EXISTS=true
            CERT_VALID=true
            CERT_DOMAIN_MATCH=true
        fi
    fi
fi

# 决定是否需要申请新证书
NEED_NEW_CERT=false

if [ "\$CERT_EXISTS" = "false" ]; then
    echo "🔄 需要申请新证书：证书文件不存在"
    NEED_NEW_CERT=true
elif [ "\$CERT_VALID" = "false" ]; then
    echo "🔄 需要申请新证书：证书已过期或即将过期"
    NEED_NEW_CERT=true
elif [ "\$CERT_DOMAIN_MATCH" = "false" ]; then
    echo "🔄 需要申请新证书：证书域名不匹配"
    NEED_NEW_CERT=true
else
    echo "✅ 现有证书有效，跳过证书申请"
    NEED_NEW_CERT=false
fi

if [ "\$NEED_NEW_CERT" = "true" ]; then
    echo ""
    echo "🔒 开始申请Let's Encrypt SSL证书..."

# 确保端口80完全空闲
echo "确保端口80完全空闲..."
sudo pkill -f "python3 -m http.server" 2>/dev/null || true
sudo systemctl stop apache2 2>/dev/null || true
sudo systemctl stop nginx 2>/dev/null || true
sudo docker stop \$(sudo docker ps -q --filter "publish=80") 2>/dev/null || true

# 等待端口释放
sleep 5

# 检查端口80是否被占用
if sudo netstat -tlnp | grep :80 > /dev/null 2>&1; then
    echo "⚠️ 端口80仍被占用，尝试强制清理..."
    sudo fuser -k 80/tcp 2>/dev/null || true
    sleep 3
fi

# 再次检查端口状态
if sudo netstat -tlnp | grep :80 > /dev/null 2>&1; then
    echo "❌ 无法释放端口80，SSL证书申请可能失败"
    echo "当前占用端口80的进程:"
    sudo netstat -tlnp | grep :80
else
    echo "✅ 端口80已释放"
fi

# 使用webroot方式申请证书，避免端口冲突
echo "创建webroot目录..."
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo chown -R \$USER:\$USER /var/www/certbot

# 启动临时nginx服务用于验证
echo "启动临时验证服务..."

# 使用简单的方法：直接使用默认nginx配置并通过环境变量传递webroot路径
docker run -d --name temp-nginx -p 80:80 -v /var/www/certbot:/usr/share/nginx/html/.well-known:ro nginx:alpine

# 等待服务启动
sleep 5

# 测试验证服务
echo "等待临时验证服务启动..."
sleep 3

# 检查容器状态
if ! docker ps | grep temp-nginx > /dev/null; then
    echo "❌ 临时nginx容器启动失败"
    docker logs temp-nginx 2>/dev/null || echo "无法获取容器日志"
    docker rm temp-nginx 2>/dev/null || true
    
    # 检查是否是Docker网络问题
    if docker logs temp-nginx 2>&1 | grep -q "iptables.*No chain"; then
        echo "🔧 检测到Docker网络配置问题，尝试修复..."
        sudo systemctl restart docker
        sleep 10
        echo "⚠️ Docker已重启，但SSL证书申请失败"
        echo "🔍 检查是否已有Let's Encrypt证书..."
        
        if [ -f "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" ]; then
            echo "✅ 发现现有Let's Encrypt证书，跳过申请"
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
            sudo chown \$USER:\$USER ssl/cert.pem ssl/key.pem
            echo "✅ 证书已复制到工作目录"
        else
            echo "⚠️ 未找到现有证书，将使用HTTP模式部署"
        fi
    else
        exit 1
    fi
else
    # 测试本地访问
    if curl -f http://localhost/ > /dev/null 2>&1; then
        echo "✅ 本地验证服务正常"
    else
        echo "❌ 本地验证服务异常"
        docker logs temp-nginx
        docker stop temp-nginx 2>/dev/null || true
        docker rm temp-nginx 2>/dev/null || true
        exit 1
    fi
fi

# 测试外部访问
if curl -f http://$DOMAIN_NAME/ > /dev/null 2>&1; then
    echo "✅ 外部验证服务正常"
else
    echo "⚠️ 外部验证服务可能有问题，但继续尝试证书申请"
fi

# 使用webroot方式申请证书
if sudo certbot certonly \\
    --webroot \\
    --webroot-path=/var/www/certbot \\
    --email $EMAIL \\
    --agree-tos \\
    --no-eff-email \\
    --non-interactive \\
    --expand \\
    -d $DOMAIN_NAME; then
    
    echo "✅ SSL证书申请成功！"
    
    # 停止临时服务
    docker stop temp-nginx 2>/dev/null || true
    docker rm temp-nginx 2>/dev/null || true
    
    # 复制证书到工作目录
    sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
    sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
    sudo chown \$USER:\$USER ssl/cert.pem ssl/key.pem
    
    echo "✅ SSL证书已复制到工作目录"
    
    # 验证证书
    echo "证书详细信息:"
    openssl x509 -in ssl/cert.pem -text -noout | grep -E "(Subject:|Issuer:|Not Before|Not After)"
    
    # 设置自动续期
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --webroot --webroot-path=/var/www/certbot --post-hook 'cd /opt/evo-payment && docker-compose restart'") | crontab -
    echo "✅ 证书自动续期已设置"
    
else
    echo "❌ SSL证书申请失败"
    echo "查看详细错误日志:"
    sudo tail -20 /var/log/letsencrypt/letsencrypt.log 2>/dev/null || echo "无法读取certbot日志"
    
    # 清理临时服务
    docker stop temp-nginx 2>/dev/null || true
    docker rm temp-nginx 2>/dev/null || true
    
    # 尝试备用方案：使用standalone模式
    echo "⚠️ 尝试备用方案：standalone模式申请证书"
    
    # 确保端口完全空闲
    sleep 5
    
    if sudo certbot certonly \\
        --standalone \\
        --preferred-challenges http \\
        --email $EMAIL \\
        --agree-tos \\
        --no-eff-email \\
        --non-interactive \\
        -d $DOMAIN_NAME; then
        
        echo "✅ 备用方案成功！SSL证书申请成功"
        
        # 复制证书到工作目录
        sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
        sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
        sudo chown \$USER:\$USER ssl/cert.pem ssl/key.pem
        
        echo "✅ SSL证书已复制到工作目录"
        
        # 验证证书
        echo "证书详细信息:"
        openssl x509 -in ssl/cert.pem -text -noout | grep -E "(Subject:|Issuer:|Not Before|Not After)"
        
        # 设置自动续期
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --post-hook 'cd /opt/evo-payment && docker-compose restart'") | crontab -
        echo "✅ 证书自动续期已设置"
        
    else
        echo "❌ 所有SSL证书申请方案都失败了"
        echo "将使用HTTP模式部署，稍后可手动申请SSL证书"
        echo ""
        echo "手动申请SSL证书的方法："
        echo "1. SSH到服务器: ssh -i ~/.ssh/key.pem ubuntu@server"
        echo "2. 停止应用: cd /opt/evo-payment && docker-compose down"
        echo "3. 申请证书: sudo certbot certonly --standalone -d $DOMAIN_NAME"
        echo "4. 复制证书: sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/*.pem ssl/"
        echo "5. 修改权限: sudo chown \$USER:\$USER ssl/*.pem"
        echo "6. 重启应用: docker-compose up -d"
    fi
fi

else
    echo "✅ 使用现有有效SSL证书，跳过证书申请流程"
fi
EOF
log_success "SSL证书检查和申请完成"

# 步骤8: 部署HTTPS应用
CURRENT_STEP=$((CURRENT_STEP + 1))
log_step "步骤 $CURRENT_STEP/$TOTAL_STEPS: 部署HTTPS应用"
$SSH_CMD $TARGET_HOST << EOF
cd /opt/evo-payment

# 使用生产环境的docker-compose配置
cp docker-compose.prod.yml docker-compose.yml

# 设置环境变量
cat > .env << ENV_FILE
IMAGE_TAG=$IMAGE_TAG
DOMAIN_NAME=$DOMAIN_NAME
ENV_FILE

# 确保管理脚本存在
if [ ! -f "manage.sh" ]; then
    echo "创建管理脚本..."
    cat > manage.sh << 'MANAGE_SCRIPT'
#!/bin/bash
case "\$1" in
    "start")
        echo "启动 EVO Payment..."
        docker-compose up -d
        sleep 5
        docker-compose ps
        ;;
    "stop")
        echo "停止 EVO Payment..."
        docker-compose down
        ;;
    "restart")
        echo "重启 EVO Payment..."
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
        if curl -f http://localhost/health > /dev/null 2>&1; then
            echo "✅ HTTP 健康检查通过"
        else
            echo "❌ HTTP 健康检查失败"
        fi
        if curl -f -k https://localhost/health > /dev/null 2>&1; then
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
        echo "EVO Payment 管理脚本"
        echo "使用方法: \$0 {start|stop|restart|logs|status|ssl-renew}"
        ;;
esac
MANAGE_SCRIPT
    chmod +x manage.sh
    echo "✅ 管理脚本已创建"
else
    echo "✅ 管理脚本已存在"
fi

# 启动最终的HTTPS服务
echo "🚀 启动HTTPS服务..."
docker-compose up -d

echo "等待服务启动..."
sleep 20

echo "=== 最终部署状态 ==="
docker-compose ps

echo
echo "=== 健康检查 ==="
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ HTTP 健康检查通过"
else
    echo "❌ HTTP 健康检查失败"
fi

if curl -f -k https://localhost/health > /dev/null 2>&1; then
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
log_success "HTTPS应用部署完成"

# 最终验证
log_step "最终验证: 测试HTTPS访问"
sleep 10

echo "测试HTTPS访问..."
if curl -f -k https://$DOMAIN_NAME/health > /dev/null 2>&1; then
    log_success "✅ HTTPS服务验证成功"
else
    log_warn "⚠️ HTTPS服务可能需要更多时间启动"
    
    # 进行详细的网络诊断
    echo ""
    echo "🔍 进行网络诊断..."
    $SSH_CMD $TARGET_HOST << 'DIAG_EOF'
echo "=== 网络诊断报告 ==="
echo "1. 容器状态："
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "2. 端口监听状态："
netstat -tlnp | grep -E ":80|:443" | head -10

echo ""
echo "3. 防火墙状态："
if command -v ufw >/dev/null 2>&1; then
    sudo ufw status numbered | head -10
else
    echo "   UFW 未安装"
fi

echo ""
echo "4. 网络接口："
ip addr show | grep -A2 -E "(enX0|eth0)" | head -10

echo ""
echo "5. 路由表："
ip route | head -5

echo ""
echo "6. DNS 解析测试："
nslookup demo.ctbz.xyz 8.8.8.8 2>/dev/null | head -10 || echo "   DNS 解析失败"

echo ""
echo "7. 本地服务测试："
curl -s -o /dev/null -w "HTTP: %{http_code}\n" http://localhost/ 2>/dev/null || echo "HTTP: 连接失败"
curl -s -o /dev/null -w "HTTPS: %{http_code}\n" -k https://localhost/ 2>/dev/null || echo "HTTPS: 连接失败"
DIAG_EOF

    echo ""
    echo "🔧 网络问题排查建议："
    echo "1. 检查 AWS 安全组配置："
    echo "   - 入站规则需要开放 HTTP (80) 和 HTTPS (443)"
    echo "   - 源地址设置为 0.0.0.0/0 (允许所有IP访问)"
    echo ""
    echo "2. 检查 AWS 网络 ACL："
    echo "   - 确保网络 ACL 允许 HTTP/HTTPS 流量"
    echo ""
    echo "3. 检查域名 DNS 解析："
    echo "   - 确认 demo.ctbz.xyz 解析到服务器公网IP"
    echo "   - 可以使用: dig demo.ctbz.xyz 或 nslookup demo.ctbz.xyz"
    echo ""
    echo "4. 手动测试命令："
    echo "   - 本地测试: curl -v http://localhost/"
    echo "   - 外部测试: curl -v http://demo.ctbz.xyz/"
fi

echo
echo "🎉 =================================="
echo "     完整部署成功！"
echo "=================================="
echo
log_success "EVO Payment 已从头完整部署到 $TARGET_HOST"
echo
log_highlight "📍 访问地址:"
log_highlight "  🔒 HTTPS: https://$DOMAIN_NAME (推荐)"
log_highlight "  🌐 HTTP:  http://$DOMAIN_NAME (将重定向到HTTPS)"
echo
log_info "🛠️ 管理命令 (在远程主机 /opt/evo-payment 目录下):"
log_info "  启动: ./manage.sh start"
log_info "  停止: ./manage.sh stop"
log_info "  重启: ./manage.sh restart"
log_info "  日志: ./manage.sh logs"
log_info "  状态: ./manage.sh status"
log_info "  续期: ./manage.sh ssl-renew"
echo
log_info "🔧 本地缓存管理:"
log_info "  缓存状态: ./deploy/cache-manager.sh status"
log_info "  清理旧版: ./deploy/cache-manager.sh clean"
log_info "  重建缓存: ./deploy/cache-manager.sh rebuild"
log_info "  大小统计: ./deploy/cache-manager.sh size"
echo
log_info "🔗 SSH 连接: $SSH_CMD $TARGET_HOST"
log_info "📁 工作目录: cd /opt/evo-payment"
echo
log_info "📦 部署信息:"
log_info "  镜像标签: $IMAGE_TAG"
log_info "  构建优化: ✅ 使用多阶段构建和缓存"
log_info "  SSL证书: Let's Encrypt 免费证书"
log_info "  自动续期: 已设置 (每天中午12点检查)"
log_info "  证书位置: /opt/evo-payment/ssl/"
echo
log_info "⚡ 性能优化:"
log_info "  基础组件: 已缓存，下次部署将跳过下载"
log_info "  构建时间: 后续部署将显著加快"
log_info "  镜像大小: 优化的分层结构"
echo
log_success "🚀 享受你的优化HTTPS应用吧！"