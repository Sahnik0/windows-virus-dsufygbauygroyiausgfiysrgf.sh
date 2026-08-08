const { PrismaClient } = require('@prisma/client');

// PrismaClient singleton instance across application
const prisma = new PrismaClient();

module.exports = prisma;
