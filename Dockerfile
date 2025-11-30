FROM node:20

WORKDIR /app

# Copia package files
COPY package*.json ./
COPY client/package*.json ./client/

# Installa dipendenze
RUN npm install
RUN cd client && npm install --include=dev

# Copia tutto il codice
COPY . .

# Build client
RUN npm run client:build

# Esponi porta
EXPOSE 3000

# Avvia server
CMD ["npm", "start"]

