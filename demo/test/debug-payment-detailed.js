// 详细的支付调试脚本
// 在二维码页面的控制台中运行此脚本

async function detailedPaymentDebug() {
    console.log('🔍 === 详细支付调试开始 ===');
    
    // 1. 检查基础数据
    console.log('\n📋 1. 基础数据检查:');
    console.log('paymentData:', paymentData);
    console.log('pollingEnabled:', pollingEnabled);
    console.log('pollingPaused:', pollingPaused);
    console.log('statusCheckInterval:', statusCheckInterval);
    
    if (!paymentData) {
        console.error('❌ 没有支付数据');
        return;
    }
    
    // 2. 检查区块链连接
    console.log('\n🌐 2. 区块链连接检查:');
    if (!window.blockchainManager || !window.blockchainManager.isConnected) {
        console.error('❌ 区块链未连接');
        return;
    }
    
    console.log('✅ 区块链已连接');
    console.log('当前RPC:', window.blockchainManager.currentRpcUrl);
    
    // 3. 获取当前区块信息
    console.log('\n📊 3. 区块信息:');
    try {
        const currentBlock = await window.blockchainManager.web3.eth.getBlockNumber();
        console.log('当前区块号:', currentBlock);
        console.log('缓存起始区块:', cachedStartBlockNumber);
        console.log('最后检查区块:', lastCheckedBlockNumber);
        
        // 4. 检查支付参数
        console.log('\n💰 4. 支付参数:');
        const tokenSymbol = paymentData.selectedPayment?.symbol;
        const expectedAmount = paymentData.price;
        const receiverAddress = '0xe27577B0e3920cE35f100f66430de0108cb78a04';
        
        console.log('代币:', tokenSymbol);
        console.log('期望金额:', expectedAmount);
        console.log('接收地址:', receiverAddress);
        console.log('容差计算:', Math.max(0.001, expectedAmount * 0.001));
        
        // 5. 手动检查最近的转账
        console.log('\n🔍 5. 检查最近转账 (最近20个区块):');
        const fromBlock = Math.max(currentBlock - 20, 1);
        const toBlock = currentBlock;
        
        console.log(`检查区块范围: ${fromBlock} - ${toBlock}`);
        
        const transfers = await window.blockchainManager.getLatestTokenTransfers(
            tokenSymbol,
            receiverAddress,
            fromBlock,
            toBlock
        );
        
        console.log(`找到 ${transfers.length} 笔 ${tokenSymbol} 转账:`);
        
        if (transfers.length === 0) {
            console.log('❌ 没有找到任何转账记录');
            
            // 检查是否有任何转账到该地址（不限代币）
            console.log('\n🔍 6. 检查所有代币的转账:');
            const allTokens = ['USDT', 'USDC', 'BUSD', 'TUSD'];
            
            for (const token of allTokens) {
                try {
                    const tokenTransfers = await window.blockchainManager.getLatestTokenTransfers(
                        token,
                        receiverAddress,
                        fromBlock,
                        toBlock
                    );
                    
                    if (tokenTransfers.length > 0) {
                        console.log(`${token}: 找到 ${tokenTransfers.length} 笔转账`);
                        tokenTransfers.forEach((transfer, index) => {
                            console.log(`  ${index + 1}. 区块: ${transfer.blockNumber}, 金额: ${transfer.formattedValue} ${token}`);
                        });
                    } else {
                        console.log(`${token}: 无转账记录`);
                    }
                } catch (error) {
                    console.log(`${token}: 检查失败 - ${error.message}`);
                }
            }
        } else {
            // 详细分析每笔转账
            transfers.forEach((transfer, index) => {
                console.log(`\n转账 ${index + 1}:`);
                console.log(`  区块号: ${transfer.blockNumber}`);
                console.log(`  交易哈希: ${transfer.transactionHash}`);
                console.log(`  金额: ${transfer.formattedValue} ${tokenSymbol}`);
                console.log(`  原始金额: ${transfer.value}`);
                
                // 检查金额匹配
                const transferAmount = parseFloat(transfer.formattedValue);
                const tolerance = Math.max(0.001, expectedAmount * 0.001);
                const difference = Math.abs(transferAmount - expectedAmount);
                const matches = difference <= tolerance;
                
                console.log(`  期望金额: ${expectedAmount}`);
                console.log(`  实际金额: ${transferAmount}`);
                console.log(`  差值: ${difference}`);
                console.log(`  容差: ${tolerance}`);
                console.log(`  匹配: ${matches ? '✅ 是' : '❌ 否'}`);
                
                if (matches) {
                    console.log(`  🎯 这笔转账应该被检测到!`);
                    
                    // 检查确认数
                    const confirmations = currentBlock - transfer.blockNumber;
                    console.log(`  确认数: ${confirmations}`);
                    
                    if (confirmations >= 1) {
                        console.log(`  ✅ 确认数足够，应该触发成功跳转`);
                    } else {
                        console.log(`  ⏳ 确认数不足，需要等待更多确认`);
                    }
                }
            });
        }
        
        // 7. 检查轮询状态
        console.log('\n⏰ 7. 轮询状态检查:');
        console.log('轮询启用:', pollingEnabled);
        console.log('轮询暂停:', pollingPaused);
        console.log('轮询间隔ID:', statusCheckInterval);
        console.log('最后转账查询时间:', new Date(window.blockchainManager.lastTransferQueryTime || 0).toLocaleString());
        
        // 8. 建议
        console.log('\n💡 8. 调试建议:');
        
        if (transfers.length === 0) {
            console.log('❌ 没有找到转账记录，可能的原因:');
            console.log('   1. 交易还没有被打包到区块中');
            console.log('   2. 使用了错误的代币类型');
            console.log('   3. 发送到了错误的地址');
            console.log('   4. 交易失败了');
            console.log('   5. 区块范围不够大');
        } else {
            const matchingTransfers = transfers.filter(transfer => {
                const transferAmount = parseFloat(transfer.formattedValue);
                const tolerance = Math.max(0.001, expectedAmount * 0.001);
                return Math.abs(transferAmount - expectedAmount) <= tolerance;
            });
            
            if (matchingTransfers.length === 0) {
                console.log('❌ 找到转账但金额不匹配，可能的原因:');
                console.log('   1. 发送的金额与期望金额不一致');
                console.log('   2. 精度问题导致匹配失败');
                console.log('   3. 代币小数位数配置错误');
            } else {
                console.log('✅ 找到匹配的转账，但没有触发跳转，可能的原因:');
                console.log('   1. 轮询被暂停或停止');
                console.log('   2. 确认数不足');
                console.log('   3. JavaScript 错误阻止了跳转');
                console.log('   4. confirmPayment 函数没有被正确调用');
            }
        }
        
    } catch (error) {
        console.error('❌ 调试过程中出错:', error);
    }
    
    console.log('\n🔍 === 详细支付调试结束 ===');
}

// 执行调试
detailedPaymentDebug();