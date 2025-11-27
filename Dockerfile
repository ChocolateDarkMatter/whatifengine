# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port 3015 (matches vite.config.ts)
EXPOSE 3015

# Start development server
CMD ["npm", "run", "dev"]
