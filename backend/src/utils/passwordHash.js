const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const hashPassword = async (plain) => bcrypt.hash(plain, SALT_ROUNDS);
const verifyPassword = async (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { hashPassword, verifyPassword };
