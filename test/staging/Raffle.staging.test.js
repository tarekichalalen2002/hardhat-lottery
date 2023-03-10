const {ethers , network , getNamedAccounts , deployments} = require("hardhat");
const {assert , expect} = require("chai");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name) ? describe.skip : (
    describe("Raffle" , () => {
        let raffle , vrfCoordinatorV2 , entranceFee , deployer ;
        beforeEach(async () => {
            deployer  =(await getNamedAccounts()).deployer;
            await deployments.fixture("all");
            raffle = await ethers.getContract("Raffle" , deployer);
            entranceFee = await raffle.getEntranceFee();
        })
        describe("fulfillRandomWords" , () => {
            it("works with live Chainlink Keepers and Chainlink VRF , we get a random winner" , async () => {
                const startingTimeStamp = await raffle.getLastTimeStamp();
                const accounts = await ethers.getSigners();
                await new Promise( async (resolve , reject) => {
                    raffle.once("WinnerPicked" , async () => {
                        console.log("WinnerPicked event fired !");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            const raffleState = await raffle.getRaffleState();
                            const winnerEndingBalance = await accounts[0].getBalance();
                            const endingTimeStamp = await raffle.getLastTimeStamp();
                            await expect(raffle.getPlayer(0)).to.be.reverted;
                            assert.equal(recentWinner.toString() , accounts[0].address)
                            assert.equal(raffleState.toString() , "0");
                            resolve();
                        } catch (e) {
                            reject(e)
                        }
                    })
                })
                await raffle.enterRaffle({value:entranceFee});
                const winnerStartingBalance = await accounts[0].getBalance();
            })
        })
    })
)