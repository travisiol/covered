// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Same surface as the pons fee escrow (credit / balanceOf / claim).
contract MockEscrow {
    mapping(address => uint256) public balanceOf;

    event Claimed(address indexed account, uint256 amount);

    function credit(address account) external payable {
        balanceOf[account] += msg.value;
    }

    function claim() external {
        uint256 amount = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send");
        emit Claimed(msg.sender, amount);
    }
}

contract MockPonsFactory {
    mapping(address token => address recipient) public recipientOf;
    mapping(address token => address recipient) public pendingOf;

    function transferCreatorFeeRecipient(address token, address newRecipient) external {
        pendingOf[token] = newRecipient;
    }

    function executeCreatorFeeRecipientChange(address token) external {
        recipientOf[token] = pendingOf[token];
        delete pendingOf[token];
    }

    function cancelCreatorFeeRecipientChange(address token) external {
        delete pendingOf[token];
    }
}

/// A treasury that refuses ETH, to prove a failed payout cannot lose an order.
contract RejectingTreasury {
    receive() external payable {
        revert("no");
    }
}
