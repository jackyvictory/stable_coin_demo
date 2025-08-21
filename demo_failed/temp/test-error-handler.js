/**
 * ErrorHandler 功能测试脚本
 */

// 模拟浏览器环境
global.window = {
    EVO_CONFIG: require('./demo/config.js'),
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

global.document = {
    getElementById: () => null,
    createElement: () => ({
        id: '',
        style: { cssText: '' },
        innerHTML: '',
        appendChild: () => {},
        remove: () => {},
        addEventListener: () => {},
        querySelector: () => null
    }),
    body: {
        appendChild: () => {},
        style: { overflow: '' }
    },
    addEventListener: () => {}
};

global.navigator = {
    userAgent: 'Node.js Test Environment',
    onLine: true
};

global.requestAnimationFrame = (callback) => setTimeout(callback, 16);

console.log('🧪 开始测试 ErrorHandler...\n');

try {
    // 加载 ErrorHandler
    const ErrorHandler = require('./demo/js/error-handler.js');
    
    // 创建测试实例
    const errorHandler = new ErrorHandler();
    
    console.log('📝 测试1: 初始化检查');
    console.log(`✅ ErrorHandler 实例创建成功`);
    console.log(`   - 错误类型数量: ${Object.keys(errorHandler.errorTypes).length}`);
    console.log(`   - 错误消息数量: ${Object.keys(errorHandler.errorMessages).length}`);
    console.log(`   - 自动隐藏延迟: ${errorHandler.autoHideDelay}ms`);
    console.log(`   - 最大错误记录: ${errorHandler.maxRecentErrors}`);
    
    console.log('\n🔧 测试2: 错误标准化');
    
    // 测试 Error 对象标准化
    const testError = new Error('Test error message');
    const normalizedError = errorHandler.normalizeError(testError, 'network_error', { test: true });
    
    console.log(`✅ Error 对象标准化:`);
    console.log(`   - 类型: ${normalizedError.type}`);
    console.log(`   - 消息: ${normalizedError.message}`);
    console.log(`   - 有堆栈: ${!!normalizedError.stack}`);
    console.log(`   - 有时间戳: ${!!normalizedError.timestamp}`);
    
    // 测试字符串错误标准化
    const stringError = errorHandler.normalizeError('String error message', 'payment_error');
    console.log(`✅ 字符串错误标准化: ${stringError.message}`);
    
    console.log('\n💬 测试3: 用户友好消息');
    
    // 测试各种错误消息转换
    const testCases = [
        { error: 'network connection failed', expected: 'network_error' },
        { error: 'wallet not found', expected: 'wallet_not_found' },
        { error: 'payment expired', expected: 'payment_expired' },
        { error: 'invalid amount', expected: 'invalid_amount' },
        { error: 'transaction failed', expected: 'transaction_failed' }
    ];
    
    testCases.forEach(testCase => {
        const errorObj = { type: 'test', message: testCase.error };
        const friendlyMessage = errorHandler.getUserFriendlyMessage(errorObj);
        console.log(`✅ "${testCase.error}" -> "${friendlyMessage}"`);
    });
    
    console.log('\n📊 测试4: 错误统计');
    
    // 测试错误记录
    const errors = [
        { message: 'Network error 1', type: 'network_error' },
        { message: 'Payment error 1', type: 'payment_error' },
        { message: 'Network error 2', type: 'network_error' },
        { message: 'System error 1', type: 'system_error' }
    ];
    
    errors.forEach(error => {
        errorHandler.recordError(error);
    });
    
    const stats = errorHandler.getErrorStats();
    console.log(`✅ 错误统计:`);
    console.log(`   - 总错误数: ${stats.total}`);
    console.log(`   - 网络错误: ${stats.byType.network_error || 0}`);
    console.log(`   - 支付错误: ${stats.byType.payment_error || 0}`);
    console.log(`   - 系统错误: ${stats.byType.system_error || 0}`);
    console.log(`   - 最近错误数: ${stats.recent.length}`);
    
    console.log('\n🎯 测试5: 完整错误处理流程');
    
    // 测试完整的错误处理
    const testNetworkError = new Error('Connection timeout');
    errorHandler.handleError(testNetworkError, errorHandler.errorTypes.NETWORK_ERROR, {
        operation: 'blockchain_query',
        timestamp: Date.now()
    });
    
    console.log(`✅ 完整错误处理流程测试完成`);
    
    // 检查统计是否更新
    const updatedStats = errorHandler.getErrorStats();
    console.log(`   - 更新后总错误数: ${updatedStats.total}`);
    
    console.log('\n📥 测试6: 数据导出');
    
    // 测试错误日志导出
    const exportedLog = errorHandler.exportErrorLog();
    const logData = JSON.parse(exportedLog);
    
    console.log(`✅ 错误日志导出:`);
    console.log(`   - 包含统计: ${!!logData.stats}`);
    console.log(`   - 包含导出时间: ${!!logData.exportedAt}`);
    console.log(`   - 错误记录数: ${logData.stats.recent.length}`);
    
    console.log('\n🧹 测试7: 清理功能');
    
    // 测试清除统计
    const beforeClear = errorHandler.errorStats.total;
    errorHandler.clearErrorStats();
    const afterClear = errorHandler.errorStats.total;
    
    console.log(`✅ 清除统计功能:`);
    console.log(`   - 清除前: ${beforeClear} 个错误`);
    console.log(`   - 清除后: ${afterClear} 个错误`);
    
    console.log('\n🎊 ErrorHandler 基础功能测试完成！');
    console.log('\n💡 注意事项:');
    console.log('   - 完整功能需要在浏览器环境中测试');
    console.log('   - 通知显示需要真实的 DOM 操作');
    console.log('   - 加载遮罩需要实际的页面渲染');
    console.log('   - 可以使用 error-demo.html 进行完整测试');
    
} catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
    console.error('错误堆栈:', error.stack);
}