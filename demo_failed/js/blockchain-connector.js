/**
 * EVO Payment 区块链连接器
 * 处理 Web3 连接、网络配置和基础区块链交互
 */

class BlockchainConnector {
    constructor() {
        // Web3 实例
        this.web3 = null;
        this.provider = null;
        
        // 连接状态
        this.isConnected = false;
        this.currentAccount = null;
        this.currentNetwork = null;
        
        // 配置
        this.config = window.EVO_CONFIG || {};
        
        // 代币合约实例缓存
        this.tokenContracts = new Map();
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化区块链连接器
     */
    async init() {
        console.log('BlockchainConnector 初始化...');
        
        try {
            // 检查 Web3 环境
            await this.checkWeb3Environment();
            
            // 设置事件监听
            this.setupEventListeners();
            
            // 尝试自动连接
            await this.autoConnect();
            
            console.log('✅ BlockchainConnector 初始化完成');
        } catch (error) {
            console.error('❌ BlockchainConnector 初始化失败:', error);
        }
    }
    
    /**
     * 检查 Web3 环境
     */
    async checkWeb3Environment() {
        // 检查是否有 Web3 提供者
        if (typeof window.ethereum !== 'undefined') {
            console.log('✅ 检测到 MetaMask 或其他 Web3 钱包');
            this.provider = window.ethereum;
            this.web3 = new Web3(window.ethereum);
            return true;
        } else if (typeof window.web3 !== 'undefined') {
            console.log('✅ 检测到旧版 Web3');
            this.web3 = new Web3(window.web3.currentProvider);
            this.provider = window.web3.currentProvider;
            return true;
        } else {
            throw new Error('未检测到 Web3 钱包，请安装 MetaMask');
        }
    }
    
    /**
     * 设置事件监听
     */
    setupEventListeners() {
        if (!this.provider) return;
        
        // 监听账户变化
        this.provider.on('accountsChanged', (accounts) => {
            console.log('账户变化:', accounts);
            this.handleAccountsChanged(accounts);
        });
        
        // 监听网络变化
        this.provider.on('chainChanged', (chainId) => {
            console.log('网络变化:', chainId);
            this.handleChainChanged(chainId);
        });
        
        // 监听连接状态
        this.provider.on('connect', (connectInfo) => {
            console.log('钱包已连接:', connectInfo);
            this.isConnected = true;
            this.onConnectionChanged(true);
        });
        
        this.provider.on('disconnect', (error) => {
            console.log('钱包已断开:', error);
            this.isConnected = false;
            this.currentAccount = null;
            this.onConnectionChanged(false);
        });
    }
    
    /**
     * 自动连接（如果之前已授权）
     */
    async autoConnect() {
        try {
            const accounts = await this.web3.eth.getAccounts();
            if (accounts.length > 0) {
                await this.handleAccountsChanged(accounts);
                console.log('✅ 自动连接成功');
            }
        } catch (error) {
            console.log('自动连接失败:', error.message);
        }
    }
    
    /**
     * 连接钱包
     */
    async connectWallet() {
        try {
            if (!this.provider) {
                throw new Error('未检测到 Web3 钱包');
            }
            
            console.log('请求连接钱包...');
            
            // 请求账户访问权限
            const accounts = await this.provider.request({
                method: 'eth_requestAccounts'
            });
            
            if (accounts.length === 0) {
                throw new Error('用户拒绝连接钱包');
            }
            
            await this.handleAccountsChanged(accounts);
            
            console.log('✅ 钱包连接成功');
            return {
                success: true,
                account: this.currentAccount,
                network: this.currentNetwork
            };
            
        } catch (error) {
            console.error('❌ 钱包连接失败:', error);
            throw error;
        }
    }
    
    /**
     * 处理账户变化
     */
    async handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            // 用户断开连接
            this.currentAccount = null;
            this.isConnected = false;
        } else {
            // 用户已连接
            this.currentAccount = accounts[0];
            this.isConnected = true;
            
            // 获取网络信息
            const chainId = await this.web3.eth.getChainId();
            await this.handleChainChanged(chainId);
        }
        
