// Stable Coin - Success Page JavaScript (WebSocket Version)

// Global variables
let paymentData = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPaymentData();
    displaySuccessInfo();
    displayBlockchainInfo();
});

// 加载支付数据
function loadPaymentData() {
    const data = sessionStorage.getItem('paymentData');
    if (data) {
        paymentData = JSON.parse(data);
        console.log('Payment data loaded:', paymentData);
    } else {
        // 如果没有支付数据，显示默认信息
        console.log('No payment data found, showing default success message');
        paymentData = {
            product: 'unknown',
            price: 0,
            paymentId: 'N/A',
            selectedPayment: { symbol: 'N/A', name: 'N/A' },
            selectedNetwork: { symbol: 'N/A', name: 'N/A' },
            timestamp: Date.now(),
            confirmedAt: Date.now(), // 添加确认时间作为备用
            monitoringMode: 'WebSocket', // WebSocket 版本默认值
            performanceMetrics: {
                detectionTime: 0,
                detectionMethod: 'WebSocket'
            }
        };
    }
}

// 显示成功信息
function displaySuccessInfo() {
    if (!paymentData) return;
    
    const itemElement = document.getElementById('success-item');
    const amountElement = document.getElementById('success-amount');
    const paymentMethodElement = document.getElementById('success-payment-method');
    const networkElement = document.getElementById('success-network');
    const payIdElement = document.getElementById('success-payment-id');
    const timestampElement = document.getElementById('success-timestamp');
    
    if (itemElement && amountElement && paymentMethodElement && networkElement && payIdElement && timestampElement) {
        // 获取产品信息
        const productInfo = getProductInfo(paymentData.product);
        const itemName = productInfo ? productInfo.description : `Food Donation (${paymentData.product})`;
        
        itemElement.textContent = itemName;
        amountElement.textContent = `$${paymentData.price.toFixed(2)}`;
        
        // 显示选择的支付方式和网络
        if (paymentData.selectedPayment) {
            // 如果symbol和name相同，只显示一个，否则显示 "symbol - name"
            if (paymentData.selectedPayment.symbol === paymentData.selectedPayment.name) {
                paymentMethodElement.textContent = paymentData.selectedPayment.symbol;
            } else {
                paymentMethodElement.textContent = `${paymentData.selectedPayment.symbol} - ${paymentData.selectedPayment.name}`;
            }
        } else {
            paymentMethodElement.textContent = 'N/A';
        }
        
        if (paymentData.selectedNetwork) {
            // 如果symbol和name相同，只显示一个，否则显示 "symbol - name"
            if (paymentData.selectedNetwork.symbol === paymentData.selectedNetwork.name) {
                networkElement.textContent = paymentData.selectedNetwork.symbol;
            } else {
                networkElement.textContent = `${paymentData.selectedNetwork.symbol} - ${paymentData.selectedNetwork.name}`;
            }
        } else {
            networkElement.textContent = 'N/A';
        }
        
        // 显示 PayID
        payIdElement.textContent = paymentData.paymentId;
        
        // 显示交易时间
        let transactionTime;
        if (paymentData.confirmedAt) {
            // 使用确认时间
            transactionTime = new Date(paymentData.confirmedAt);
        } else if (paymentData.timestamp) {
            // 回退到创建时间
            transactionTime = new Date(paymentData.timestamp);
        } else {
            // 默认使用当前时间
            transactionTime = new Date();
        }
        
        // 检查日期是否有效
        if (isNaN(transactionTime.getTime())) {
            console.error('Invalid transaction time:', paymentData);
            timestampElement.textContent = 'Invalid Date';
        } else {
            timestampElement.textContent = formatTimestamp(transactionTime);
        }
    }
}

