const {network , ethers} = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const {verify} = require("../utils/verify");
require("dotenv").config();

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");

module.exports = async ({getNamedAccounts , deployments}) => {
    const {deploy , log} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = network.config.chainId; 
    let vrfCoordinatorAddress , subscriptionId;
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorContract = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorAddress = vrfCoordinatorContract.address;
        const transactionResponse = await vrfCoordinatorContract.createSubscription();
        const transactionReceipt = await transactionResponse.wait();
        subscriptionId = transactionReceipt.events[0].args.subId;
        await vrfCoordinatorContract.fundSubscription(subscriptionId ,VRF_SUB_FUND_AMOUNT);
    }else{
        vrfCoordinatorAddress = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    const args = [
        vrfCoordinatorAddress,
        subscriptionId,
        gasLane,
        interval,
        entranceFee,
        callbackGasLimit,
    ]

    const raffle = await deploy("Raffle" , {
        from:deployer,
        args:args,
        log:true,
        waitConfirmations : network.config.blockConfiramtion || 1 ,
    })
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying ...");
        await verify(raffle.address , args);
        log("-------------------------------------------------------------------------------------------------------");
    }
}

module.exports.tags = ["all" , "raffle"];