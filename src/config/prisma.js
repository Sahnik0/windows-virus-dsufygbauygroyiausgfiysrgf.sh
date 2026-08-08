// Import PrismaClient constructor from Prisma ORM library
const { PrismaClient } = require('@prisma/client');

// Create a single shared PrismaClient instance to manage database connection pooling efficiently
const prisma = new PrismaClient();

// Export the singleton Prisma instance for use in services across the app
module.exports = prisma;