// 显示区块链信息
function displayBlockchainInfo() {
    console.log('🔗 [displayBlockchainInfo] Starting blockchain info display...');
    
    if (!paymentData) {
        console.error('❌ [displayBlockchainInfo] No payment data available');
        return;
    }
    
    console.log('📋 [displayBlockchainInfo] Payment data:', paymentData);
    
    // 获取所有区块链信息元素
    const blockchainNameElement = document.getElementById('blockchain-name');
    const txHashElement = document.getElementById('blockchain-tx-hash');
    const blockNumberElement = document.getElementById('blockchain-block-number');
    const fromAddrElement = document.getElementById('blockchain-from-addr');
    const toAddrElement = document.getElementById('blockchain-to-addr');
    const contractAddrElement = document.getElementById('blockchain-contract-addr');
    const amountElement = document.getElementById('blockchain-amount');
    
    // 从支付数据中提取区块链信息
    let blockchainData = extractBlockchainData(paymentData);
    console.log('🔗 [displayBlockchainInfo] Extracted blockchain data:', blockchainData);
    
    // 更新区块链名称
    if (blockchainNameElement) {
        const networkName = getBlockchainName(paymentData);
        blockchainNameElement.textContent = networkName;
        blockchainNameElement.className = 'blockchain-value network';
        console.log('🌐 [displayBlockchainInfo] Network name set to:', networkName);
    }
    
    // 更新各个字段
    if (txHashElement) {
        const fullHash = blockchainData.fullTransactionHash || blockchainData.transactionHash;
        const displayHash = blockchainData.transactionHash || 'N/A';
        txHashElement.textContent = displayHash;
        txHashElement.className = 'blockchain-value hash';
        if (fullHash && fullHash !== 'N/A') {
            txHashElement.title = fullHash; // 完整哈希作为tooltip
        }
        console.log('🔗 [displayBlockchainInfo] Transaction hash set to:', displayHash);
    }
    
    if (blockNumberElement) {
        const displayBlockNumber = blockchainData.blockNumber || 'N/A';
        blockNumberElement.textContent = displayBlockNumber;
        blockNumberElement.className = 'blockchain-value';
        console.log('🧱 [displayBlockchainInfo] Block number set to:', displayBlockNumber);
    }
    
    if (fromAddrElement) {
        const fullFromAddr = blockchainData.fullFromAddress || blockchainData.fromAddress;
        const displayFromAddr = blockchainData.fromAddress || 'N/A';
        fromAddrElement.textContent = displayFromAddr;
        fromAddrElement.className = 'blockchain-value address';
        if (fullFromAddr && fullFromAddr !== 'N/A') {
            fromAddrElement.title = fullFromAddr; // 完整地址作为tooltip
        }
        console.log('📤 [displayBlockchainInfo] From address set to:', displayFromAddr);
    }
    
    if (toAddrElement) {
        const fullToAddr = blockchainData.fullToAddress || blockchainData.toAddress;
        const displayToAddr = blockchainData.toAddress || 'N/A';
        toAddrElement.textContent = displayToAddr;
        toAddrElement.className = 'blockchain-value address';
        if (fullToAddr && fullToAddr !== 'N/A') {
            toAddrElement.title = fullToAddr; // 完整地址作为tooltip
        }
        console.log('📥 [displayBlockchainInfo] To address set to:', displayToAddr);
    }
    
    if (contractAddrElement) {
        const fullContractAddr = blockchainData.fullContractAddress || blockchainData.contractAddress;
        const displayContractAddr = blockchainData.contractAddress || 'N/A';
        contractAddrElement.textContent = displayContractAddr;
        contractAddrElement.className = 'blockchain-value address';
        if (fullContractAddr && fullContractAddr !== 'N/A') {
            contractAddrElement.title = fullContractAddr; // 完整合约地址作为tooltip
        }
        console.log('📄 [displayBlockchainInfo] Contract address set to:', displayContractAddr);
    }
    
    if (amountElement) {
        const displayAmount = blockchainData.amountAndCurrency || 'N/A';
        amountElement.textContent = displayAmount;
        amountElement.className = 'blockchain-value amount';
        console.log('💰 [displayBlockchainInfo] Amount set to:', displayAmount);
    }
    
    console.log('✅ [displayBlockchainInfo] Blockchain info display completed');
}

