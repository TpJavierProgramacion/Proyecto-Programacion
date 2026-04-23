# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copiar solo los archivos de dependencias PRIMERO (cache layer)
COPY package.json package-lock.json* ./

# Instalar con ci para builds limpios y rápidos
RUN npm ci --prefer-offline --no-audit

# Copiar el resto del código
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]