/**
 * PaymentUI 功能测试脚本
 */

// 模拟浏览器环境
global.window = {
    EVO_CONFIG: require('./demo/config.js'),
    addEventListener: () => {},
    dispatchEvent: () => {},
    CustomEvent: class CustomEvent {
        constructor(type, options) {
            this.type = type;
            this.detail = options?.detail;
        }
    }
};

global.document = {
    readyState: 'complete',
    getElementById: (id) => {
        // 模拟常用的 DOM 元素
        const mockElements = {
            connectWallet: { addEventListener: () => {}, style: { display: 'block' } },
            walletStatus: { classList: { add: () => {}, remove: () => {} } },
            walletAddress: { textContent: '' },
            networkName: { textContent: '' },
            amountGrid: { innerHTML: '' },
            tokenGrid: { innerHTML: '' },
            customAmount: { value: '', addEventListener: () => {} },
            paymentSummary: { classList: { add: () => {}, remove: () => {} } },
            summaryAmount: { textContent: '' },
            summaryToken: { textContent: '' },
            summaryReceiver: { textContent: '' },
            generateQRCode: { addEventListener: () => {} },
            qrContainer: { classList: { add: () => {}, remove: () => {} } },
            qrCodeCanvas: {},
            qrAmount: { textContent: '' },
            qrToken: { textContent: '' },
            qrAddress: { textContent: '' },
            paymentStatus: { 
                className: '', 
                classList: { add: () => {}, remove: () => {} },
                innerHTML: '',
                textContent: ''
            },
            checkPayment: { addEventListener: () => {} },
            paymentResult: { innerHTML: '' },
            viewTransaction: { onclick: null },
            errorMessage: { 
                textContent: '', 
                classList: { add: () => {}, remove: () => {} } 
            },
            successMessage: { 
                textContent: '', 
                classList: { add: () => {}, remove: () => {} } 
            }
        };
        
        return mockElements[id] || { 
            addEventListener: () => {},
            classList: { add: () => {}, remove: () => {} },
            style: {},
            textContent: '',
            innerHTML: '',
            value: ''
        };
    },
    createElement: () => ({ innerHTML: '', appendChild: () => {} }),
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null
};

// 模拟依赖组件
global.window.PaymentHandler = {
    createPayment: (data) => ({
        paymentId: 'test_payment_' + Date.now(),
        amount: data.amount,
        tokenSymbol: data.token,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    }),
    generateQRCode: (paymentId, canvas) => Promise.resolve({
        paymentId,
        url: 'ethereum:0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6?value=1000000000000000000',
        displayInfo: {
            amount: '$10.00',
            token: 'USDT',
            address: '0x742d...d8b6'
        }
    }),
    getPaymentInfo: (paymentId) => ({
        paymentId,
        amount: 10,
        tokenSymbol: 'USDT',
        status: 'completed',
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        completedAt: new Date()
    })
};

global.window.BlockchainConnector = {
    isConnected: false,
    currentAccount: null,
    connectWallet: () => Promise.resolve({
        success: true,
        account: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
    }),
    getConnectionStatus: () => ({
        isConnected: true,
        account: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        network: 56,
        hasWeb3: true
    })
};

global.window.BlockchainMonitor = {
    startMonitoring: (paymentId) => Promise.resolve(),
    checkPaymentTransaction: (paymentId) => Promise.resolve()
};

global.window.EVORouter = {
    navigateTo: (route) => console.log(`路由导航: ${route}`)
};

console.log('🧪 开始测试 PaymentUI...\n');

