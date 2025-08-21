/**
 * EVO Payment 路由管理器
 * 处理页面导航和状态管理
 */

class EVORouter {
    constructor() {
        this.routes = {
            '/': 'home',
            '/payment': 'payment',
            '/qrcode': 'qrcode',
            '/success': 'success'
        };
        
        this.currentRoute = '/';
        this.history = [];
        
        // 绑定事件
        this.bindEvents();
    }
    
    /**
     * 绑定路由事件
     */
    bindEvents() {
        // 监听浏览器前进后退
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.route) {
                this.navigateTo(event.state.route, false);
            }
        });
        
        // 监听页面链接点击
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[data-route]');
            if (link) {
                event.preventDefault();
                const route = link.getAttribute('data-route');
                this.navigateTo(route);
            }
        });
    }
    
    /**
     * 导航到指定路由
     * @param {string} route - 目标路由
     * @param {boolean} pushState - 是否添加到浏览器历史
     */
    navigateTo(route, pushState = true) {
        // 验证路由
        if (!this.routes[route]) {
            console.error(`未知路由: ${route}`);
            return;
        }
        
        // 保存当前路由到历史
        if (this.currentRoute !== route) {
            this.history.push(this.currentRoute);
        }
        
        // 更新当前路由
        this.currentRoute = route;
        
        // 更新浏览器历史
        if (pushState) {
            const title = this.getPageTitle(route);
            history.pushState({ route }, title, route);
            document.title = title;
        }
        
        // 触发路由变化事件
        this.onRouteChange(route);
        
        console.log(`导航到: ${route}`);
    }
    
    /**
     * 返回上一页
     */
    goBack() {
        if (this.history.length > 0) {
            const previousRoute = this.history.pop();
            this.navigateTo(previousRoute);
        } else {
            this.navigateTo('/');
        }
    }
    
    /**
     * 获取页面标题
     * @param {string} route - 路由
     * @returns {string} 页面标题
     */
    getPageTitle(route) {
        const titles = {
            '/': 'EVO Payment - Home',
            '/payment': 'EVO Payment - Select Amount',
            '/qrcode': 'EVO Payment - Scan QR Code',
            '/success': 'EVO Payment - Payment Success'
        };
        
        return titles[route] || 'EVO Payment';
    }
    
    /**
     * 路由变化处理
     * @param {string} route - 新路由
     */
    onRouteChange(route) {
        // 隐藏所有页面
        this.hideAllPages();
        
        // 显示目标页面
        const pageId = this.routes[route];
        const pageElement = document.getElementById(`page-${pageId}`);
        
        if (pageElement) {
            pageElement.classList.remove('hidden');
            
            // 触发页面初始化
            this.initializePage(pageId);
        } else {
            console.error(`页面元素未找到: page-${pageId}`);
        }
        
        // 更新导航状态
        this.updateNavigation(route);
    }
    
    /**
     * 隐藏所有页面
     */
    hideAllPages() {
        const pages = document.querySelectorAll('[id^="page-"]');
        pages.forEach(page => {
            page.classList.add('hidden');
        });
    }
    
    /**
     * 更新导航状态
     * @param {string} route - 当前路由
     */
    updateNavigation(route) {
        // 更新导航链接状态
        const navLinks = document.querySelectorAll('a[data-route]');
        navLinks.forEach(link => {
            const linkRoute = link.getAttribute('data-route');
            if (linkRoute === route) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        
        // 显示/隐藏返回按钮
        const backButton = document.getElementById('backButton');
        if (backButton) {
            if (route === '/' || this.history.length === 0) {
                backButton.classList.add('hidden');
            } else {
                backButton.classList.remove('hidden');
            }
        }
    }
    
    /**
     * 初始化页面
     * @param {string} pageId - 页面ID
     */
    initializePage(pageId) {
        switch (pageId) {
            case 'home':
                this.initializeHomePage();
                break;
            case 'payment':
                this.initializePaymentPage();
                break;
            case 'qrcode':
                this.initializeQRCodePage();
                break;
            case 'success':
                this.initializeSuccessPage();
                break;
        }
    }
    
    /**
     * 初始化首页
     */
    initializeHomePage() {
        console.log('初始化首页');
        // 首页初始化逻辑
    }
    
    /**
     * 初始化支付页面
     */
    initializePaymentPage() {
        console.log('初始化支付页面');
        // 支付页面初始化逻辑
        // 检查钱包连接状态
        if (!window.EVOPayment || !window.EVOPayment.userAccount) {
            window.EVOPayment.showError('请先连接钱包');
            this.navigateTo('/');
            return;
        }
        
        // 加载支持的代币
        this.loadSupportedTokens();
    }
    
    /**
     * 初始化二维码页面
     */
    initializeQRCodePage() {
        console.log('初始化二维码页面');
        // 二维码页面初始化逻辑
        const paymentData = this.getPaymentData();
        if (!paymentData) {
            window.EVOPayment.showError('支付信息不完整');
            this.navigateTo('/payment');
            return;
        }
        
        // 生成二维码
        this.generateQRCode(paymentData);
    }
    
    /**
     * 初始化成功页面
     */
    initializeSuccessPage() {
        console.log('初始化成功页面');
        // 成功页面初始化逻辑
        const paymentResult = this.getPaymentResult();
        if (paymentResult) {
            this.displayPaymentResult(paymentResult);
        }
    }
    
    /**
     * 加载支持的代币
     */
    loadSupportedTokens() {
        const config = window.EVO_CONFIG;
        const tokensContainer = document.getElementById('supportedTokens');
        
        if (tokensContainer && config) {
            const tokens = config.ConfigUtils.getSupportedTokens();
            tokensContainer.innerHTML = tokens.map(token => `
                <div class="token-option" data-token="${token.symbol}">
                    <img src="${token.icon}" alt="${token.name}" class="token-icon">
                    <span class="token-name">${token.name}</span>
                    <span class="token-symbol">${token.symbol}</span>
                </div>
            `).join('');
        }
    }
    
    /**
     * 获取支付数据
     */
    getPaymentData() {
        return sessionStorage.getItem('paymentData') ? 
               JSON.parse(sessionStorage.getItem('paymentData')) : null;
    }
    
    /**
     * 设置支付数据
     */
    setPaymentData(data) {
        sessionStorage.setItem('paymentData', JSON.stringify(data));
    }
    
    /**
     * 获取支付结果
     */
    getPaymentResult() {
        return sessionStorage.getItem('paymentResult') ? 
               JSON.parse(sessionStorage.getItem('paymentResult')) : null;
    }
    
    /**
     * 设置支付结果
     */
    setPaymentResult(result) {
        sessionStorage.setItem('paymentResult', JSON.stringify(result));
    }
    
    /**
     * 生成二维码
     */
    generateQRCode(paymentData) {
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer && window.QRCode) {
            // 构建支付链接
            const paymentUrl = this.buildPaymentUrl(paymentData);
            
            // 生成二维码
            QRCode.toCanvas(qrContainer, paymentUrl, {
                width: window.EVO_CONFIG.APP_CONFIG.ui.qrCodeSize,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) {
                    console.error('二维码生成失败:', error);
                    window.EVOPayment.showError('二维码生成失败');
                }
            });
        }
    }
    
    /**
     * 构建支付URL
     */
    buildPaymentUrl(paymentData) {
        const { token, amount, address } = paymentData;
        return `ethereum:${address}@${window.EVO_CONFIG.APP_CONFIG.currentNetwork}?value=${amount}&token=${token}`;
    }
    
    /**
     * 显示支付结果
     */
    displayPaymentResult(result) {
        const resultContainer = document.getElementById('paymentResultContainer');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="payment-result">
                    <h3>Payment ${result.status}</h3>
                    <p>Transaction Hash: ${result.txHash}</p>
                    <p>Amount: ${result.amount} ${result.token}</p>
                    <p>Time: ${new Date(result.timestamp).toLocaleString()}</p>
                </div>
            `;
        }
    }
    
    /**
     * 清理会话数据
     */
    clearSessionData() {
        sessionStorage.removeItem('paymentData');
        sessionStorage.removeItem('paymentResult');
    }
}

// 创建全局路由实例
window.EVORouter = new EVORouter();

// 导出路由器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EVORouter;
}