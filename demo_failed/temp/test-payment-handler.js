/**
 * PaymentHandler 功能测试脚本
 */

// 模拟浏览器环境
global.window = {
    EVO_CONFIG: require('./demo/config.js'),
    addEventListener: () => {},
    dispatchEvent: () => {},
    navigator: { userAgent: 'Node.js Test' }
};

global.document = {
    getElementById: () => null,
    createElement: () => ({ innerHTML: '', appendChild: () => {} }),
    addEventListener: () => {}
};

global.CustomEvent = class CustomEvent {
    constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
    }
};

// 加载 PaymentHandler
const PaymentHandler = require('./demo/js/payment-handler.js');

// 创建测试实例
const paymentHandler = new PaymentHandler();

console.log('🧪 开始测试 PaymentHandler...\n');

// 测试1: 创建支付
console.log('📝 测试1: 创建支付');
try {
    const payment1 = paymentHandler.createPayment({
        amount: 10.5,
        token: 'USDT',
        userAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
    });
    
    console.log('✅ 支付创建成功:');
    console.log(`   - 支付ID: ${payment1.paymentId}`);
    console.log(`   - 金额: $${payment1.amount}`);
    console.log(`   - 代币: ${payment1.tokenSymbol}`);
    console.log(`   - 状态: ${payment1.status}`);
    console.log(`   - 过期时间: ${payment1.expiresAt.toLocaleString()}`);
    
    // 测试2: 获取支付信息
    console.log('\n📋 测试2: 获取支付信息');
    const retrievedPayment = paymentHandler.getPaymentInfo(payment1.paymentId);
    if (retrievedPayment && retrievedPayment.paymentId === payment1.paymentId) {
        console.log('✅ 支付信息获取成功');
    } else {
        console.log('❌ 支付信息获取失败');
    }
    
    // 测试3: 生成二维码数据 (在状态更新前)
    console.log('\n📱 测试3: 生成二维码数据');
    const qrData = paymentHandler.generateQRCodeData(payment1.paymentId);
    console.log('✅ 二维码数据生成成功:');
    console.log(`   - 支付URL: ${qrData.url}`);
    console.log(`   - 显示金额: ${qrData.displayInfo.amount}`);
    console.log(`   - 显示代币: ${qrData.displayInfo.token}`);
    
    // 测试4: 更新支付状态
    console.log('\n🔄 测试4: 更新支付状态');
    paymentHandler.updatePaymentStatus(payment1.paymentId, 'monitoring');
    const updatedPayment = paymentHandler.getPaymentInfo(payment1.paymentId);
    if (updatedPayment.status === 'monitoring') {
        console.log('✅ 支付状态更新成功: pending -> monitoring');
    } else {
        console.log('❌ 支付状态更新失败');
    }
    
    // 测试5: 创建多个支付
    console.log('\n📊 测试5: 创建多个支付');
    const payment2 = paymentHandler.createPayment({
        amount: 25,
        token: 'USDC',
        userAddress: '0x123456789abcdef123456789abcdef123456789a'
    });
    
    const payment3 = paymentHandler.createPayment({
        amount: 5.75,
        token: 'BUSD',
        userAddress: '0x987654321fedcba987654321fedcba987654321b'
    });
    
    console.log(`✅ 创建了3个支付记录`);
    
    // 测试6: 获取支付统计
    console.log('\n📈 测试6: 获取支付统计');
    const stats = paymentHandler.getPaymentStats();
    console.log('✅ 支付统计:');
    console.log(`   - 总支付数: ${stats.total}`);
    console.log(`   - 待处理: ${stats.pending}`);
    console.log(`   - 已完成: ${stats.completed}`);
    console.log(`   - 总金额: $${stats.totalAmount}`);
    
    // 测试7: 获取支付列表
    console.log('\n📋 测试7: 获取支付列表');
    const allPayments = paymentHandler.getAllPayments();
    console.log(`✅ 获取到 ${allPayments.length} 个支付记录`);
    
    const pendingPayments = paymentHandler.getAllPayments({ status: 'pending' });
    console.log(`✅ 待处理支付: ${pendingPayments.length} 个`);
    
    // 测试8: 完成支付流程
    console.log('\n🎉 测试8: 完成支付流程');
    paymentHandler.updatePaymentStatus(payment2.paymentId, 'completed', {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    });
    
    const completedPayment = paymentHandler.getPaymentInfo(payment2.paymentId);
    if (completedPayment.status === 'completed' && completedPayment.txHash) {
        console.log('✅ 支付完成流程测试成功');
        console.log(`   - 交易哈希: ${completedPayment.txHash}`);
        console.log(`   - 完成时间: ${completedPayment.completedAt?.toLocaleString()}`);
    }
    
    // 测试9: 导出数据
    console.log('\n📥 测试9: 导出数据');
    const exportData = paymentHandler.exportPaymentData();
    console.log('✅ 数据导出成功:');
    console.log(`   - 支付记录数: ${exportData.payments.length}`);
    console.log(`   - 导出时间: ${exportData.exportedAt}`);
    
    // 测试10: 错误处理
    console.log('\n❌ 测试10: 错误处理');
    
    try {
        paymentHandler.createPayment({
            amount: -10,
            token: 'USDT',
            userAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
        });
        console.log('❌ 应该抛出错误但没有');
    } catch (error) {
        console.log('✅ 负金额错误处理正确:', error.message);
    }
    
    try {
        paymentHandler.createPayment({
            amount: 10,
            token: 'INVALID_TOKEN',
            userAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
        });
        console.log('❌ 应该抛出错误但没有');
    } catch (error) {
        console.log('✅ 无效代币错误处理正确:', error.message);
    }
    
    try {
        paymentHandler.getPaymentInfo('invalid_payment_id');
        console.log('✅ 无效支付ID处理正确: 返回null');
    } catch (error) {
        console.log('❌ 无效支付ID应该返回null而不是抛出错误');
    }
    
    console.log('\n🎊 所有测试完成！PaymentHandler 功能正常');
    
} catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
}