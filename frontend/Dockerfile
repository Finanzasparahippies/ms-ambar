FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "dev"]
