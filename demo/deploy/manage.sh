#!/bin/bash

# EVO Payment 管理脚本
# 用于管理容器化的 EVO Payment 应用

case "$1" in
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
            CERT_DATES=$(openssl x509 -in ssl/cert.pem -dates -noout 2>/dev/null || echo "无法读取证书")
            echo "证书信息: $CERT_DATES"
        else
            echo "未找到 SSL 证书"
        fi
        ;;
    "ssl-renew")
        echo "检查SSL证书续期需求..."
        DOMAIN_NAME=$(grep DOMAIN_NAME .env | cut -d= -f2)
        if [ -z "$DOMAIN_NAME" ]; then
            echo "❌ 无法获取域名信息"
            exit 1
        fi
        
        # 检查证书是否存在和有效
        if [ -f "ssl/cert.pem" ]; then
            # 检查证书是否需要续期（30天内过期）
            if openssl x509 -in ssl/cert.pem -checkend 2592000 -noout 2>/dev/null; then
                echo "ℹ️ 证书仍然有效（超过30天），无需续期"
                echo "当前证书信息:"
                openssl x509 -in ssl/cert.pem -dates -noout 2>/dev/null || echo "无法读取证书信息"
                echo "如需强制续期，请使用: ./manage.sh ssl-force-renew"
                exit 0
            else
                echo "⚠️ 证书即将过期（30天内），开始续期..."
            fi
        else
            echo "❌ 未找到SSL证书文件"
            exit 1
        fi
        
        # 确保webroot目录存在
        sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
        sudo chown -R $USER:$USER /var/www/certbot
        
        # 使用webroot方式续期
        if sudo certbot renew --webroot --webroot-path=/var/www/certbot; then
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
            sudo chown $USER:$USER ssl/cert.pem ssl/key.pem
            docker-compose restart
            echo "✅ SSL证书续期完成"
        else
            echo "❌ SSL证书续期失败"
            echo "请检查域名解析和网络连接"
            exit 1
        fi
        ;;
    "ssl-force-renew")
        echo "强制续期SSL证书..."
        DOMAIN_NAME=$(grep DOMAIN_NAME .env | cut -d= -f2)
        if [ -z "$DOMAIN_NAME" ]; then
            echo "❌ 无法获取域名信息"
            exit 1
        fi
        
        # 确保webroot目录存在
        sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
        sudo chown -R $USER:$USER /var/www/certbot
        
        # 强制续期
        if sudo certbot renew --force-renewal --webroot --webroot-path=/var/www/certbot; then
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ssl/cert.pem
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ssl/key.pem
            sudo chown $USER:$USER ssl/cert.pem ssl/key.pem
            docker-compose restart
            echo "✅ SSL证书强制续期完成"
        else
            echo "❌ SSL证书强制续期失败"
            echo "请检查域名解析和网络连接"
            exit 1
        fi
        ;;
    "ssl-check")
        echo "=== SSL证书检查 ==="
        if [ -f "ssl/cert.pem" ]; then
            echo "✅ 证书文件存在"
            
            # 检查证书格式
            if openssl x509 -in ssl/cert.pem -noout 2>/dev/null; then
                echo "✅ 证书格式正确"
                
                # 显示证书信息
                echo "📋 证书详细信息:"
                CERT_SUBJECT=$(openssl x509 -in ssl/cert.pem -subject -noout 2>/dev/null | sed 's/subject=//')
                CERT_DATES=$(openssl x509 -in ssl/cert.pem -dates -noout 2>/dev/null)
                echo "  主题: $CERT_SUBJECT"
                echo "  $CERT_DATES"
                
                # 检查有效期
                if openssl x509 -in ssl/cert.pem -checkend 0 -noout 2>/dev/null; then
                    echo "✅ 证书当前有效"
                    
                    if openssl x509 -in ssl/cert.pem -checkend 2592000 -noout 2>/dev/null; then
                        echo "✅ 证书有效期充足（超过30天）"
                    else
                        echo "⚠️ 证书将在30天内过期，建议续期"
                    fi
                else
                    echo "❌ 证书已过期"
                fi
            else
                echo "❌ 证书格式错误"
            fi
        else
            echo "❌ 未找到SSL证书文件"
        fi
        ;;
    *)
        echo "EVO Payment 管理脚本"
        echo "使用方法: $0 {start|stop|restart|logs|status|ssl-renew|ssl-force-renew|ssl-check}"
        ;;
esac