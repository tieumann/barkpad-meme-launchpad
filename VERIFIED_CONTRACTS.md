# Verified Contracts — OPN Testnet (Chain 984)

All 13 Barkpad contracts are **verified** on the OPN Chain testnet block explorer
(Blockscout) at https://testnet.iopn.tech. Click any address to view source.

Explorer base: `https://testnet.iopn.tech/address/<address>#code`

## Core infrastructure (10)

| Contract | Address | Explorer |
|---|---|---|
| TokenFactory | `0x4773a2C6ba5BDEf290cC8C2a32581bd758B92d8E` | [code](https://testnet.iopn.tech/address/0x4773a2C6ba5BDEf290cC8C2a32581bd758B92d8E#code) |
| MemeToken (impl) | `0x0d36c54F72bFB2C512B9c822991a44D6F2ed895F` | [code](https://testnet.iopn.tech/address/0x0d36c54F72bFB2C512B9c822991a44D6F2ed895F#code) |
| BondingCurve (impl) | `0x4C46794aC7DBb1E4BDd12bC202f2EeF0Ff1368e9` | [code](https://testnet.iopn.tech/address/0x4C46794aC7DBb1E4BDd12bC202f2EeF0Ff1368e9#code) |
| Treasury | `0x041BaC779D3385Da285B75F4423534cf760581ee` | [code](https://testnet.iopn.tech/address/0x041BaC779D3385Da285B75F4423534cf760581ee#code) |
| ReputationRegistry | `0x243D594f487F7BEF1CcD556c9Ee3236606d8789b` | [code](https://testnet.iopn.tech/address/0x243D594f487F7BEF1CcD556c9Ee3236606d8789b#code) |
| LiquidityLocker | `0x3a11e9B4361D7D7781418C3aB3c470C861936B8f` | [code](https://testnet.iopn.tech/address/0x3a11e9B4361D7D7781418C3aB3c470C861936B8f#code) |
| IdentityGate | `0xA9b137Be7DAce8666AED652946419efbE932B90F` | [code](https://testnet.iopn.tech/address/0xA9b137Be7DAce8666AED652946419efbE932B90F#code) |
| SimpleAMM | `0x979a1fEBF5B85Ec8D22AF015cE03568307CCfEdD` | [code](https://testnet.iopn.tech/address/0x979a1fEBF5B85Ec8D22AF015cE03568307CCfEdD#code) |
| StakingFactory | `0xd04115002cD232d2273Cc5d55c06880D3A6affB8` | [code](https://testnet.iopn.tech/address/0xd04115002cD232d2273Cc5d55c06880D3A6affB8#code) |
| AirdropFactory | `0xbEF3B28a65E3A38e3B759ffEA8Ca2DA62e30443E` | [code](https://testnet.iopn.tech/address/0xbEF3B28a65E3A38e3B759ffEA8Ca2DA62e30443E#code) |

## DogOn project suite (3)

| Contract | Address | Explorer |
|---|---|---|
| DogOn ($DOGON) | `0xe30711D1D9fbdF478E746A13281E209b15a46A3C` | [code](https://testnet.iopn.tech/address/0xe30711D1D9fbdF478E746A13281E209b15a46A3C#code) |
| Presale | `0xd37778ED6EF9D3cF8D03F5711636Baa240175CA9` | [code](https://testnet.iopn.tech/address/0xd37778ED6EF9D3cF8D03F5711636Baa240175CA9#code) |
| QuestRewards | `0x5408e25Dc84879F31A011d989cB172483a1BaC5b` | [code](https://testnet.iopn.tech/address/0x5408e25Dc84879F31A011d989cB172483a1BaC5b#code) |

## How verification was done

The explorer is Blockscout. Hardhat is configured (`hardhat.config.ts`) with a
`customChains` entry pointing at `https://testnet.iopn.tech/api`. Verify with:

```bash
npx hardhat verify --network opnTestnet <address> [constructorArgs...]
# or for contracts with complex args:
npx hardhat verify --network opnTestnet --constructor-args args-factory.js <address>
```
