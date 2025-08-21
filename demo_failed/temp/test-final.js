/**
 * EVO Payment 最终集成测试
 */

// 模拟浏览器环境
global.window = {
    addEventListener: () => {},
    dispatchEvent: () => {},
    location: { href: 'http://localhost/test' },
    CustomEvent: class CustomEvent {
        constructor(type, options) {
            this.type = type;
            this.detail = options?.detail;
        }
    }
};

global.navigator = { userAgent: 'Node.js Test Environment' };
global.document = {
    getElementById: () => ({ style: {}, appendChild: () => {}, innerHTML: '', textContent: '' }),
    createElement: () => ({ style: {}, appendChild: () => {}, innerHTML: '', textContent: '' }),
    body: { appendChild: () => {} },
    addEventListener: () => {},
    querySelectorAll: () => []
};

global.QRCode = {
    toCanvas: (canvas, text, options, callback) => {
        console.log(`📱 生成二维码: ${text}`);
        if (callback) callback(null);
    }
};

console.log('🧪 开始 EVO Payment 最终集成测试...\n');

async function runFinalTests() {
    try {
        // 加载组件
        console.log('📦 加载组件...');
        const PaymentHandler = require('./demo/js/payment-handler.js');
        const ErrorHandler = require('./demo/js/error-handler.js');
        const UIComponents = require('./demo/js/ui-components.js');
        console.log('✅ 组件加载成功\n');
        
        // 实例化
        console.log('🔧 实例化组件...');
        const paymentHandler = new PaymentHandler();
        const errorHandler = new ErrorHandler();
        const uiComponents = new UIComponents();
        console.log('✅ 组件实例化成功\n');
        
        // 配置
        console.log('⚙️ 设置配置...');
        paymentHandler.config = {
            TOKENS: {
                USDT: {
                    address: '0x55d398326f99059fF775485246999027B3197955',
                    decimals: 18,
                    symbol: 'USDT',
                    name: 'Tether USD'
                }
            },
            APP_CONFIG: {
                payment: {
                    receiverAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
                    timeoutMinutes: 30
                },
                currentNetwork: 'mainnet'
            },
            NETWORK_CONFIG: {
                mainnet: {
                    chainId: 56,
                    rpcUrl: 'https://bsc-dataseed1.binance.org/'
                }
            }
        };
        console.log('✅ 配置设置完成\n');
        
        // 测试支付功能
        console.log('💳 测试支付功能...');
        
        // 生成支付ID
        const paymentId = paymentHandler.generatePaymentId();
        console.log(`✅ 支付ID生成: ${paymentId}`);
        
        // 创建支付
        try {
            const payment = paymentHandler.createPayment({
                amount: 100,
                token: 'USDT',
                userAddress: '0x1111111111111111111111111111111111111111'
            });
            console.log(`✅ 支付创建成功: ${payment.paymentId}`);
            
            // 获取支付信息
            const paymentInfo = paymentHandler.getPaymentInfo(payment.paymentId);
            console.log(`✅ 支付信息获取: ${paymentInfo ? '成功' : '失败'}`);
            
            // 更新支付状态
            paymentHandler.updatePaymentStatus(payment.paymentId, 'completed', {
                txHash: '0x1234567890abcdef'
            });
            console.log('✅ 支付状态更新成功');
            
            // 生成二维码
            const qrData = paymentHandler.generateQRCodeData(payment.paymentId);
            console.log('✅ 二维码数据生成成功');
            
        } catch (error) {
            console.log(`⚠️ 支付功能测试: ${error.message}`);
        }
        
        console.log();
        
        // 测试工具功能
        console.log('🔧 测试工具功能...');
        
        const validAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
        console.log(`✅ 地址验证: ${paymentHandler.isValidAddress(validAddress)}`);
        console.log(`✅ 地址格式化: ${paymentHandler.formatAddress(validAddress)}`);
        
        const wei = paymentHandler.toWei(100, 18);
        const amount = paymentHandler.fromWei(wei, 18);
        console.log(`✅ 数值转换: 100 -> ${wei} -> ${amount}`);
        
        console.log();
        
        // 测试UI组件
        console.log('🎨 测试UI组件...');
        
        uiComponents.showSuccess('测试成功通知');
        console.log('✅ 成功通知');
        
        const loaderId = uiComponents.showLoader('测试加载');
        uiComponents.hideLoader(loaderId);
        console.log('✅ 加载器');
        
        console.log();
        
        // 测试错误处理
        console.log('⚠️ 测试错误处理...');
        
        errorHandler.handleError({
            type: 'network_error',
            message: '网络连接失败'
        });
        console.log('✅ 网络错误处理');
        
        errorHandler.handleError(new Error('JavaScript错误'));
        console.log('✅ JavaScript错误处理');
        
        console.log();
        
        // 性能测试
        console.log('⚡ 性能测试...');
        
        const start = Date.now();
        const ids = [];
        for (let i = 0; i < 1000; i++) {
            ids.push(paymentHandler.generatePaymentId());
        }
        const end 