# 多阶段构建 - 基础镜像阶段
FROM nginx:alpine AS base

# 安装必要的工具 (这一层会被缓存)
RUN apk add --no-cache \
    curl \
    bash \
    openssl \
    docker-cli \
    docker-compose

# 创建必要的目录 (这一层会被缓存)
RUN mkdir -p /var/log/nginx \
    /opt/evo-payment/ssl \
    /opt/evo-payment/logs \
    /var/www/certbot

# 资源哈希处理阶段
FROM base AS hash-resources

# 安装Node.js用于处理资源哈希
RUN apk add --no-cache nodejs npm

# 设置工作目录
WORKDIR /app

# 复制处理脚本和静态资源
COPY deploy/generate-resource-hashes.js ./
COPY index.html payment.html qrcode.html success.html ./
COPY css/ ./css/
COPY js/ ./js/
COPY images/ ./images/
COPY lib/ ./lib/
COPY config.js ./

# 生成资源哈希并重命名文件
RUN node generate-resource-hashes.js .

# 应用构建阶段
FROM base AS app

# 设置工作目录
WORKDIR /usr/share/nginx/html

# 从哈希处理阶段复制处理后的文件
COPY --from=hash-resources /app/index.html ./
COPY --from=hash-resources /app/payment.html ./
COPY --from=hash-resources /app/qrcode.html ./
COPY --from=hash-resources /app/success.html ./
COPY --from=hash-resources /app/css/ ./css/
COPY --from=hash-resources /app/js/ ./js/
COPY --from=hash-resources /app/images/ ./images/
COPY --from=hash-resources /app/lib/ ./lib/
COPY --from=hash-resources /app/config.js ./

# 复制配置文件到镜像中
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# 复制部署和管理脚本
COPY deploy/*.sh /usr/local/bin/
COPY deploy/docker-compose.yml /opt/evo-payment/docker-compose.prod.yml

# 创建文档目录 (文档将通过卷挂载或其他方式提供)
RUN mkdir -p /opt/evo-payment/docs

# 设置脚本执行权限
RUN chmod +x /usr/local/bin/*.sh

# 设置正确的文件权限
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# 创建启动脚本
COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 暴露端口
EXPOSE 80 443

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# 使用自定义启动脚本
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]