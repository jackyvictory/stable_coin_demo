# EVO Payment 部署指南

## 📁 文件结构

```
deploy/
├── deploy.sh              # 主部署脚本
├── cache-manager.sh       # 缓存管理脚本
├── docker-entrypoint.sh   # 容器启动脚本
├── manage.sh              # 应用管理脚本
├── Dockerfile             # Docker 镜像构建配置
├── docker-compose.yml     # Docker Compose 配置
├── nginx.conf             # 统一 Nginx 配置 (支持 HTTP/HTTPS)
└── DEPLOYMENT.md          # 本部署指南
```

## 🚀 优化部署方案

EVO Payment 采用智能缓存构建策略和统一配置管理，显著提升部署速度和效率。

### 🔧 配置特性

- **统一 nginx 配置**: 自动检测 SSL 证书，动态支持 HTTP/HTTPS
- **多阶段构建**: 优化 Docker 镜像大小和构建速度
- **智能缓存**: 基础组件缓存，应用代码快速更新

### 📋 部署脚本概览

| 脚本 | 用途 | 适用场景 | 构建时间 |
|------|------|----------|----------|
| `deploy.sh` | 完整部署 | 首次部署、代码更新 | 3-5分钟 |
| `deploy.sh ... false` | 快速部署 | 配置更新、SSL续期 | 1-2分钟 |
| `cache-manager.sh` | 缓存管理 | 维护优化 | - |

### 🔄 部署流程

#### 部署命令
```bash
# 进入部署目录
cd demo

# 完整部署 (首次部署和代码更新时使用)
./deploy.sh ubuntu@18.141.172.113 demo.ctbz.xyz /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem jacky.zhang@cardinfolink.com

# 快速部署 (仅配置更新，跳过镜像构建，节省时间)
./deploy.sh ubuntu@18.141.172.113 demo.ctbz.xyz /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem jacky.zhang@cardinfolink.com false

# 验证部署
curl -I https://demo.ctbz.xyz

# 检查健康状态
curl https://demo.ctbz.xyz/health
```

### 🔧 缓存管理

#### 查看缓存状态
```bash
./cache-manager.sh status
```

#### 清理旧版本
```bash
./cache-manager.sh clean
```

#### 重建基础缓存
```bash
./cache-manager.sh rebuild
```

#### 查看存储占用
```bash
./cache-manager.sh size
```

### 🧪 测试构建

在部署前测试构建过程：
```bash
# 进入部署目录
cd deploy

# 测试基础镜像构建
docker build -f Dockerfile --target base -t evo-payment-base:test .

# 测试完整镜像构建
docker build -f Dockerfile -t evo-payment:test .

# 本地测试运行
docker run -p 8080:80 evo-payment:test
```

## 📊 性能优化

### 构建优化

**多阶段构建策略：**
1. **基础阶段** - 包含nginx、工具、依赖 (缓存)
2. **应用阶段** - 仅包含项目文件 (每次更新)

**统一配置管理：**
- 单一 `nginx.conf` 文件，支持动态 HTTP/HTTPS 切换
- 自动检测 SSL 证书，无需手动配置切换
- 简化的容器启动脚本，减少配置复杂性

**缓存机制：**
- 基础组件一次下载，永久缓存
- 应用代码独立打包，快速更新
- 智能分层，最大化缓存利用率

### 部署优化

**智能清理：**
- 保留基础镜像缓存
- 仅清理过期应用版本
- 避免重复下载系统组件

**快速传输：**
- 压缩镜像传输
- 增量更新机制
- 并行处理优化

### 性能对比

| 场景 | 传统方式 | 完整部署 | 快速部署 | 提升 |
|------|----------|----------|----------|------|
| 首次部署 | 8-12分钟 | 3-5分钟 | - | 60%+ |
| 代码更新 | 5-8分钟 | 1-2分钟 | - | 80%+ |
| 配置更新 | 5-8分钟 | 1-2分钟 | 30-60秒 | 90%+ |
| SSL续期 | 手动操作 | 1-2分钟 | 30-60秒 | 自动化 |
| 镜像大小 | 200MB+ | 50-100MB | 无传输 | 50%+ |
| 网络传输 | 每次全量 | 增量更新 | 跳过传输 | 70%+ |

## 🛠️ 故障排除

### 常见问题

#### 1. 基础镜像缓存丢失
**症状：** 每次构建都很慢
**解决：**
```bash
./cache-manager.sh status
./cache-manager.sh rebuild
```

