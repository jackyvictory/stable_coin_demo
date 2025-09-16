# Makefile for Stable Coin Payment System

# Variables
PROJECT_NAME = payment
BACKEND_DIR = backend
FRONTEND_DIR = frontend
DOCKER_COMPOSE = docker-compose.yml

# Colors
GREEN := \033[0;32m
BLUE := \033[0;34m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Help target
.PHONY: help
help:
	@echo "$(BLUE)Stable Coin Payment System Makefile$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@echo "  $(YELLOW)help$(NC)          - Show this help message"
	@echo "  $(YELLOW)build$(NC)         - Build all services"
	@echo "  $(YELLOW)start$(NC)         - Start all services"
	@echo "  $(YELLOW)stop$(NC)          - Stop all services"
	@echo "  $(YELLOW)restart$(NC)       - Restart all services"
	@echo "  $(YELLOW)logs$(NC)          - Show logs for all services"
	@echo "  $(YELLOW)clean$(NC)         - Stop and remove all containers"
	@echo "  $(YELLOW)backend-deps$(NC)  - Install backend dependencies"
	@echo "  $(YELLOW)frontend-deps$(NC) - Install frontend dependencies"
	@echo "  $(YELLOW)test$(NC)          - Run tests"
	@echo "  $(YELLOW)migrate$(NC)       - Run database migrations"
	@echo ""

# Build all services
.PHONY: build
build:
	@echo "$(BLUE)Building all services...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE) build

# Start all services
.PHONY: start
start:
	@echo "$(BLUE)Starting all services...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)Services started successfully!$(NC)"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:8080"
	@echo "Health check: http://localhost:8080/health"

# Stop all services
.PHONY: stop
stop:
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE) down

# Restart all services
.PHONY: restart
restart: stop start

# Show logs for all services
.PHONY: logs
logs:
	@echo "$(BLUE)Showing logs for all services...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE) logs -f

# Clean all services
.PHONY: clean
clean:
	@echo "$(BLUE)Cleaning all services...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE) down -v --remove-orphans

# Install backend dependencies
.PHONY: backend-deps
backend-deps:
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	cd $(BACKEND_DIR) && go mod tidy

# Install frontend dependencies
.PHONY: frontend-deps
frontend-deps:
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	cd $(FRONTEND_DIR) && npm install

# Run tests
.PHONY: test
test:
	@echo "$(BLUE)Running tests...$(NC)"
	cd $(BACKEND_DIR) && go test -v ./...

# Run database migrations
.PHONY: migrate
migrate:
	@echo "$(BLUE)Running database migrations...$(NC)"
	@echo "Migrations are automatically run when the backend starts"

# Initialize development environment
.PHONY: dev-init
dev-init: backend-deps frontend-deps
	@echo "$(GREEN)Development environment initialized!$(NC)"

# Run backend in development mode
.PHONY: dev-backend
dev-backend:
	@echo "$(BLUE)Starting backend in development mode...$(NC)"
	cd $(BACKEND_DIR) && go run cmd/api/main.go

# Run frontend in development mode
.PHONY: dev-frontend
dev-frontend:
	@echo "$(BLUE)Starting frontend in development mode...$(NC)"
	cd $(FRONTEND_DIR) && npm run dev

# Show status of services
.PHONY: status
status:
	@echo "$(BLUE)Checking service status...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE) ps

# Backup database
.PHONY: backup-db
backup-db:
	@echo "$(BLUE)Creating database backup...$(NC)"
	mkdir -p backups
	docker-compose -f $(DOCKER_COMPOSE) exec backend cp /app/data/payment.db ./backup-$(shell date +%Y%m%d-%H%M%S).db
	@echo "$(GREEN)Database backup created!$(NC)"

# Restore database
.PHONY: restore-db
restore-db:
	@echo "$(BLUE)Restoring database...$(NC)"
	@echo "$(YELLOW)Please provide backup file name:$(NC)"
	@read -p "Backup file: " backup_file; \
	if [ -f "$(BACKEND_DIR)/$$backup_file" ]; then \
		docker-compose -f $(DOCKER_COMPOSE) exec backend cp /app/data/payment.db /app/data/payment.db.backup; \
		docker-compose -f $(DOCKER_COMPOSE) exec backend cp ./$$backup_file /app/data/payment.db; \
		echo "$(GREEN)Database restored from $$backup_file!$(NC)"; \
	else \
		echo "$(RED)Backup file not found!$(NC)"; \
	fi

# Show system information
.PHONY: info
info:
	@echo "$(BLUE)System Information:$(NC)"
	@echo "Project: $(PROJECT_NAME)"
	@echo "Backend Directory: $(BACKEND_DIR)"
	@echo "Frontend Directory: $(FRONTEND_DIR)"
	@echo "Docker Compose File: $(DOCKER_COMPOSE)"
	@echo ""
	@echo "$(BLUE)Docker Information:$(NC)"
	@docker --version
	@docker-compose --version
	@echo ""
	@echo "$(BLUE)Go Information:$(NC)"
	@cd $(BACKEND_DIR) && go version
	@echo ""
	@echo "$(BLUE)Node.js Information:$(NC)"
	@cd $(FRONTEND_DIR) && node --version
	@cd $(FRONTEND_DIR) && npm --version