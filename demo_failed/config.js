/**
 * EVO Payment 配置文件
 * 包含 BSC 网络配置和代币信息
 */

// BSC 网络配置
const NETWORK_CONFIG = {
    // BSC 主网配置
    mainnet: {
        chainId: 56,
        chainName: 'BNB Smart Chain',
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        },
        rpcUrls: [
            'https://bsc-dataseed1.binance.org/',
            'https://bsc-dataseed2.binance.org/',
            'https://bsc-dataseed3.binance.org/',
            'https://bsc-dataseed4.binance.org/'
        ],
        blockExplorerUrls: ['https://bscscan.com/']
    },
    // BSC 测试网配置 (用于开发测试)
    testnet: {
        chainId: 97,
        chainName: 'BNB Smart Chain Testnet',
        nativeCurrency: {
            name: 'tBNB',
            symbol: 'tBNB',
            decimals: 18
        },
        rpcUrls: [
            'https://data-seed-prebsc-1-s1.binance.org:8545/',
            'https://data-seed-prebsc-2-s1.binance.org:8545/'
        ],
        blockExplorerUrls: ['https://testnet.bscscan.com/']
    }
};

// 支持的代币配置
const TOKENS = {
    USDT: {
        symbol: 'USDT',
        name: 'Tether USD',
        contract: '0x55d398326f99059fF775485246999027B3197955', // BSC 主网 USDT
        decimals: 18,
        icon: './images/usdt-logo.png'
    },
    USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC 主网 USDC
        decimals: 18,
        icon: './images/usd-coin-usdc-logo.png'
    },
    BUSD: {
        symbol: 'BUSD',
        name: 'Binance USD',
        contract: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BSC 主网 BUSD
        decimals: 18,
        icon: './images/busd-logo.png'
    }
};

// ERC-20 代币标准 ABI (简化版，只包含必要的方法)
const ERC20_ABI = [
    // balanceOf
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    // transfer
    {
        "constant": false,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    // Transfer 事件
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "from", "type": "address"},
            {"indexed": true, "name": "to", "type": "address"},
            {"indexed": false, "name": "value", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    },
    // decimals
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    // symbol
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    }
];

// 应用配置
const APP_CONFIG = {
    // 当前使用的网络 (mainnet 或 testnet)
    currentNetwork: 'mainnet',
    
    // 支付配置
    payment: {
        // 收款地址 (需要替换为实际地址)
        receiverAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        
        // 支付超时时间 (30分钟)
        paymentTimeout: 30 * 60 * 1000,
        
        // 轮询间隔 (5秒)
        pollingInterval: 5000,
        
        // 需要的确认数
        confirmations: 3,
        
        // 支持的代币
        supportedTokens: ['USDT', 'USDC', 'BUSD']
    },
    
    // UI 配置
    ui: {
        // 二维码大小
        qrCodeSize: 256,
        
        // 页面刷新间隔
        refreshInterval: 5000,
        
        // 默认支付金额选项
        defaultAmounts: [0.25, 0.5, 1, 2, 5, 10, 20, 50],
        
        // 主题颜色
        theme: {
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#46C16D',
            error: '#D7272B',
            warning: '#DD6B20'
        }
    }
};

// 支付状态枚举
const PAYMENT_STATUS = {
    PENDING: 'pending',        // 等待支付
    MONITORING: 'monitoring',  // 监听中
    CONFIRMED: 'confirmed',    // 已确认
    COMPLETED: 'completed',    // 已完成
    EXPIRED: 'expired',        // 已过期
    FAILED: 'failed'           // 支付失败
};

// 错误类型
const ERROR_TYPES = {
    NETWORK_ERROR: 'network_error',
    PAYMENT_ERROR: 'payment_error',
    WALLET_ERROR: 'wallet_error',
    TIMEOUT_ERROR: 'timeout_error',
    VALIDATION_ERROR: 'validation_error'
};

// 导出配置 (支持浏览器和 Node.js 环境)
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = {
        NETWORK_CONFIG,
        TOKENS,
        ERC20_ABI,
        APP_CONFIG,
        PAYMENT_STATUS,
        ERROR_TYPES
    };
} else {
    // 浏览器环境
    window.EVO_CONFIG = {
        NETWORK_CONFIG,
        TOKENS,
        ERC20_ABI,
        APP_CONFIG,
        PAYMENT_STATUS,
        ERROR_TYPES
    };
}

// 辅助函数
const ConfigUtils = {
    /**
     * 获取当前网络配置
     */
    getCurrentNetwork() {
        return NETWORK_CONFIG[APP_CONFIG.currentNetwork];
    },
    
    /**
     * 获取代币配置
     */
    getToken(symbol) {
        return TOKENS[symbol.toUpperCase()];
    },
    
    /**
     * 获取所有支持的代币
     */
    getSupportedTokens() {
        return APP_CONFIG.payment.supportedTokens.map(symbol => TOKENS[symbol]);
    },
    
    /**
     * 验证地址格式
     */
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    },
    
    /**
     * 格式化金额显示
     */
    formatAmount(amount, decimals = 2) {
        return parseFloat(amount).toFixed(decimals);
    },
    
    /**
     * 将金额转换为 Wei (考虑代币精度)
     */
    toWei(amount, decimals = 18) {
        return (parseFloat(amount) * Math.pow(10, decimals)).toString();
    },
    
    /**
     * 将 Wei 转换为可读金额
     */
    fromWei(wei, decimals = 18) {
        return (parseInt(wei) / Math.pow(10, decimals)).toString();
    }
};

// 在浏览器环境中也导出工具函数
if (typeof window !== 'undefined') {
    window.ConfigUtils = ConfigUtils;
}