#### 2. 构建失败
**症状：** Docker构建报错
**解决：**
```bash
# 检查Dockerfile
ls -la Dockerfile

# 测试构建
docker build -f Dockerfile --target base -t test-base .

# 重建缓存
./cache-manager.sh rebuild
```

#### 3. 部署超时
**症状：** 部署过程中断
**解决：**
```bash
# 检查网络连接
ping your-server.com

# 检查SSH连接
ssh -i /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem ubuntu@18.141.172.113

# 重新部署
./deploy.sh ...
```

#### 4. SSL证书申请失败
**症状：** SSL证书申请过程中出现验证失败
**常见原因：**
- 端口80被其他服务占用
- 域名DNS解析未指向服务器
- 防火墙阻止了80端口访问
- Let's Encrypt验证文件无法访问

**解决步骤：**
```bash
# SSH到服务器
ssh -i /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem ubuntu@18.141.172.113
cd /opt/evo-payment

# 1. 检查端口80占用情况
sudo netstat -tlnp | grep :80

# 2. 停止占用端口的服务
sudo systemctl stop apache2 nginx
sudo docker stop $(sudo docker ps -q --filter "publish=80")

# 3. 检查域名解析
nslookup demo.ctbz.xyz
dig demo.ctbz.xyz

# 4. 测试外部访问
curl -I http://demo.ctbz.xyz

# 5. 手动申请SSL证书 (方法1: webroot)
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot --webroot-path=/var/www/certbot -d demo.ctbz.xyz

# 6. 手动申请SSL证书 (方法2: standalone)
sudo certbot certonly --standalone -d demo.ctbz.xyz

# 7. 如果成功，复制证书
sudo cp /etc/letsencrypt/live/demo.ctbz.xyz/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/demo.ctbz.xyz/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/cert.pem ssl/key.pem

# 8. 重新部署
docker-compose restart
```

#### 5. HTTPS访问失败
**症状：** HTTPS访问返回错误或无法连接
**解决：**
```bash
# SSH到服务器
ssh -i /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem ubuntu@18.141.172.113
cd /opt/evo-payment

# 检查证书状态
./manage.sh status

# 检查证书文件
ls -la ssl/
openssl x509 -in ssl/cert.pem -text -noout | grep -E "(Subject:|Not After)"

# 手动续期
./manage.sh ssl-renew

# 重启服务
./manage.sh restart
```

### 日志查看

#### 本地构建日志
```bash
# Docker构建日志
docker build -f Dockerfile -t test .

# 镜像信息
docker images | grep evo-payment
```

#### 远程部署日志
```bash
# SSH到服务器
ssh -i /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem ubuntu@18.141.172.113
cd /opt/evo-payment

# 查看应用日志
./manage.sh logs

# 查看系统日志
sudo journalctl -u docker
```

## ⚙️ 配置说明

### nginx.conf 特性

统一的 nginx 配置文件支持以下特性：

- **自动 HTTPS 重定向**: 检测到 SSL 证书时，HTTP 请求自动重定向到 HTTPS
- **纯 HTTP 模式**: 无 SSL 证书时，直接提供 HTTP 服务
- **Let's Encrypt 支持**: 内置 `/.well-known/acme-challenge/` 路径支持
- **安全头部**: 自动添加安全相关的 HTTP 头部
- **静态资源缓存**: 优化的缓存策略
- **Rate Limiting**: 防止 API 滥用和 DDoS 攻击

### 环境变量配置

容器支持以下环境变量：

- `DOMAIN_NAME`: 域名设置 (默认: localhost)
- `SSL_MODE`: SSL 模式 (auto/http/https，默认: auto)
- `AUTO_SSL`: 自动生成 SSL 证书 (true/false)
- `SSL_EMAIL`: Let's Encrypt 证书邮箱

### 使用示例

```bash
# HTTP 模式
docker run -e SSL_MODE=http -p 80:80 evo-payment

# HTTPS 模式 (需要挂载证书)
docker run -e SSL_MODE=https -v /path/to/ssl:/opt/evo-payment/ssl -p 80:80 -p 443:443 evo-payment

# 自动生成证书模式
docker run -e AUTO_SSL=true -e SSL_EMAIL=jacky.zhang@cardinfolink.com -e DOMAIN_NAME=demo.ctbz.xyz -p 80:80 -p 443:443 evo-payment
```

## 🔒 安全最佳实践

### SSH密钥管理
- 使用专用SSH密钥
- 设置适当的文件权限 (600)
- 定期轮换密钥

