-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

CREATE TABLE IF NOT EXISTS payment_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    network_id TEXT NOT NULL,
    receiver_address TEXT NOT NULL,
    sender_address TEXT,
    status TEXT NOT NULL,
    qr_code_data TEXT,
    transaction_hash TEXT,
    block_number INTEGER,
    confirmed_at DATETIME,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_sessions_payment_id ON payment_sessions(payment_id);
CREATE INDEX idx_payment_sessions_status ON payment_sessions(status);
CREATE INDEX idx_payment_sessions_expires_at ON payment_sessions(expires_at);

CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    network_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_tokens_network_id ON tokens(network_id);

CREATE TABLE IF NOT EXISTS networks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    rpc_url TEXT NOT NULL,
    websocket_url TEXT,
    block_explorer TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default network configuration
INSERT OR IGNORE INTO networks (id, name, chain_id, rpc_url, websocket_url, block_explorer) VALUES 
('BSC', 'BNB Smart Chain', 56, 'https://bsc-dataseed1.binance.org/', 'wss://bsc-ws-node.nariox.org', 'https://bscscan.com');

-- Insert default token configurations
INSERT OR IGNORE INTO tokens (symbol, name, contract_address, decimals, network_id) VALUES 
('USDT', 'Tether USD', '0x55d398326f99059fF775485246999027B3197955', 18, 'BSC'),
('USDC', 'USD Coin', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, 'BSC'),
('BUSD', 'Binance USD', '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', 18, 'BSC');

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

DROP TABLE IF EXISTS payment_sessions;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS networks;