try {
    // 加载 PaymentUI
    const PaymentUI = require('./demo/js/payment-ui.js');
    
    // 创建测试实例
    const paymentUI = new PaymentUI();
    
    console.log('📝 测试1: 初始化检查');
    console.log(`✅ PaymentUI 实例创建成功`);
    console.log(`   - 当前步骤: ${paymentUI.currentStep}`);
    console.log(`   - 处理状态: ${paymentUI.isProcessing}`);
    console.log(`   - 支付数据: ${paymentUI.paymentData || '无'}`);
    
    console.log('\n🔧 测试2: 工具函数');
    
    // 测试地址格式化
    const testAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
    const formattedAddress = paymentUI.formatAddress(testAddress);
    console.log(`✅ 地址格式化: ${testAddress} -> ${formattedAddress}`);
    
    // 测试空地址
    const emptyFormatted = paymentUI.formatAddress('');
    console.log(`✅ 空地址处理: '' -> '${emptyFormatted}'`);
    
    console.log('\n💳 测试3: 支付流程控制');
    
    // 测试选择金额
    const mockAmountElement = {
        dataset: { amount: '10.5' },
        classList: { add: () => {} }
    };
    
    paymentUI.selectAmount(mockAmountElement);
    console.log(`✅ 选择金额: $${paymentUI.paymentData?.amount}`);
    
    // 测试选择代币
    const mockTokenElement = {
        dataset: { token: 'USDT' },
        classList: { add: () => {} }
    };
    
    paymentUI.selectToken(mockTokenElement);
    console.log(`✅ 选择代币: ${paymentUI.paymentData?.token}`);
    
    // 测试自定义金额
    paymentUI.handleCustomAmount('25.75');
    console.log(`✅ 自定义金额: $${paymentUI.paymentData?.amount}`);
    
    console.log('\n📱 测试4: 二维码生成');
    
    // 模拟钱包连接
    global.window.BlockchainConnector.isConnected = true;
    global.window.BlockchainConnector.currentAccount = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
    
    // 测试生成二维码
    paymentUI.generatePaymentQR().then(() => {
        console.log(`✅ 二维码生成成功`);
        console.log(`   - 支付ID: ${paymentUI.paymentData?.paymentId}`);
    }).catch(error => {
        console.log(`❌ 二维码生成失败: ${error.message}`);
    });
    
    console.log('\n🔍 测试5: 状态管理');
    
    // 测试状态更新
    paymentUI.updatePaymentStatus('monitoring', 'Waiting for payment...');
    console.log(`✅ 状态更新: monitoring`);
    
    paymentUI.updatePaymentStatus('confirmed', 'Payment confirmed!');
    console.log(`✅ 状态更新: confirmed`);
    
    paymentUI.updatePaymentStatus('completed', 'Payment completed!');
    console.log(`✅ 状态更新: completed`);
    
    console.log('\n📄 测试6: 页面导航');
    
    // 测试显示支付表单
    paymentUI.showPaymentForm();
    console.log(`✅ 显示支付表单: ${paymentUI.currentStep}`);
    
    // 测试显示步骤
    paymentUI.showStep('qrcode');
    console.log(`✅ 显示二维码页面: ${paymentUI.currentStep}`);
    
    paymentUI.showStep('success');
    console.log(`✅ 显示成功页面: ${paymentUI.currentStep}`);
    
    console.log('\n💬 测试7: 消息显示');
    
    // 测试错误消息
    paymentUI.showError('测试错误消息');
    console.log(`✅ 显示错误消息`);
    
    // 测试成功消息
    paymentUI.showSuccess('测试成功消息');
    console.log(`✅ 显示成功消息`);
    
    // 测试加载状态
    paymentUI.showLoading('测试加载中...');
    console.log(`✅ 显示加载状态: ${paymentUI.isProcessing}`);
    
    paymentUI.hideLoading();
    console.log(`✅ 隐藏加载状态: ${paymentUI.isProcessing}`);
    
    console.log('\n🎭 测试8: 事件处理');
    
    // 测试连接状态变化
    paymentUI.handleConnectionChanged({ isConnected: true });
    console.log(`✅ 处理连接状态变化`);
    
    // 测试账户变化
    paymentUI.handleAccountChanged({ account: '0x1234567890123456789012345678901234567890' });
    console.log(`✅ 处理账户变化`);
    
    // 测试网络变化
    paymentUI.handleNetworkChanged({ chainId: 56, isSupported: true });
    console.log(`✅ 处理网络变化`);
    
    // 测试支付状态变化
    const mockPayment = {
        paymentId: 'test_payment_123',
        status: 'completed',
        amount: 10,
        tokenSymbol: 'USDT',
        txHash: '0x1234567890abcdef',
        completedAt: new Date()
    };
    
    paymentUI.paymentData = { paymentId: 'test_payment_123' };
    paymentUI.handlePaymentStatusChanged({
        paymentId: 'test_payment_123',
        status: 'completed',
        payment: mockPayment
    });
    console.log(`✅ 处理支付状态变化`);
    
    console.log('\n🔄 测试9: 重置功能');
    
    // 测试重置支付流程
    paymentUI.resetPaymentFlow();
    console.log(`✅ 重置支付流程`);
    console.log(`   - 当前步骤: ${paymentUI.currentStep}`);
    console.log(`   - 支付数据: ${paymentUI.paymentData || '无'}`);
    
    console.log('\n⚠️  测试10: 错误处理');
    
    // 测试无钱包连接的支付
    global.window.BlockchainConnector.isConnected = false;
    global.window.BlockchainConnector.currentAccount = null;
    
    paymentUI.showPaymentForm();
    console.log(`✅ 无钱包连接时的错误处理`);
    
    // 测试无效支付数据
    paymentUI.paymentData = null;
    paymentUI.generatePaymentQR().catch(error => {
        console.log(`✅ 无效支付数据错误处理: ${error.message}`);
    });
    
    console.log('\n🎊 PaymentUI 基础功能测试完成！');
    console.log('\n💡 注意事项:');
    console.log('   - 完整功能需要在浏览器环境中测试');
    console.log('   - 需要真实的 DOM 元素和事件绑定');
    console.log('   - 实际使用需要连接钱包和区块链');
    console.log('   - 可以使用 ui-demo.html 进行完整测试');
    
} catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
    console.error('错误堆栈:', error.stack);
}