### 服务器安全
- 开启防火墙，仅开放必要端口
- 定期更新系统和Docker
- 监控异常访问

### SSL证书
- 使用Let's Encrypt免费证书
- 设置自动续期
- 监控证书过期时间

## 📈 监控和维护

### 健康检查
```bash
# 远程健康检查
curl -I https://demo.ctbz.xyz/health

# 服务器状态检查
ssh -i /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem ubuntu@18.141.172.113 'cd /opt/evo-payment && ./manage.sh status'
```

### 定期维护
```bash
# 每周清理旧镜像
./cache-manager.sh clean

# 每月检查证书状态
ssh -i /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem ubuntu@18.141.172.113 'cd /opt/evo-payment && ./manage.sh status'

# 每季度重建基础缓存
./cache-manager.sh rebuild
```

### 备份策略
- 定期备份SSL证书
- 备份应用配置文件
- 记录部署版本信息

## 🚀 高级用法

### 快速部署模式
```bash
# 进入部署目录
cd deploy

# 快速部署 (跳过镜像构建)
./deploy.sh ubuntu@18.141.172.113 demo.ctbz.xyz /Users/jacky/go/src/desktop/keys/inf-sgp-temporary.pem jacky.zhang@cardinfolink.com false

# 适用场景:
# - SSL证书续期
# - 配置文件更新
# - 容器重启
# - 环境变量修改
```

### 自定义构建
```bash
# 进入部署目录
cd deploy

# 使用自定义Dockerfile
docker build -f Dockerfile.custom -t evo-payment:custom .

# 指定构建参数
docker build --build-arg VERSION=1.0.0 -t evo-payment:1.0.0 .

# 使用环境变量自定义配置
docker run -e SSL_MODE=https -e DOMAIN_NAME=example.com -p 8080:80 evo-payment:test
```

### 多环境部署
```bash
# 进入部署目录
cd deploy

# 开发环境
./deploy.sh ubuntu@dev-server.com dev.domain.com ~/.ssh/dev-key.pem admin@company.com

# 生产环境
./deploy.sh ubuntu@prod-server.com domain.com ~/.ssh/prod-key.pem admin@company.com
```

### 批量部署
```bash
# 创建服务器列表
cat > servers.txt << EOF
ubuntu@server1.com,domain1.com,~/.ssh/key1.pem,admin@company.com
ubuntu@server2.com,domain2.com,~/.ssh/key2.pem,admin@company.com
EOF

# 批量部署脚本
while IFS=',' read -r host domain key email; do
    echo "部署到 $host..."
    ./deploy.sh "$host" "$domain" "$key" "$email"
done < servers.txt
```

## 🔒 SSL证书智能管理

### 自动证书检查

部署脚本现在包含智能SSL证书检查功能：

- **自动检测现有证书**：检查证书文件是否存在
- **验证证书有效性**：确认证书格式正确且未过期
- **域名匹配检查**：验证证书域名与目标域名一致
- **有效期检查**：确保证书至少还有7天有效期
- **跳过不必要申请**：如果证书有效，自动跳过申请流程

### 证书管理命令

在远程服务器的 `/opt/evo-payment` 目录下可使用以下命令：

```bash
# 检查SSL证书状态
./manage.sh ssl-check

# 智能续期（仅在需要时续期）
./manage.sh ssl-renew

# 强制续期（无论是否需要）
./manage.sh ssl-force-renew

# 应用管理
./manage.sh start      # 启动服务
./manage.sh stop       # 停止服务
./manage.sh restart    # 重启服务
./manage.sh logs       # 查看日志
./manage.sh status     # 查看状态
```

### 证书检查逻辑

部署时的证书检查流程：

1. **检查证书文件**：`ssl/cert.pem` 和 `ssl/key.pem`
2. **验证证书格式**：使用 `openssl` 验证证书有效性
3. **检查有效期**：确保证书至少还有7天有效期
4. **验证域名**：确认证书CN字段与目标域名匹配
5. **决定是否申请**：只有在必要时才申请新证书

### 证书续期策略

- **智能续期**：仅在证书30天内过期时执行
- **强制续期**：无论有效期如何都执行续期
- **自动续期**：通过crontab每天检查并自动续期

## 📞 支持

如遇到问题，请检查：
1. 网络连接和DNS解析
2. SSH密钥权限和连接
3. 服务器防火墙和安全组
4. Docker服务状态
5. 磁盘空间和内存使用
6. SSL证书状态和有效期

更多帮助请查看项目文档或提交Issue。