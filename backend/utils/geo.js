const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => degrees * Math.PI / 180;

const getDistanceMeters = (latitude1, longitude1, latitude2, longitude2) => {
    const dLatitude = toRadians(latitude2 - latitude1);
    const dLongitude = toRadians(longitude2 - longitude1);

    const latitude1Radians = toRadians(latitude1);
    const latitude2Radians = toRadians(latitude2);

    const a =
        Math.sin(dLatitude / 2) * Math.sin(dLatitude / 2) +
        Math.cos(latitude1Radians) *
        Math.cos(latitude2Radians) *
        Math.sin(dLongitude / 2) *
        Math.sin(dLongitude / 2);

    return EARTH_RADIUS_METERS * 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );
};

module.exports = {
    getDistanceMeters
};