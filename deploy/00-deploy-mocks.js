const { ethers } = require("ethers");
const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25");
const GAS_PRICE_LINK = 1e9;

module.exports = async ({getNamedAccounts , deployments}) => {
    const {deploy , log } = deployments;
    const { deployer } = await getNamedAccounts();
    const args = [BASE_FEE , GAS_PRICE_LINK];
    if (developmentChains.includes(network.name)) {
        log("Local network detected ! deploying mocks ...");
        const mock = await deploy("VRFCoordinatorV2Mock" , {
            from:deployer,
            args:args,
            log:true,
            waitConfirmations : network.config.blockConfirmation || 1 ,
        })
        log("Mock deployed");
    }
}
module.exports.tags = ["all" , "mocks"];