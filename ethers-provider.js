const ethers = require('ethers');
const ganache = require('ganache-cli');

const provider = new ethers.providers.Web3Provider(ganache.provider({ gasLimit: 8000000 }));

module.exports = provider;
