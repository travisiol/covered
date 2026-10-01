// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IPonsFeeEscrow {
    function balanceOf(address account) external view returns (uint256);
    function claim() external;
}

interface IPonsFactory {
    function transferCreatorFeeRecipient(address token, address newRecipient) external;
    function executeCreatorFeeRecipientChange(address token) external;
    function cancelCreatorFeeRecipientChange(address token) external;
}

interface ICoveredRouter {
    function fulfiller() external view returns (address);
    function treasury() external view returns (address);
    function ponsEscrow() external view returns (address);
    function ponsFactory() external view returns (address);
}

/// @title Tab
/// @notice One per creator. It stands in as `creatorFeeRecipient` on pons, so
/// every creator fee the creator's coins earn lands here. The creator spends
/// the balance on gift cards (one-off, or a plan charged every period) or
/// withdraws it as ETH. Nobody else can move the balance: the fulfiller can
/// only charge a plan the creator set, inside the limits the creator set, and
/// is only paid once it marks the order fulfilled.
contract Tab {
    enum Status {
        None,
        Open,
        Fulfilled,
        Refunded
    }

    struct Order {
        bytes32 sku;
        uint32 usdCents;
        uint64 createdAt;
        Status status;
        bool recurring;
        uint256 weiAmount;
    }

    struct Plan {
        uint32 usdCents;
        uint32 periodDays;
        uint64 nextDue;
        bool active;
        uint256 maxWei;
    }

    /// An open order the fulfiller has not delivered can be refunded by the
    /// creator after this delay.
    uint256 public constant REFUND_DELAY = 48 hours;
    uint256 public constant MAX_SEALED = 512;

    bytes32 public constant QUOTE_TYPEHASH =
        keccak256("Quote(address tab,bytes32 sku,uint32 usdCents,uint256 weiAmount,uint256 expiry,uint256 nonce)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    address public creator;
    ICoveredRouter public router;

    /// Wei held by open orders; not spendable, not withdrawable.
    uint256 public locked;
    /// Everything this tab has ever pulled from the pons escrow.
    uint256 public totalPulled;

    Order[] private _orders;
    mapping(bytes32 sku => Plan) public plans;
    bytes32[] private _planSkus;
    mapping(bytes32 sku => bool) private _planKnown;
    mapping(uint256 nonce => bool) public nonceUsed;
    /// Encrypted card code of each delivered order.
    mapping(uint256 id => bytes) public sealedCard;
    /// Encrypted delivery contact of the creator.
    bytes public contact;

    uint256 private _entered;

    event Pulled(uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Ordered(uint256 indexed id, bytes32 indexed sku, uint32 usdCents, uint256 weiAmount, bool recurring);
    event Fulfilled(uint256 indexed id);
    event ContactSet();
    event Refunded(uint256 indexed id);
    event PlanSet(bytes32 indexed sku, uint32 usdCents, uint32 periodDays, uint256 maxWei);
    event PlanCancelled(bytes32 indexed sku);

    error AlreadyInitialized();
    error NotCreator();
    error NotFulfiller();
    error InsufficientBalance(uint256 available, uint256 needed);
    error QuoteExpired();
    error QuoteReused();
    error BadQuoteSignature();
    error BadPlan();
    error PlanInactive();
    error PlanNotDue(uint64 nextDue);
    error AboveMaxWei(uint256 maxWei);
    error OrderNotOpen();
    error RefundTooEarly(uint256 availableAt);
    error TransferFailed();
    error Reentrancy();
    error TooLong();

    modifier onlyCreator() {
        if (msg.sender != creator) revert NotCreator();
        _;
    }

    modifier onlyFulfiller() {
        if (msg.sender != router.fulfiller()) revert NotFulfiller();
        _;
    }

    modifier nonReentrant() {
        if (_entered == 1) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function initialize(address creator_) external {
        if (address(router) != address(0)) revert AlreadyInitialized();
        router = ICoveredRouter(msg.sender);
        creator = creator_;
    }

    receive() external payable {}

    // ------------------------------------------------------------- balance

    /// @notice Spendable balance already sitting in the tab.
    function available() public view returns (uint256) {
        return address(this).balance - locked;
    }

    /// @notice Creator fees swept to the pons escrow and not pulled yet.
    function pendingInEscrow() public view returns (uint256) {
        return IPonsFeeEscrow(router.ponsEscrow()).balanceOf(address(this));
    }

    /// @notice Pull this tab's creator fees out of the pons escrow. Open to
    /// anyone: it can only move money into the tab.
    function pull() public nonReentrant returns (uint256 amount) {
        IPonsFeeEscrow escrow = IPonsFeeEscrow(router.ponsEscrow());
        if (escrow.balanceOf(address(this)) == 0) return 0;
        uint256 before = address(this).balance;
        escrow.claim();
        amount = address(this).balance - before;
        totalPulled += amount;
        emit Pulled(amount);
    }

    /// @notice Take the balance out as ETH instead of spending it.
    function withdraw(address to, uint256 amount) external onlyCreator nonReentrant {
        uint256 free = available();
        if (amount > free) revert InsufficientBalance(free, amount);
        _send(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Point a coin's creator fees somewhere else. pons only lets the
    /// current recipient (this tab) move them, and applies its own timelock
    /// (3 days on mainnet) before the change can be executed.
    function redirectFees(address token, address newRecipient) external onlyCreator {
        IPonsFactory(router.ponsFactory()).transferCreatorFeeRecipient(token, newRecipient);
    }

    function executeRedirect(address token) external onlyCreator {
        IPonsFactory(router.ponsFactory()).executeCreatorFeeRecipientChange(token);
    }

    function cancelRedirect(address token) external onlyCreator {
        IPonsFactory(router.ponsFactory()).cancelCreatorFeeRecipientChange(token);
    }

    // -------------------------------------------------------------- orders

    /// @notice Buy one gift card at a price the fulfiller quoted and signed.
    /// The wei stays locked in the tab until the card is delivered.
    function redeem(
        bytes32 sku,
        uint32 usdCents,
        uint256 weiAmount,
        uint256 expiry,
        uint256 nonce,
        bytes calldata signature
    ) external onlyCreator returns (uint256 id) {
        if (block.timestamp > expiry) revert QuoteExpired();
        if (nonceUsed[nonce]) revert QuoteReused();
        bytes32 structHash = keccak256(abi.encode(QUOTE_TYPEHASH, address(this), sku, usdCents, weiAmount, expiry, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
        if (ECDSA.recover(digest, signature) != router.fulfiller()) revert BadQuoteSignature();
        nonceUsed[nonce] = true;
        id = _open(sku, usdCents, weiAmount, false);
    }

    /// @notice Have a card bought automatically as soon as the balance covers
    /// it: every `periodDays`, or once if `periodDays` is 0. `maxWei` caps what
    /// one charge may lock, whatever the ETH price does.
    function setPlan(bytes32 sku, uint32 usdCents, uint32 periodDays, uint256 maxWei) external onlyCreator {
        _setPlan(sku, usdCents, periodDays, maxWei);
    }

    /// @notice Several plans in one transaction. The router may call it, but
    /// only from `setup`, which acts on the caller's own tab.
    function setPlans(
        bytes32[] calldata skus,
        uint32[] calldata usdCents,
        uint32[] calldata periodDays,
        uint256[] calldata maxWei
    ) external {
        if (msg.sender != creator && msg.sender != address(router)) revert NotCreator();
        if (skus.length != usdCents.length || skus.length != periodDays.length || skus.length != maxWei.length) revert BadPlan();
        for (uint256 i; i < skus.length; ++i) _setPlan(skus[i], usdCents[i], periodDays[i], maxWei[i]);
    }

    function _setPlan(bytes32 sku, uint32 usdCents, uint32 periodDays, uint256 maxWei) private {
        if (usdCents == 0 || maxWei == 0) revert BadPlan();
        Plan storage p = plans[sku];
        uint64 nextDue = p.active ? p.nextDue : uint64(block.timestamp);
        plans[sku] = Plan(usdCents, periodDays, nextDue, true, maxWei);
        if (!_planKnown[sku]) {
            _planKnown[sku] = true;
            _planSkus.push(sku);
        }
        emit PlanSet(sku, usdCents, periodDays, maxWei);
    }

    function cancelPlan(bytes32 sku) external onlyCreator {
        plans[sku].active = false;
        emit PlanCancelled(sku);
    }

    /// @notice The fulfiller charges a due plan. Pulls the escrow first so a
    /// plan is paid from fees that were swept but not collected yet.
    function charge(bytes32 sku, uint256 weiAmount) external onlyFulfiller returns (uint256 id) {
        Plan storage p = plans[sku];
        if (!p.active) revert PlanInactive();
        if (block.timestamp < p.nextDue) revert PlanNotDue(p.nextDue);
        if (weiAmount > p.maxWei) revert AboveMaxWei(p.maxWei);
        pull();
        if (p.periodDays == 0) p.active = false;
        else p.nextDue = uint64(block.timestamp + uint256(p.periodDays) * 1 days);
        id = _open(sku, p.usdCents, weiAmount, true);
    }

    /// @notice The card was delivered: keep its code, encrypted, with the order
    /// and release the locked wei to the treasury. `sealedCode` is ciphertext:
    /// the chain is the only place the code is stored.
    function fulfill(uint256 id, bytes calldata sealedCode) external onlyFulfiller nonReentrant {
        if (sealedCode.length > MAX_SEALED) revert TooLong();
        Order storage o = _orders[id];
        if (o.status != Status.Open) revert OrderNotOpen();
        o.status = Status.Fulfilled;
        locked -= o.weiAmount;
        sealedCard[id] = sealedCode;
        _send(router.treasury(), o.weiAmount);
        emit Fulfilled(id);
    }

    /// @notice Where the creator wants cards sent (an e-mail), encrypted by the
    /// service before it gets here. Empty clears it.
    function setContact(bytes calldata sealedContact) external {
        if (msg.sender != creator && msg.sender != address(router)) revert NotCreator();
        if (sealedContact.length > MAX_SEALED) revert TooLong();
        contact = sealedContact;
        emit ContactSet();
    }

    /// @notice Unlock an undelivered order. The fulfiller can do it at any
    /// time, the creator once REFUND_DELAY has passed.
    function refund(uint256 id) external {
        Order storage o = _orders[id];
        if (o.status != Status.Open) revert OrderNotOpen();
        if (msg.sender == creator) {
            uint256 at = uint256(o.createdAt) + REFUND_DELAY;
            if (block.timestamp < at) revert RefundTooEarly(at);
        } else if (msg.sender != router.fulfiller()) {
            revert NotCreator();
        }
        o.status = Status.Refunded;
        locked -= o.weiAmount;
        emit Refunded(id);
    }

    // --------------------------------------------------------------- views

    function orderCount() external view returns (uint256) {
        return _orders.length;
    }

    function orders(uint256 id) external view returns (Order memory) {
        return _orders[id];
    }

    function allOrders() external view returns (Order[] memory) {
        return _orders;
    }

    function planSkus() external view returns (bytes32[] memory) {
        return _planSkus;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("Covered"), keccak256("1"), block.chainid, address(this))
        );
    }

    // ------------------------------------------------------------ internal

    function _open(bytes32 sku, uint32 usdCents, uint256 weiAmount, bool recurring) private returns (uint256 id) {
        uint256 free = available();
        if (weiAmount > free) revert InsufficientBalance(free, weiAmount);
        locked += weiAmount;
        id = _orders.length;
        _orders.push(Order(sku, usdCents, uint64(block.timestamp), Status.Open, recurring, weiAmount));
        emit Ordered(id, sku, usdCents, weiAmount, recurring);
    }

    function _send(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
