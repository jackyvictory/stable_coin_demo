/**
 * BlockchainConnector 功能测试脚本
 * 注意：这个测试需要在浏览器环境中运行，因为需要 Web3 和 MetaMask
 */

// 模拟浏览器环境的基本对象
global.window = {
    EVO_CONFIG: require('./demo/config.js'),
    addEventListener: () => {},
    dispatchEvent: () => {},
    ethereum: null, // 模拟没有 MetaMask
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

// 模拟 Web3 (简化版)
global.Web3 = class Web3 {
    constructor(provider) {
        this.provider = provider;
        this.eth = {
            getAccounts: () => Promise.resolve([]),
            getChainId: () => Promise.resolve(56),
            getBlockNumber: () => Promise.resolve(12345678),
            getGasPrice: () => Promise.resolve('5000000000'),
            getBalance: () => Promise.resolve('1000000000000000000'),
            getTransaction: () => Promise.resolve({}),
            getTransactionReceipt: () => Promise.resolve({}),
            estimateGas: () => Promise.resolve(21000),
            Contract: class Contract {
                constructor(abi, address) {
                    this.abi = abi;
                    this.address = address;
                    this.methods = {
                        balanceOf: () => ({
                            call: () => Promise.resolve('1000000000000000000')
                        })
                    };
                    this.events = {
                        Transfer: () => ({})
                    };
                    this.getPastEvents = () => Promise.resolve([]);
                }
            }
        };
        this.utils = {
            isAddress: (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
            toWei: (value, unit) => (parseFloat(value) * 1e18).toString(),
            fromWei: (value, unit) => (parseInt(value) / 1e18).toString(),
            toBN: (value) => ({
                mul: (other) => ({ toString: () => (parseInt(value) * parseInt(other.toString())).toString() }),
                div: (other) => ({ toString: () => Math.floor(parseInt(value) / parseInt(other.toString())).toString() }),
                mod: (other) => ({ 
                    toString: () => (parseInt(value) % parseInt(other.toString())).toString(),
                    isZero: () => (parseInt(value) % parseInt(other.toString())) === 0
                }),
                add: (other) => ({ toString: () => (parseInt(value) + parseInt(other.toString())).toString() }),
                pow: (exp) => ({ toString: () => Math.pow(parseInt(value), parseInt(exp.toString())).toString() }),
                toString: () => value.toString()
            })
        };
    }
};

console.log('🧪 开始测试 BlockchainConnector...\n');

try {
    // 加载 BlockchainConnector
    const BlockchainConnector = require('./demo/js/blockchain-connector.js');
    
    // 创建测试实例
    const connector = new BlockchainConnector();
    
    console.log('📝 测试1: 初始化检查');
    console.log(`✅ BlockchainConnector 实例创建成功`);
    console.log(`   - 配置加载: ${!!connector.config.TOKENS ? '成功' : '失败'}`);
    console.log(`   - 代币数量: ${Object.keys(connector.config.TOKENS || {}).length}`);
    
    console.log('\n🔧 测试2: 工具函数');
    
    // 测试地址验证
    const validAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
    const invalidAddress = '0xinvalid';
    
    console.log(`✅ 地址验证功能:`);
    console.log(`   - 有效地址: ${connector.isValidAddress(validAddress)}`);
    console.log(`   - 无效地址: ${connector.isValidAddress(invalidAddress)}`);
    
    // 测试地址格式化
    const formattedAddress = connector.formatAddress(validAddress);
    console.log(`✅ 地址格式化: ${formattedAddress}`);
    
    // 测试 Wei 转换
    const weiValue = connector.toWei('1.5', 18);
    const etherValue = connector.fromWei(weiValue, 18);
    console.log(`✅ Wei 转换:`);
    console.log(`   - 1.5 -> Wei: ${weiValue}`);
    console.log(`   - Wei -> Ether: ${etherValue}`);
    
    console.log('\n🪙 测试3: 代币合约配置');
    
    // 测试代币配置
    const supportedTokens = ['USDT', 'USDC', 'BUSD'];
    supportedTokens.forEach(token => {
        try {
            const contract = connector.getTokenContract(token);
            console.log(`✅ ${token} 合约实例创建成功`);
            console.log(`   - 合约地址: ${contract.address}`);
        } catch (error) {
            console.log(`❌ ${token} 合约创建失败: ${error.message}`);
        }
    });
    
    console.log('\n📊 测试4: 连接状态管理');
    
    // 测试连接状态
    const initialStatus = connector.getConnectionStatus();
    console.log(`✅ 初始连接状态:`);
    console.log(`   - 已连接: ${initialStatus.isConnected}`);
    console.log(`   - 账户: ${initialStatus.account || '无'}`);
    console.log(`   - 网络: ${initialStatus.network || '无'}`);
    console.log(`   - Web3: ${initialStatus.hasWeb3}`);
    
    console.log('\n🌐 测试5: 网络配置');
    
    // 测试网络配置
    const networks = ['mainnet', 'testnet'];
    networks.forEach(network => {
        const config = connector.config.NETWORK_CONFIG?.[network];
        if (config) {
            console.log(`✅ ${network} 网络配置:`);
            console.log(`   - 链ID: ${config.chainId}`);
            console.log(`   - 名称: ${config.chainName}`);
            console.log(`   - RPC数量: ${config.rpcUrls.length}`);
        } else {
            console.log(`❌ ${network} 网络配置缺失`);
        }
    });
    
    console.log('\n⚠️  测试6: 错误处理');
    
    // 测试无效代币
    try {
        connector.getTokenContract('INVALID_TOKEN');
        console.log('❌ 应该抛出错误但没有');
    } catch (error) {
        console.log('✅ 无效代币错误处理正确:', error.message);
    }
    
    // 测试无效地址
    const isValidInvalid = connector.isValidAddress('invalid_address');
    console.log(`✅ 无效地址验证: ${!isValidInvalid ? '正确' : '错误'}`);
    
    console.log('\n📋 测试7: 配置完整性检查');
    
    // 检查必要配置
    const requiredConfigs = [
        'NETWORK_CONFIG',
        'TOKENS', 
        'ERC20_ABI',
        'APP_CONFIG'
    ];
    
    requiredConfigs.forEach(configKey => {
        if (connector.config[configKey]) {
            console.log(`✅ ${configKey} 配置存在`);
        } else {
            console.log(`❌ ${configKey} 配置缺失`);
        }
    });
    
    // 检查代币配置完整性
    Object.entries(connector.config.TOKENS || {}).forEach(([symbol, config]) => {
        const requiredFields = ['symbol', 'contract', 'decimals'];
        const missingFields = requiredFields.filter(field => !config[field]);
        
        if (missingFields.length === 0) {
            console.log(`✅ ${symbol} 代币配置完整`);
        } else {
            console.log(`❌ ${symbol} 代币配置缺失字段: ${missingFields.join(', ')}`);
        }
    });
    
    console.log('\n🎊 BlockchainConnector 基础功能测试完成！');
    console.log('\n💡 注意事项:');
    console.log('   - 完整功能需要在浏览器环境中测试');
    console.log('   - 需要安装 MetaMask 或其他 Web3 钱包');
    console.log('   - 实际区块链交互需要连接到 BSC 网络');
    console.log('   - 可以使用 blockchain-demo.html 进行完整测试');
    
} catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
    console.error('错误堆栈:', error.stack);
}