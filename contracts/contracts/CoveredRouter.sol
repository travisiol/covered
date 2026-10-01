// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Tab} from "./Tab.sol";

/// @title CoveredRouter
/// @notice Gives every creator one deterministic Tab address. The address is
/// known before the tab exists, so a coin can be launched on pons with its
/// creator fees pointed at it straight away; the tab is deployed the first
/// time somebody pulls or opens it.
contract CoveredRouter is Ownable2Step {
    address public immutable tabImplementation;
    address public immutable ponsEscrow;
    address public immutable ponsFactory;

    /// Signs gift card quotes, charges plans, marks orders fulfilled.
    address public fulfiller;
    /// Receives the wei of fulfilled orders.
    address public treasury;

    address[] public creators;
    mapping(address tab => address creator) public creatorOf;

    event TabOpened(address indexed creator, address tab);
    event FulfillerSet(address fulfiller);
    event TreasurySet(address treasury);

    error ZeroAddress();

    constructor(
        address owner_,
        address ponsEscrow_,
        address ponsFactory_,
        address fulfiller_,
        address treasury_
    ) Ownable(owner_) {
        if (ponsEscrow_ == address(0) || fulfiller_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        tabImplementation = address(new Tab());
        ponsEscrow = ponsEscrow_;
        ponsFactory = ponsFactory_;
        fulfiller = fulfiller_;
        treasury = treasury_;
    }

    /// @notice The tab address of a creator, deployed or not.
    function predictTab(address creator) public view returns (address) {
        return Clones.predictDeterministicAddress(tabImplementation, _salt(creator), address(this));
    }

    function isOpen(address creator) public view returns (bool) {
        return predictTab(creator).code.length != 0;
    }

    /// @notice Deploy a creator's tab. Anyone can; it does nothing if it exists.
    function openTab(address creator) public returns (address tab) {
        if (creator == address(0)) revert ZeroAddress();
        tab = predictTab(creator);
        if (tab.code.length != 0) return tab;
        Clones.cloneDeterministic(tabImplementation, _salt(creator));
        Tab(payable(tab)).initialize(creator);
        creatorOf[tab] = creator;
        creators.push(creator);
        emit TabOpened(creator, tab);
    }

    /// @notice Open (if needed) and pull the escrow for a batch of creators.
    function pullMany(address[] calldata list) external {
        for (uint256 i; i < list.length; ++i) {
            Tab(payable(openTab(list[i]))).pull();
        }
    }

    /// @notice Open the caller's tab, set what it should buy and, if given,
    /// where to send the cards, in one transaction.
    function setup(
        bytes32[] calldata skus,
        uint32[] calldata usdCents,
        uint32[] calldata periodDays,
        uint256[] calldata maxWei,
        bytes calldata sealedContact
    ) external returns (address tab) {
        tab = openTab(msg.sender);
        if (skus.length != 0) Tab(payable(tab)).setPlans(skus, usdCents, periodDays, maxWei);
        if (sealedContact.length != 0) Tab(payable(tab)).setContact(sealedContact);
    }

    function creatorCount() external view returns (uint256) {
        return creators.length;
    }

    function setFulfiller(address fulfiller_) external onlyOwner {
        if (fulfiller_ == address(0)) revert ZeroAddress();
        fulfiller = fulfiller_;
        emit FulfillerSet(fulfiller_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function _salt(address creator) private pure returns (bytes32) {
        return bytes32(uint256(uint160(creator)));
    }
}
