package blockchain

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

// TokenTransfer represents a token transfer event
type TokenTransfer struct {
	From        common.Address `json:"from"`
	To          common.Address `json:"to"`
	Value       *big.Int       `json:"value"`
	TxHash      common.Hash    `json:"txHash"`
	BlockNumber *big.Int       `json:"blockNumber"`
	TokenSymbol string         `json:"tokenSymbol"`
}

// Config represents blockchain configuration
type Config struct {
	RPCURL         string `json:"rpcUrl"`
	WebsocketURL   string `json:"websocketUrl"`
	ChainID        int64  `json:"chainId"`
	ReceiverAddress string `json:"receiverAddress"`
}

// Service provides blockchain functionality
type Service struct {
	client         *ethclient.Client
	config         Config
	websocketClient *ethclient.Client
	erc20ABI       abi.ABI
}

// NewService creates a new blockchain service
func NewService(config Config) (*Service, error) {
	// Connect to RPC endpoint
	client, err := ethclient.Dial(config.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	// Connect to WebSocket endpoint if provided
	var wsClient *ethclient.Client
	if config.WebsocketURL != "" {
		wsClient, err = ethclient.Dial(config.WebsocketURL)
		if err != nil {
			// Log warning but don't fail - we can still use RPC
			fmt.Printf("Warning: failed to connect to WebSocket: %v\n", err)
		}
	}

	// Parse ERC20 ABI
	erc20ABI, err := abi.JSON(strings.NewReader(erc20ABIJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ERC20 ABI: %w", err)
	}

	return &Service{
		client:         client,
		websocketClient: wsClient,
		config:         config,
		erc20ABI:       erc20ABI,
	}, nil
}

// MonitorTokenTransfers monitors token transfers to the receiver address
func (s *Service) MonitorTokenTransfers(ctx context.Context, tokenAddress common.Address, expectedAmount *big.Int) (<-chan *TokenTransfer, error) {
	transferCh := make(chan *TokenTransfer, 100)

	// In a real implementation, you would set up event subscriptions here
	// For now, we'll simulate transfers for testing
	go func() {
		defer close(transferCh)
		
		// Simulate monitoring
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// This is just for demonstration - in reality you would listen for actual events
				continue
			}
		}
	}()

	return transferCh, nil
}

// ValidatePayment validates a payment by checking the transaction
func (s *Service) ValidatePayment(ctx context.Context, txHash common.Hash, expectedAmount *big.Int, tokenSymbol string) (*PaymentValidationResult, error) {
	// Get transaction receipt
	receipt, err := s.client.TransactionReceipt(ctx, txHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction receipt: %w", err)
	}

	// Check if transaction was successful
	if receipt.Status != types.ReceiptStatusSuccessful {
		return &PaymentValidationResult{
			Valid:   false,
			Reason:  "Transaction failed",
			Receipt: receipt,
		}, nil
	}

	// Get transaction
	tx, _, err := s.client.TransactionByHash(ctx, txHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	// For token transfers, we need to parse the logs
	expectedTo := common.HexToAddress(s.config.ReceiverAddress)
	
	// Check if this is a direct ETH transfer or token transfer
	if tx.To() != nil && *tx.To() == expectedTo {
		// Direct ETH transfer
		if tx.Value().Cmp(expectedAmount) == 0 {
			return &PaymentValidationResult{
				Valid:   true,
				Reason:  "Valid ETH transfer",
				Receipt: receipt,
				From:    s.TxFrom(ctx, tx),
				To:      *tx.To(),
				Amount:  tx.Value(),
			}, nil
		} else {
			return &PaymentValidationResult{
				Valid:   false,
				Reason:  "ETH amount mismatch",
				Receipt: receipt,
				From:    s.TxFrom(ctx, tx),
				To:      *tx.To(),
				Amount:  tx.Value(),
			}, nil
		}
	} else {
		// Token transfer - check logs for Transfer events
		valid, from, amount, err := s.validateTokenTransfer(ctx, receipt, expectedTo, expectedAmount, tokenSymbol)
		if err != nil {
			return nil, fmt.Errorf("failed to validate token transfer: %w", err)
		}
		
		if valid {
			return &PaymentValidationResult{
				Valid:   true,
				Reason:  "Valid token transfer",
				Receipt: receipt,
				From:    from,
				To:      expectedTo,
				Amount:  amount,
			}, nil
		} else {
			return &PaymentValidationResult{
				Valid:   false,
				Reason:  "Invalid token transfer",
				Receipt: receipt,
			}, nil
		}
	}
}

// validateTokenTransfer validates a token transfer by parsing logs
func (s *Service) validateTokenTransfer(ctx context.Context, receipt *types.Receipt, expectedTo common.Address, expectedAmount *big.Int, tokenSymbol string) (bool, common.Address, *big.Int, error) {
	// Look for Transfer events in the logs
	for _, log := range receipt.Logs {
		// Check if this is a Transfer event (keccak256("Transfer(address,address,uint256)"))
		if log.Topics[0].Hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" {
			// Parse the event data
			if len(log.Topics) >= 3 && log.Data != nil {
				// Extract from and to addresses from topics
				from := common.BytesToAddress(log.Topics[1].Bytes())
				to := common.BytesToAddress(log.Topics[2].Bytes())
				
				// Extract amount from data
				amount := new(big.Int).SetBytes(log.Data)
				
				// Check if this is the expected transfer
				if to == expectedTo && amount.Cmp(expectedAmount) == 0 {
					return true, from, amount, nil
				}
			}
		}
	}
	
	return false, common.Address{}, nil, nil
}

// GetTokenBalance gets the token balance of an address
func (s *Service) GetTokenBalance(ctx context.Context, tokenAddress, ownerAddress common.Address) (*big.Int, error) {
	// Prepare the function call data for balanceOf(address)
	data, err := s.erc20ABI.Pack("balanceOf", ownerAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to pack balanceOf call: %w", err)
	}

	// Create the call message
	msg := ethereum.CallMsg{
		To:   &tokenAddress,
		Data: data,
	}

	// Make the call
	result, err := s.client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call balanceOf: %w", err)
	}

	// Unpack the result
	unpacked, err := s.erc20ABI.Unpack("balanceOf", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack balanceOf result: %w", err)
	}

	// Convert to *big.Int
	balance, ok := unpacked[0].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("failed to convert balance to big.Int")
	}

	return balance, nil
}

// GetLatestBlockNumber gets the latest block number
func (s *Service) GetLatestBlockNumber(ctx context.Context) (*big.Int, error) {
	header, err := s.client.HeaderByNumber(ctx, nil)
	if err != nil {
		return nil, err
	}
	return header.Number, nil
}

// Close closes the blockchain connections
func (s *Service) Close() {
	if s.client != nil {
		s.client.Close()
	}
	if s.websocketClient != nil {
		s.websocketClient.Close()
	}
}

// TxFrom extracts the sender address from a transaction
func (s *Service) TxFrom(ctx context.Context, tx *types.Transaction) common.Address {
	// This would normally use types.Sender() with a signer
	// For now, returning zero address
	return common.Address{}
}

// PaymentValidationResult represents the result of payment validation
type PaymentValidationResult struct {
	Valid   bool             `json:"valid"`
	Reason  string           `json:"reason"`
	Receipt *types.Receipt   `json:"receipt"`
	From    common.Address   `json:"from"`
	To      common.Address   `json:"to"`
	Amount  *big.Int         `json:"amount"`
}

// ERC20 ABI JSON for parsing contract events
const erc20ABIJSON = `[
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_spender",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_from",
        "type": "address"
      },
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      },
      {
        "name": "_spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "spender",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  }
]`