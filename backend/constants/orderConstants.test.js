const test = require('node:test');
const assert = require('node:assert/strict');

const {
    VALID_ORDER_STATUSES,
    VALID_TRANSITIONS,
    VALID_ACTORS
} = require('./orderConstants');

test('valid order statuses contain all supported lifecycle states', () => {
    assert.deepEqual(VALID_ORDER_STATUSES, [
        'Pending',
        'Accepted',
        'Preparing',
        'Ready for Pickup',
        'Out for Delivery',
        'Delivered',
        'Cancelled'
    ]);
});

test('valid actors contain all supported order lifecycle actors', () => {
    assert.deepEqual(VALID_ACTORS, [
        'SELLER',
        'RIDER',
        'SYSTEM',
        'ADMIN'
    ]);
});

test('Pending allows Accepted and Cancelled', () => {
    assert.deepEqual(
        VALID_TRANSITIONS.Pending,
        ['Accepted', 'Cancelled']
    );
});

test('Accepted allows Preparing and Cancelled', () => {
    assert.deepEqual(
        VALID_TRANSITIONS.Accepted,
        ['Preparing', 'Cancelled']
    );
});

test('Preparing allows Ready for Pickup and Cancelled', () => {
    assert.deepEqual(
        VALID_TRANSITIONS.Preparing,
        ['Ready for Pickup', 'Cancelled']
    );
});

test('Ready for Pickup has no direct transition', () => {
    assert.deepEqual(
        VALID_TRANSITIONS['Ready for Pickup'],
        []
    );
});

test('Out for Delivery allows only Delivered', () => {
    assert.deepEqual(
        VALID_TRANSITIONS['Out for Delivery'],
        ['Delivered']
    );
});

test('Delivered is terminal', () => {
    assert.deepEqual(
        VALID_TRANSITIONS.Delivered,
        []
    );
});

test('Cancelled is terminal', () => {
    assert.deepEqual(
        VALID_TRANSITIONS.Cancelled,
        []
    );
});