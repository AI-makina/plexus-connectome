FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install native build dependencies for SQLite3
RUN apk add --no-cache python3 make g++ 

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create the persistent directory for the SQLite Connectome
# We will mount a Coolify Persistent Volume to this exact path
RUN mkdir -p /app/plexus-integration

# Expose the API port
EXPOSE 3200

# Start the Express server
CMD ["node", "server.js"]
