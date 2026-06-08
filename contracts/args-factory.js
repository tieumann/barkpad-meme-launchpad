// Constructor args for the deployed TokenFactory.
// Order matches TokenFactory constructor:
// (owner, memeTokenImpl, bondingCurveImpl, treasury, reputation, locker,
//  identityGate, router, identityGatingEnabled)
module.exports = [
  "0x6440a649C0cbFd61Ea887A2253045BF7a47B95C8", // owner (deployer/admin)
  "0x0d36c54F72bFB2C512B9c822991a44D6F2ed895F", // memeTokenImpl
  "0x4C46794aC7DBb1E4BDd12bC202f2EeF0Ff1368e9", // bondingCurveImpl
  "0x041BaC779D3385Da285B75F4423534cf760581ee", // treasury
  "0x243D594f487F7BEF1CcD556c9Ee3236606d8789b", // reputation
  "0x3a11e9B4361D7D7781418C3aB3c470C861936B8f", // locker
  "0xA9b137Be7DAce8666AED652946419efbE932B90F", // identityGate
  "0x979a1fEBF5B85Ec8D22AF015cE03568307CCfEdD", // router (SimpleAMM)
  false, // identityGatingEnabled
];
