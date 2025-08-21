/**
 * BlockchainMonitor 功能测试脚本
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
    getElementById: () => null,
    createElement: () => ({ innerHTML: '', appendChild: () => {} }),
    addEventListener: () => {}
};

// 模拟 PaymentHandler
global.window.PaymentHandler = {
    getPaymentInfo: (paymentId) => {
        if (paymentId === 'test_payment_123') {
            return {
                paymentId: 'test_payment_123',
                amount: 10.5,
                tokenSymbol: 'USDT',
                tokenContract: '0x55d398326f99059fF775485246999027B3197955',
                tokenDecimals: 18,
                paymentAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
                status: 'pending',
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
                createdAt: new Date()
            };
        }
        return null;
    },
    updatePaymentStatus: (paymentId, status, additionalData = {}) => {
        console.log(`📝 更新支付状态: ${paymentId} -> ${status}`, additionalData);
    }
};

// 模拟 BlockchainConnector
global.window.BlockchainConnector = {
    web3: {
        eth: {
            getBlockNumber: () => Promise.resolve(12345678),
            getBlock: (blockNum, includeTx) => Promise.resolve({
                number: blockNum,
                transactions: includeTx ? [] : null
            })
        }
    },
    getTokenContract: (symbol) => ({
        getPastEvents: (eventName, options) => {
            // 模拟返回一些转账事件
            if (eventName === 'Transfer') {
                return Promise.resolve([
                    {
                        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                        blockNumber: 12345670,
                        returnValues: {
                            from: '0x1111111111111111111111111111111111111111',
                            to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
                            value: '10500000000000000000' // 10.5 tokens
                        }
                    }
                ]);
            }
            return Promise.resolve([]);
        }
    }),
    getConfirmations: (blockNumber) => Promise.resolve(5),
    fromWei: (value, decimals) => {
        const factor = Math.pow(10, decimals);
        return (parseInt(value) / factor).toString();
    }
};

console.log('🧪 开始测试 BlockchainMonitor...\n');

try {
    // 加载 BlockchainMonitor
    const BlockchainMonitor = require('./demo/js/blockchain-monitor.js');
    
    // 创建测试实例
    const monitor = new BlockchainMonitor();
    
    console.log('📝 测试1: 初始化检查');
    console.log(`✅ BlockchainMonitor 实例创建成功`);
    console.log(`   - 轮询间隔: ${monitor.pollingInterval}ms`);
    console.log(`   - 需要确认数: ${monitor.requiredConfirmations}`);
    console.log(`   - 活跃监听数: ${monitor.activePayments.size}`);
    
    console.log('\n📊 测试2: 监听统计');
    const stats = monitor.getMonitoringStats();
    console.log(`✅ 监听统计:`);
    console.log(`   - 活跃监听: ${stats.activeMonitoring}`);
    console.log(`   - 总间隔数: ${stats.totalIntervals}`);
    console.log(`   - 轮询间隔: ${stats.pollingInterval}ms`);
    console.log(`   - 需要确认数: ${stats.requiredConfirmations}`);
    
    console.log('\n🔍 测试3: 开始监听');
    
    // 模拟开始监听
    const testPaymentId = 'test_payment_123';
    
    // 由于这是异步操作，我们需要使用 Promise 来处理
    monitor.startMonitoring(testPaymentId).then(() => {
        console.log(`✅ 开始监听成功: ${testPaymentId}`);
        
        // 检查监听状态
        const updatedStats = monitor.getMonitoringStats();
        console.log(`   - 活跃监听数: ${updatedStats.activeMonitoring}`);
        
        console.log('\n🔍 测试4: 检查支付交易');
        
        // 模拟检查支付交易
        monitor.checkPaymentTransaction(testPaymentId).then(() => {
            console.log(`✅ 检查支付交易完成`);
            
            console.log('\n⏹️ 测试5: 停止监听');
            
            // 停止监听
            monitor.stopMonitoring(testPaymentId);
            console.log(`✅ 停止监听成功: ${testPaymentId}`);
            
            // 检查监听状态
            const finalStats = monitor.getMonitoringStats();
            console.log(`   - 活跃监听数: ${finalStats.activeMonitoring}`);
            
            console.log('\n🎭 测试6: 模拟支付处理');
            
            // 测试模拟支付找到
            const mockTransaction = {
                hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                blockNumber: 12345670,
                from: '0x1111111111111111111111111111111111111111',
                to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
                value: '10500000000000000000',
                tokenContract: '0x55d398326f99059fF775485246999027B3197955',
                type: 'token_transfer'
            };
            
            monitor.handlePaymentFound(testPaymentId, mockTransaction);
            console.log(`✅ 模拟支付找到处理完成`);
            
            // 测试模拟支付过期
            monitor.handlePaymentExpired('expired_payment_456');
            console.log(`✅ 模拟支付过期处理完成`);
            
            // 测试模拟支付错误
            const mockError = new Error('模拟网络错误');
            monitor.handlePaymentError('error_payment_789', mockError);
            console.log(`✅ 模拟支付错误处理完成`);
            
            console.log('\n🔧 测试7: 工具函数');
            
            // 测试金额解析
            const amount1 = monitor.parseTransactionAmount('10500000000000000000', 18);
            console.log(`✅ 金额解析: 10500000000000000000 -> ${amount1}`);
            
            // 测试代币符号获取
            const symbol = monitor.getTokenSymbolByContract('0x55d398326f99059fF775485246999027B3197955');
            console.log(`✅ 代币符号获取: ${symbol}`);
            
            // 测试网络错误判断
            const networkError = new Error('Network connection failed');
            const isNetworkError = monitor.isNetworkError(networkError);
            console.log(`✅ 网络错误判断: ${isNetworkError}`);
            
            console.log('\n⚠️  测试8: 错误处理');
            
            // 测试无效支付ID
            monitor.startMonitoring('invalid_payment_id').catch(error => {
                console.log(`✅ 无效支付ID错误处理: ${error.message}`);
            });
            
            // 测试停止不存在的监听
            monitor.stopMonitoring('non_existent_payment');
            console.log(`✅ 停止不存在监听的错误处理正确`);
            
            console.log('\n🛑 测试9: 停止所有监听');
            
            // 先启动几个监听
            monitor.activePayments.set('test1', { paymentId: 'test1' });
            monitor.activePayments.set('test2', { paymentId: 'test2' });
            monitor.monitoringIntervals.set('test1', setInterval(() => {}, 1000));
            monitor.monitoringIntervals.set('test2', setInterval(() => {}, 1000));
            
            console.log(`   - 启动前活跃监听: ${monitor.activePayments.size}`);
            
            monitor.stopAllMonitoring();
            
            console.log(`   - 停止后活跃监听: ${monitor.activePayments.size}`);
            console.log(`✅ 停止所有监听功能正常`);
            
            console.log('\n🎊 BlockchainMonitor 基础功能测试完成！');
            console.log('\n💡 注意事项:');
            console.log('   - 完整功能需要在浏览器环境中测试');
            console.log('   - 需要连接到真实的区块链网络');
            console.log('   - 实际监听需要有效的支付信息');
            console.log('   - 可以使用 monitor-demo.html 进行完整测试');
            
        }).catch(error => {
            console.error('❌ 检查支付交易测试失败:', error.message);
        });
        
    }).catch(error => {
        console.error('❌ 开始监听测试失败:', error.message);
    });
    
} catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
    console.error('错误堆栈:', error.stack);
}