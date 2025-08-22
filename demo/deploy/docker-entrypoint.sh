#!/bin/bash

# Stable Coin Docker 容器启动脚本
# 自动检测SSL证书，支持动态 HTTP/HTTPS 配置

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 初始化函数
init_container() {
    log_info "初始化 Stable Coin 容器..."
    
    # 设置默认值
    DOMAIN_NAME=${DOMAIN_NAME:-"localhost"}
    
    log_info "域名: $DOMAIN_NAME"
    log_info "配置模式: 动态 HTTP/HTTPS (根据证书自动切换)"
    
    # 创建必要的目录
    mkdir -p /opt/evo-payment/ssl /opt/evo-payment/logs /var/www/certbot
    
    # 验证nginx配置
    select_nginx_config
    
    # 检查SSL证书状态
    check_ssl_certificates
}

# 选择nginx配置
select_nginx_config() {
    local config_file="/etc/nginx/nginx.conf"
    
    # nginx.conf 已经包含了动态 HTTP/HTTPS 配置
    log_info "使用统一的 nginx 配置 (支持动态 HTTP/HTTPS)"
    
    # 检查配置文件是否存在
    if [ ! -f "$config_file" ]; then
        log_error "nginx 配置文件不存在: $config_file"
        exit 1
    fi
    
    # 验证nginx配置
    if nginx -t -c $config_file 2>/dev/null; then
        log_info "✅ nginx 配置验证通过"
    else
        log_error "❌ nginx 配置验证失败"
        nginx -t -c $config_file
        exit 1
    fi
    
    # 根据SSL证书存在情况显示相应信息
    if [ -f "/opt/evo-payment/ssl/cert.pem" ] && [ -f "/opt/evo-payment/ssl/key.pem" ]; then
        log_info "检测到SSL证书，将启用 HTTPS (HTTP请求会自动重定向)"
    else
        log_info "未检测到SSL证书，将仅提供 HTTP 服务"
    fi
}

# 检查SSL证书
check_ssl_certificates() {
    if [ -f "/opt/evo-payment/ssl/cert.pem" ] && [ -f "/opt/evo-payment/ssl/key.pem" ]; then
        log_info "验证SSL证书..."
        
        # 验证证书格式
        if openssl x509 -in /opt/evo-payment/ssl/cert.pem -noout 2>/dev/null; then
            log_info "✅ SSL证书格式正确"
            
            # 显示证书信息
            CERT_SUBJECT=$(openssl x509 -in /opt/evo-payment/ssl/cert.pem -subject -noout 2>/dev/null | sed 's/subject=//' || echo "无法读取")
            CERT_DATES=$(openssl x509 -in /opt/evo-payment/ssl/cert.pem -dates -noout 2>/dev/null || echo "无法读取有效期")
            
            log_info "证书主题: $CERT_SUBJECT"
            log_info "证书有效期: $CERT_DATES"
            
            # 检查证书是否即将过期 (30天内)
            if openssl x509 -in /opt/evo-payment/ssl/cert.pem -checkend 2592000 -noout 2>/dev/null; then
                log_info "✅ 证书有效期充足"
            else
                log_warn "⚠️ 证书将在30天内过期，建议续期"
            fi
        else
            log_warn "⚠️ SSL证书格式可能有问题"
        fi
    else
        log_info "未找到SSL证书文件，将使用 HTTP 模式"
        
        # 如果设置了自动生成SSL证书的环境变量
        if [ "$AUTO_SSL" = "true" ] && [ -n "$DOMAIN_NAME" ] && [ -n "$SSL_EMAIL" ]; then
            log_info "尝试自动生成SSL证书..."
            generate_ssl_certificate
        else
            log_info "要启用HTTPS，请："
            log_info "  1. 挂载证书文件到 /opt/evo-payment/ssl/"
            log_info "  2. 或设置环境变量自动生成："
            log_info "     AUTO_SSL=true"
            log_info "     SSL_EMAIL=your-email@example.com"
            log_info "     DOMAIN_NAME=$DOMAIN_NAME"
        fi
    fi
}

# 自动生成SSL证书
generate_ssl_certificate() {
    log_info "开始自动生成Let's Encrypt SSL证书..."
    
    # 检查必要的工具
    if ! command -v certbot &> /dev/null; then
        log_error "certbot 未安装，无法自动生成SSL证书"
        return 1
    fi
    
    # 创建webroot目录
    mkdir -p /var/www/certbot
    
    # 临时启动nginx用于域名验证
    log_info "启动临时HTTP服务进行域名验证..."
    
    # 创建临时nginx配置
    cat > /tmp/nginx-temp.conf << EOF
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name $DOMAIN_NAME;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 200 "SSL certificate generation in progress...";
            add_header Content-Type text/plain;
        }
    }
}
EOF
    
    # 启动临时nginx
    nginx -c /tmp/nginx-temp.conf -g "daemon off;" &
    TEMP_NGINX_PID=$!
    
    sleep 5
    
    # 获取证书
    if certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$SSL_EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN_NAME"; then
        
        # 复制证书到项目目录
        cp "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" /opt/evo-payment/ssl/cert.pem
        cp "/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem" /opt/evo-payment/ssl/key.pem
        
        log_info "✅ SSL证书生成成功"
        
        # 设置自动续期
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
        log_info "✅ 证书自动续期已设置"
        
        # 停止临时nginx
        kill $TEMP_NGINX_PID 2>/dev/null || true
        
        log_info "SSL证书已安装，nginx 将自动启用 HTTPS"
        
        return 0
    else
        log_error "❌ SSL证书生成失败"
        kill $TEMP_NGINX_PID 2>/dev/null || true
        return 1
    fi
}

# 显示访问信息
show_access_info() {
    log_info "=== Stable Coin 启动完成 ==="
    
    if [ -f "/opt/evo-payment/ssl/cert.pem" ] && [ -f "/opt/evo-payment/ssl/key.pem" ]; then
        log_info "HTTPS 访问地址: https://$DOMAIN_NAME"
        log_info "HTTP 访问地址:  http://$DOMAIN_NAME (将重定向到HTTPS)"
    else
        log_info "HTTP 访问地址: http://$DOMAIN_NAME"
    fi
    
    log_info "健康检查: http://$DOMAIN_NAME/health"
    log_info "=========================="
}

# 主函数
main() {
    # 初始化容器
    init_container
    
    # 显示访问信息
    show_access_info
    
    # 如果有参数，执行传入的命令
    if [ $# -gt 0 ]; then
        log_info "执行命令: $@"
        exec "$@"
    else
        log_info "启动 Nginx..."
        exec nginx -g "daemon off;"
    fi
}

# 运行主函数
main "$@"