const VALID_ORDER_STATUSES = ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Cancelled'];
const VALID_ACTORS = ['SELLER', 'RIDER', 'SYSTEM', 'ADMIN'];

const VALID_TRANSITIONS = {
    'Pending': ['Accepted', 'Cancelled'],
    'Accepted': ['Preparing', 'Cancelled'],
    'Preparing': ['Ready for Pickup', 'Cancelled'],
    'Ready for Pickup': ['Out for Delivery'],
    'Out for Delivery': ['Delivered'],
    'Delivered': [],
    'Cancelled': []
};

module.exports = {
    VALID_ORDER_STATUSES,
    VALID_TRANSITIONS,
    VALID_ACTORS
};
