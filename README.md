# TimeAlly Smart Contract Testing
Testing for the TimeAlly smart contract of Era Swap Ecosystem

## Steps
- Clone this git repo.
- `npm i`
- `npm run test`

If you make any changes to contract source code, then do `node compile.js`

## `mou()` time forwarding logic (for testing purpose)
This logic is written in `./contracts/Eraswap.sol` file from `line 24` to `line 44`. Instead of using `now` for getting the current timestamp, `mou()` is used, it returns offset timestamp. The offset can be changed by other methods. Eraswap contract is linked with other contracts and we can use a common time source.
### Methods
- `mou()`: This returns the offset timestamp (`uint256`).
- `goToFuture(uint256 _seconds)`: This method is used to increase the offset in seconds.
- `goToPast(uint256 _seconds)`: This method is used to decrease the offset in seconds.
- `setTimeMachineDepth(int256)`: This method replaces the offset(+/-) in seconds.