        this.onAccountChanged(this.currentAccount);
    }
    
    /**
     * 处理网络变化
     */
    async handleChainChanged(chainId) {
        const chainIdNum = parseInt(chainId);
        this.currentNetwork = chainIdNum;
        
        // 检查是否为支持的网络
        const supportedNetworks = [
            this.config.NETWORK_CONFIG?.mainnet?.chainId,
            this.config.NETWORK_CONFIG?.testnet?.chainId
        ].filter(Boolean);
        
        const isSupported = supportedNetworks.includes(chainIdNum);
        
        console.log(`当前网络: ${chainIdNum}, 支持: ${isSupported}`);
        
        this.onNetworkChanged(chainIdNum, isSupported);
    }
    
    /**
     * 切换到指定网络
     */
    async switchNetwork(networkType = 'mainnet') {
        try {
            const networkConfig = this.config.NETWORK_CONFIG?.[networkType];
            if (!networkConfig) {
                throw new Error(`不支持的网络类型: ${networkType}`);
            }
            
            const chainIdHex = '0x' + networkConfig.chainId.toString(16);
            
            try {
                // 尝试切换网络
                await this.provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: chainIdHex }]
                });
                
                console.log(`✅ 切换到 ${networkConfig.chainName} 成功`);
                
            } catch (switchError) {
                // 如果网络不存在，尝试添加网络
                if (switchError.code === 4902) {
                    await this.addNetwork(networkType);
                } else {
                    throw switchError;
                }
            }
            
        } catch (error) {
            console.error('❌ 切换网络失败:', error);
            throw error;
        }
    }
    
    /**
     * 添加网络到钱包
     */
    async addNetwork(networkType) {
        try {
            const networkConfig = this.config.NETWORK_CONFIG?.[networkType];
            if (!networkConfig) {
                throw new Error(`不支持的网络类型: ${networkType}`);
            }
            
            await this.provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x' + networkConfig.chainId.toString(16),
                    chainName: networkConfig.chainName,
                    nativeCurrency: networkConfig.nativeCurrency,
                    rpcUrls: networkConfig.rpcUrls,
                    blockExplorerUrls: networkConfig.blockExplorerUrls
                }]
            });
            
            console.log(`✅ 添加 ${networkConfig.chainName} 网络成功`);
            
        } catch (error) {
            console.error('❌ 添加网络失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取代币合约实例
     */
    getTokenContract(tokenSymbol) {
        const tokenConfig = this.config.TOKENS?.[tokenSymbol.toUpperCase()];
        if (!tokenConfig) {
            throw new Error(`不支持的代币: ${tokenSymbol}`);
        }
        
        // 检查缓存
        const cacheKey = `${tokenSymbol}_${this.currentNetwork}`;
        if (this.tokenContracts.has(cacheKey)) {
            return this.tokenContracts.get(cacheKey);
        }
        
        // 创建合约实例
        const contract = new this.web3.eth.Contract(
            this.config.ERC20_ABI,
            tokenConfig.contract
        );
        
        // 缓存合约实例
        this.tokenContracts.set(cacheKey, contract);
        
        return contract;
    }
    
    /**
     * 获取代币余额
     */
    async getTokenBalance(tokenSymbol, address = null) {
        try {
            const targetAddress = address || this.currentAccount;
            if (!targetAddress) {
                throw new Error('未指定地址且未连接钱包');
            }
            
            const contract = this.getTokenContract(tokenSymbol);
            const balance = await contract.methods.balanceOf(targetAddress).call();
            
            const tokenConfig = this.config.TOKENS[tokenSymbol.toUpperCase()];
            const decimals = tokenConfig.decimals;
            
            // 转换为可读格式
            const readableBalance = this.fromWei(balance, decimals);
            
            return {
                raw: balance,
                formatted: readableBalance,
                symbol: tokenSymbol.toUpperCase(),
                decimals
            };
            
        } catch (error) {
            console.error(`获取 ${tokenSymbol} 余额失败:`, error);
            throw error;
        }
    }
    
    /**
     * 获取原生代币余额 (BNB)
     */
    async getNativeBalance(address = null) {
        try {
            const targetAddress = address || this.currentAccount;
            if (!targetAddress) {
                throw new Error('未指定地址且未连接钱包');
            }
            
            const balance = await this.web3.eth.getBalance(targetAddress);
            const readableBalance = this.web3.utils.fromWei(balance, 'ether');
            
            return {
                raw: balance,
                formatted: readableBalance,
                symbol: 'BNB',
                decimals: 18
            };
            
        } catch (error) {
            console.error('获取 BNB 余额失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取交易详情
     */
    async getTransaction(txHash) {
        try {
            const [tx, receipt] = await Promise.all([
                this.web3.eth.getTransaction(txHash),
                this.web3.eth.getTransactionReceipt(txHash)
            ]);
            
            return {
                transaction: tx,
                receipt: receipt,
                status: receipt ? (receipt.status ? 'success' : 'failed') : 'pending',
                confirmations: receipt ? await this.getConfirmations(receipt.blockNumber) : 0
            };
            
        } catch (error) {
            console.error('获取交易详情失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取确认数
     */
    async getConfirmations(blockNumber) {
        try {
            const currentBlock = await this.web3.eth.getBlockNumber();
            return currentBlock - blockNumber;
        } catch (error) {
            console.error('获取确认数失败:', error);
            return 0;
        }
    }
    
    /**
     * 监听代币转账事件
     */
    async watchTokenTransfer(tokenSymbol, toAddress, fromBlock = 'latest') {
        try {
            const contract = this.getTokenContract(tokenSymbol);
            
            // 创建事件过滤器
            const eventFilter = contract.events.Transfer({
                filter: { to: toAddress },
                fromBlock: fromBlock
            });
            
            console.log(`开始监听 ${tokenSymbol} 转账到 ${toAddress}`);
            
            return eventFilter;
            
        } catch (error) {
            console.error('创建转账监听失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取代币转账历史
     */
    async getTokenTransferHistory(tokenSymbol, address, fromBlock = 0, toBlock = 'latest') {
        try {
            const contract = this.getTokenContract(tokenSymbol);
            
            // 获取转入记录
            const transfersIn = await contract.getPastEvents('Transfer', {
                filter: { to: address },
                fromBlock,
                toBlock
            });
            
            // 获取转出记录
            const transfersOut = await contract.getPastEvents('Transfer', {
                filter: { from: address },
                fromBlock,
                toBlock
            });
            
            // 合并并排序
            const allTransfers = [...transfersIn, ...transfersOut]
                .sort((a, b) => b.blockNumber - a.blockNumber);
            
            return allTransfers.map(event => ({
                txHash: event.transactionHash,
                blockNumber: event.blockNumber,
                from: event.returnValues.from,
                to: event.returnValues.to,
                value: event.returnValues.value,
                formattedValue: this.fromWei(
                    event.returnValues.value,
                    this.config.TOKENS[tokenSymbol.toUpperCase()].decimals
                ),
                type: event.returnValues.to.toLowerCase() === address.toLowerCase() ? 'in' : 'out'
            }));
            
        } catch (error) {
            console.error('获取转账历史失败:', error);
            throw error;
        }
    }
    
    /**
     * 估算 Gas 费用
     */
    async estimateGas(transaction) {
        try {
            const gasEstimate = await this.web3.eth.estimateGas(transaction);
            const gasPrice = await this.web3.eth.getGasPrice();
            
            const gasCost = this.web3.utils.toBN(gasEstimate).mul(this.web3.utils.toBN(gasPrice));
            const gasCostInEther = this.web3.utils.fromWei(gasCost, 'ether');
            
            return {
                gasLimit: gasEstimate,
                gasPrice: gasPrice,
                gasCost: gasCost.toString(),
                gasCostFormatted: gasCostInEther
            };
            
        } catch (error) {
            console.error('估算 Gas 失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取当前网络信息
     */
    async getNetworkInfo() {
        try {
            const [chainId, blockNumber, gasPrice] = await Promise.all([
                this.web3.eth.getChainId(),
                this.web3.eth.getBlockNumber(),
                this.web3.eth.getGasPrice()
            ]);
            
            const networkConfig = Object.values(this.config.NETWORK_CONFIG || {})
                .find(config => config.chainId === chainId);
            
            return {
                chainId,
                blockNumber,
                gasPrice,
                gasPriceFormatted: this.web3.utils.fromWei(gasPrice, 'gwei') + ' Gwei',
                networkName: networkConfig?.chainName || `Unknown (${chainId})`,
                isSupported: !!networkConfig
            };
            
        } catch (error) {
            console.error('获取网络信息失败:', error);
            throw error;
        }
    }
    
    /**
     * 工具函数：Wei 转换
     */
    fromWei(value, decimals = 18) {
        if (!this.web3) {
            // 简单的数学计算作为后备
            const factor = Math.pow(10, decimals);
            return (parseInt(value) / factor).toString();
        }
        
        try {
            const divisor = this.web3.utils.toBN(10).pow(this.web3.utils.toBN(decimals));
            const quotient = this.web3.utils.toBN(value).div(divisor);
            const remainder = this.web3.utils.toBN(value).mod(divisor);
            
            if (remainder.isZero()) {
                return quotient.toString();
            } else {
                const remainderStr = remainder.toString().padStart(decimals, '0');
                const trimmedRemainder = remainderStr.replace(/0+$/, '');
                return quotient.toString() + '.' + trimmedRemainder;
            }
        } catch (error) {
            // 如果 Web3 BN 操作失败，使用简单计算
            const factor = Math.pow(10, decimals);
            return (parseInt(value) / factor).toString();
        }
    }
    
    /**
     * 工具函数：转换为 Wei
     */
    toWei(value, decimals = 18) {
        if (!this.web3) {
            // 简单的数学计算作为后备
            const factor = Math.pow(10, decimals);
            return (parseFloat(value) * factor).toString();
        }
        
        try {
            const multiplier = this.web3.utils.toBN(10).pow(this.web3.utils.toBN(decimals));
            const [integer, decimal = ''] = value.toString().split('.');
            
            const integerBN = this.web3.utils.toBN(integer).mul(multiplier);
            
            if (decimal) {
                const decimalPadded = decimal.padEnd(decimals, '0').slice(0, decimals);
                const decimalBN = this.web3.utils.toBN(decimalPadded);
                return integerBN.add(decimalBN).toString();
            }
            
            return integerBN.toString();
        } catch (error) {
            // 如果 Web3 BN 操作失败，使用简单计算
            const factor = Math.pow(10, decimals);
            return (parseFloat(value) * factor).toString();
        }
    }
    
    /**
     * 验证地址格式
     */
    isValidAddress(address) {
        return this.web3.utils.isAddress(address);
    }
    
    /**
     * 格式化地址显示
     */
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    
    /**
     * 事件回调：连接状态变化
     */
    onConnectionChanged(isConnected) {
        console.log('连接状态变化:', isConnected);
        
        // 触发自定义事件
        const event = new CustomEvent('blockchainConnectionChanged', {
            detail: { isConnected, account: this.currentAccount }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 事件回调：账户变化
     */
    onAccountChanged(account) {
        console.log('账户变化:', account);
        
        // 触发自定义事件
        const event = new CustomEvent('blockchainAccountChanged', {
            detail: { account }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 事件回调：网络变化
     */
    onNetworkChanged(chainId, isSupported) {
        console.log('网络变化:', chainId, '支持:', isSupported);
        
        // 触发自定义事件
        const event = new CustomEvent('blockchainNetworkChanged', {
            detail: { chainId, isSupported }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 获取连接状态
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            account: this.currentAccount,
            network: this.currentNetwork,
            hasWeb3: !!this.web3
        };
    }
    
    /**
     * 断开连接
     */
    disconnect() {
        this.currentAccount = null;
        this.isConnected = false;
        this.tokenContracts.clear();
        
        console.log('已断开区块链连接');
        this.onConnectionChanged(false);
    }
}

// 创建全局实例
window.BlockchainConnector = new BlockchainConnector();

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockchainConnector;
}