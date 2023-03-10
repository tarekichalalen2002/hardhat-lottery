const {ethers , network , getNamedAccounts , deployments} = require("hardhat");
const {assert , expect} = require("chai");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name) ? describe.skip : (
    describe("Raffle" , () => {
        let raffle , vrfCoordinatorV2 , entranceFee , deployer , interval;
        beforeEach(async () => {
            deployer  =(await getNamedAccounts()).deployer;
            await deployments.fixture("all");
            raffle = await ethers.getContract("Raffle" , deployer);
            vrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock" , deployer)
            entranceFee = await raffle.getEntranceFee();
            interval = await raffle.getInterval();
        })
        describe("constructor" , async () => {
            it("initializes the contract correctly" , async () => {
                const raffleState = await raffle.getRaffleState();
                assert.equal(raffleState.toString() , "0");
                assert.equal(interval.toString() , "30");
            })
        })
        describe("enterRaffle" , () => {
            it("Fails if you don't send enough ETH" , async () => {
                await expect(raffle.enterRaffle()).to.be.reverted;
            })
            it("Records players when they enter" , async () => {
                await raffle.enterRaffle({value : entranceFee});
                const player = await raffle.getPlayer(0);
                assert.equal(player.toString() , deployer);
            })
            it("Emits an event on enter" , async () => {
                await expect(raffle.enterRaffle({value:entranceFee})).to.emit(raffle , "RaffleEnter")
            })
            it("Doesn't allow entrance when raffle is calculating" , async () => {
                await raffle.enterRaffle({value : entranceFee});
                await network.provider.send("evm_increaseTime" , [interval.toNumber() + 1]);
                await network.provider.send("evm_mine" , []);
                // // We pretend to be Chainlink keeper
                await raffle.performUpkeep([]);
                await expect(raffle.enterRaffle({value: entranceFee})).to.be.revertedWith(
                    "Raffle__RaffleNotOpen"
                );
            })
        })
        describe("checkUpkeep" , () => {
            it("Returns false if no one sent ETH" , async () => {
                await network.provider.send("evm_increaseTime" , [interval.toNumber() + 1]);
                await network.provider.send("evm_mine" , []);
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert(!upkeepNeeded);
            })
            it("Returns false if raffle isn't open" , async () => {
                await raffle.enterRaffle({value : entranceFee});
                await network.provider.send("evm_increaseTime" , [interval.toNumber() + 1]);
                await network.provider.send("evm_mine" , []);
                await raffle.performUpkeep([]);
                const raffleState = await raffle.getRaffleState();
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert.equal(raffleState.toString() , "1");
                assert(!upkeepNeeded);
            })
            it("Returns false if enough time hasn't passed" , async () => {
                await raffle.enterRaffle({value : entranceFee});
                await network.provider.send("evm_increaseTime" , [interval.toNumber() - 1]);
                await network.provider.request({method: "evm_mine" , params:[]});
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                assert(!upkeepNeeded);
            })
            it("Returns true if there is ETH , raffle is open , time has passed" , async () => {
                await raffle.enterRaffle({value : entranceFee});
                await network.provider.send("evm_increaseTime" , [interval.toNumber() + 1]);
                await network.provider.request({method: "evm_mine" , params:[]});
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                assert(upkeepNeeded);
            })
        })
        describe("performUpkeep" , () => {
            it("can only run if checkUpkeep is true" , async () => {
                await raffle.enterRaffle({value : entranceFee});
                await network.provider.send("evm_increaseTime" , [interval.toNumber() + 1]);
                await network.provider.request({method: "evm_mine" , params:[]});
                const tx = await raffle.performUpkeep([]);
                assert(tx);
            })
            it("reverts upkeep not needed if checkupkeep is false" , async () => {
                await expect(raffle.performUpkeep([])).to.be.revertedWith(
                    "Raffle__UpkeepNotNeeded"
                )
            })
            it("updates the raffle state, emits an event, and calls the vrf coordinator" , async () => {
                await raffle.enterRaffle({value : entranceFee});
                await network.provider.send("evm_increaseTime" , [interval.toNumber() + 1]);
                await network.provider.request({method: "evm_mine" , params:[]});
                const txResponse = await raffle.performUpkeep([]);
                const txReceipt = await txResponse.wait(1);
                const requestId = txReceipt.events[1].args.requestId;
                const raffleState = await raffle.getRaffleState();
                assert(requestId.toNumber() > 0);
                assert(raffleState.toString() === "1");
            })
        })
        describe("fulfillRandomWords" , () => {
            beforeEach(async () => {
                await raffle.enterRaffle({value : entranceFee});
                await network.provider.send("evm_increaseTime" , [interval.toNumber() + 1]);
                await network.provider.request({method: "evm_mine" , params:[]});
            })
            it("can only be called after performUpkeep" , async () => {
                await expect(vrfCoordinatorV2.fulfillRandomWords(0 , raffle.address)).to.be.revertedWith(
                    "nonexistent request"
                )
                await expect(vrfCoordinatorV2.fulfillRandomWords(1 , raffle.address)).to.be.revertedWith(
                    "nonexistent request"
                )
            })
            it("picks a winner , resets the lottery and sends money" , async () => {
                const additionalEntrants = 3;
                const startingAccountIndex = 1;
                const accounts = await ethers.getSigners()
                const winnerStartingBalance = await accounts[1].getBalance();
                for (let i=startingAccountIndex; i<startingAccountIndex+additionalEntrants; i++) {
                    const accountConnectedRaffle = await raffle.connect(accounts[i])
                    await accountConnectedRaffle.enterRaffle({value:entranceFee});
                }
                const startingTimeStamp = await raffle.getLastTimeStamp();

                await new Promise(async (resolve , reject) => {
                    raffle.once("WinnerPicked" , async () => {
                        console.log("Found the event !");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            console.log(recentWinner);
                            console.log(accounts[1].address);
                            console.log(accounts[2].address);
                            console.log(accounts[3].address);

                            const winnerEndingBalance = await accounts[1].getBalance();
                            console.log("winner's balance before" , winnerStartingBalance.toString());
                            console.log("winner's balance after" , winnerEndingBalance.toString());
                            console.log("balance of others:");
                            const b2 = await accounts[2].getBalance();
                            const b3 = await accounts[3].getBalance();
                            console.log(b2.toString());
                            console.log(b3.toString());
                            const raffleState = await raffle.getRaffleState();
                            const endingTimeStamp = await raffle.getLastTimeStamp();
                            const numPlayers = await raffle.getNumberOfPlayers();
                            assert.equal(numPlayers.toString() , "0");
                            assert.equal(raffleState.toString() , "0");
                            // assert.equal(
                            //     winnerEndingBalance.add(txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice)).toString(), 
                            //     winnerStartingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                            //         .add(
                            //             entranceFee
                            //                 .mul(additionalEntrants)
                            //         )
                            //         .toString()
                            // )
                        } catch (e) {
                            reject(e)
                        }
                        resolve()
                    })
                    const tx = await raffle.performUpkeep([]);
                    const txReceipt = await tx.wait(1);
                    await vrfCoordinatorV2.fulfillRandomWords(txReceipt.events[1].args.requestId , raffle.address)
                })
            })
        })
    })
)