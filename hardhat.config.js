require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;

module.exports = {
  solidity: "0.8.18",
  defaultNetwork : "hardhat",
  networks: {
    hardhat:{
      chainId:31337,
      blockConfirmation : 1,
    },
    goerli: {
      url:GOERLI_RPC_URL,
      accounts:[PRIVATE_KEY],
      chainId:5,
      blockConfirmation:6,
    },
  },
  namedAccounts :{
    deployer :  {
      default : 0
    },
    player: {
      default : 1
    }
  },
  gasReporter:{
    enabled: true,
    currency: "USD",
    outputFile:"gas-report.txt",
    noColors : true,
  },
  etherscan:{
    apiKey:{
      goerli:ETHERSCAN_API_KEY
    }
  },
  mocha:{
    timeout:200000 //200 seconds
  }
};
