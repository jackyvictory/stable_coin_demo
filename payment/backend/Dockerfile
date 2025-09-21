# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev linux-headers git

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the binary with SQLite3 compatibility flags
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -tags sqlite_omit_load_extension -o bin/api ./cmd/api

# Final stage
FROM alpine:3.18

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Install curl for health checks
RUN apk --no-cache add curl

# Install wget for health checks
RUN apk --no-cache add wget

# Create app directory
WORKDIR /app

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Copy binary from builder stage
COPY --from=builder /app/bin/api .

# No deployment configurations needed in the image
# All configurations are managed externally in the deploy directory

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Run the binary
ENTRYPOINT ["./api"]