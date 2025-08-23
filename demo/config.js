// Stable Coin Configuration
const CONFIG = {
  // 区块链配置
  blockchain: {
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    chainId: 56,
    confirmations: 3
    // WebSocket 专用版本不需要轮询间隔配置
  },
  
  // 支付配置
  payment: {
    receiverAddress: '0xe27577B0e3920cE35f100f66430de0108cb78a04', // 固定收款地址
    supportedTokens: ['USDT', 'USDC', 'BUSD'],
    paymentTimeout: 30 * 60 * 1000, // 30分钟超时
    qrCodeImage: './images/wallet_qr.jpg' // 固定二维码图片
  },
  
  // UI 配置
  ui: {
    brand: 'Stable Coin',
    logo: './images/logo.png',
    theme: {
      primaryColor: '#2328da',
      backgroundColor: '#f4d8a9'
    }
  },
  
  // 代币配置
  tokens: {
    USDT: {
      symbol: 'USDT',
      name: 'Tether USD',
      contract: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      icon: 'usdt-icon.png'
    },
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
      icon: 'usdc-icon.png'
    },
    BUSD: {
      symbol: 'BUSD',
      name: 'Binance USD',
      contract: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      decimals: 18,
      icon: 'busd-icon.png'
    }
  },
  
  // 网络配置
  networks: {
    BSC: {
      name: 'BNB Smart Chain',
      chainId: 56,
      rpcUrl: 'https://bsc-dataseed1.binance.org/',
      blockExplorer: 'https://bscscan.com'
    }
  }
};

// 导出配置 (兼容不同模块系统)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}