/**
 * EVO Payment UI 组件库
 * 包含加载动画、状态指示器、通知等 UI 组件
 */

class UIComponents {
    constructor() {
        this.activeLoaders = new Set();
        this.notifications = [];
        this.init();
    }
    
    /**
     * 初始化 UI 组件
     */
    init() {
        console.log('UIComponents 初始化...');
        
        // 创建通知容器
        this.createNotificationContainer();
        
        // 绑定全局事件
        this.bindGlobalEvents();
        
        console.log('✅ UIComponents 初始化完成');
    }
    
    /**
     * 创建通知容器
     */
    createNotificationContainer() {
        if (document.getElementById('ui-notifications')) {
            return;
        }
        
        const container = document.createElement('div');
        container.id = 'ui-notifications';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10001;
            max-width: 400px;
            pointer-events: none;
        `;
        
        document.body.appendChild(container);
    }
    
    /**
     * 绑定全局事件
     */
    bindGlobalEvents() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAnimations();
            } else {
                this.resumeAnimations();
            }
        });
        
        // 监听网络状态变化
        window.addEventListener('online', () => {
            this.showNotification('网络连接已恢复', 'success', { autoHide: true });
        });
        
        window.addEventListener('offline', () => {
            this.showNotification('网络连接已断开', 'warning', { autoHide: false });
        });
    }
    
    /**
     * 显示加载覆盖层
     * @param {string} message - 加载消息
     * @param {Object} options - 选项
     * @returns {string} 加载器ID
     */
    showLoader(message = '加载中...', options = {}) {
        const loaderId = 'loader_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const overlay = document.createElement('div');
        overlay.id = loaderId;
        overlay.className = 'loading-overlay fade-in';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
        `;
        
        const content = document.createElement('div');
        content.className = 'loading-content bounce-in';
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            max-width: 300px;
            margin: 20px;
        `;
        
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner-large';
        spinner.style.cssText = `
            display: inline-block;
            width: 40px;
            height: 40px;
            border: 4px solid rgba(102, 126, 234, 0.3);
            border-radius: 50%;
            border-top-color: #667eea;
            animation: spin 1s ease-in-out infinite;
            margin-bottom: 15px;
        `;
        
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.cssText = `
            font-size: 16px;
            font-weight: 500;
            color: #333;
            margin-bottom: 10px;
        `;
        
        // 进度条（如果需要）
        if (options.showProgress) {
            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = `
                width: 100%;
                height: 6px;
                background: #e5e7eb;
                border-radius: 3px;
                overflow: hidden;
                margin-top: 15px;
            `;
            
            const progressBar = document.createElement('div');
            progressBar.id = loaderId + '_progress';
            progressBar.style.cssText = `
                height: 100%;
                background: linear-gradient(45deg, #667eea, #764ba2);
                border-radius: 3px;
                width: 0%;
                transition: width 0.3s ease;
            `;
            
            progressContainer.appendChild(progressBar);
            content.appendChild(progressContainer);
        }
        
        // 取消按钮（如果需要）
        if (options.cancelable) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.className = 'btn btn-secondary btn-small';
            cancelBtn.style.marginTop = '15px';
            cancelBtn.onclick = () => {
                if (options.onCancel) options.onCancel();
                this.hideLoader(loaderId);
            };
            content.appendChild(cancelBtn);
        }
        
        content.appendChild(spinner);
        content.appendChild(messageEl);
        overlay.appendChild(content);
        
        document.body.appendChild(overlay);
        this.activeLoaders.add(loaderId);
        
        // 自动隐藏（如果设置了超时）
        if (options.timeout) {
            setTimeout(() => {
                this.hideLoader(loaderId);
            }, options.timeout);
        }
        
        return loaderId;
    }
    
    /**
     * 隐藏加载器
     * @param {string} loaderId - 加载器ID
     */
    hideLoader(loaderId) {
        const loader = document.getElementById(loaderId);
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
                this.activeLoaders.delete(loaderId);
            }, 300);
        }
    }
    
    /**
     * 更新加载器进度
     * @param {string} loaderId - 加载器ID
     * @param {number} progress - 进度百分比 (0-100)
     * @param {string} message - 新消息
     */
    updateLoader(loaderId, progress, message) {
        const loader = document.getElementById(loaderId);
        if (!loader) return;
        
        // 更新进度条
        const progressBar = document.getElementById(loaderId + '_progress');
        if (progressBar) {
            progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
        }
        
        // 更新消息
        if (message) {
            const messageEl = loader.querySelector('.loading-content div:last-child');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    }
    
    /**
     * 显示状态指示器
     * @param {string} message - 状态消息
     * @param {string} type - 状态类型 (pending, success, error, warning, info)
     * @param {Object} options - 选项
     * @returns {HTMLElement} 状态元素
     */
    showStatus(message, type = 'info', options = {}) {
        const statusEl = document.createElement('div');
        statusEl.className = `status-indicator status-${type} fade-in`;
        
        if (options.pulse) {
            statusEl.classList.add('pulse');
        }
        
        // 状态图标
        const icon = this.getStatusIcon(type);
        const iconEl = document.createElement('span');
        iconEl.innerHTML = icon;
        iconEl.style.fontSize = '18px';
        
        // 状态消息
        const messageEl = document.createElement('span');
        messageEl.textContent = message;
        
        statusEl.appendChild(iconEl);
        statusEl.appendChild(messageEl);
        
        // 如果指定了容器，添加到容器中
        if (options.container) {
            const container = typeof options.container === 'string' 
                ? document.getElementById(options.container)
                : options.container;
            if (container) {
                container.appendChild(statusEl);
            }
        }
        
        // 自动隐藏
        if (options.autoHide !== false) {
            setTimeout(() => {
                statusEl.classList.add('fade-out');
                setTimeout(() => {
                    if (statusEl.parentNode) {
                        statusEl.parentNode.removeChild(statusEl);
                    }
                }, 300);
            }, options.duration || 5000);
        }
        
        return statusEl;
    }
    
    /**
     * 获取状态图标
     * @param {string} type - 状态类型
     * @returns {string} 图标HTML
     */
    getStatusIcon(type) {
        const icons = {
            pending: '⏳',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型
     * @param {Object} options - 选项
     */
    showNotification(message, type = 'info', options = {}) {
        const notification = {
            id: 'notif_' + Date.now(),
            message,
            type,
            timestamp: new Date(),
            autoHide: options.autoHide !== false,
            duration: options.duration || 5000,
            actions: options.actions || []
        };
        
        const notificationEl = this.createNotificationElement(notification);
        const container = document.getElementById('ui-notifications');
        
        if (container) {
            container.appendChild(notificationEl);
            
            // 动画显示
            setTimeout(() => {
                notificationEl.style.transform = 'translateX(0)';
                notificationEl.style.opacity = '1';
            }, 100);
            
            // 自动隐藏
            if (notification.autoHide) {
                setTimeout(() => {
                    this.hideNotification(notificationEl);
                }, notification.duration);
            }
        }
        
        this.notifications.push(notification);
        return notification.id;
    }
    
    /**
     * 创建通知元素
     * @param {Object} notification - 通知对象
     * @returns {HTMLElement} 通知元素
     */
    createNotificationElement(notification) {
        const el = document.createElement('div');
        el.className = `notification notification-${notification.type}`;
        el.style.cssText = `
            background: ${this.getNotificationColor(notification.type)};
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            margin-bottom: 10px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease;
            pointer-events: auto;
            max-width: 100%;
            word-wrap: break-word;
            position: relative;
            border-left: 4px solid rgba(255,255,255,0.3);
        `;
        
        // 通知图标
        const iconEl = document.createElement('div');
        iconEl.innerHTML = this.getStatusIcon(notification.type);
        iconEl.style.cssText = `
            display: inline-block;
            margin-right: 10px;
            font-size: 16px;
        `;
        
        // 消息内容
        const contentEl = document.createElement('div');
        contentEl.style.display = 'inline-block';
        contentEl.style.verticalAlign = 'top';
        contentEl.style.width = 'calc(100% - 60px)';
        
        const messageEl = document.createElement('div');
        messageEl.textContent = notification.message;
        messageEl.style.cssText = 'font-weight: 500; margin-bottom: 4px;';
        
        const timeEl = document.createElement('div');
        timeEl.textContent = notification.timestamp.toLocaleTimeString();
        timeEl.style.cssText = 'font-size: 12px; opacity: 0.8;';
        
        contentEl.appendChild(messageEl);
        contentEl.appendChild(timeEl);
        
        // 关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 12px;
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.7';
        closeBtn.onclick = () => this.hideNotification(el);
        
        el.appendChild(iconEl);
        el.appendChild(contentEl);
        el.appendChild(closeBtn);
        
        // 操作按钮
        if (notification.actions && notification.actions.length > 0) {
            const actionsEl = document.createElement('div');
            actionsEl.style.cssText = 'margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;';
            
            notification.actions.forEach(action => {
                const actionBtn = document.createElement('button');
                actionBtn.textContent = action.label;
                actionBtn.style.cssText = `
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background 0.2s;
                `;
                actionBtn.onmouseover = () => actionBtn.style.background = 'rgba(255,255,255,0.3)';
                actionBtn.onmouseout = () => actionBtn.style.background = 'rgba(255,255,255,0.2)';
                actionBtn.onclick = () => {
                    if (action.handler) action.handler();
                    this.hideNotification(el);
                };
                actionsEl.appendChild(actionBtn);
            });
            
            el.appendChild(actionsEl);
        }
        
        return el;
    }
    
    /**
     * 获取通知颜色
     * @param {string} type - 通知类型
     * @returns {string} 颜色值
     */
    getNotificationColor(type) {
        const colors = {
            success: 'linear-gradient(135deg, #46C16D, #38a558)',
            info: 'linear-gradient(135deg, #667eea, #764ba2)',
            warning: 'linear-gradient(135deg, #DD6B20, #c05621)',
            error: 'linear-gradient(135deg, #D7272B, #b91c1c)',
            pending: 'linear-gradient(135deg, #fbbf24, #f59e0b)'
        };
        return colors[type] || colors.info;
    }
    
    /**
     * 隐藏通知
     * @param {HTMLElement} notificationEl - 通知元素
     */
    hideNotification(notificationEl) {
        notificationEl.style.transform = 'translateX(100%)';
        notificationEl.style.opacity = '0';
        
        setTimeout(() => {
            if (notificationEl.parentNode) {
                notificationEl.parentNode.removeChild(notificationEl);
            }
        }, 300);
    }
    
    /**
     * 创建进度条
     * @param {HTMLElement} container - 容器元素
     * @param {Object} options - 选项
     * @returns {Object} 进度条控制对象
     */
    createProgressBar(container, options = {}) {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar';
        progressContainer.style.cssText = `
            width: 100%;
            height: ${options.height || 8}px;
            background: #e5e7eb;
            border-radius: ${(options.height || 8) / 2}px;
            overflow: hidden;
            margin: ${options.margin || '15px 0'};
        `;
        
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.cssText = `
            height: 100%;
            background: ${options.color || 'linear-gradient(45deg, #667eea, #764ba2)'};
            border-radius: ${(options.height || 8) / 2}px;
            width: 0%;
            transition: width 0.3s ease;
            position: relative;
        `;
        
        if (options.animated !== false) {
            progressFill.style.backgroundImage = `
                linear-gradient(
                    -45deg,
                    rgba(255, 255, 255, .2) 25%,
                    transparent 25%,
                    transparent 50%,
                    rgba(255, 255, 255, .2) 50%,
                    rgba(255, 255, 255, .2) 75%,
                    transparent 75%,
                    transparent
                )
            `;
            progressFill.style.backgroundSize = '50px 50px';
            progressFill.style.animation = 'move 2s linear infinite';
        }
        
        progressContainer.appendChild(progressFill);
        container.appendChild(progressContainer);
        
        return {
            setProgress: (percent) => {
                progressFill.style.width = Math.min(100, Math.max(0, percent)) + '%';
            },
            setColor: (color) => {
                progressFill.style.background = color;
            },
            remove: () => {
                if (progressContainer.parentNode) {
                    progressContainer.parentNode.removeChild(progressContainer);
                }
            }
        };
    }
    
    /**
     * 创建复制按钮
     * @param {string} text - 要复制的文本
     * @param {Object} options - 选项
     * @returns {HTMLElement} 复制按钮
     */
    createCopyButton(text, options = {}) {
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.textContent = options.label || '复制';
        button.style.cssText = `
            background: #e2e8f0;
            border: none;
            border-radius: 6px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
            color: #4a5568;
            transition: all 0.2s ease;
            margin-left: 8px;
        `;
        
        button.onclick = async () => {
            try {
                await navigator.clipboard.writeText(text);
                const originalText = button.textContent;
                button.textContent = '已复制';
                button.style.background = '#48bb78';
                button.style.color = 'white';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '#e2e8f0';
                    button.style.color = '#4a5568';
                }, 2000);
                
                if (options.onSuccess) options.onSuccess();
            } catch (err) {
                console.error('复制失败:', err);
                if (options.onError) options.onError(err);
            }
        };
        
        return button;
    }
    
    /**
     * 暂停动画
     */
    pauseAnimations() {
        document.querySelectorAll('.loading-spinner, .loading-spinner-large').forEach(el => {
            el.style.animationPlayState = 'paused';
        });
    }
    
    /**
     * 恢复动画
     */
    resumeAnimations() {
        document.querySelectorAll('.loading-spinner, .loading-spinner-large').forEach(el => {
            el.style.animationPlayState = 'running';
        });
    }
    
    /**
     * 清除所有加载器
     */
    clearAllLoaders() {
        this.activeLoaders.forEach(loaderId => {
            this.hideLoader(loaderId);
        });
    }
    
    /**
     * 清除所有通知
     */
    clearAllNotifications() {
        const container = document.getElementById('ui-notifications');
        if (container) {
            container.innerHTML = '';
        }
        this.notifications = [];
    }
    
    // 便捷方法
    
    /**
     * 显示成功通知
     */
    showSuccess(message, options = {}) {
        return this.showNotification(message, 'success', options);
    }
    
    /**
     * 显示错误通知
     */
    showError(message, options = {}) {
        return this.showNotification(message, 'error', options);
    }
    
    /**
     * 显示警告通知
     */
    showWarning(message, options = {}) {
        return this.showNotification(message, 'warning', options);
    }
    
    /**
     * 显示信息通知
     */
    showInfo(message, options = {}) {
        return this.showNotification(message, 'info', options);
    }
}

// 创建全局实例
window.UIComponents = new UIComponents();

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIComponents;
}