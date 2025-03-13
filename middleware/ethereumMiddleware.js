const ethers = require('ethers');
require('dotenv').config();

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const { abi } = require('../artifacts/contracts/contractAPI.sol/UserSignup.json');

const ethereumMiddleware = (req, res, next) => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(API_URL);
        const signer = new ethers.Wallet(PRIVATE_KEY, provider);
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

        req.contractInstance = contractInstance; // Attach the contract instance to the request object
        console.log("Contract instance set up successfully:", contractInstance.address);
        next();
    } catch (error) {
        console.error("Error setting up Ethereum middleware:", error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports = ethereumMiddleware;