// 从支付数据中提取区块链信息
function extractBlockchainData(paymentData) {
    console.log('🔍 [extractBlockchainData] Starting data extraction...');
    console.log('📋 [extractBlockchainData] Input payment data:', paymentData);
    
    const blockchainData = {
        transactionHash: null,
        fullTransactionHash: null,
        blockNumber: null,
        fromAddress: null,
        fullFromAddress: null,
        toAddress: null,
        fullToAddress: null,
        contractAddress: null,
        fullContractAddress: null,
        amountAndCurrency: null
    };
    
    // 尝试从不同的数据源提取信息
    let sourceData = null;
    
    // 优先使用 confirmationData（WebSocket 监听到的数据）
    if (paymentData.confirmationData) {
        sourceData = paymentData.confirmationData;
        console.log('✅ [extractBlockchainData] Using confirmationData as source:', sourceData);
    }
    // 其次使用直接的支付数据字段
    else if (paymentData.transactionHash || paymentData.blockNumber) {
        sourceData = paymentData;
        console.log('✅ [extractBlockchainData] Using paymentData as source (has tx/block):', sourceData);
    }
    // 最后尝试从 blockchainInfo 字段
    else if (paymentData.blockchainInfo) {
        sourceData = paymentData.blockchainInfo;
        console.log('✅ [extractBlockchainData] Using blockchainInfo as source:', sourceData);
    } else {
        console.warn('⚠️ [extractBlockchainData] No suitable blockchain data source found');
        console.log('📋 [extractBlockchainData] Available fields in paymentData:', Object.keys(paymentData));
    }
    
    if (sourceData) {
        // 交易哈希
        if (sourceData.transactionHash) {
            blockchainData.fullTransactionHash = sourceData.transactionHash;
            blockchainData.transactionHash = formatTransactionHash(sourceData.transactionHash);
        }
        
        // 区块号
        if (sourceData.blockNumber) {
            blockchainData.blockNumber = `#${sourceData.blockNumber}`;
        }
        
        // 发送地址
        if (sourceData.fromAddress) {
            blockchainData.fullFromAddress = sourceData.fromAddress;
            blockchainData.fromAddress = formatAddress(sourceData.fromAddress);
        } else if (sourceData.from) {
            blockchainData.fullFromAddress = sourceData.from;
            blockchainData.fromAddress = formatAddress(sourceData.from);
        }
        
        // 接收地址
        if (sourceData.toAddress) {
            blockchainData.fullToAddress = sourceData.toAddress;
            blockchainData.toAddress = formatAddress(sourceData.toAddress);
        } else if (sourceData.to) {
            blockchainData.fullToAddress = sourceData.to;
            blockchainData.toAddress = formatAddress(sourceData.to);
        }
        
        // 合约地址
        if (sourceData.contractAddress) {
            blockchainData.fullContractAddress = sourceData.contractAddress;
            blockchainData.contractAddress = formatAddress(sourceData.contractAddress);
        } else if (sourceData.tokenContract) {
            blockchainData.fullContractAddress = sourceData.tokenContract;
            blockchainData.contractAddress = formatAddress(sourceData.tokenContract);
        }
        
        // 金额和货币
        if (sourceData.amount && sourceData.tokenSymbol) {
            blockchainData.amountAndCurrency = `${sourceData.amount} ${sourceData.tokenSymbol}`;
        } else if (paymentData.price && paymentData.selectedPayment?.symbol) {
            blockchainData.amountAndCurrency = `${paymentData.price} ${paymentData.selectedPayment.symbol}`;
        }
    }
    
    // 如果没有从 WebSocket 数据中获取到信息，使用支付数据的基本信息
    if (!blockchainData.toAddress && paymentData.walletAddress) {
        blockchainData.fullToAddress = paymentData.walletAddress;
        blockchainData.toAddress = formatAddress(paymentData.walletAddress);
    }
    
    if (!blockchainData.amountAndCurrency && paymentData.price && paymentData.selectedPayment?.symbol) {
        blockchainData.amountAndCurrency = `${paymentData.price} ${paymentData.selectedPayment.symbol}`;
    }
    
    // 如果没有从 WebSocket 数据中获取到合约地址，使用支付数据中的合约地址
    if (!blockchainData.contractAddress && paymentData.selectedPayment?.contractAddress) {
        blockchainData.fullContractAddress = paymentData.selectedPayment.contractAddress;
        blockchainData.contractAddress = formatAddress(paymentData.selectedPayment.contractAddress);
    }
    
    console.log('Extracted blockchain data:', blockchainData);
    return blockchainData;
}

