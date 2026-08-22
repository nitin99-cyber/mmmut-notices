FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

# Switch to root to install dependencies
USER root
COPY package*.json ./
RUN npm install

# Copy application code
COPY index.js ./

# Create a directory for session data and ensure permissions
RUN mkdir -p /app/.wwebjs_auth && chown -R pptruser:pptruser /app

# Switch back to the non-root user provided by the puppeteer image
USER pptruser

EXPOSE 2785

CMD ["node", "index.js"]
