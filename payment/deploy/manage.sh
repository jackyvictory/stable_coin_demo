#!/bin/bash

# Stable Coin Payment 生产环境管理脚本
# 此脚本用于在生产服务器上管理已部署的服务
# 使用方法: ./manage.sh {start|stop|restart|logs|status|ssl-renew|init-ssl}

case "$1" in
    "start")
        echo "启动 Stable Coin Payment 应用..."
        docker-compose -f docker-compose.prod.yml up -d
        sleep 5
        docker-compose -f docker-compose.prod.yml ps
        ;;
    "stop")
        echo "停止 Stable Coin Payment 应用..."
        docker-compose -f docker-compose.prod.yml down
        ;;
    "restart")
        echo "重启 Stable Coin Payment 应用..."
        docker-compose -f docker-compose.prod.yml restart
        sleep 5
        docker-compose -f docker-compose.prod.yml ps
        ;;
    "logs")
        docker-compose -f docker-compose.prod.yml logs -f
        ;;
    "status")
        echo "=== 容器状态 ==="
        docker-compose -f docker-compose.prod.yml ps
        echo
        echo "=== 健康检查 ==="
        if curl -f http://demo.ctbz.xyz/health > /dev/null 2>&1; then
            echo "✅ HTTP 健康检查通过"
        else
            echo "❌ HTTP 健康检查失败"
        fi
        if curl -f -k https://demo.ctbz.xyz/health > /dev/null 2>&1; then
            echo "✅ HTTPS 健康检查通过"
        else
            echo "❌ HTTPS 健康检查失败"
        fi
        echo
        echo "=== SSL 证书状态 ==="
        if [ -f "ssl/cert.pem" ]; then
            CERT_DATES=$(openssl x509 -in ssl/cert.pem -dates -noout 2>/dev/null || echo "无法读取证书")
            echo "证书信息: $CERT_DATES"
        else
            echo "未找到 SSL 证书"
        fi
        ;;
    "ssl-renew")
        echo "手动续期SSL证书..."
        DOMAIN_NAME=$(grep DOMAIN_NAME .env | cut -d= -f2)
        if [ -z "$DOMAIN_NAME" ]; then
            echo "❌ 无法获取域名信息"
            exit 1
        fi

        # 确保webroot目录存在
        sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
        sudo chown -R $USER:$USER /var/www/certbot

        # 使用webroot方式续期
        if sudo certbot renew --force-renewal --webroot --webroot-path=/var/www/certbot; then
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
            sudo chown $USER:$USER ssl/cert.pem ssl/key.pem
            docker-compose -f docker-compose.prod.yml restart
            echo "✅ SSL证书续期完成"
        else
            echo "❌ SSL证书续期失败"
            echo "请检查域名解析和网络连接"
            exit 1
        fi
        ;;
    "init-ssl")
        echo "初始化SSL证书..."
        DOMAIN_NAME=$(grep DOMAIN_NAME .env | cut -d= -f2)
        EMAIL=$(grep EMAIL .env | cut -d= -f2)
        if [ -z "$DOMAIN_NAME" ]; then
            echo "❌ 无法获取域名信息"
            exit 1
        fi

        # 确保证书目录存在
        mkdir -p ssl
        sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
        sudo chown -R $USER:$USER /var/www/certbot

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
        sudo chown $USER:$USER ssl/cert.pem ssl/key.pem
        chmod 644 ssl/cert.pem
        chmod 600 ssl/key.pem

        # 重启服务以应用新证书
        docker-compose -f docker-compose.prod.yml restart nginx
        echo "✅ SSL证书初始化完成"
        ;;
    *)
        echo "Stable Coin Payment 生产环境管理脚本"
        echo "使用方法: $0 {start|stop|restart|logs|status|ssl-renew|init-ssl}"
        echo ""
        echo "在远程生产服务器上使用此脚本来管理已部署的服务："
        echo "  start      - 启动所有服务"
        echo "  stop       - 停止所有服务"
        echo "  restart    - 重启所有服务"
        echo "  logs       - 查看实时日志"
        echo "  status     - 查看服务状态和健康检查"
        echo "  ssl-renew  - 手动续期SSL证书"
        echo "  init-ssl   - 初始化SSL证书"
        ;;
esac