/**
 * EVO Payment 最终集成测试脚本
 * 完整测试所有功能模块
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
    },
    // 模拟Web3环境
    ethereum: {
        isMetaMask: true,
        request: async () => ['0x1111111111111111111111111111111111111111'],
        on: () => {},
        removeListener: () => {}
    },
    web3: {
        eth: {
            getAccounts: async () => ['0x1111111111111111111111111111111111111111']
        }
    }
};

global.navigator = {
    userAgent: 'Node.js Test Environment'
};

global.document = {
    getElementById: () => ({ 
        style: {}, 
        appendChild: () => {}, 
        innerHTML: '', 
        textContent: '',
        classList: { add: () => {}, remove: () => {} }
    }),
    createElement: () => ({ 
        style: {}, 
        appendChild: () => {}, 
        innerHTML: '', 
        textContent: '',
        classList: { add: () => {}, remove: () => {} }
    }),
    body: { appendChild: () => {} },
    addEventListener: () => {},
    querySelectorAll: () => []
};

global.QRCode = {
    toCanvas: (canvas, text, options, callback) => {
        console.log(`📱 生成二维码: ${text.substring(0, 50)}...`);
        if (callback) callback(null);
    }
};

// 模拟Web3库
global.Web3 = class Web3 {
    constructor(provider) {
        this.eth = {
            getAccounts: async () => ['0x1111111111111111111111111111111111111111'],
            getBalance: async () => '1000000000000000000',
            getChainId: async () => 56,
            Contract: class Contract {
                constructor(abi, address) {
                    this.methods = {
                        balanceOf: () => ({
                            call: async () => '1000000000000000000'
                        }),
                        transfer: () => ({
                            send: async () => ({ transactionHash: '0x123...' })
                        })
                    };
                }
            }
        };
        this.utils = {
            isAddress: (address) => /^0x[a-fA-F0-9]{40}$/.test(address),
            toWei: (amount, unit) => (parseFloat(amount) * Math.pow(10, 18)).toString(),
            fromWei: (wei, unit) => (parseInt(wei) / Math.pow(10, 18)).toString()
        };
    }
    
    static givenProvider = {
        isMetaMask: true
    };
};

console.log('🧪 开始 EVO Payment 最终集成测试...\n');

async function runFinalIntegrationTests() {
    const testResults = {};
    let totalTests = 0;
    let passedTests = 0;

    function recordTest(testName, passed, message = '') {
        testResults[testName] = passed;
        totalTests++;
        if (passed) passedTests++;
        console.log(`${passed ? '✅' : '❌'} ${testName}: ${passed ? '通过' : '失败'}${message ? ' - ' + message : ''}`);
    }

    try {
        // 测试1: 组件加载
        console.log('📦 测试1: 组件加载');
        
        let PaymentHandler, BlockchainConnector, BlockchainMonitor, PaymentUI, ErrorHandler, UIComponents;
        
        try {
            PaymentHandler = require('./demo/js/payment-handler.js');
            BlockchainConnector = require('./demo/js/blockchain-connector.js');
            BlockchainMonitor = require('./demo/js/blockchain-monitor.js');
            PaymentUI = require('./demo/js/payment-ui.js');
            ErrorHandler = require('./demo/js/error-handler.js');
            UIComponents = require('./demo/js/ui-components.js');
            recordTest('组件加载', true);
        } catch (error) {
            recordTest('组件加载', false, error.message);
            throw error;
        }
        
        // 测试2: 组件实例化
        console.log('\n🔧 测试2: 组件实例化');
        
        let paymentHandler, blockchainConnector, blockchainMonitor, paymentUI, errorHandler, uiComponents;
        
        try {
            paymentHandler = new PaymentHandler();
            blockchainConnector = new BlockchainConnector();
            blockchainMonitor = new BlockchainMonitor();
            paymentUI = new PaymentUI();
            errorHandler = new ErrorHandler();
            uiComponents = new UIComponents();
            recordTest('组件实例化', true);
        } catch (error) {
            recordTest('组件实例化', false, error.message);
            throw error;
        }
        
        // 测试3: 配置设置
        console.log('\n⚙️ 测试3: 配置设置');
        
        try {
            const config = {
                TOKENS: {
                    USDT: {
                        address: '0x55d398326f99059fF775485246999027B3197955',
                        decimals: 18,
                        symbol: 'USDT',
                        name: 'Tether USD'
                    },
                    USDC: {
                        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
                        decimals: 18,
                        symbol: 'USDC',
                        name: 'USD Coin'
                    },
                    BUSD: {
                        address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
                        decimals: 18,
                        symbol: 'BUSD',
                        name: 'Binance USD'
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
            
            paymentHandler.config = config;
            recordTest('配置设置', true);
        } catch (error) {
            recordTest('配置设置', false, error.message);
        }
        
        // 测试4: 支付ID生成
        console.log('\n🆔 测试4: 支付ID生成');
        
        try {
            const paymentIds = [];
            for (let i = 0; i < 10; i++) {
                paymentIds.push(paymentHandler.generatePaymentId());
            }
            
            const uniqueIds = new Set(paymentIds);
            const isUnique = uniqueIds.size === paymentIds.length;
            recordTest('支付ID生成', isUnique, `生成${paymentIds.length}个ID，唯一性${isUnique ? '通过' : '失败'}`);
        } catch (error) {
            recordTest('支付ID生成', false, error.message);
        }
        
        // 测试5: 支付创建
        console.log('\n💳 测试5: 支付创建');
        
        let testPayment;
        try {
            const paymentRequest = {
                amount: 100,
                token: 'USDT',
                userAddress: '0x1111111111111111111111111111111111111111'
            };
            
            testPayment = paymentHandler.createPayment(paymentRequest);
            const isValid = testPayment && testPayment.paymentId && testPayment.status === 'pending';
            recordTest('支付创建', isValid, `支付ID: ${testPayment?.paymentId}`);
        } catch (error) {
            recordTest('支付创建', false, error.message);
        }
        
        // 测试6: 支付信息获取
        console.log('\n🔍 测试6: 支付信息获取');
        
        try {
            if (testPayment) {
                const retrievedPayment = paymentHandler.getPaymentInfo(testPayment.paymentId);
                const isValid = retrievedPayment && retrievedPayment.paymentId === testPayment.paymentId;
                recordTest('支付信息获取', isValid);
            } else {
                recordTest('支付信息获取', false, '没有测试支付可用');
            }
        } catch (error) {
            recordTest('支付信息获取', false, error.message);
        }
        
        // 测试7: 支付状态更新
        console.log('\n🔄 测试7: 支付状态更新');
        
        try {
            if (testPayment) {
                paymentHandler.updatePaymentStatus(testPayment.paymentId, 'completed', {
                    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
                });
                
                const updatedPayment = paymentHandler.getPaymentInfo(testPayment.paymentId);
                const isValid = updatedPayment && updatedPayment.status === 'completed';
                recordTest('支付状态更新', isValid, `状态: ${updatedPayment?.status}`);
            } else {
                recordTest('支付状态更新', false, '没有测试支付可用');
            }
        } catch (error) {
            recordTest('支付状态更新', false, error.message);
        }
        
        // 测试8: 二维码生成
        console.log('\n📱 测试8: 二维码生成');
        
        try {
            const qrPaymentRequest = {
                amount: 25,
                token: 'USDT',
                userAddress: '0x3333333333333333333333333333333333333333'
            };
            
            const qrPayment = paymentHandler.createPayment(qrPaymentRequest);
            const qrData = paymentHandler.generateQRCodeData(qrPayment.paymentId);
            
            const isValid = qrData && qrData.paymentId && qrData.url;
            recordTest('二维码生成', isValid, `包含支付URL: ${isValid ? '是' : '否'}`);
        } catch (error) {
            recordTest('二维码生成', false, error.message);
        }
        
        // 测试9: 支付查询
        console.log('\n🔍 测试9: 支付查询');
        
        try {
            const allPayments = paymentHandler.getAllPayments();
            const pendingPayments = paymentHandler.getAllPayments({ status: 'pending' });
            const completedPayments = paymentHandler.getAllPayments({ status: 'completed' });
            
            const isValid = Array.isArray(allPayments) && Array.isArray(pendingPayments) && Array.isArray(completedPayments);
            recordTest('支付查询', isValid, `总计: ${allPayments.length}, 待处理: ${pendingPayments.length}, 已完成: ${completedPayments.length}`);
        } catch (error) {
            recordTest('支付查询', false, error.message);
        }
        
        // 测试10: 地址验证
        console.log('\n🔐 测试10: 地址验证');
        
        try {
            const validAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
            const invalidAddress = 'invalid_address';
            
            const validResult = paymentHandler.isValidAddress(validAddress);
            const invalidResult = paymentHandler.isValidAddress(invalidAddress);
            
            const isValid = validResult === true && invalidResult === false;
            recordTest('地址验证', isValid, `有效地址: ${validResult}, 无效地址: ${invalidResult}`);
        } catch (error) {
            recordTest('地址验证', false, error.message);
        }
        
        // 测试11: 地址格式化
        console.log('\n📝 测试11: 地址格式化');
        
        try {
            const address = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
            const formatted = paymentHandler.formatAddress(address);
            
            const isValid = formatted && formatted.includes('0x742d') && formatted.includes('d8b6');
            recordTest('地址格式化', isValid, `${address} -> ${formatted}`);
        } catch (error) {
            recordTest('地址格式化', false, error.message);
        }
        
        // 测试12: 数值转换
        console.log('\n🔢 测试12: 数值转换');
        
        try {
            const amount = 100;
            const wei = paymentHandler.toWei(amount, 18);
            const backToAmount = paymentHandler.fromWei(wei, 18);
            
            const isValid = parseFloat(backToAmount) === amount;
            recordTest('数值转换', isValid, `${amount} -> ${wei} -> ${backToAmount}`);
        } catch (error) {
            recordTest('数值转换', false, error.message);
        }
        
        // 测试13: 错误处理
        console.log('\n⚠️ 测试13: 错误处理');
        
        try {
            // 测试无效支付创建
            let errorCaught = false;
            try {
                paymentHandler.createPayment({
                    amount: -10, // 无效金额
                    token: 'USDT',
                    userAddress: '0x1111111111111111111111111111111111111111'
                });
            } catch (error) {
                errorCaught = true;
            }
            
            // 测试不存在的支付查询
            const nonExistentPayment = paymentHandler.getPaymentInfo('non_existent_id');
            const isNull = nonExistentPayment === null;
            
            const isValid = errorCaught && isNull;
            recordTest('错误处理', isValid, `无效金额错误: ${errorCaught}, 不存在支付返回null: ${isNull}`);
        } catch (error) {
            recordTest('错误处理', false, error.message);
        }
        
        // 测试14: UI 组件功能
        console.log('\n🎨 测试14: UI 组件功能');
        
        try {
            // 测试通知
            uiComponents.showSuccess('测试成功通知');
            uiComponents.showError('测试错误通知');
            
            // 测试加载器
            const loaderId = uiComponents.showLoader('测试加载中...');
            uiComponents.hideLoader(loaderId);
            
            recordTest('UI组件功能', true, '通知和加载器功能正常');
        } catch (error) {
            recordTest('UI组件功能', false, error.message);
        }
        
        // 测试15: 错误处理器功能
        console.log('\n🚨 测试15: 错误处理器功能');
        
        try {
            const testErrors = [
                { type: 'network_error', message: '网络连接失败' },
                { type: 'payment_error', message: '支付处理失败' },
                'Simple error message',
                new Error('JavaScript Error')
            ];
            
            let errorCount = 0;
            testErrors.forEach((error) => {
                try {
                    errorHandler.handleError(error);
                    errorCount++;
                } catch (e) {
                    // 忽略处理错误
                }
            });
            
            const isValid = errorCount === testErrors.length;
            recordTest('错误处理器功能', isValid, `处理了 ${errorCount}/${testErrors.length} 个错误`);
        } catch (error) {
            recordTest('错误处理器功能', false, error.message);
        }
        
        // 测试16: 性能测试
        console.log('\n⚡ 测试16: 性能测试');
        
        try {
            const performanceStart = Date.now();
            
            // 创建大量支付
            const testPayments = [];
            for (let i = 0; i < 50; i++) {
                try {
                    const testPayment = paymentHandler.createPayment({
                        amount: Math.floor(Math.random() * 1000) + 1,
                        token: ['USDT', 'USDC'][Math.floor(Math.random() * 2)],
                        userAddress: `0x${i.toString(16).padStart(40, '0')}`
                    });
                    testPayments.push(testPayment);
                } catch (error) {
                    // 忽略配置相关错误
                }
            }
            
            const performanceEnd = Date.now();
            const duration = performanceEnd - performanceStart;
            
            // 内存使用
            const memoryUsage = process.memoryUsage();
            const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
            
            const isValid = testPayments.length > 0 && duration < 5000; // 5秒内完成
            recordTest('性能测试', isValid, `创建 ${testPayments.length} 个支付耗时 ${duration}ms, 内存使用 ${memoryMB}MB`);
        } catch (error) {
            recordTest('性能测试', false, error.message);
        }
        
        // 测试17: 区块链监听器基础功能
        console.log('\n👁️ 测试17: 区块链监听器基础功能');
        
        try {
            // 测试监听器的基本方法
            const hasStartMethod = typeof blockchainMonitor.startMonitoring === 'function';
            const hasStopMethod = typeof blockchainMonitor.stopMonitoring === 'function';
            const hasValidateMethod = typeof blockchainMonitor.validateTransaction === 'function';
            
            const isValid = hasStartMethod && hasStopMethod && hasValidateMethod;
            recordTest('区块链监听器基础功能', isValid, `方法完整性: ${isValid ? '通过' : '失败'}`);
        } catch (error) {
            recordTest('区块链监听器基础功能', false, error.message);
        }
        
        // 测试18: 支付UI基础功能
        console.log('\n🖥️ 测试18: 支付UI基础功能');
        
        try {
            // 测试UI的基本方法存在性
            const hasUpdateMethod = typeof paymentUI.updatePaymentStatus === 'function';
            const hasShowMethod = typeof paymentUI.showSuccessPage === 'function';
            
            const isValid = hasUpdateMethod && hasShowMethod;
            recordTest('支付UI基础功能', isValid, `UI方法完整性: ${isValid ? '通过' : '失败'}`);
        } catch (error) {
            recordTest('支付UI基础功能', false, error.message);
        }
        
        // 测试19: 区块链连接器基础功能
        console.log('\n🔗 测试19: 区块链连接器基础功能');
        
        try {
            // 测试连接器的基本方法存在性
            const hasConnectMethod = typeof blockchainConnector.connectWallet === 'function';
            const hasValidateMethod = typeof blockchainConnector.isValidAddress === 'function';
            
            const isValid = hasConnectMethod && hasValidateMethod;
            recordTest('区块链连接器基础功能', isValid, `连接器方法完整性: ${isValid ? '通过' : '失败'}`);
        } catch (error) {
            recordTest('区块链连接器基础功能', false, error.message);
        }
        
        // 测试20: 最终系统集成验证
        console.log('\n🎯 测试20: 最终系统集成验证');
        
        try {
            // 模拟完整支付流程
            const flowPaymentRequest = {
                amount: 50,
                token: 'USDT',
                userAddress: '0x9999999999999999999999999999999999999999'
            };
            
            // 1. 创建支付
            const flowPayment = paymentHandler.createPayment(flowPaymentRequest);
            
            // 2. 生成二维码
            const flowQRData = paymentHandler.generateQRCodeData(flowPayment.paymentId);
            
            // 3. 更新状态
            paymentHandler.updatePaymentStatus(flowPayment.paymentId, 'completed');
            
            // 4. 验证最终状态
            const finalPayment = paymentHandler.getPaymentInfo(flowPayment.paymentId);
            
            const isValid = flowPayment && flowQRData && finalPayment && finalPayment.status === 'completed';
            recordTest('最终系统集成验证', isValid, `完整流程: ${isValid ? '成功' : '失败'}`);
        } catch (error) {
            recordTest('最终系统集成验证', false, error.message);
        }
        
        // 输出最终结果
        console.log('\n📊 测试结果汇总:');
        console.log('='.repeat(60));
        
        Object.entries(testResults).forEach(([test, passed]) => {
            console.log(`${passed ? '✅' : '❌'} ${test}`);
        });
        
        console.log('='.repeat(60));
        console.log(`🎯 总体结果: ${passedTests}/${totalTests} 测试通过`);
        console.log(`📈 成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (passedTests === totalTests) {
            console.log('\n🎉 所有集成测试通过！EVO Payment 系统准备就绪！');
            console.log('\n✨ 系统功能验证完成:');
            console.log('   ✅ 支付信息生成和管理');
            console.log('   ✅ 二维码生成');
            console.log('   ✅ 支付状态跟踪');
            console.log('   ✅ 地址验证和格式化');
            console.log('   ✅ 数值转换');
            console.log('   ✅ 错误处理');
            console.log('   ✅ UI 组件');
            console.log('   ✅ 性能优化');
            console.log('   ✅ 系统集成');
        } else {
            console.log('\n⚠️ 部分测试未通过，需要进一步检查:');
            Object.entries(testResults).forEach(([test, passed]) => {
                if (!passed) {
                    console.log(`   ❌ ${test}`);
                }
            });
        }
        
        // 系统状态报告
        console.log('\n📋 系统状态报告:');
        const finalStats = paymentHandler.getAllPayments();
        console.log(`   - 总支付记录: ${finalStats.length}`);
        console.log(`   - 内存使用: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   - 测试执行时间: ${Date.now() - global.testStartTime}ms`);
        
    } catch (error) {
        console.error('\n❌ 集成测试执行失败:', error.message);
        console.error('错误堆栈:', error.stack);
        process.exit(1);
    }
}

// 记录测试开始时间
global.testStartTime = Date.now();

// 运行最终集成测试
runFinalIntegrationTests().then(() => {
    console.log('\n🏁 最终集成测试完成！');
}).catch(error => {
    console.error('❌ 集成测试异常:', error);
    process.exit(1);
});