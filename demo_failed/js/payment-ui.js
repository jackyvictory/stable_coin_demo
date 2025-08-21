/**
 * EVO Payment 前端用户界面交互控制器
 * 处理支付流程的页面导航和用户交互
 */

class PaymentUI {
    constructor() {
        // UI 状态
        this.currentStep = 'home';
        this.paymentData = null;
        this.isProcessing = false;
        
        // 配置
        this.config = window.EVO_CONFIG || {};
        
        // 依赖组件
        this.paymentHandler = window.PaymentHandler;
        this.blockchainConnector = window.BlockchainConnector;
        this.blockchainMonitor = window.BlockchainMonitor;
        this.router = window.EVORouter;
        
        // UI 元素缓存
        this.elements = {};
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化 UI 控制器
     */
    init() {
        console.log('PaymentUI 初始化...');
        
        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupUI();
            });
        } else {
            this.setupUI();
        }
    }
    
    /**
     * 设置 UI
     */
    setupUI() {
        // 缓存常用元素
        this.cacheElements();
        
        // 绑定事件
        this.bindEvents();
        
        // 设置监听器
        this.setupEventListeners();
        
        // 初始化状态
        this.updateConnectionStatus();
        
        console.log('✅ PaymentUI 初始化完成');
    }
    
    /**
     * 缓存 DOM 元素
     */
    cacheElements() {
        this.elements = {
            // 钱包连接
            connectWallet: document.getElementById('connectWallet'),
            walletStatus: document.getElementById('walletStatus'),
            walletAddress: document.getElementById('walletAddress'),
            networkName: document.getElementById('networkName'),
            
            // 支付表单
            paymentForm: document.getElementById('paymentForm'),
            amountGrid: document.getElementById('amountGrid'),
            tokenGrid: document.getElementById('tokenGrid'),
            customAmount: document.getElementById('customAmount'),
            paymentSummary: document.getElementById('paymentSummary'),
            summaryAmount: document.getElementById('summaryAmount'),
            summaryToken: document.getElementById('summaryToken'),
            summaryReceiver: document.getElementById('summaryReceiver'),
            generateQRCode: document.getElementById('generateQRCode'),
            
            // 二维码页面
            qrContainer: document.getElementById('qrContainer'),
            qrCodeCanvas: document.getElementById('qrCodeCanvas'),
            qrAmount: document.getElementById('qrAmount'),
            qrToken: document.getElementById('qrToken'),
            qrAddress: document.getElementById('qrAddress'),
            paymentStatus: document.getElementById('paymentStatus'),
            checkPayment: document.getElementById('checkPayment'),
            
            // 成功页面
            paymentResult: document.getElementById('paymentResult'),
            viewTransaction: document.getElementById('viewTransaction'),
            
            // 状态消息
            errorMessage: document.getElementById('errorMessage'),
            successMessage: document.getElementById('successMessage'),
            statusMessages: document.getElementById('statusMessages')
        };
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 钱包连接
        if (this.elements.connectWallet && this.elements.connectWallet.addEventListener) {
            this.elements.connectWallet.addEventListener('click', () => {
                this.connectWallet();
            });
        }
        
        // 金额选择
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('amount-option')) {
                this.selectAmount(e.target);
            }
        });
        
        // 代币选择
        document.addEventListener('click', (e) => {
            if (e.target.closest('.token-option')) {
                this.selectToken(e.target.closest('.token-option'));
            }
        });
        
        // 自定义金额输入
        if (this.elements.customAmount && this.elements.customAmount.addEventListener) {
            this.elements.customAmount.addEventListener('input', (e) => {
                this.handleCustomAmount(e.target.value);
            });
        }
        
        // 生成二维码
        if (this.elements.generateQRCode && this.elements.generateQRCode.addEventListener) {
            this.elements.generateQRCode.addEventListener('click', () => {
                this.generatePaymentQR();
            });
        }
        
        // 检查支付状态
        if (this.elements.checkPayment && this.elements.checkPayment.addEventListener) {
            this.elements.checkPayment.addEventListener('click', () => {
                this.checkPaymentStatus();
            });
        }
        
        // 查看交易
        if (this.elements.viewTransaction && this.elements.viewTransaction.addEventListener) {
            this.elements.viewTransaction.addEventListener('click', () => {
                this.viewTransactionOnExplorer();
            });
        }
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 区块链连接事件
        window.addEventListener('blockchainConnectionChanged', (event) => {
            this.handleConnectionChanged(event.detail);
        });
        
        window.addEventListener('blockchainAccountChanged', (event) => {
            this.handleAccountChanged(event.detail);
        });
        
        window.addEventListener('blockchainNetworkChanged', (event) => {
            this.handleNetworkChanged(event.detail);
        });
        
        // 支付状态事件
        window.addEventListener('paymentStatusChanged', (event) => {
            this.handlePaymentStatusChanged(event.detail);
        });
        
        // 监听事件
        window.addEventListener('monitoringStarted', (event) => {
            this.handleMonitoringStarted(event.detail);
        });
        
        window.addEventListener('paymentFound', (event) => {
            this.handlePaymentFound(event.detail);
        });
        
        window.addEventListener('paymentCompleted', (event) => {
            this.handlePaymentCompleted(event.detail);
        });
        
        window.addEventListener('paymentExpired', (event) => {
            this.handlePaymentExpired(event.detail);
        });
        
        window.addEventListener('paymentError', (event) => {
            this.handlePaymentError(event.detail);
        });
    }
    
    /**
     * 显示支付表单
     */
    showPaymentForm() {
        this.currentStep = 'payment';
        
        // 检查钱包连接
        if (!this.blockchainConnector?.isConnected) {
            this.showError('Please connect your wallet first');
            return;
        }
        
        // 初始化支付选项
        this.initializePaymentOptions();
        
        // 显示支付表单
        this.showStep('payment');
        
        console.log('💳 显示支付表单');
    }
    
    /**
     * 初始化支付选项
     */
    initializePaymentOptions() {
        // 初始化金额选项
        if (this.elements.amountGrid) {
            const amounts = this.config.APP_CONFIG?.ui?.defaultAmounts || [0.25, 0.5, 1, 2, 5, 10, 20, 50];
            this.elements.amountGrid.innerHTML = amounts.map(amount => `
                <div class="amount-option" data-amount="${amount}">
                    <div class="amount-value">$${amount}</div>
                </div>
            `).join('');
        }
        
        // 初始化代币选项
        if (this.elements.tokenGrid) {
            const tokens = this.config.APP_CONFIG?.payment?.supportedTokens || ['USDT', 'USDC', 'BUSD'];
            this.elements.tokenGrid.innerHTML = tokens.map(symbol => {
                const tokenConfig = this.config.TOKENS?.[symbol];
                return `
                    <div class="token-option" data-token="${symbol}">
                        <img src="${tokenConfig?.icon || './images/token-placeholder.png'}" 
                             alt="${symbol}" class="token-icon" onerror="this.style.display='none'">
                        <div class="token-info">
                            <div class="token-symbol">${symbol}</div>
                            <div class="token-name">${tokenConfig?.name || symbol}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
    
    /**
     * 选择金额
     * @param {HTMLElement} element - 金额选项元素
     */
    selectAmount(element) {
        // 清除其他选择
        document.querySelectorAll('.amount-option').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 选中当前选项
        element.classList.add('selected');
        
        // 清除自定义金额
        if (this.elements.customAmount) {
            this.elements.customAmount.value = '';
        }
        
        // 更新支付数据
        this.paymentData = {
            ...this.paymentData,
            amount: parseFloat(element.dataset.amount)
        };
        
        this.updatePaymentSummary();
        
        console.log(`💰 选择金额: $${this.paymentData.amount}`);
    }
    
    /**
     * 选择代币
     * @param {HTMLElement} element - 代币选项元素
     */
    selectToken(element) {
        // 清除其他选择
        document.querySelectorAll('.token-option').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 选中当前选项
        element.classList.add('selected');
        
        // 更新支付数据
        this.paymentData = {
            ...this.paymentData,
            token: element.dataset.token
        };
        
        this.updatePaymentSummary();
        
        console.log(`🪙 选择代币: ${this.paymentData.token}`);
    }
    
    /**
     * 处理自定义金额输入
     * @param {string} value - 输入值
     */
    handleCustomAmount(value) {
        if (value && !isNaN(value) && parseFloat(value) > 0) {
            // 清除金额选择
            document.querySelectorAll('.amount-option').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 更新支付数据
            this.paymentData = {
                ...this.paymentData,
                amount: parseFloat(value)
            };
            
            this.updatePaymentSummary();
            
            console.log(`💰 自定义金额: $${this.paymentData.amount}`);
        }
    }
    
    /**
     * 更新支付摘要
     */
    updatePaymentSummary() {
        if (!this.paymentData?.amount || !this.paymentData?.token) {
            if (this.elements.paymentSummary) {
                this.elements.paymentSummary.classList.add('hidden');
            }
            return;
        }
        
        // 更新摘要信息
        if (this.elements.summaryAmount) {
            this.elements.summaryAmount.textContent = `$${this.paymentData.amount}`;
        }
        
        if (this.elements.summaryToken) {
            this.elements.summaryToken.textContent = this.paymentData.token;
        }
        
        if (this.elements.summaryReceiver) {
            const receiverAddress = this.config.APP_CONFIG?.payment?.receiverAddress;
            this.elements.summaryReceiver.textContent = this.formatAddress(receiverAddress);
        }
        
        // 显示摘要
        if (this.elements.paymentSummary) {
            this.elements.paymentSummary.classList.remove('hidden');
        }
    }
    
    /**
     * 生成支付二维码
     */
    async generatePaymentQR() {
        try {
            if (!this.paymentData?.amount || !this.paymentData?.token) {
                throw new Error('Please select amount and token');
            }
            
            if (!this.blockchainConnector?.currentAccount) {
                throw new Error('Please connect your wallet first');
            }
            
            this.showLoading('Generating payment...');
            
            // 创建支付
            const payment = this.paymentHandler.createPayment({
                amount: this.paymentData.amount,
                token: this.paymentData.token,
                userAddress: this.blockchainConnector.currentAccount
            });
            
            this.paymentData.paymentId = payment.paymentId;
            
            // 显示二维码页面
            await this.displayQRCode(payment.paymentId);
            
            // 开始监听
            await this.startPaymentMonitoring(payment.paymentId);
            
            // 导航到二维码页面
            this.showStep('qrcode');
            
            console.log(`📱 生成支付二维码: ${payment.paymentId}`);
            
        } catch (error) {
            console.error('生成支付二维码失败:', error);
            this.showError('Failed to generate payment: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * 显示二维码
     * @param {string} paymentId - 支付ID
     */
    async displayQRCode(paymentId) {
        try {
            // 生成二维码
            const qrData = await this.paymentHandler.generateQRCode(
                paymentId,
                this.elements.qrCodeCanvas
            );
            
            // 更新二维码信息
            if (this.elements.qrAmount) {
                this.elements.qrAmount.textContent = qrData.displayInfo.amount;
            }
            
            if (this.elements.qrToken) {
                this.elements.qrToken.textContent = qrData.displayInfo.token;
            }
            
            if (this.elements.qrAddress) {
                this.elements.qrAddress.textContent = qrData.displayInfo.address;
            }
            
            // 显示二维码容器
            if (this.elements.qrContainer) {
                this.elements.qrContainer.classList.remove('hidden');
            }
            
            console.log('📱 二维码显示成功');
            
        } catch (error) {
            console.error('显示二维码失败:', error);
            throw error;
        }
    }
    
    /**
     * 开始支付监听
     * @param {string} paymentId - 支付ID
     */
    async startPaymentMonitoring(paymentId) {
        try {
            await this.blockchainMonitor.startMonitoring(paymentId);
            
            // 更新状态显示
            this.updatePaymentStatus('monitoring', 'Waiting for payment...');
            
            console.log(`🔍 开始监听支付: ${paymentId}`);
            
        } catch (error) {
            console.error('开始支付监听失败:', error);
            this.showError('Failed to start payment monitoring: ' + error.message);
        }
    }
    
    /**
     * 检查支付状态
     */
    async checkPaymentStatus() {
        if (!this.paymentData?.paymentId) {
            this.showError('No active payment to check');
            return;
        }
        
        try {
            this.showLoading('Checking payment status...');
            
            // 手动检查一次
            await this.blockchainMonitor.checkPaymentTransaction(this.paymentData.paymentId);
            
            // 获取最新支付信息
            const payment = this.paymentHandler.getPaymentInfo(this.paymentData.paymentId);
            
            if (payment) {
                this.updatePaymentStatusFromPayment(payment);
            }
            
            console.log(`🔍 检查支付状态: ${this.paymentData.paymentId}`);
            
        } catch (error) {
            console.error('检查支付状态失败:', error);
            this.showError('Failed to check payment status: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * 更新支付状态显示
     * @param {string} status - 状态
     * @param {string} message - 消息
     */
    updatePaymentStatus(status, message) {
        if (!this.elements.paymentStatus) return;
        
        // 更新状态样式
        this.elements.paymentStatus.className = `status-indicator status-${status}`;
        
        // 更新状态消息
        const statusMessages = {
            'pending': '⏳ Payment created, waiting...',
            'monitoring': '👀 Monitoring blockchain...',
            'confirmed': '✅ Payment confirmed!',
            'completed': '🎉 Payment completed!',
            'expired': '⏰ Payment expired',
            'failed': '❌ Payment failed'
        };
        
        const displayMessage = message || statusMessages[status] || `Status: ${status}`;
        
        // 添加加载动画
        if (status === 'monitoring') {
            this.elements.paymentStatus.innerHTML = `
                <span class="loading"></span>
                <span>${displayMessage}</span>
            `;
        } else {
            this.elements.paymentStatus.textContent = displayMessage;
        }
        
        this.elements.paymentStatus.classList.remove('hidden');
    }
    
    /**
     * 根据支付信息更新状态
     * @param {Object} payment - 支付信息
     */
    updatePaymentStatusFromPayment(payment) {
        this.updatePaymentStatus(payment.status);
        
        // 如果支付完成，准备跳转
        if (payment.status === 'completed') {
            setTimeout(() => {
                this.showSuccessPage(payment);
            }, 2000);
        }
    }
    
    /**
     * 显示成功页面
     * @param {Object} payment - 支付信息
     */
    showSuccessPage(payment) {
        this.currentStep = 'success';
        
        // 更新成功页面信息
        if (this.elements.paymentResult) {
            this.elements.paymentResult.innerHTML = `
                <div class="payment-success">
                    <h3>🎉 Payment Successful!</h3>
                    <div class="payment-details">
                        <p><strong>Amount:</strong> $${payment.amount}</p>
                        <p><strong>Token:</strong> ${payment.tokenSymbol}</p>
                        <p><strong>Transaction:</strong> ${this.formatAddress(payment.txHash)}</p>
                        <p><strong>Time:</strong> ${payment.completedAt?.toLocaleString()}</p>
                    </div>
                </div>
            `;
        }
        
        // 设置查看交易按钮
        if (this.elements.viewTransaction && payment.txHash) {
            this.elements.viewTransaction.onclick = () => {
                this.viewTransactionOnExplorer(payment.txHash);
            };
        }
        
        // 显示成功页面
        this.showStep('success');
        
        // 显示成功消息
        this.showSuccess('Payment completed successfully!');
        
        console.log(`🎉 显示成功页面: ${payment.paymentId}`);
    }
    
    /**
     * 在区块链浏览器中查看交易
     * @param {string} txHash - 交易哈希
     */
    viewTransactionOnExplorer(txHash) {
        if (!txHash && this.paymentData) {
            const payment = this.paymentHandler.getPaymentInfo(this.paymentData.paymentId);
            txHash = payment?.txHash;
        }
        
        if (!txHash) {
            this.showError('No transaction hash available');
            return;
        }
        
        // 获取当前网络的浏览器URL
        const network = this.config.APP_CONFIG?.currentNetwork || 'mainnet';
        const networkConfig = this.config.NETWORK_CONFIG?.[network];
        const explorerUrl = networkConfig?.blockExplorerUrls?.[0] || 'https://bscscan.com';
        
        const txUrl = `${explorerUrl}/tx/${txHash}`;
        window.open(txUrl, '_blank');
        
        console.log(`🔗 查看交易: ${txUrl}`);
    }
    
    /**
     * 连接钱包
     */
    async connectWallet() {
        try {
            this.showLoading('Connecting wallet...');
            
            const result = await this.blockchainConnector.connectWallet();
            
            if (result.success) {
                this.showSuccess('Wallet connected successfully!');
                this.updateConnectionStatus();
            }
            
        } catch (error) {
            console.error('连接钱包失败:', error);
            this.showError('Failed to connect wallet: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * 更新连接状态
     */
    updateConnectionStatus() {
        const status = this.blockchainConnector?.getConnectionStatus();
        
        if (status?.isConnected && status.account) {
            // 已连接状态
            if (this.elements.walletAddress) {
                this.elements.walletAddress.textContent = this.formatAddress(status.account);
            }
            
            if (this.elements.networkName) {
                const networkConfig = Object.values(this.config.NETWORK_CONFIG || {})
                    .find(config => config.chainId === status.network);
                this.elements.networkName.textContent = networkConfig?.chainName || `Network ${status.network}`;
            }
            
            if (this.elements.walletStatus) {
                this.elements.walletStatus.classList.remove('hidden');
            }
            
            if (this.elements.connectWallet) {
                this.elements.connectWallet.style.display = 'none';
            }
            
        } else {
            // 未连接状态
            if (this.elements.walletStatus) {
                this.elements.walletStatus.classList.add('hidden');
            }
            
            if (this.elements.connectWallet) {
                this.elements.connectWallet.style.display = 'inline-block';
            }
        }
    }
    
    /**
     * 显示步骤
     * @param {string} step - 步骤名称
     */
    showStep(step) {
        // 隐藏所有页面
        document.querySelectorAll('[id^="page-"]').forEach(page => {
            page.classList.add('hidden');
        });
        
        // 显示目标页面
        const targetPage = document.getElementById(`page-${step}`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }
        
        this.currentStep = step;
        
        // 更新路由
        if (this.router) {
            this.router.navigateTo(`/${step}`);
        }
    }
    
    /**
     * 显示加载状态
     * @param {string} message - 加载消息
     */
    showLoading(message = 'Loading...') {
        this.isProcessing = true;
        
        // 可以在这里添加全局加载指示器
        console.log(`⏳ ${message}`);
    }
    
    /**
     * 隐藏加载状态
     */
    hideLoading() {
        this.isProcessing = false;
        
        // 隐藏全局加载指示器
        console.log('✅ Loading complete');
    }
    
    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     */
    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.classList.remove('hidden');
            
            // 自动隐藏成功消息
            if (this.elements.successMessage) {
                this.elements.successMessage.classList.add('hidden');
            }
            
            // 5秒后自动隐藏
            setTimeout(() => {
                this.hideError();
            }, 5000);
        }
        
        console.error(`❌ ${message}`);
    }
    
    /**
     * 隐藏错误消息
     */
    hideError() {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.classList.add('hidden');
        }
    }
    
    /**
     * 显示成功消息
     * @param {string} message - 成功消息
     */
    showSuccess(message) {
        if (this.elements.successMessage) {
            this.elements.successMessage.textContent = message;
            this.elements.successMessage.classList.remove('hidden');
            
            // 自动隐藏错误消息
            if (this.elements.errorMessage) {
                this.elements.errorMessage.classList.add('hidden');
            }
            
            // 3秒后自动隐藏
            setTimeout(() => {
                this.hideSuccess();
            }, 3000);
        }
        
        console.log(`✅ ${message}`);
    }
    
    /**
     * 隐藏成功消息
     */
    hideSuccess() {
        if (this.elements.successMessage) {
            this.elements.successMessage.classList.add('hidden');
        }
    }
    
    /**
     * 格式化地址显示
     * @param {string} address - 地址
     * @returns {string} 格式化后的地址
     */
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    
    /**
     * 重置支付流程
     */
    resetPaymentFlow() {
        this.paymentData = null;
        this.currentStep = 'home';
        
        // 清除表单选择
        document.querySelectorAll('.amount-option, .token-option').forEach(el => {
            el.classList.remove('selected');
        });
        
        if (this.elements.customAmount) {
            this.elements.customAmount.value = '';
        }
        
        // 隐藏摘要
        if (this.elements.paymentSummary) {
            this.elements.paymentSummary.classList.add('hidden');
        }
        
        // 隐藏二维码
        if (this.elements.qrContainer) {
            this.elements.qrContainer.classList.add('hidden');
        }
        
        // 隐藏状态消息
        this.hideError();
        this.hideSuccess();
        
        console.log('🔄 重置支付流程');
    }
    
    // 事件处理方法
    
    /**
     * 处理连接状态变化
     * @param {Object} detail - 事件详情
     */
    handleConnectionChanged(detail) {
        console.log('🔗 连接状态变化:', detail.isConnected);
        this.updateConnectionStatus();
    }
    
    /**
     * 处理账户变化
     * @param {Object} detail - 事件详情
     */
    handleAccountChanged(detail) {
        console.log('👤 账户变化:', detail.account);
        this.updateConnectionStatus();
        
        // 如果在支付流程中，可能需要重置
        if (this.currentStep !== 'home' && !detail.account) {
            this.showError('Wallet disconnected. Please reconnect to continue.');
            this.resetPaymentFlow();
            this.showStep('home');
        }
    }
    
    /**
     * 处理网络变化
     * @param {Object} detail - 事件详情
     */
    handleNetworkChanged(detail) {
        console.log('🌐 网络变化:', detail.chainId, '支持:', detail.isSupported);
        this.updateConnectionStatus();
        
        if (!detail.isSupported) {
            this.showError('Unsupported network. Please switch to BNB Smart Chain.');
        }
    }
    
    /**
     * 处理支付状态变化
     * @param {Object} detail - 事件详情
     */
    handlePaymentStatusChanged(detail) {
        const { paymentId, status, payment } = detail;
        
        // 只处理当前支付的状态变化
        if (this.paymentData?.paymentId === paymentId) {
            console.log(`💳 支付状态变化: ${paymentId} -> ${status}`);
            this.updatePaymentStatusFromPayment(payment);
        }
    }
    
    /**
     * 处理监听开始
     * @param {Object} detail - 事件详情
     */
    handleMonitoringStarted(detail) {
        const { paymentId } = detail;
        
        if (this.paymentData?.paymentId === paymentId) {
            console.log(`🔍 开始监听: ${paymentId}`);
            this.updatePaymentStatus('monitoring', 'Monitoring blockchain for payment...');
        }
    }
    
    /**
     * 处理支付找到
     * @param {Object} detail - 事件详情
     */
    handlePaymentFound(detail) {
        const { paymentId, transaction } = detail;
        
        if (this.paymentData?.paymentId === paymentId) {
            console.log(`✅ 找到支付: ${paymentId}`);
            this.updatePaymentStatus('confirmed', 'Payment found! Waiting for confirmations...');
            this.showSuccess('Payment detected on blockchain!');
        }
    }
    
    /**
     * 处理支付完成
     * @param {Object} detail - 事件详情
     */
    handlePaymentCompleted(detail) {
        const { paymentId, transaction } = detail;
        
        if (this.paymentData?.paymentId === paymentId) {
            console.log(`🎉 支付完成: ${paymentId}`);
            
            // 获取完整支付信息
            const payment = this.paymentHandler.getPaymentInfo(paymentId);
            if (payment) {
                this.showSuccessPage(payment);
            }
        }
    }
    
    /**
     * 处理支付过期
     * @param {Object} detail - 事件详情
     */
    handlePaymentExpired(detail) {
        const { paymentId } = detail;
        
        if (this.paymentData?.paymentId === paymentId) {
            console.log(`⏰ 支付过期: ${paymentId}`);
            this.updatePaymentStatus('expired', 'Payment expired. Please try again.');
            this.showError('Payment expired. Please create a new payment.');
        }
    }
    
    /**
     * 处理支付错误
     * @param {Object} detail - 事件详情
     */
    handlePaymentError(detail) {
        const { paymentId, error } = detail;
        
        if (this.paymentData?.paymentId === paymentId) {
            console.log(`❌ 支付错误: ${paymentId} - ${error.message}`);
            this.updatePaymentStatus('failed', 'Payment monitoring failed.');
            this.showError('Payment monitoring failed: ' + error.message);
        }
    }
}

// 创建全局实例
window.PaymentUI = new PaymentUI();

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentUI;
}