// 格式化交易哈希（显示前10位和后6位）
function formatTransactionHash(hash) {
    if (!hash || hash === 'N/A') return 'N/A';
    if (hash.length <= 20) return hash;
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 6)}`;
}

// 格式化地址（显示前8位和后6位）
function formatAddress(address) {
    if (!address || address === 'N/A') return 'N/A';
    if (address.length <= 20) return address;
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
}

// 格式化区块时间戳
function formatBlockTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        let date;
        if (typeof timestamp === 'number') {
            // 如果是数字，可能是毫秒或秒级时间戳
            date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            return 'N/A';
        }
        
        if (isNaN(date.getTime())) {
            return 'N/A';
        }
        
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting block timestamp:', error);
        return 'N/A';
    }
}

// 获取区块链名称
function getBlockchainName(paymentData) {
    // 优先从网络配置中获取
    if (paymentData.selectedNetwork?.name) {
        return paymentData.selectedNetwork.name;
    }
    
    // 从确认数据中获取
    if (paymentData.confirmationData?.networkName) {
        return paymentData.confirmationData.networkName;
    }
    
    // 根据链ID推断
    if (paymentData.selectedNetwork?.chainId) {
        const chainId = paymentData.selectedNetwork.chainId;
        switch (chainId) {
            case 56:
                return 'BNB Smart Chain (BSC)';
            case 1:
                return 'Ethereum Mainnet';
            case 137:
                return 'Polygon';
            case 43114:
                return 'Avalanche';
            case 250:
                return 'Fantom';
            default:
                return `Chain ID ${chainId}`;
        }
    }
    
    // 默认值
    return 'BNB Smart Chain (BSC)';
}

// 切换区块链信息的折叠/展开状态
function toggleBlockchainInfo() {
    const detailsElement = document.getElementById('blockchain-details');
    const toggleBtn = document.getElementById('blockchain-toggle-btn');
    
    if (!detailsElement || !toggleBtn) {
        console.error('Blockchain details or toggle button not found');
        return;
    }
    
    const isHidden = detailsElement.style.display === 'none';
    
    if (isHidden) {
        // 展开
        detailsElement.style.display = 'block';
        toggleBtn.classList.add('expanded');
        console.log('Blockchain info expanded');
    } else {
        // 折叠
        detailsElement.style.display = 'none';
        toggleBtn.classList.remove('expanded');
        console.log('Blockchain info collapsed');
    }
}

// 确保函数在全局作用域中可用
window.toggleBlockchainInfo = toggleBlockchainInfo;



// 获取产品信息
function getProductInfo(productKey) {
    const products = {
        peanut: { description: 'Food Donation (Peanut)' },
        rice: { description: 'Food Donation (Rice)' },
        bread: { description: 'Food Donation (Bread)' },
        milk: { description: 'Food Donation (Milk)' },
        fruit: { description: 'Food Donation (Fruit)' }
    };
    return products[productKey] || null;
}

// 格式化时间戳
function formatTimestamp(date) {
    // 检查输入是否为有效日期
    if (!date || isNaN(date.getTime())) {
        console.error('Invalid date provided to formatTimestamp:', date);
        return 'Invalid Date';
    }
    
    try {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return 'Invalid Date';
    }
}

// 开始新的支付 (WebSocket 版本)
function startNewPayment() {
    // 清除支付处理器数据
    if (typeof window.paymentHandler !== 'undefined') {
        window.paymentHandler.clearStorage();
    }
    
    // 清除当前支付数据
    sessionStorage.removeItem('paymentData');
    
    // 跳转到首页
    window.location.href = 'index.html';
}

// 返回首页
function goHome() {
    // 清除支付处理器数据
    if (typeof window.paymentHandler !== 'undefined') {
        window.paymentHandler.clearStorage();
    }
    
    // 清除当前支付数据
    sessionStorage.removeItem('paymentData');
    
    // 跳转到首页
    window.location.href = 'index.html';
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.SuccessPageWS = {
        startNewPayment,
        goHome,
        displaySuccessInfo,
        displayBlockchainInfo,
        extractBlockchainData,
        formatTransactionHash,
        formatAddress,
        formatBlockTimestamp,
        getBlockchainName,
        toggleBlockchainInfo
    };
}