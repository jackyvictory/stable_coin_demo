# EVO Payment - Crypto Payment System

A pixel-perfect clone of imsafu.com payment system, rebranded as EVO Payment with BNB Smart Chain integration.

## Features

- 🎨 Pixel-perfect UI clone of imsafu.com
- 💰 Support for USDT, USDC, BUSD payments
- 🔗 BNB Smart Chain integration
- 📱 Desktop-optimized design
- 🐳 Docker containerized deployment

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Navigate to the demo directory
cd demo

# Start the application
docker-compose up -d

# Access the application
open http://localhost:8080
```

### Using Docker

```bash
# Navigate to the demo directory
cd demo

# Build the image
docker build -t evo-payment .

# Run the container
docker run -d -p 8080:80 --name evo-payment-app evo-payment

# Access the application
open http://localhost:8080
```

### Development Mode

For development, you can serve the files directly using any static file server:

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js (if you have http-server installed)
npx http-server -p 8080

# Using PHP
php -S localhost:8080
```

## Configuration

The application configuration is located in `config.js`:

- **Blockchain Settings**: BSC mainnet RPC, polling intervals
- **Payment Settings**: Fixed receiver address, supported tokens
- **UI Settings**: Branding, theme colors

## Project Structure

```
demo/
├── index.html              # Homepage (product selection)
├── payment.html            # Cashier page
├── qrcode.html            # QR code payment page
├── success.html           # Payment success page
├── config.js              # Application configuration
├── css/                   # Stylesheets
├── js/                    # JavaScript modules
├── images/                # Images and assets
├── lib/                   # Third-party libraries
├── Dockerfile             # Docker build configuration
├── docker-compose.yml     # Docker Compose configuration
├── nginx.conf             # Nginx server configuration
└── README.md              # This file
```

## Payment Flow

1. **Homepage**: Select product and click "Pay With EVO Payment"
2. **Cashier**: Choose payment method (USDT/USDC/BUSD) and network (BSC)
3. **QR Code**: Scan QR code and send payment to the displayed address
4. **Success**: Automatic redirect after payment confirmation

## Blockchain Integration

- **Network**: BNB Smart Chain Mainnet
- **Receiver Address**: `0xe27577B0e3920cE35f100f66430de0108cb78a04`
- **Supported Tokens**: USDT, USDC, BUSD
- **Monitoring**: Real-time transaction polling every 5 seconds

## Development

To modify the application:

1. Edit the HTML, CSS, and JavaScript files
2. Update configuration in `config.js` if needed
3. Restart the Docker container to see changes

## Deployment

The application is containerized and ready for production deployment:

- Nginx serves static files with optimized caching
- Gzip compression enabled
- Security headers configured
- Health check endpoint available at `/health`

## Support

For issues or questions, please check the configuration and ensure:
- Docker is installed and running
- Ports 8080 and 8443 are available
- Internet connection is available for blockchain RPC calls